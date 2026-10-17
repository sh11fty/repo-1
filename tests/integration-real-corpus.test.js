import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from '../engine/registry.js';
import { loadCorpus } from '../engine/corpus.js';
import { retrieve, buildIndex } from '../engine/retrieval.js';
import { validateAll } from '../scripts/validate-content.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const have = existsSync(`${root}/data/corpus`);
const skip = have ? false : 'real corpus not present (raw PDFs are gitignored); run `npm run ingest`';

test('shipped content (questions, lessons, rubrics) validates against the real corpus', { skip }, () => {
  const v = validateAll(); assert.deepEqual(v.errors, []); assert.equal(v.ok, true);
});

test('the real corpus has no quarantined sources and the registry hashes match', { skip }, () => {
  const registry = loadRegistry(`${root}/sources/registry.json`);
  const corpus = loadCorpus(`${root}/data/corpus`, registry, registry.targetSession.id);
  assert.deepEqual(corpus.quarantined, []); assert.ok(corpus.chunks.size > 100);
});

test('real retrieval finds exam-structure evidence and refuses an IFRS technical question (no tier 1 source)', { skip }, () => {
  const registry = loadRegistry(`${root}/sources/registry.json`);
  const corpus = loadCorpus(`${root}/data/corpus`, registry, registry.targetSession.id);
  const idx = buildIndex(corpus);
  assert.ok(retrieve(idx, registry, 'how long is the SBR exam and how many marks').sufficient);
  const r = retrieve(idx, registry, 'what is the lease liability discount rate under IFRS 16 for a lessee');
  assert.ok(!r.sufficient || !r.hits.some((h) => registry.byId.get(h.chunk.sourceId).tier === 1), 'no tier-1 evidence exists');
});
