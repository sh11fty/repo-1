import { normText, tokenize, numbersIn, sentencesOf, looksLikeInjection, leaksSecret } from './util.js';
import { validateCitation, extractStandardRefs, extractParagraphRefs } from './citation.js';
import { checkCalculation } from './calc.js';

export const CLAIM_TYPES = ['source_statement', 'explanation', 'inference', 'application', 'illustration', 'calculation'];
const NEG = /\b(not|no|never|cannot|can't|neither|nor|none|without)\b|n't\b/i;
const ABS = /\b(always|never|only|must|all|every|any|none|cannot|required|prohibited|forbidden)\b/gi;
const QUALIFIER = /\b(unless|except|provided that|however|only if|subject to|but not|other than|whereas)\b/i;
const ENDORSE = /(official(ly)?\s+(ACCA|marking|mark scheme|answer|solution)|ACCA[- ](approved|endorsed|official|verified)|examiner'?s?[- ](own )?(mark|marking)|ACCA mark scheme|officially (marked|examinable))/i;

/** Deterministic, model-free verification. Any critical or major finding rejects the answer. */
export function verifyDeterministic(answer, ctx) {
  const { corpus, registry, session, scenarioText = '', evidenceChunks = [], policy = {} } = ctx;
  const findings = [];
  const add = (code, severity, claimId, message) => findings.push({ code, severity, claimId: claimId ?? null, message });

  if (!answer || !Array.isArray(answer.claims) || answer.claims.length === 0) {
    add('schema', 'critical', null, 'answer has no claims');
    return finish(findings);
  }
  const byId = new Map();
  for (const c of answer.claims) {
    if (!c || typeof c.id !== 'string' || typeof c.text !== 'string' || !c.text.trim()) { add('schema', 'critical', c?.id, 'claim missing id or text'); continue; }
    if (byId.has(c.id)) add('schema', 'critical', c.id, 'duplicate claim id');
    if (!CLAIM_TYPES.includes(c.type)) add('schema', 'critical', c.id, `unknown claim type ${JSON.stringify(c.type)}`);
    byId.set(c.id, c);
  }
  // Generator-supplied status fields are never honoured
  for (const k of ['verified', 'approved', 'official', 'verification', 'status']) if (k in answer) add('override-attempt', 'critical', null, `generator output contained field "${k}"`);

  const evidenceText = evidenceChunks.map((c) => c.text).join(' \n ');
  const evidenceNums = numbersIn(evidenceText);
  const scenarioNums = numbersIn(scenarioText);
  const corpusStd = ctx.corpusStandardRefs ?? allStandardRefs(corpus);
  const citedByClaim = new Map();
  const calcNums = new Set();

  for (const c of answer.claims) {
    if (!byId.has(c.id) || byId.get(c.id) !== c) continue;
    const quotes = [];
    const chunks = [];
    for (const cit of c.citations ?? []) {
      const r = validateCitation(cit, { corpus, registry, session, blockedChunks: ctx.blockedChunks });
      if (!r.ok) { add(`citation-${r.code}`, 'critical', c.id, r.message); continue; }
      quotes.push(cit.quote);
      chunks.push(r.chunk);
      if (r.source.tier === 5) add('textbook-only-citation', 'major', c.id, 'textbook sources cannot be the basis of a claim');
    }
    citedByClaim.set(c.id, { quotes, chunks });
    const quoteText = quotes.join(' ');
    const chunkText = chunks.map((x) => x.text).join(' ');

    if (c.type === 'calculation') {
      const r = checkCalculation(c.calc);
      if (!r.ok) add('calculation-mismatch', 'critical', c.id, r.reason);
      else if (typeof c.calc.result === 'number') calcNums.add(String(c.calc.result)), calcNums.add(String(r.computed));
      if (!(c.dependsOn?.length)) add('calculation-no-basis', 'major', c.id, 'calculation must depend on the sourced claim that states the method');
    }

    if (c.type === 'source_statement' || c.type === 'inference') {
      if (quotes.length === 0) add('no-valid-citation', 'critical', c.id, `${c.type} has no valid citation`);
      else {
        const claimToks = [...new Set(tokenize(c.text))];
        const qToks = new Set(tokenize(quoteText));
        const cov = claimToks.length ? claimToks.filter((t) => qToks.has(t)).length / claimToks.length : 0;
        const need = c.type === 'source_statement' ? (policy.minSupportCoverage ?? 0.5) : 0.3;
        if (cov < need) add('weak-evidence-support', 'major', c.id, `only ${(cov * 100).toFixed(0)}% of the claim's content words appear in the cited quotation (need ${(need * 100).toFixed(0)}%)`);
        if (c.type === 'source_statement') {
          if (NEG.test(c.text) !== NEG.test(quoteText)) add('negation-mismatch', 'major', c.id, 'claim and quotation differ in negation');
          const claimAbs = new Set((c.text.match(ABS) ?? []).map((x) => x.toLowerCase()));
          const quoteLow = normText(quoteText);
          for (const a of claimAbs) if (!new RegExp(`\\b${a}\\b`).test(quoteLow)) add('overstatement', 'major', c.id, `claim uses "${a}" which the cited quotation does not`);
          // omitted qualification: look at quote's sentence and the next one inside the chunk
          for (const ch of chunks) {
            const sents = sentencesOf(ch.text);
            const q = normText(quoteText);
            const idx = sents.findIndex((s) => normText(s).includes(q.slice(-40)) || q.includes(normText(s).slice(0, 40)));
            const around = idx >= 0 ? [sents[idx], sents[idx + 1]].filter(Boolean).join(' ') : '';
            if (around && QUALIFIER.test(around) && !QUALIFIER.test(c.text) && !QUALIFIER.test(quoteText)) {
              add('possible-omitted-qualification', 'major', c.id, 'the source passage next to the quotation contains a qualification (unless/except/subject to...) that the claim does not carry');
            }
          }
        }
      }
      if (c.type === 'inference' && !(typeof c.basis === 'string' && c.basis.trim().length >= 15)) add('inference-no-basis', 'major', c.id, 'inference must state its basis');
      if (c.type === 'source_statement' && !quoteText) { /* already critical */ }
      for (const n of numbersIn(c.text)) {
        if (!numbersIn(quoteText).has(n) && !numbersIn(chunkText).has(n)) add('number-not-in-source', 'critical', c.id, `number ${n} does not appear in the cited source text`);
      }
    }

    if (c.type === 'explanation' || c.type === 'application') {
      const deps = c.dependsOn ?? [];
      if (!deps.length && quotes.length === 0) add('ungrounded-claim', 'critical', c.id, `${c.type} has neither citations nor dependsOn`);
      for (const n of numbersIn(c.text)) {
        const ok = evidenceNums.has(n) || scenarioNums.has(n) || calcNums.has(n) || [...answer.claims].some((x) => x.type === 'calculation' && numbersIn(String(x.calc?.result ?? '')).has(n));
        if (!ok) add('number-unsupported', 'major', c.id, `number ${n} is not in the evidence, the scenario or a checked calculation`);
      }
    }

    if (c.type === 'illustration' && (c.citations?.length ?? 0) > 0) add('illustration-with-citation', 'minor', c.id, 'illustration cites a source; check it is not presented as a rule');

    // dependency checks
    for (const d of c.dependsOn ?? []) {
      if (!byId.has(d)) add('schema', 'critical', c.id, `dependsOn unknown claim ${d}`);
      else if (d === c.id) add('schema', 'critical', c.id, 'claim depends on itself');
    }

    // Standard and paragraph reference screening (applies to every claim type except illustration for standards? no: all)
    for (const ref of extractStandardRefs(c.text)) {
      if (!corpusStd.has(ref)) add('unknown-standard', 'critical', c.id, `"${ref}" does not appear anywhere in the approved corpus; it cannot be taught or cited`);
      else if ((c.type === 'source_statement' || c.type === 'inference') && !extractStandardRefs(chunkText).has(ref)) add('standard-not-in-cited-source', 'major', c.id, `"${ref}" is not in the cited passage`);
    }
    for (const ref of extractParagraphRefs(c.text)) {
      if (!normText(chunkText).includes(normText(ref))) add('fabricated-paragraph-ref', 'critical', c.id, `paragraph reference ${ref} is not present in any cited passage`);
    }

    if (ENDORSE.test(c.text)) {
      // Official status comes from registry metadata about the SOURCE, never from words inside a retrieved passage.
      const supported = chunks.some((x) => x.tier <= 3 && ['marking-scheme', 'past-paper', 'examiner-report'].includes(registry.byId.get(x.sourceId)?.kind));
      if (!supported) add('unsupported-endorsement-claim', 'critical', c.id, 'claims official ACCA status/marking that no cited source supports');
    }
    if (looksLikeInjection(c.text)) add('injection-in-output', 'critical', c.id, 'claim text contains instruction-like content');
    if (leaksSecret(c.text)) add('secret-leak', 'critical', c.id, 'claim text contains secret-like content');
  }

  // grounding chain, cycle detection
  const grounded = new Map();
  const visiting = new Set();
  function isGrounded(id) {
    if (grounded.has(id)) return grounded.get(id);
    if (visiting.has(id)) { add('schema', 'critical', id, 'dependency cycle'); return false; }
    visiting.add(id);
    const c = byId.get(id);
    let g = false;
    if (c) {
      if (c.type === 'illustration') g = true;
      else if ((citedByClaim.get(id)?.quotes.length ?? 0) > 0) g = true;
      else g = (c.dependsOn ?? []).some((d) => byId.has(d) && isGrounded(d));
    }
    visiting.delete(id);
    grounded.set(id, g);
    return g;
  }
  for (const c of byId.values()) if (!isGrounded(c.id)) add('ungrounded-claim', 'critical', c.id, 'claim is not grounded in any validated citation, directly or through dependsOn');
  if (![...byId.values()].some((c) => c.type === 'source_statement')) add('no-source-statement', 'critical', null, 'an answer must contain at least one source_statement');

  // tutor moves: screened like claims (no unsupported standards/numbers; no injection)
  for (const m of answer.tutorMoves ?? []) {
    const t = String(m?.text ?? '');
    if (!['question', 'hint'].includes(m?.type)) add('schema', 'critical', null, 'tutorMove type must be question or hint');
    for (const ref of extractStandardRefs(t)) if (!corpusStd.has(ref)) add('unknown-standard', 'critical', null, `tutor move mentions "${ref}" which is not in the approved corpus`);
    for (const n of numbersIn(t)) if (!evidenceNums.has(n) && !scenarioNums.has(n)) add('number-unsupported', 'major', null, `tutor move contains number ${n} not in evidence or scenario`);
    if (looksLikeInjection(t) || leaksSecret(t) || ENDORSE.test(t)) add('tutor-move-unsafe', 'critical', null, 'tutor move contains unsafe content');
  }
  return finish(findings);
}

export function allStandardRefs(corpus) {
  const s = new Set();
  for (const c of corpus.chunks.values()) if (c.retrievable) for (const r of extractStandardRefs(c.text)) s.add(r);
  return s;
}

function finish(findings) {
  const blocking = findings.filter((f) => f.severity === 'critical' || f.severity === 'major');
  return { ok: blocking.length === 0, findings, criticalCount: findings.filter((f) => f.severity === 'critical').length, blockingCount: blocking.length };
}
