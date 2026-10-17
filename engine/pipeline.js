import { randomUUID } from 'node:crypto';
import { buildIndex, retrieve } from './retrieval.js';
import { verifyDeterministic, allStandardRefs } from './verify.js';
import { modelVerify } from './modelVerifier.js';
import { parseJsonObject } from './json.js';
import { GENERATOR_SYSTEM, MODE_NOTES, evidenceBlock } from './prompts.js';
import { looksLikeInjection, tokenize, sha256, deepFreeze } from './util.js';
import { issueVerifiedAnswer, issueNonAnswer } from './release.js';
import { usability } from './registry.js';

export const LIMITATIONS_NOTICE = 'Checked against stored excerpts of the approved sources listed. This reduces, but cannot eliminate, the risk of error. It is not an ACCA answer or an official marking scheme.';
const LOCKED_MODES = new Set(['socratic', 'test', 'apply', 'challenge', 'revision']);
const LABELS = {
  source_statement: 'Source statement',
  explanation: 'Explanation derived from source statements',
  inference: 'Inference (not stated by the source)',
  application: 'Application to your scenario',
  illustration: 'Illustrative example (invented; not a rule)',
  calculation: 'Calculation (arithmetic recomputed by the system)',
};

const untrusted = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/<\/?\s*(EVIDENCE|LEARNER[A-Z_]*|SCENARIO|CLAIM|CITED_PASSAGES|DEPENDS_ON|RUBRIC)[^>]*>/gi, '[tag removed]').slice(0, 6000);

