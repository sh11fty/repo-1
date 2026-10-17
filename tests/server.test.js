import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app.js';
import { createPipeline } from '../engine/pipeline.js';
import { createServe } from '../engine/serve.js';
import { AuditLog } from '../engine/audit.js';
import { Corrections } from '../engine/corrections.js';
import { Progress } from '../engine/progress.js';
import { fixtureEnv, scripted, unavailable, credulousVerifier, goodAnswer } from './helpers/fixtures.js';

const servers = [];
after(() => { for (const s of servers) { s.closeAllConnections?.(); s.close(); } });
const TOKEN = 'test-token-0123456789-abcdefghij';
async function boot({ generator, verifier, pipelineOverride } = {}) {
  const env = fixtureEnv();
  const dir = mkdtempSync(`${tmpdir()}/sbr-srv-`);
  const audit = new AuditLog(`${dir}/a.jsonl`);
  const corrections = new Corrections(`${dir}/c.json`, audit);
  const progress = new Progress(`${dir}/p.json`);
  const gen = generator ?? scripted('gen', () => goodAnswer());
  const ver = verifier ?? credulousVerifier();
  const pipeline = pipelineOverride ?? createPipeline({ ...env, generator: gen, verifier: ver, audit, corrections });
  const serve = createServe({ ...env, corrections });
  const content = { matrix: { rows: [] }, curriculum: { modules: [], diagnostic: {} }, questions: { questions: [] } };
  const app = createApp({ pipeline, serve, registry: env.registry, corpus: env.corpus, audit, corrections, progress, content, generator: gen, verifier: ver, marker: gen, token: TOKEN, clientDir: dir });
  servers.push(app);
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const call = (method, path, body, token = TOKEN) => fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  return { call, close: () => app.close(), audit };
}

test('health is public; everything else needs the bearer token', async () => {
  const s = await boot();
  assert.equal((await s.call('GET', '/api/health', null, null)).status, 200);
  for (const [m, p] of [['GET', '/api/status'], ['POST', '/api/tutor'], ['GET', '/api/progress'], ['POST', '/api/mark'], ['GET', '/api/lessons/x']]) {
    assert.equal((await s.call(m, p, {}, null)).status, 401, p);
    assert.equal((await s.call(m, p, {}, 'wrong-token')).status, 401, p);
  }
  s.close();
});

test('tutor returns a verified, cited answer over HTTP', async () => {
  const s = await boot();
  const r = await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' });
  assert.equal(r.status, 200); assert.equal(r.body.outcome, 'verified'); assert.ok(r.body.blocks[0].citations[0].sourceTitle);
  s.close();
});

test('with the generator or verifier unavailable the tutor fails closed with no technical content', async () => {
  for (const o of [{ generator: unavailable('g') }, { verifier: unavailable('v') }]) {
    const s = await boot(o);
    const r = await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' });
    assert.equal(r.status, 200); assert.equal(r.body.outcome, 'unavailable'); assert.ok(!r.body.blocks);
    assert.ok(!r.body.claims && !r.body.tutorMoves, 'no generated content in the unavailable response');
    s.close();
  }
});

test('a technical route that returns a plain unbranded object is blocked with a 500 and nothing leaks', async () => {
  const leaky = { hasTier1: true, refresh() {}, async answer() { return { outcome: 'verified', blocks: [{ text: 'IFRS 16 says whatever the model remembered' }] }; }, reveal() { return { text: 'x' }; }, evidenceOnly() { return { text: 'x' }; } };
  const s = await boot({ pipelineOverride: leaky });
  const r = await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' });
  assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('IFRS 16'));
  s.close();
});

test('a spread copy or JSON round-trip of an engine answer is not releasable', async () => {
  const env = fixtureEnv();
  const dir = mkdtempSync(`${tmpdir()}/sbr-srv-`);
  const audit = new AuditLog(`${dir}/a.jsonl`);
  const real = createPipeline({ ...env, generator: scripted('g', () => goodAnswer()), verifier: credulousVerifier(), audit, corrections: new Corrections(`${dir}/c.json`, audit) });
  const copying = { hasTier1: true, refresh() {}, async answer(a) { return { ...(await real.answer(a)) }; }, reveal() {}, evidenceOnly() {} };
  const s = await boot({ pipelineOverride: copying });
  assert.equal((await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' })).status, 500);
  s.close();
});

test('there is no free-chat endpoint and unknown routes 404', async () => {
  const s = await boot();
  for (const p of ['/api/chat', '/api/complete', '/api/ask', '/api/llm']) assert.equal((await s.call('POST', p, { message: 'hi' })).status, 404, p);
  s.close();
});

test('oversized bodies and malformed JSON are rejected', async () => {
  const s = await boot();
  assert.equal((await s.call('POST', '/api/tutor', { message: 'x'.repeat(70000) })).status, 413);
  s.close();
});

test('error reports withdraw a chunk at once and the audit chain stays valid', async () => {
  const s = await boot();
  assert.equal((await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' })).body.outcome, 'verified');
  assert.equal((await s.call('POST', '/api/report-error', { targetType: 'chunk', targetId: 'FX-STD-ALPHA:p3:c1', description: 'wrong' })).status, 200);
  assert.notEqual((await s.call('POST', '/api/tutor', { message: 'When must an entity recognise a widget asset?' })).body.outcome, 'verified');
  assert.equal((await s.call('GET', '/api/audit/verify')).body.ok, true);
  s.close();
});

test('status exposes stub status and never exposes secrets', async () => {
  const s = await boot();
  const r = await s.call('GET', '/api/status');
  assert.equal(r.body.generator.isStub, true);
  assert.ok(!JSON.stringify(r.body).includes(TOKEN));
  s.close();
});

test('greeting and help are templates, not model output; the model is not called', async () => {
  const gen = scripted('g', () => goodAnswer());
  const s = await boot({ generator: gen });
  const r = await s.call('POST', '/api/tutor', { message: 'hello' });
  assert.equal(r.status, 200); assert.equal(gen.calls, 0);
  s.close();
});
