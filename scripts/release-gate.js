#!/usr/bin/env node
// Release gate: runs the adversarial suite, the full node test run and content validation against the real corpus.
// Exits non-zero on any critical failure. It never claims the app is hallucination-free.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite, CASES } from '../tests/adversarial-cases.js';
import { validateAll } from './validate-content.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suite = await runSuite();
const t = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...['unit', 'adversarial', 'pipeline', 'marking', 'server', 'architecture', 'integration-real-corpus'].map((n) => `tests/${n}.test.js`)], { cwd: root, encoding: 'utf8', timeout: 300000 });
const num = (k) => Number((t.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [])[1] ?? NaN);
const tests = { total: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), exitCode: t.status };
const content = existsSync(`${root}/data/corpus`) ? validateAll() : { ok: false, errors: ['no corpus; content validation not run'], counts: {} };

const m = suite.metrics;
const checks = [
  ['zero critical failures in the adversarial suite', m.criticalFailures === 0],
  ['no adversarial case released', m.hallucinationCasesReleased === 0],
  ['unsupported-claim rate in released answers is 0 (independent oracle)', m.unsupportedClaimRateInReleased === 0],
  ['citation validity in released answers is 1', m.citationValidityInReleased === 1],
  ['correct abstention/rejection rate is 1', m.correctAbstentionOrRejectionRate === 1],
  ['positive controls accepted (no over-blocking)', m.honestAnswerAcceptanceRate === 1],
  ['node test run passes with none skipped', tests.exitCode === 0 && tests.fail === 0 && tests.skipped === 0],
  ['shipped content validates against the corpus', content.ok],
].map(([name, ok]) => ({ name, ok: Boolean(ok) }));
const pass = checks.every((c) => c.ok);

const report = {
  generatedAt: new Date().toISOString(), result: pass ? 'PASS' : 'FAIL', checks, adversarial: m, tests, content: { ok: content.ok, counts: content.counts, errors: content.errors },
  notClaimed: [
    'Zero real-world hallucinations is NOT claimed and cannot be guaranteed.',
    'The adversarial suite uses scripted stub models (isStub) and synthetic fixture sources. It proves the pipeline rejects or abstains correctly given bad model output; it does not measure any real model\'s hallucination rate. Run `npm run eval:live` with a real key for that.',
    'Independent human review of high-risk cases has NOT been done. Marking agreement was measured against author-written reference judgements, not independent examiner marking.',
    'No IFRS/IAS standard text, ACCA examinable documents, Study Hub content or official past papers are loaded, so technical accounting teaching is declined and coverage is not claimed.',
  ],
};
mkdirSync(`${root}/reports`, { recursive: true });
writeFileSync(`${root}/reports/release_report.json`, JSON.stringify(report, null, 1));
const md = [`# Release report`, '', `Generated ${report.generatedAt}. **Result: ${report.result}**`, '', '## Gate checks', '', ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}`), '',
  '## Adversarial suite', '', `Cases: ${m.cases} (critical: ${m.criticalCases}); critical failures: ${m.criticalFailures}`, '', '```json', JSON.stringify(m, null, 1), '```', '',
  '## Node tests', '', `total ${tests.total}, pass ${tests.pass}, fail ${tests.fail}, skipped ${tests.skipped}`, '', '## Content validation', '', content.ok ? `valid ${JSON.stringify(content.counts)}` : content.errors.join('\n'), '',
  '## Case list', '', '| Id | Category | Critical | Title |', '|---|---|---|---|', ...CASES.map((c) => `| ${c.id} | ${c.category} | ${c.critical ? 'yes' : ''} | ${c.title} |`), '',
  '## What this does NOT show', '', ...report.notClaimed.map((x) => `- ${x}`)].join('\n');
mkdirSync(`${root}/docs`, { recursive: true });
writeFileSync(`${root}/docs/RELEASE_REPORT.md`, md + '\n');
console.log(`${report.result}: ${checks.filter((c) => c.ok).length}/${checks.length} checks; tests ${tests.pass}/${tests.total}; critical failures ${m.criticalFailures}`);
process.exit(pass ? 0 : 1);