export function createPipeline({ corpus, registry, session, generator, verifier, audit, corrections = null, syllabus = [], policy = {} }) {
  const maxRetries = Math.min(policy.maxRetries ?? 2, 3); // hard ceiling
  let index = buildIndex(corpus);
  const corpusStd = allStandardRefs(corpus);
  const stored = new Map(); // answerId -> {claims, blocks, tutorMoves, evidenceIds}
  const ctxBase = { corpus, registry, session };

  const refresh = () => { ctxBase.blockedChunks = new Set(corrections?.blockedChunks() ?? []); index = buildIndex({ ...corpus, chunks: new Map([...corpus.chunks].filter(([id]) => !corrections?.blockedChunks().has(id))) }); };
  refresh();

  const hasTier1 = registry.sources.some((s) => s.tier === 1 && usability(s, session).usable);

  function excerpts(hits) {
    return hits.slice(0, 5).map(({ chunk }) => {
      const src = registry.byId.get(chunk.sourceId);
      return { chunkId: chunk.chunkId, sourceId: chunk.sourceId, sourceTitle: src.title, tier: src.tier, version: src.version, page: chunk.page, extraction: chunk.extraction ?? 'text-layer', excerpt: chunk.text.length > 400 ? `${chunk.text.slice(0, 400)}…` : chunk.text };
    });
  }

  function matchSyllabus(question) {
    const q = new Set(tokenize(question));
    return syllabus.map((lo) => ({ id: lo.id, area: lo.area, overlap: tokenize(`${lo.label} ${(lo.keywords ?? []).join(' ')}`).filter((t) => q.has(t)).length }))
      .filter((x) => x.overlap >= 2).sort((a, b) => b.overlap - a.overlap).slice(0, 3);
  }

  function nonAnswer(kind, message, extra = {}) {
    return issueNonAnswer({ outcome: kind, message, missingSourcesNote: registry.missingSources?.filter((m) => m.needed && m.status !== 'approved').map((m) => ({ id: m.id, status: m.status, impact: m.impact })), ...extra });
  }

  function render(answer, evidence) {
    const blocks = answer.claims.map((c) => ({
      claimId: c.id, claimType: c.type, label: LABELS[c.type], text: c.text, dependsOn: c.dependsOn ?? [], basis: c.type === 'inference' ? c.basis : undefined,
      calc: c.type === 'calculation' ? { expression: c.calc.expression, inputs: c.calc.inputs, result: c.calc.result } : undefined,
      citations: (c.citations ?? []).map((cit) => {
        const ch = corpus.chunks.get(cit.chunkId);
        const src = registry.byId.get(ch.sourceId);
        return { sourceId: src.id, sourceTitle: src.title, tier: src.tier, version: src.version, page: ch.page, chunkId: ch.chunkId, quote: cit.quote, extraction: ch.extraction ?? 'text-layer', sourceCaveat: src.caveat };
      }),
    }));
    const usedSources = [...new Set(blocks.flatMap((b) => b.citations.map((c) => c.sourceId)))].map((id) => registry.byId.get(id));
    const caveats = [LIMITATIONS_NOTICE];
    if (!hasTier1) caveats.push('No IFRS/IAS standard text is loaded. This answer rests on ACCA documents only and says nothing authoritative about accounting treatments.');
    for (const s of usedSources) if (s.caveat) caveats.push(`${s.id}: ${s.caveat}`);
    if (blocks.some((b) => b.citations.some((c) => c.extraction === 'ocr'))) caveats.push('Some quotations come from OCR text. Check the wording against the original PDF page.');
    return { blocks, caveats, evidenceChunkIds: evidence.map((h) => h.chunk.chunkId) };
  }

  async function answer({ question, mode = 'teach', scenario = '', learnerAnswer = '', profile = null }) {
    const answerId = randomUUID();
    const rawQ = untrusted(question).trim();
    const injectionFlag = looksLikeInjection(rawQ) || looksLikeInjection(scenario) || looksLikeInjection(learnerAnswer);
    // Instruction-like sentences are removed from what retrieval and the generator see; the original is kept in the audit log.
    const q = rawQ.split(/(?<=[.!?])\s+/).filter((sent) => !looksLikeInjection(sent)).join(' ').trim();
    const rec = { answerId, mode, question: rawQ, injectionFlag, session, attempts: [], limitations: injectionFlag ? ['instruction-like text removed from the question before retrieval and generation'] : [] };
    const finish = (result, outcome, extra = {}) => { audit?.append({ ...rec, outcome, ...extra }); return result; };

    if (!q) return finish(nonAnswer('abstain', 'No question was provided.', { answerId }), 'abstain-empty');
    if (!MODE_NOTES[mode]) return finish(nonAnswer('abstain', `Unknown mode "${mode}".`, { answerId }), 'abstain-bad-mode');

    const syl = matchSyllabus(q);
    rec.syllabusMatches = syl;
    let query = q;
    let k = 6;
    let r = retrieve(index, registry, query, { k });
    rec.retrieval = { queryTokens: r.queryTokens, coverage: r.coverage, best: r.bestScore, sufficient: r.sufficient, reason: r.reason, chunkIds: r.hits.map((h) => h.chunk.chunkId) };

    if (r.conflicts.length) {
      return finish(nonAnswer('conflict', 'The approved sources appear to conflict or overlap across versions, so a definitive answer is withheld until this is resolved. Both versions are shown.', { answerId, conflicts: r.conflicts, evidence: excerpts(r.hits) }), 'conflict', { conflicts: r.conflicts });
    }
    if (!r.sufficient) {
      const why = r.reason === 'no-approved-sources-loaded' ? 'No approved sources are loaded.' : 'The approved sources do not establish an answer to this question.';
      return finish(nonAnswer('abstain', `${why} I will not answer from memory. ${syl.length ? 'It maps to syllabus outcome ' + syl.map((s) => s.id).join(', ') + ', but the supporting source text has not been supplied.' : 'It does not map to a syllabus outcome I can match.'}`, { answerId, reason: r.reason, syllabusMatches: syl, evidence: excerpts(r.hits) }), 'abstain-insufficient-evidence');
    }

    if (!generator?.available?.()) {
      return finish(nonAnswer('unavailable', 'The answer generator is unavailable, so no technical answer can be given. The most relevant stored source excerpts are shown instead.', { answerId, evidence: excerpts(r.hits) }), 'fail-closed-generator-unavailable');
    }
    if (!verifier?.available?.()) {
      return finish(nonAnswer('unavailable', 'The independent verifier is unavailable, so no technical answer can be given. The most relevant stored source excerpts are shown instead.', { answerId, evidence: excerpts(r.hits) }), 'fail-closed-verifier-unavailable');
    }
    if (generator.name === verifier.name) {
      return finish(nonAnswer('unavailable', 'The verifier is not independent of the generator (same model configuration), so verification is refused.', { answerId, evidence: excerpts(r.hits) }), 'fail-closed-verifier-not-independent');
    }

    let priorCodes = [];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const evidence = r.hits;
      const user = [
        MODE_NOTES[mode],
        `<LEARNER_QUESTION>\n${q}\n</LEARNER_QUESTION>`,
        scenario ? `<SCENARIO>\n${untrusted(scenario)}\n</SCENARIO>` : '',
        learnerAnswer ? `<LEARNER_ANSWER>\n${untrusted(learnerAnswer)}\n</LEARNER_ANSWER>` : '',
        profile ? `<LEARNER_PROFILE>\n${untrusted(JSON.stringify(profile)).replace(/[^\w\s,.:{}\[\]"-]/g, '')}\n</LEARNER_PROFILE>` : '',
        priorCodes.length ? `<PREVIOUS_REJECTION_CODES>\n${priorCodes.join(', ')}\n</PREVIOUS_REJECTION_CODES>` : '',
        evidenceBlock(evidence.map((h) => ({ ...h.chunk, text: untrusted(h.chunk.text) }))),
      ].filter(Boolean).join('\n\n');

      let gen;
      try { gen = await generator.complete({ system: GENERATOR_SYSTEM, user, maxTokens: 2500, temperature: 0 }); }
      catch { return finish(nonAnswer('unavailable', 'The answer generator failed, so no technical answer can be given. Source excerpts are shown instead.', { answerId, evidence: excerpts(r.hits) }), 'fail-closed-generator-error'); }

      const parsed = parseJsonObject(gen.text);
      if (parsed?.insufficient === true) {
        return finish(nonAnswer('abstain', 'The sources retrieved do not establish the answer. I will not fill the gap from memory.', { answerId, reason: 'generator-reported-insufficient', missing: String(parsed.missing ?? '').slice(0, 300), evidence: excerpts(r.hits) }), 'abstain-generator-insufficient');
      }
      const att = { n: attempt + 1, claimsHash: parsed ? sha256(JSON.stringify(parsed.claims ?? null)) : null };
      rec.attempts.push(att);
      if (!parsed || !Array.isArray(parsed.claims)) {
        att.deterministic = { ok: false, findings: [{ code: 'schema', severity: 'critical', message: 'generator output was not a valid claims object' }] };
        priorCodes = ['schema'];
      } else {
        const det = verifyDeterministic(parsed, { ...ctxBase, scenarioText: `${scenario} ${learnerAnswer}`, evidenceChunks: evidence.map((h) => h.chunk), corpusStandardRefs: corpusStd, policy });
        att.deterministic = { ok: det.ok, findings: det.findings };
        if (det.ok) {
          const mv = await modelVerify({ verifier, answer: parsed, ctx: ctxBase });
          att.model = mv;
          if (mv.error) {
            return finish(nonAnswer('unavailable', 'Verification could not be completed, so the answer is withheld. Source excerpts are shown instead.', { answerId, evidence: excerpts(r.hits) }), 'fail-closed-verification-error', { verifierError: mv.error });
          }
          if (mv.ok) {
            const rendered = render(parsed, evidence);
            const tutorMoves = (parsed.tutorMoves ?? []).map((m) => ({ type: m.type, text: m.text }));
            const locked = LOCKED_MODES.has(mode);
            stored.set(answerId, { blocks: rendered.blocks, caveats: rendered.caveats, claims: parsed.claims, mode });
            const payload = {
              answerId, outcome: 'verified', mode, session, tutorMoves,
              solutionLocked: locked, blocks: locked ? [] : rendered.blocks, caveats: rendered.caveats,
              verification: { attempts: attempt + 1, deterministicChecks: 'passed', independentModelCheck: 'all claims entailed', note: 'An AI verifier agreed; this is an additional check, not proof.' },
            };
            return finish(issueVerifiedAnswer(deepFreeze(payload)), 'verified', { chunkIds: rendered.evidenceChunkIds, sourceVersions: Object.fromEntries([...new Set(evidence.map((h) => h.chunk.sourceId))].map((id) => [id, registry.byId.get(id).version])), claims: parsed.claims });
          }
          priorCodes = mv.verdicts.filter((v) => v.verdict !== 'entailed').map((v) => `model-${v.verdict}`);
        } else priorCodes = [...new Set(det.findings.filter((f) => f.severity !== 'minor').map((f) => f.code))].slice(0, 8);
      }
      // retry with broader evidence
      k += 4;
      query = `${q} ${(parsed?.claims ?? []).map((c) => c.text).join(' ').slice(0, 300)}`;
      r = retrieve(index, registry, query, { k });
    }
    const lastFindings = rec.attempts.at(-1)?.deterministic?.findings ?? [];
    return finish(nonAnswer('unverified', 'I could not produce an answer that passed verification, so I am not giving one. The available source excerpts are shown so you can read them directly.', { answerId, attempts: rec.attempts.length, failureCodes: [...new Set([...lastFindings.map((f) => f.code), ...priorCodes])].slice(0, 10), evidence: excerpts(r.hits) }), 'unverified-after-retries');
  }

  /** Reveal a locked solution. Re-runs the deterministic checks against the current corpus first. */
  function reveal(answerId) {
    const s = stored.get(answerId);
    const fromAudit = !s ? audit?.find(answerId) : null;
    const claims = s?.claims ?? fromAudit?.claims;
    if (!claims) return nonAnswer('abstain', 'That answer is no longer available to reveal.', { answerId });
    const chunkIds = new Set(claims.flatMap((c) => (c.citations ?? []).map((x) => x.chunkId)));
    const chunks = [...chunkIds].map((id) => corpus.chunks.get(id)).filter(Boolean);
    const det = verifyDeterministic({ claims }, { ...ctxBase, evidenceChunks: chunks, corpusStandardRefs: corpusStd, policy });
    if (!det.ok) return nonAnswer('unverified', 'The stored solution no longer passes verification against the current sources, so it is withheld.', { answerId, failureCodes: [...new Set(det.findings.map((f) => f.code))] });
    const rendered = s ? { blocks: s.blocks, caveats: s.caveats } : render({ claims }, chunks.map((chunk) => ({ chunk })));
    return issueVerifiedAnswer(deepFreeze({ answerId, outcome: 'verified', mode: s?.mode ?? 'revealed', session, tutorMoves: [], solutionLocked: false, blocks: rendered.blocks, caveats: rendered.caveats, verification: { attempts: 0, deterministicChecks: 're-passed at reveal', independentModelCheck: 'passed when first generated', note: 'Re-checked deterministically at reveal time.' } }));
  }

  /** Search-only mode: verbatim stored excerpts, no generation, no model involved. */
  function evidenceOnly(question) {
    const q = untrusted(question).trim();
    const r = retrieve(index, registry, q, { k: 6 });
    const out = nonAnswer(r.sufficient ? 'evidence_only' : 'abstain', r.sufficient ? 'Verbatim excerpts from approved sources (no AI composition).' : 'No sufficiently relevant approved source text found.', { evidence: excerpts(r.hits) });
    audit?.append({ answerId: randomUUID(), mode: 'evidence-only', question: q, session, outcome: r.sufficient ? 'evidence-only' : 'abstain-insufficient-evidence', chunkIds: r.hits.map((h) => h.chunk.chunkId) });
    return out;
  }

  return { answer, reveal, evidenceOnly, refresh, get hasTier1() { return hasTier1; } };
}
