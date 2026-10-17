#!/usr/bin/env node
// Authoring script for the content that CAN be verified from the supplied sources today (exam structure, examinability,
// the ACCA "stepping up" article). Output is validated by scripts/validate-content.js with the same citation validator
// and deterministic verifier the tutor uses. Technical IFRS lessons are placeholders until tier 1 sources are supplied.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYL = 'ACCA-SYL-SBRINT-2627';
const ART = 'ACCA-ART-SBR-STEPUP';
const cite = (src, chunk, quote) => ({ chunkId: `${src}:${chunk}`, quote });
const S = (id, text, ...citations) => ({ id, type: 'source_statement', text, citations });

// ---- verified fact claims (reused by lessons and questions) ----
const F = {
  duration: S('c1', 'The syllabus is assessed by a three-hour fifteen-minute examination.', cite(SYL, 'p12:c4', 'The syllabus is assessed by a three-hour fifteen-minute examination.')),
  sectionA: S('c1', 'Section A will consist of two scenario-based questions. The first question will be worth 30 marks and the second question will be worth 20 marks.', cite(SYL, 'p12:c5', 'Section A will consist of two scenario-based questions. The first question will be worth 30 marks and the second question will be worth 20 marks.')),
  sectionB: S('c1', 'Students will be required to answer a further two questions, each worth 25 marks.', cite(SYL, 'p13:c1', 'Students will be required to answer a further two questions, each worth 25 marks.')),
  sectionBStake: S('c2', 'Section B will always include either a full question, or part of a question, that requires the candidate to consider stakeholder perspectives.', cite(SYL, 'p13:c1', 'Section B could deal with any aspect of the syllabus but will always include either a full question, or part of a question, that requires the candidate to consider stakeholder perspectives.')),
  psm: S('c1', 'Two professional skills marks will be awarded in question two and two in question four.', cite(SYL, 'p13:c2', 'Two professional skills marks will be awarded in question two and two in question four.')),
  psmTotal: S('c2', 'This exam contains four professional skills marks.', cite(SYL, 'p15:c1', 'This exam contains four professional skills marks.')),
  q1: S('c1', 'Candidates will need to discuss issues in group accounting and use a spreadsheet to adjust a consolidated financial statement.', cite(SYL, 'p13:c1', 'Candidates will need to discuss issues in group accounting and use a spreadsheet to adjust a consolidated financial statement.')),
  q2: S('c1', 'The second question in Section A will require candidates to consider the reporting implications and the ethical implications of specific events in a contemporary scenario.', cite(SYL, 'p13:c1', 'The second question in Section A will require candidates to consider the reporting implications and the ethical implications of specific events in a contemporary scenario.')),
  pass: S('c1', 'The pass mark for all ACCA Qualification examinations is 50%.', cite(SYL, 'p14:c1', 'The pass mark for all ACCA Qualification examinations is 50%.')),
  compulsory: S('c1', 'It contains two sections and all questions are compulsory.', cite(SYL, 'p15:c1', 'It contains two sections and all questions are compulsory.')),
  levels: S('c1', 'The specific capabilities are assessed at one of three intellectual or cognitive levels.', cite(SYL, 'p5:c1', 'The specific capabilities within the detailed syllabuses and study guides are assessed at one of three intellectual or cognitive levels')),
  rule: S('c1', 'For most examinations (not tax), regulations issued or legislation passed on or before 31 August annually will be examinable from 1 September of the following year to 31 August of the year after that.', cite(SYL, 'p17:c1', 'For most examinations (not tax), regulations issued or legislation passed on or before 31 August annually, will be examinable from 1 September of the following year to 31 August of the year after that.')),
  future: S('c2', 'Regulations issued or legislation passed in accordance with the above dates will not be examinable if the effective date is in the future, unless explicitly stated otherwise in this syllabus and study guide or examinable documents.', cite(SYL, 'p17:c2', 'Regulations issued or legislation passed in accordance with the above dates will not be examinable if the effective date is in the future, unless explicitly stated otherwise in this syllabus and study guide or examinable documents.')),
  defs: S('c3', 'The term issued or passed relates to when regulation or legislation has been formally approved. The term effective relates to when regulation or legislation must be applied to an entity’s transactions and business practices.', cite(SYL, 'p17:c2', 'The term issued or passed relates to when regulation or legislation has been formally approved. The term effective relates to when regulation or legislation must be applied to an entity’s transactions and business practices.')),
  changeF1c: S('c1', 'The syllabus records a change to F1 c) Discussion of issues in financial reporting: the intellectual level changed from 2 to 3.', cite(SYL, 'p12:c2', 'F1 c) Discussion of issues in financial reporting'), cite(SYL, 'p12:c3', 'Intellectual level changed from 2 to 3')),
  regurg: S('c1', 'The article says candidates will score very little in this exam for simply regurgitating the requirements of IFRS Accounting Standards.', cite(ART, 'p4:c8', 'You will score very little in this exam for simply regurgitating the requirements of IFRS Accounting Standards.')),
  depth: S('c1', 'The article says that in SBR analysis and interpretation has a very different meaning from FR and is tested in much more depth.', cite(ART, 'p4:c11', 'was in FR; however in SBR it has a very different meaning. AT THIS LEVEL, ‘ANALYSIS AND INTERPRETATION’ IS TESTED IN MUCH MORE DEPTH.')),
  apm: S('c1', 'The article says that additional performance measures are not examined in the earlier levels of the Qualification.', cite(ART, 'p5:c1', 'One area on the SBR syllabus that is worthy of specific mention is ‘additional performance measures’. This area is not examined in the earlier levels of the Qualification.')),
  sds: S('c1', 'The article says it is extremely important to be aware that the IFRS Sustainability Disclosure Standards are examinable documents.', cite(ART, 'p6:c9', 'it is extremely important to be aware that the IFRS Sustainability Disclosure Standards are examinable documents.')),
  practice: S('c1', 'The article says the best way to develop the necessary skills and a good exam technique is to attempt exam-style questions throughout your studies.', cite(ART, 'p7:c7', 'the very best way to develop these necessary skills and a good exam technique is to attempt exam-style questions throughout your studies.')),
  written: S('c1', 'The article says a common misconception is that a reporting exam is largely numerical, however the emphasis in SBR is on written questions.', cite(ART, 'p7:c2', 'A common misconception is that a reporting exam is largely numerical, however the emphasis in SBR is on written questions.')),
  stakeholders: S('c1', 'The article says you should practise thinking from the point of view of different stakeholder groups, as the syllabus places a significant emphasis on stakeholder impact.', cite(ART, 'p4:c13', 'You should also ensure that you practise thinking from the point of view of different stakeholder groups, as the syllabus places a significant emphasis on stakeholder impact.')),
  stakeFocus: S('c1', 'Students will be required to adopt either a stakeholder or an external focus in answering questions.', cite(SYL, 'p12:c5', 'Students will be required to adopt either a stakeholder or an external focus in answering questions')),
};
const withId = (c, id) => ({ ...c, id });

