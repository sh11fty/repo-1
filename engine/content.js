import { verifyDeterministic } from './verify.js';
import { validateCitation } from './citation.js';
import { numbersIn } from './util.js';

export const SOURCE_STATUSES = ['official-reproduced', 'official-linked', 'adapted', 'original-ai-generated', 'illustrative-teaching-example'];
export const SOURCE_STATUS_LABEL = {
  'official-reproduced': 'Official ACCA question (reproduced with permission)',
  'official-linked': 'Official ACCA question (external link)',
  adapted: 'Adapted from an official question',
  'original-ai-generated': 'AI-generated practice question (NOT an ACCA question)',
  'illustrative-teaching-example': 'Illustrative teaching example (invented)',
};

function claimsOk(claims, ctx, label, errs) {
  const chunkIds = new Set(claims.flatMap((c) => (c.citations ?? []).map((x) => x.chunkId)));
  const chunks = [...chunkIds].map((id) => ctx.corpus.chunks.get(id)).filter(Boolean);
  const r = verifyDeterministic({ claims }, { ...ctx, evidenceChunks: chunks });
  for (const f of r.findings.filter((x) => x.severity !== 'minor')) errs.push(`${label}: ${f.code}: ${f.message}`);
}

export function validateQuestions(bank, ctx, loIds) {
  const errs = [];
  const seen = new Set();
  for (const q of bank.questions) {
    const L = `question ${q.id}`;
    for (const f of ['id', 'syllabusRefs', 'topic', 'difficulty', 'skill', 'type', 'prompt', 'sourceStatus', 'status']) if (q[f] === undefined) errs.push(`${L}: missing ${f}`);
    if (seen.has(q.id)) errs.push(`${L}: duplicate id`); seen.add(q.id);
    if (!SOURCE_STATUSES.includes(q.sourceStatus)) errs.push(`${L}: invalid sourceStatus`);
    if (q.sourceStatus?.startsWith('official')) {
      const src = ctx.registry.sources.find((s) => s.id === q.officialSourceId && s.kind === 'past-paper' && s.status === 'approved');
      if (!src) errs.push(`${L}: labelled official but no approved past-paper source is registered`);
    }
    for (const r of q.syllabusRefs ?? []) if (!loIds.has(r)) errs.push(`${L}: unknown syllabus ref ${r}`);
    if (![1, 2, 3].includes(q.difficulty)) errs.push(`${L}: difficulty must be 1-3`);
    if (q.scored && q.status !== 'verified') errs.push(`${L}: scored but not verified`);
    if (q.status === 'verified') {
      if (!q.answerClaims?.length) errs.push(`${L}: verified question has no answer claims`);
      else claimsOk(q.answerClaims, ctx, L, errs);
      const pts = q.rubric?.points ?? [];
      if (!pts.length) errs.push(`${L}: no rubric points`);
      if (q.rubric?.kind !== 'indicative' && !q.officialSourceId) errs.push(`${L}: rubric must be 'indicative' unless an official source is registered`);
      for (const p of pts) {
        const r = validateCitation(p.citation, ctx);
        if (!r.ok) errs.push(`${L}: rubric ${p.id}: citation ${r.code}: ${r.message}`);
        if (!(p.marks > 0)) errs.push(`${L}: rubric ${p.id}: marks must be > 0`);
      }
    }
  }
  return errs;
}

export function validateCurriculum(cur, ctx, loIds) {
  const errs = [];
  for (const m of cur.modules) for (const l of m.lessons) {
    const L = `lesson ${l.id}`;
    for (const r of l.syllabusRefs ?? []) if (!loIds.has(r)) errs.push(`${L}: unknown syllabus ref ${r}`);
    if (l.status === 'verified-from-sources') {
      if (!l.claims?.length) errs.push(`${L}: verified lesson has no claims`); else claimsOk(l.claims, ctx, L, errs);
    } else if (l.status === 'source-required') {
      if (!l.requiredSources?.length) errs.push(`${L}: source-required lesson must list requiredSources`);
      if (l.claims?.length) errs.push(`${L}: source-required lesson must not carry unverified claims`);
    } else if (l.status === 'app-guidance') {
      if (!l.sourceNote) errs.push(`${L}: app-guidance lesson must carry a sourceNote`);
      if (l.worked) {
        claimsOk(l.worked.supportingClaims, ctx, `${L} worked example`, errs);
        const allowed = new Set();
        for (const c of l.worked.supportingClaims) for (const cit of c.citations ?? []) for (const n of numbersIn(cit.quote)) allowed.add(n);
        for (const k of ['weak', 'adequate', 'strong']) for (const n of numbersIn(l.worked[k])) if (!allowed.has(n)) errs.push(`${L}: worked ${k} answer contains number ${n} not in supporting claims`);
      }
    } else errs.push(`${L}: unknown status ${l.status}`);
  }
  return errs;
}
