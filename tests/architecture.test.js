// Evidence that the production app cannot silently bypass verification. Static scans of the real source plus runtime checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const src = (dir) => walk(`${root}/${dir}`).map((p) => ({ path: relative(root, p), text: readFileSync(p, 'utf8') }));
const engine = src('engine'); const server = src('server');

test('issue* functions that mint releasable output are imported only by the engine modules that verify', () => {
  const allowed = { issueVerifiedAnswer: ['engine/pipeline.js', 'engine/serve.js'], issueMarking: ['engine/marking.js'], issueTemplate: ['engine/router.js', 'engine/serve.js'], issueNonAnswer: ['engine/pipeline.js', 'engine/serve.js', 'engine/marking.js', 'engine/router.js', 'server/app.js'] };
  for (const f of [...engine, ...server]) {
    if (f.path === 'engine/release.js') continue;
    for (const [fn, ok] of Object.entries(allowed)) if (new RegExp(`\\b${fn}\\b`).test(f.text)) assert.ok(ok.includes(f.path), `${f.path} must not use ${fn}`);
  }
});

test('model .complete( is called only from the verification-aware modules', () => {
  const ok = ['engine/pipeline.js', 'engine/modelVerifier.js', 'engine/marking.js', 'engine/models/anthropic.js'];
  for (const f of [...engine, ...server]) if (/\.complete\(/.test(f.text)) assert.ok(ok.includes(f.path), `${f.path} calls a model directly`);
  assert.ok(!server.some((f) => /\.complete\(/.test(f.text)), 'the HTTP layer never calls a model');
});

test('the generator is only invoked inside the pipeline, always followed by deterministic verification', () => {
  const p = engine.find((f) => f.path === 'engine/pipeline.js').text;
  const gen = p.indexOf('generator.complete'); const det = p.indexOf('verifyDeterministic(parsed');
  assert.ok(gen > 0 && det > gen, 'verification follows generation');
  assert.match(p, /modelVerify\(/); assert.match(p, /independen/i);
});

test('only the Anthropic provider reads secrets from the environment', () => {
  for (const f of [...engine, ...server]) if (/process\.env/.test(f.text)) assert.ok(['engine/models/anthropic.js', 'server/index.js'].includes(f.path), `${f.path} reads process.env`);
});

test('no source file embeds credentials', () => {
  for (const f of [...engine, ...server, ...src('scripts'), ...src('tests')]) {
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(f.text), `${f.path} contains an API-key-like string`);
    assert.ok(!/password\s*[:=]\s*['"][^'"]{4,}['"]/i.test(f.text.replace(/\/password\\s\*\[:=\]\/i/g, '')), `${f.path} contains a hard-coded password`);
  }
});

test('every technical HTTP route passes through release(); technical routes are enumerated', () => {
  const app = server.find((f) => f.path === 'server/app.js').text;
  assert.match(app, /r\.kind === 'technical'\) return json\(res, 200, release\(out\)\)/);
  const technical = [...app.matchAll(/add\('(GET|POST)', '([^']+)', 'technical'/g)].map((m) => m[2]);
  for (const need of ['/api/tutor', '/api/tutor/reveal', '/api/evidence', '/api/mark', '/api/lessons/:id', '/api/questions/:id']) assert.ok(technical.includes(need), need);
});

test('meta routes do not call the pipeline or serve technical content', () => {
  const app = server.find((f) => f.path === 'server/app.js').text;
  for (const line of app.split('\n').filter((l) => /'meta'/.test(l))) assert.ok(!/pipeline\.(answer|reveal)|serve\.|markAnswer|\.complete\(/.test(line), line.slice(0, 80));
});

test('the bootstrap refuses to start without a token, a corpus, or valid content', () => {
  const idx = readFileSync(`${root}/server/index.js`, 'utf8');
  assert.match(idx, /Refusing to start: set APP_TOKEN/); assert.match(idx, /Refusing to start: no corpus/); assert.match(idx, /failed validation/);
  assert.match(idx, /HOST \|\| '127\.0\.0\.1'/);
});

test('the pipeline refuses a verifier with the same provider name as the generator', async () => {
  const { createPipeline } = await import('../engine/pipeline.js');
  const { AuditLog } = await import('../engine/audit.js');
  const { Corrections } = await import('../engine/corrections.js');
  const { fixtureEnv, scripted, credulousVerifier, goodAnswer } = await import('./helpers/fixtures.js');
  const { tmpdir } = await import('node:os'); const { mkdtempSync } = await import('node:fs');
  const dir = mkdtempSync(`${tmpdir()}/arch-`); const audit = new AuditLog(`${dir}/a.jsonl`);
  const p = createPipeline({ ...fixtureEnv(), generator: scripted('same', () => goodAnswer()), verifier: credulousVerifier('same'), audit, corrections: new Corrections(`${dir}/c.json`, audit) });
  const r = await p.answer({ question: 'When must an entity recognise a widget asset?' });
  assert.notEqual(r.outcome, 'verified');
});

test('released objects are frozen and non-forgeable', async () => {
  const { isReleasable, issueNonAnswer } = await import('../engine/release.js');
  const a = issueNonAnswer({ outcome: 'abstain', message: 'x' });
  assert.ok(isReleasable(a)); assert.ok(Object.isFrozen(a));
  assert.ok(!isReleasable({ ...a })); assert.ok(!isReleasable(JSON.parse(JSON.stringify(a))));
});