// ---- question bank (verified recall of exam facts; ORIGINAL AI-generated wording; not ACCA questions) ----
const P = (id, text, marks, keywords, citation) => ({ id, text, marks, keywords, citation });
const Q = (id, refs, topic, prompt, hints, claims, points, extra = {}) => ({
  id, syllabusRefs: refs, topic, difficulty: 1, skill: 'recall', type: 'short-answer', prompt,
  sourceStatus: 'original-ai-generated', status: 'verified', scored: true, hints,
  answerClaims: claims, rubric: { kind: 'indicative', points }, ...extra,
});
const q = [
  Q('Q-S7-001', ['S7'], 'Exam duration', 'How long is the SBR examination?', ['It is stated in the section on how the syllabus is assessed.', 'The answer is expressed in hours and minutes.'],
    [F.duration], [P('p1', 'Three hours fifteen minutes', 1, ['three', 'hour', 'fifteen', '3'], F.duration.citations[0])]),
  Q('Q-S7-002', ['S7'], 'Section A structure', 'Describe Section A of the SBR exam: how many questions, what type, and how many marks each?', ['Think of two questions with different mark values.', 'Both questions are scenario-based.'],
    [F.sectionA], [P('p1', 'Two scenario-based questions', 1, ['two', 'scenario'], F.sectionA.citations[0]), P('p2', 'Question 1 is worth 30 marks', 1, ['30'], F.sectionA.citations[0]), P('p3', 'Question 2 is worth 20 marks', 1, ['20'], F.sectionA.citations[0])]),
  Q('Q-S7-003', ['S7'], 'Section B structure', 'How many questions are in Section B, how many marks is each worth, and what must Section B always include?', ['Section B questions are discursive.', 'One required element relates to a particular viewpoint.'],
    [F.sectionB, F.sectionBStake], [P('p1', 'Two questions, each 25 marks', 1, ['two', '25'], F.sectionB.citations[0]), P('p2', 'Always includes a question or part of a question requiring stakeholder perspectives', 2, ['stakeholder'], F.sectionBStake.citations[0])]),
  Q('Q-S7-004', ['S7'], 'Professional skills marks', 'How many professional skills marks are there in SBR, and in which questions are they awarded?', ['The marks are split evenly between two questions.', 'The questions are numbered.'],
    [F.psm, withId(F.psmTotal, 'c2')], [P('p1', 'Two marks in question two and two in question four', 2, ['two', 'four', 'question'], F.psm.citations[0]), P('p2', 'Four professional skills marks in total', 1, ['four'], F.psmTotal.citations[0])]),
  Q('Q-S7-005', ['S7'], 'Section A Question 1', 'What does the first Section A question focus on and what must candidates do in it?', ['Which syllabus area (a letter) does it examine?', 'There is a spreadsheet task.'],
    [F.q1], [P('p1', 'Discuss issues in group accounting', 1, ['group accounting', 'discuss'], F.q1.citations[0]), P('p2', 'Use a spreadsheet to adjust a consolidated financial statement', 1, ['spreadsheet', 'consolidated'], F.q1.citations[0])]),
  Q('Q-S7-006', ['S7'], 'Section A Question 2', 'What must candidates consider in the second Section A question?', ['Two kinds of implications are named.'],
    [F.q2], [P('p1', 'Reporting implications of specific events in a contemporary scenario', 1, ['reporting'], F.q2.citations[0]), P('p2', 'Ethical implications of those events', 1, ['ethical'], F.q2.citations[0])]),
  Q('Q-S9-001', ['S9'], 'Pass mark', 'What is the pass mark for ACCA Qualification examinations?', ['It is a percentage.'],
    [F.pass], [P('p1', '50%', 1, ['50'], F.pass.citations[0])]),
  Q('Q-S9-002', ['S9'], 'Compulsory questions', 'Can candidates choose which SBR questions to answer?', ['Think about the words "compulsory" and "sections".'],
    [F.compulsory], [P('p1', 'No: it has two sections and all questions are compulsory', 1, ['compulsory', 'all'], F.compulsory.citations[0])]),
  Q('Q-S5-001', ['S7'], 'Intellectual levels', 'How many intellectual (cognitive) levels are used to describe how deeply a learning outcome may be assessed?', ['The levels are numbered.'],
    [F.levels], [P('p1', 'Three levels', 1, ['three', '3'], F.levels.citations[0])], { note: 'Syllabus section 3.' }),
  Q('Q-S11-001', ['S11'], 'Examinability rule', 'Under the stated rule, when are regulations issued on or before 31 August examinable?', ['The rule gives a start and an end date.', 'The start date is 1 September of a particular year.'],
    [F.rule], [P('p1', 'From 1 September of the following year', 1, ['1 september', 'following year'], F.rule.citations[0]), P('p2', 'To 31 August of the year after that', 1, ['31 august'], F.rule.citations[0])], { note: 'Applies to "most examinations (not tax)" per the syllabus. The ACCA examinable documents, not yet supplied, are the final authority.' }),
  Q('Q-S11-002', ['S11'], 'Future effective dates', 'What does the syllabus say about regulations whose effective date is in the future?', ['There is an exception clause.'],
    [F.future], [P('p1', 'Not examinable if the effective date is in the future', 1, ['not examinable', 'future'], F.future.citations[0]), P('p2', 'Unless explicitly stated otherwise in the syllabus and study guide or examinable documents', 1, ['unless', 'examinable documents'], F.future.citations[0])]),
  Q('Q-S11-003', ['S11'], 'Issued versus effective', 'In the syllabus, what do the terms "issued or passed" and "effective" mean?', ['One relates to approval; the other to when it must be applied.'],
    [F.defs], [P('p1', 'Issued or passed: formally approved', 1, ['formally approved', 'approved'], F.defs.citations[0]), P('p2', 'Effective: when it must be applied to an entity\'s transactions and business practices', 1, ['applied', 'effective'], F.defs.citations[0])]),
  Q('Q-S12-001', ['F1c'], 'Syllabus amendment', 'What amendment does the 2026-27 syllabus record for F1 c)?', ['It concerns the intellectual level.'],
    [F.changeF1c], [P('p1', 'Intellectual level changed from 2 to 3', 2, ['2', '3', 'level'], F.changeF1c.citations[1])]),
  Q('Q-ART-001', ['E1a'], 'Analysis and interpretation at SBR', 'According to the ACCA "stepping up" article, how does "analysis and interpretation" at SBR differ from FR?', ['Think depth and meaning.'],
    [F.depth], [P('p1', 'It has a very different meaning in SBR', 1, ['different meaning'], F.depth.citations[0]), P('p2', 'It is tested in much more depth', 1, ['depth'], F.depth.citations[0])], { sourceNote: 'ACCA article, June 2025; syllabus controls if they differ.' }),
  Q('Q-ART-002', ['S7'], 'Regurgitation', 'According to the ACCA article, how much credit is there for simply regurgitating the requirements of IFRS Accounting Standards?', ['The article uses the phrase "very little".'],
    [F.regurg], [P('p1', 'Candidates score very little', 1, ['very little', 'little'], F.regurg.citations[0])], { sourceNote: 'ACCA article, June 2025.' }),
  Q('Q-ART-003', ['E1a'], 'Additional performance measures', 'According to the ACCA article, at which levels of the Qualification are additional performance measures examined?', ['Contrast with earlier levels.'],
    [F.apm], [P('p1', 'They are not examined in the earlier levels', 1, ['not examined', 'earlier'], F.apm.citations[0])], { sourceNote: 'ACCA article, June 2025.' }),
  Q('Q-ART-004', ['F1c'], 'Sustainability standards examinable', 'According to the ACCA article, what is the status of the IFRS Sustainability Disclosure Standards for SBR?', ['Consider the phrase "examinable documents".'],
    [F.sds], [P('p1', 'They are examinable documents', 1, ['examinable'], F.sds.citations[0])], { sourceNote: 'ACCA article, June 2025. Which parts are examinable in 2026-27 must be confirmed against the examinable documents (not supplied).' }),
  Q('Q-ART-005', ['S7'], 'Numerical or written', 'According to the ACCA article, what is a common misconception about a reporting exam such as SBR?', ['It concerns the balance between calculation and writing.'],
    [F.written], [P('p1', 'That it is largely numerical', 1, ['numerical'], F.written.citations[0]), P('p2', 'The emphasis in SBR is on written questions', 1, ['written'], F.written.citations[0])], { sourceNote: 'ACCA article, June 2025.' }),
  Q('Q-ART-006', ['S7'], 'Practice and feedback', 'According to the ACCA article, what is the best way to develop SBR skills and exam technique?', ['It involves a particular type of question.'],
    [F.practice], [P('p1', 'Attempt exam-style questions throughout your studies', 2, ['exam-style', 'questions'], F.practice.citations[0])], { sourceNote: 'ACCA article, June 2025.' }),
];

