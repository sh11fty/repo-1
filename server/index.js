import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from '../engine/registry.js';
import { loadCorpus } from '../engine/corpus.js';
import { createPipeline } from '../engine/pipeline.js';
import { createServe } from '../engine/serve.js';
import { AuditLog } from '../engine/audit.js';
import { Corrections } from '../engine/corrections.js';
import { Progress } from '../engine/progress.js';
import { anthropicProvider } from '../engine/models/anthropic.js';
import { createApp } from './app.js';
import { validateAll } from '../scripts/validate-content.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// minimal .env loader (no dependency). Real environment variables win. Secrets are never printed.
if (existsSync(`${root}/.env`)) for (const line of readFileSync(`${root}/.env`, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env) && m[2]) process.env[m[1]] = m[2]; }

const env = process.env;
if (!env.APP_TOKEN || env.APP_TOKEN.length < 24) { console.error('Refusing to start: set APP_TOKEN (24+ random characters) in .env or the environment.'); process.exit(1); }
if (!existsSync(`${root}/data/corpus`)) { console.error('Refusing to start: no corpus. Place the source PDFs in sources/raw/ and run `npm run ingest`.'); process.exit(1); }

const registry = loadRegistry(`${root}/sources/registry.json`);
const session = env.TARGET_SESSION || registry.targetSession.id;
const corpus = loadCorpus(`${root}/data/corpus`, registry, session);
const v = validateAll();
if (!v.ok) { console.error(`Refusing to start: shipped content failed validation:\n${v.errors.join('\n')}`); process.exit(1); }

const generator = anthropicProvider({ model: env.GENERATOR_MODEL || 'claude-sonnet-5-5' });
const verifier = anthropicProvider({ model: env.VERIFIER_MODEL || 'claude-opus-5-5' });
const audit = new AuditLog(`${root}/data/audit/audit.jsonl`, { storeQuestionText: env.AUDIT_STORE_QUESTIONS !== '0' });
const corrections = new Corrections(`${root}/data/corrections.json`, audit);
const progress = new Progress(`${root}/data/progress/progress.json`);
const lo = JSON.parse(readFileSync(`${root}/data/syllabus_los.json`, 'utf8'));
const content = { matrix: JSON.parse(readFileSync(`${root}/data/coverage/matrix.json`, 'utf8')), curriculum: JSON.parse(readFileSync(`${root}/data/curriculum.json`, 'utf8')), questions: JSON.parse(readFileSync(`${root}/data/questions.json`, 'utf8')) };
const pipeline = createPipeline({ corpus, registry, session, generator, verifier, audit, corrections, syllabus: lo.los });
const serve = createServe({ corpus, registry, session, corrections });
const app = createApp({ pipeline, serve, registry, corpus, audit, corrections, progress, content, generator, verifier, marker: generator, token: env.APP_TOKEN, clientDir: `${root}/client`, allowedOrigin: env.ALLOWED_ORIGIN || null });

const port = Number(env.PORT || 8787); const host = env.HOST || '127.0.0.1';
app.listen(port, host, () => {
  console.log(`SBR tutor on http://${host}:${port}  session=${session}`);
  console.log(`generator available: ${generator.available()}  verifier available: ${verifier.available()}  (technical answers fail closed when either is unavailable)`);
  if (!pipeline.hasTier1) console.log('NOTE: no IFRS/IAS (tier 1) source is loaded; technical accounting questions will be declined.');
});
