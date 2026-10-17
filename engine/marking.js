import { MARKER_SYSTEM } from './prompts.js';
import { parseJsonObject } from './json.js';
import { normText, tokenize, looksLikeInjection } from './util.js';
import { validateCitation } from './citation.js';
import { issueMarking, issueNonAnswer } from './release.js';
import { SOURCE_STATUS_LABEL } from './content.js';

export const INDICATIVE_LABEL = 'INDICATIVE assessment against a project rubric. It is NOT an ACCA mark and does not predict an examiner\'s mark.';

const untrusted = (s) => String(s ?? '').replace(/<\/?\s*(LEARNER[A-Z_]*|RUBRIC|POINT)[^>]*>/gi, '[tag removed]').slice(0, 8000);

/**
 * Marks a learner answer against a stored, verified question rubric.
 * - Refuses unverified or blocked questions.
 * - Rubric citations are re-validated against the corpus on every call.
 * - A model may judge points but must quote the learner's own words as evidence; quotes that are not substrings of the
 *   learner's answer are discarded and the point earns nothing.
 * - Without a marker model, only a keyword-coverage estimate is produced and labelled as such.
 */
export async function markAnswer({ question, answer, marker, ctx, corrections }) {
  if (!question || question.status !== 'verified') return issueNonAnswer({ outcome: 'abstain', message: 'This question has no verified answer or rubric, so it cannot be marked.' });
  if (corrections?.isBlocked('question', question.id)) return issueNonAnswer({ outcome: 'abstain', message: 'This question has an open error report and is withheld until reviewed.' });
  const text = String(answer ?? '').trim();
  if (!text) return issueNonAnswer({ outcome: 'abstain', message: 'No answer provided.' });
  const points = question.rubric.points;
  for (const p of points) {
    const r = validateCitation(p.citation, ctx);
    if (!r.ok) return issueNonAnswer({ outcome: 'unverified', message: `Rubric point ${p.id} no longer validates against the sources (${r.code}); marking withheld.` });
  }
  const max = points.reduce((s, p) => s + p.marks, 0);
  const norm = normText(text);
  const ansTokens = new Set(tokenize(text));
  const keywordHit = (p) => (p.keywords ?? []).some((k) => norm.includes(normText(k)) || tokenize(k).every((t) => ansTokens.has(t)));

  let mode = 'keyword-coverage-only';
  let judged = null;
  let markerNote = 'No marker model available: this is a keyword-coverage estimate only and cannot judge correct alternative wording.';
  if (marker?.available?.()) {
    try {
      const user = `<RUBRIC>\n${points.map((p) => `<POINT id="${p.id}">${p.text}</POINT>`).join('\n')}\n</RUBRIC>\n<LEARNER_ANSWER>\n${untrusted(text)}\n</LEARNER_ANSWER>`;
      const raw = await marker.complete({ system: MARKER_SYSTEM, user, maxTokens: 1500, temperature: 0 });
      const parsed = parseJsonObject(raw.text);
      if (parsed && Array.isArray(parsed.points)) { judged = new Map(parsed.points.map((x) => [x?.pointId, x])); mode = 'model-judged-with-evidence-check'; markerNote = 'A model judged each rubric point; every awarded point must quote your own words.'; }
    } catch { /* fall back to keyword estimate */ }
  }

  const injected = looksLikeInjection(text);
  const rows = points.map((p) => {
    let judgement = 'not_met', evidence = '', flag = null;
    if (judged) {
      const j = judged.get(p.id);
      judgement = ['met', 'partially_met', 'not_met'].includes(j?.judgement) ? j.judgement : 'not_met';
      evidence = String(j?.evidence ?? '');
      if (judgement !== 'not_met' && !(evidence && norm.includes(normText(evidence)))) { flag = 'Evidence quote was not found in your answer, so no mark was given for this point.'; judgement = 'not_met'; }
      else if (judgement !== 'not_met' && injected && !keywordHit(p)) { flag = 'Your answer contains instruction-like text; points without the usual key terms were not credited.'; judgement = 'not_met'; }
      else if (judgement === 'met' && !keywordHit(p)) flag = 'Judged met without the usual key terms; check that this is a genuinely equivalent explanation.';
    } else if (keywordHit(p)) { judgement = 'partially_met'; flag = 'Key term present; substance not judged.'; }
    const awarded = judgement === 'met' ? p.marks : judgement === 'partially_met' ? Math.floor(p.marks) / 2 : 0;
    return { id: p.id, text: p.text, marks: p.marks, awarded, judgement, evidence, flag };
  });
  const total = Math.min(max, rows.reduce((s, r) => s + r.awarded, 0));
  return issueMarking({
    label: INDICATIVE_LABEL, questionId: question.id, questionLabel: SOURCE_STATUS_LABEL[question.sourceStatus], rubricKind: question.rubric.kind,
    mode, markerNote, injectionFlag: injected, total, max, points: rows,
    feedback: {
      didCorrectly: rows.filter((r) => r.judgement === 'met').map((r) => r.text),
      omitted: rows.filter((r) => r.judgement === 'not_met').map((r) => r.text),
      partlyCovered: rows.filter((r) => r.judgement === 'partially_met').map((r) => r.text),
      statedIncorrectly: { status: 'not-assessed', reason: 'Detecting incorrect statements requires verified source comparison; use "Explain my mistake" mode, which is source-checked.' },
      modelAnswer: question.answerClaims.map((c) => ({ text: c.text, source: c.citations?.map((x) => x.chunkId) })),
      revise: question.syllabusRefs, followUp: 'Retry this question later without hints.',
    },
    sources: question.answerClaims.flatMap((c) => c.citations.map((x) => x.chunkId)),
  });
}