// ---- curriculum ----
const TEMPLATE = ['Concept and rationale', 'Purpose of the standard', 'Scope and definitions', 'Recognition', 'Initial measurement', 'Subsequent measurement', 'Presentation and disclosure', 'Calculations and journals', 'Gains, losses, income, expense, assets, liabilities', 'Effect on profit or loss, OCI, equity, cash flows', 'Consolidation implications', 'Exceptions and judgements', 'Interaction with other standards', 'Common misunderstandings and exam traps', 'Ethical considerations', 'Business scenario application', 'Exam-style questions and worked solutions', 'Revision summary and recall questions'];
const los = JSON.parse(readFileSync(`${root}/data/syllabus_los.json`, 'utf8')).los;
const secOf = (id) => (id[0] === 'G' ? 'G' : id[0] + id.slice(1).replace(/[a-z]+$/, ''));
const secs = new Map();
for (const lo of los) { const k = secOf(lo.id); if (!secs.has(k)) secs.set(k, { k, name: lo.section, area: lo.area, los: [] }); secs.get(k).los.push(lo.id); }
const NEEDS = {
  A: 'Tier 1/3 source needed: the ethical code applied in SBR and ACCA ethics guidance (not supplied).',
  B: 'Tier 1 source needed: the IASB Conceptual Framework text applicable to the session (not supplied).',
  C: 'Tier 1 source needed: the relevant IFRS/IAS standard text, plus the ACCA examinable documents (neither supplied).',
  D: 'Tier 1 source needed: the relevant group-accounting standards text, plus the ACCA examinable documents (neither supplied).',
  E: 'Tier 1/3 source needed: the relevant standards text, ACCA guidance on performance measures (not supplied).',
  F: 'Tier 1 source needed: IFRS Sustainability Disclosure Standards and ESRS comparison material, plus examinable documents (not supplied).',
  G: 'Tier 3 source needed: ACCA computer-based exam practice platform guidance (not supplied).',
};
const modules = [];
modules.push({ id: 'M0', title: 'Orientation: the SBR exam and how it is assessed', lessons: [
  { id: 'L-S7', title: 'Structure of the SBR exam', syllabusRefs: ['S7', 'S9'], status: 'verified-from-sources', claims: [F.duration, F.sectionA, F.q1, F.q2, F.sectionB, F.sectionBStake, F.psm, F.psmTotal, F.compulsory, F.pass].map((c, i) => withId(c, `c${i + 1}`)) },
  { id: 'L-S11', title: 'What can be examined, and when', syllabusRefs: ['S11'], status: 'verified-from-sources', claims: [withId(F.rule, 'c1'), withId(F.future, 'c2'), withId(F.defs, 'c3'),
    { id: 'c4', type: 'inference', text: 'The passage does not say which date the phrase "in the future" is measured from, so the ACCA examinable documents must be consulted to settle borderline cases.', citations: [cite(SYL, 'p17:c2', 'will not be examinable if the effective date is in the future, unless explicitly stated otherwise in this syllabus and study guide or examinable documents')], basis: 'The quoted rule refers to the future without naming a reference date, and it points to the examinable documents for exceptions.' }] },
  { id: 'L-STEP', title: 'Stepping up from FR: what changes at SBR', syllabusRefs: ['S7', 'E1a'], status: 'verified-from-sources', sourceNote: 'Based on an ACCA article dated June 2025; the 2026-27 syllabus controls where they differ.', claims: [F.regurg, F.depth, F.written, F.apm, F.sds, F.practice].map((c, i) => withId(c, `c${i + 1}`)) },
] });
modules.push({ id: 'MT', title: 'Exam technique', lessons: [
  { id: 'T-STAKE', title: 'Adopting a stakeholder focus', syllabusRefs: ['S7'], status: 'verified-from-sources', claims: [withId(F.stakeFocus, 'c1'), withId(F.stakeholders, 'c2'), withId(F.sectionBStake, 'c3')] },
  { id: 'T-STRUCT', title: 'A flexible five-step answer structure', syllabusRefs: ['S7'], status: 'app-guidance',
    sourceNote: 'This framework was specified in your project brief. It is NOT ACCA guidance and is not source-verified. Use it as a flexible aid, not a template.',
    steps: ['Identify the issue', 'Explain the applicable principle', 'Apply it to the facts', 'Explain the accounting and financial statement consequences', 'Conclude or recommend an action'],
    worked: {
      requirement: 'Explain how Section B differs from Section A in the SBR exam. (Subject matter is exam structure, so every fact below is source-verified.)',
      weak: 'Section B is harder and has more writing.',
      adequate: 'Section A has two scenario-based questions worth 30 and 20 marks. Section B has two questions worth 25 marks each.',
      strong: 'Issue: the difference in structure and focus. Principle (syllabus): Section A is two scenario-based questions worth 30 and 20 marks; Section B is two discursive questions worth 25 marks each. Application: the first Section A question centres on group accounting and a spreadsheet task, while Section B can cover any syllabus area. Consequence: revision must cover all areas because all questions are compulsory, and Section B always needs a stakeholder viewpoint. Conclusion: plan revision across the whole syllabus and practise stakeholder-focused answers.',
      commentary: 'Weak: vague and unsupported. Adequate: accurate but only restates facts. Strong: states the issue, applies the facts to the learner’s situation and draws a conclusion. The marks logic here is illustrative, not an ACCA marking scheme.',
      supportingClaims: [F.sectionA, F.sectionB, F.q1, F.sectionBStake, F.compulsory].map((c, i) => withId(c, `c${i + 1}`)),
    } },
  { id: 'T-VERBS', title: 'Command verbs: discuss, explain, evaluate, advise, analyse', syllabusRefs: ['S7'], status: 'source-required', requiredSources: ['ACCA guidance defining command verbs (not supplied)'] },
  { id: 'T-MARKER', title: 'What markers reward', syllabusRefs: ['S7'], status: 'source-required', requiredSources: ["ACCA article 'Read the mind of an SBR marker' (referenced by the supplied article; not supplied)", "ACCA article 'Strategic Business Reporting - exam techniques for success' (referenced; not supplied)", 'ACCA examiner reports and specimen exam answers (not supplied)'] },
] });
for (const area of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
  const ss = [...secs.values()].filter((s) => s.area === area);
  modules.push({ id: `M${area}`, title: `${ss[0] ? los.find((l) => l.area === area).areaName : area}`, lessons: ss.map((s) => ({
    id: `L-${s.k}`, title: s.name, syllabusRefs: s.los, status: 'source-required', requiredSources: [NEEDS[area]], template: TEMPLATE,
    note: 'Syllabus scope is verified. Technical content is NOT written: no authoritative standard text is loaded, and the tutor will not teach accounting rules from model memory.',
  })) });
}
const curriculum = { generatedBy: 'scripts/author-content.js', template18: TEMPLATE, modules,
  diagnostic: { part1: 'Self-rating of confidence per syllabus area (1-5). Self-assessment only: it is not a knowledge test and is never shown as a score.', part2: 'Scored recall questions drawn from verified questions (exam structure and approach).', part2QuestionIds: q.slice(0, 8).map((x) => x.id) } };

writeFileSync(`${root}/data/questions.json`, JSON.stringify({ note: 'All questions are ORIGINAL AI-generated wording testing verified exam-structure facts. None is an ACCA question. Rubrics are indicative, not official marking schemes.', questions: q }, null, 1));
writeFileSync(`${root}/data/curriculum.json`, JSON.stringify(curriculum, null, 1));
console.log(`questions: ${q.length}, lessons: ${modules.flatMap((m) => m.lessons).length}`);
