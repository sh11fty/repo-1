import { verifyDeterministic, allStandardRefs } from './verify.js';
import { issueVerifiedAnswer, issueNonAnswer, issueTemplate } from './release.js';
import { SOURCE_STATUS_LABEL } from './content.js';
import { deepFreeze } from './util.js';
import { LIMITATIONS_NOTICE } from './pipeline.js';

/**
 * Serving of stored, pre-validated content (lessons, question answers). Content is re-verified deterministically
 * against the CURRENT corpus every time it is served, so a source change or an open error report withdraws it.
 */
export function createServe({ corpus, registry, session, corrections }) {
  const corpusStd = allStandardRefs(corpus);
  const ctx = { corpus, registry, session, corpusStandardRefs: corpusStd };

  function renderClaims(claims) {
    return claims.map((c) => ({
      claimId: c.id, claimType: c.type, text: c.text,
      citations: (c.citations ?? []).map((cit) => { const ch = corpus.chunks.get(cit.chunkId); const src = registry.byId.get(ch.sourceId); return { sourceId: src.id, sourceTitle: src.title, tier: src.tier, version: src.version, page: ch.page, chunkId: ch.chunkId, quote: cit.quote, extraction: ch.extraction ?? 'text-layer', sourceCaveat: src.caveat }; }),
    }));
  }
  function check(claims) {
    const chunks = [...new Set(claims.flatMap((c) => (c.citations ?? []).map((x) => x.chunkId)))].map((id) => corpus.chunks.get(id)).filter(Boolean);
    return verifyDeterministic({ claims }, { ...ctx, evidenceChunks: chunks });
  }
  const caveatsFor = (claims) => {
    const out = [LIMITATIONS_NOTICE];
    const srcs = new Set(claims.flatMap((c) => (c.citations ?? []).map((x) => corpus.chunks.get(x.chunkId)?.sourceId)));
    for (const id of srcs) { const s = registry.byId.get(id); if (s?.caveat) out.push(`${s.id}: ${s.caveat}`); }
    return out;
  };

  function lesson(l) {
    if (corrections?.isBlocked('lesson', l.id)) return issueNonAnswer({ outcome: 'withheld', message: 'This lesson has an open error report and is withheld until reviewed.' });
    if (l.status === 'source-required') return issueNonAnswer({ outcome: 'source_required', message: 'Technical content for this lesson has not been written because no authoritative source is loaded. Syllabus scope is shown; supply the listed sources to enable grounded teaching.', lesson: { id: l.id, title: l.title, syllabusRefs: l.syllabusRefs, requiredSources: l.requiredSources, template: l.template } });
    if (l.status === 'app-guidance') {
      const w = l.worked ? { ...l.worked, supportingClaims: undefined } : null;
      const r = l.worked ? check(l.worked.supportingClaims) : { ok: true };
      if (!r.ok) return issueNonAnswer({ outcome: 'unverified', message: 'This lesson no longer passes verification against the current sources.' });
      return issueTemplate({ template: 'app-guidance-lesson', lesson: { id: l.id, title: l.title, steps: l.steps, worked: w, supporting: l.worked ? renderClaims(l.worked.supportingClaims) : [] }, sourceNote: l.sourceNote });
    }
    const r = check(l.claims);
    if (!r.ok) return issueNonAnswer({ outcome: 'unverified', message: 'This lesson no longer passes verification against the current sources, so it is withheld.', failureCodes: [...new Set(r.findings.map((f) => f.code))] });
    return issueVerifiedAnswer(deepFreeze({ outcome: 'verified', lessonId: l.id, title: l.title, sourceNote: l.sourceNote, blocks: renderClaims(l.claims), caveats: caveatsFor(l.claims), verification: { deterministicChecks: 'passed at serve time' } }));
  }

  function questionPublic(q) {
    if (corrections?.isBlocked('question', q.id)) return issueNonAnswer({ outcome: 'withheld', message: 'This question has an open error report and is withheld.' });
    return issueTemplate({ template: 'question', question: { id: q.id, topic: q.topic, prompt: q.prompt, difficulty: q.difficulty, skill: q.skill, syllabusRefs: q.syllabusRefs, type: q.type, hints: q.hints, maxMarks: q.rubric.points.reduce((s, p) => s + p.marks, 0), scored: q.scored, sourceLabel: SOURCE_STATUS_LABEL[q.sourceStatus], sourceNote: q.sourceNote, rubricKind: q.rubric.kind } });
  }
  function questionAnswer(q) {
    if (corrections?.isBlocked('question', q.id)) return issueNonAnswer({ outcome: 'withheld', message: 'This question has an open error report and is withheld.' });
    const r = check(q.answerClaims);
    if (!r.ok) return issueNonAnswer({ outcome: 'unverified', message: 'The stored answer no longer passes verification against the current sources.' });
    return issueVerifiedAnswer(deepFreeze({ outcome: 'verified', questionId: q.id, blocks: renderClaims(q.answerClaims), caveats: caveatsFor(q.answerClaims), note: 'AI-generated question; model answer is source-verified. The rubric is indicative, not an ACCA marking scheme.' }));
  }
  return { lesson, questionPublic, questionAnswer };
}
