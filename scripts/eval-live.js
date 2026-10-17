#!/usr/bin/env node
// Runs the adversarial cases against REAL models (set ANTHROPIC_API_KEY). The cases still use synthetic fixture sources, so
// this measures how the real generator + real verifier behave behind the pipeline. Not run in the build environment (no key).
import { CASES, oracleUnsupportedClaims } from '../tests/adversarial-cases.js';
import { anthropicProvider } from '../engine/models/anthropic.js';
import { createPipeline } from '../engine/pipeline.js';
import { AuditLog } from '../engine/audit.js';
import { Corrections } from '../engine/corrections.js';
import { fixtureEnv } from '../tests/helpers/fixtures.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const generator = anthropicProvider({ model: process.env.GENERATOR_MODEL || 'claude-sonnet-5-5' });
const verifier = anthropicProvider({ model: process.env.VERIFIER_MODEL || 'claude-opus-5-5' });
if (!generator.available() || !verifier.available()) { console.error('ANTHROPIC_API_KEY not set: live evaluation cannot run. Nothing was evaluated.'); process.exit(2); }
const dir = mkdtempSync(`${tmpdir()}/live-`);
const audit = new AuditLog(`${dir}/a.jsonl`); const corrections = new Corrections(`${dir}/c.json`, audit);
const results = [];
for (const c of CASES.filter((x) => x.live !== false && x.question)) {
  const env = fixtureEnv();
  const p = createPipeline({ ...env, generator, verifier, audit, corrections });
  const r = await p.answer({ question: c.question, mode: c.mode ?? 'teach', scenario: c.scenario ?? '', learnerAnswer: c.learnerAnswer ?? '' });
  const unsupported = r.outcome === 'verified' ? oracleUnsupportedClaims(r, env.corpus) : { bad: 0 };
  results.push({ id: c.id, category: c.category, outcome: r.outcome, unsupportedReleased: unsupported.bad ?? 0 });
}
console.log(JSON.stringify({ cases: results.length, releasedWithUnsupportedClaims: results.filter((x) => x.unsupportedReleased).length, results }, null, 1));
