#!/usr/bin/env node
// Validates every shipped lesson, question and learning outcome with the same code the tutor uses at runtime.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from '../engine/registry.js';
import { loadCorpus } from '../engine/corpus.js';
import { validateQuestions, validateCurriculum } from '../engine/content.js';
import { checkLOs } from './check-los.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function validateAll() {
  const registry = loadRegistry(`${root}/sources/registry.json`);
  const session = registry.targetSession.id;
  const corpus = loadCorpus(`${root}/data/corpus`, registry, session);
  const errors = [];
  if (corpus.quarantined.length) errors.push(`quarantined sources: ${JSON.stringify(corpus.quarantined)}`);
  if (corpus.missing.length) errors.push(`approved sources missing from corpus: ${corpus.missing.join(', ')} (run npm run ingest)`);
  if (errors.length) return { ok: false, errors, counts: {} };
  const lo = JSON.parse(readFileSync(`${root}/data/syllabus_los.json`, 'utf8'));
  const ids = new Set([...lo.los, ...lo.nonLO].map((x) => x.id));
  const ctx = { corpus, registry, session };
  const lc = checkLOs(root);
  for (const r of lc.results.filter((x) => !x.status.startsWith('verified'))) errors.push(`LO ${r.id}: ${r.status}`);
  const bank = JSON.parse(readFileSync(`${root}/data/questions.json`, 'utf8'));
  const cur = JSON.parse(readFileSync(`${root}/data/curriculum.json`, 'utf8'));
  errors.push(...validateQuestions(bank, ctx, ids), ...validateCurriculum(cur, ctx, ids));
  return { ok: errors.length === 0, errors, counts: { los: lo.los.length, questions: bank.questions.length, lessons: cur.modules.flatMap((m) => m.lessons).length } };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(`${root}/data/corpus`)) { console.error('No corpus. Run npm run ingest first.'); process.exit(2); }
  const r = validateAll();
  console.log(r.ok ? `content valid: ${JSON.stringify(r.counts)}` : `CONTENT INVALID:\n${r.errors.join('\n')}`);
  process.exit(r.ok ? 0 : 1);
}
