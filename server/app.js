import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, normalize, join } from 'node:path';
import { release, issueNonAnswer, UnverifiedOutputError } from '../engine/release.js';
import { route } from '../engine/router.js';
import { markAnswer } from '../engine/marking.js';
import { safeEqual } from '../engine/util.js';
import { ERROR_CATEGORIES } from '../engine/progress.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const MAX_BODY = 64 * 1024;

/** Route kinds: 'technical' handlers MUST return an object issued by the engine; the framework calls release() on it.
 *  'meta' handlers return plain data that carries no accounting content (health, progress numbers, source registry). */
export function createApp({ pipeline, serve, registry, corpus, audit, corrections, progress, content, generator, verifier, marker, token, clientDir, allowedOrigin = null }) {
  const routes = [];
  const add = (method, pattern, kind, handler) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:[a-z]+/gi, '([^/]+)')}$`), kind, handler });

  add('GET', '/api/health', 'public', async () => ({ ok: true }));
  add('GET', '/api/status', 'meta', async () => ({
    session: registry.targetSession, sources: registry.sources.map((s) => ({ id: s.id, title: s.title, tier: s.tier, version: s.version, status: s.status, sha256: s.sha256, access: s.access, authenticity: s.authenticity, caveat: s.caveat, extraction: s.extraction, usage: s.usage })),
    missingSources: registry.missingSources, quarantined: corpus.quarantined, missingFromCorpus: corpus.missing, hasTier1Source: pipeline.hasTier1,
    generator: { name: generator?.name, available: Boolean(generator?.available?.()), isStub: Boolean(generator?.isStub) }, verifier: { name: verifier?.name, available: Boolean(verifier?.available?.()), isStub: Boolean(verifier?.isStub) },
    auditChain: audit.verifyChain(), openErrorReports: corrections.open().length,
  }));
  add('GET', '/api/coverage', 'meta', async () => content.matrix);
  add('GET', '/api/curriculum', 'meta', async () => ({ modules: content.curriculum.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, status: l.status, syllabusRefs: l.syllabusRefs })) })), diagnostic: content.curriculum.diagnostic }));
  add('GET', '/api/lessons/:id', 'technical', async ({ params }) => {
    const l = content.curriculum.modules.flatMap((m) => m.lessons).find((x) => x.id === params[0]);
    return l ? serve.lesson(l) : issueNonAnswer({ outcome: 'abstain', message: 'Unknown lesson.' });
  });
  add('GET', '/api/questions', 'meta', async () => ({ questions: content.questions.questions.filter((q) => q.status === 'verified' && !corrections.isBlocked('question', q.id)).map((q) => ({ id: q.id, topic: q.topic, syllabusRefs: q.syllabusRefs, difficulty: q.difficulty, skill: q.skill })) }));
  add('GET', '/api/questions/:id', 'technical', async ({ params }) => { const q = content.questions.questions.find((x) => x.id === params[0]); return q ? serve.questionPublic(q) : issueNonAnswer({ outcome: 'abstain', message: 'Unknown question.' }); });
  add('POST', '/api/questions/:id/reveal', 'technical', async ({ params }) => { const q = content.questions.questions.find((x) => x.id === params[0]); return q ? serve.questionAnswer(q) : issueNonAnswer({ outcome: 'abstain', message: 'Unknown question.' }); });
  add('POST', '/api/tutor', 'technical', async ({ body }) => {
    const r = route(body.message);
    if (r.kind === 'template') return r.payload;
    return pipeline.answer({ question: String(body.message ?? ''), mode: String(body.mode ?? 'teach'), scenario: String(body.scenario ?? ''), learnerAnswer: String(body.learnerAnswer ?? ''), profile: body.personalise === false ? null : progress.profileForTutor() });
  });
  add('POST', '/api/tutor/reveal', 'technical', async ({ body }) => pipeline.reveal(String(body.answerId ?? '')));
  add('POST', '/api/evidence', 'technical', async ({ body }) => pipeline.evidenceOnly(String(body.question ?? '')));
  add('POST', '/api/mark', 'technical', async ({ body }) => {
    const q = content.questions.questions.find((x) => x.id === body.questionId);
    if (!q) return issueNonAnswer({ outcome: 'abstain', message: 'Unknown question.' });
    return markAnswer({ question: q, answer: String(body.answer ?? ''), marker, ctx: { corpus, registry, session: registry.targetSession.id }, corrections });
  });
  add('GET', '/api/progress', 'meta', async () => ({ due: progress.due(), weak: progress.weakAreas(), mistakes: progress.recurringMistakes(), confidence: progress.data.confidence, attempts: progress.data.attempts.length, categories: ERROR_CATEGORIES }));
  add('POST', '/api/progress/attempt', 'meta', async ({ body }) => { progress.recordAttempt({ questionId: String(body.questionId), syllabusRefs: Array.isArray(body.syllabusRefs) ? body.syllabusRefs.map(String) : [], score: Number(body.score) || 0, max: Number(body.max) || 0, category: body.category || null, hintsUsed: Number(body.hintsUsed) || 0 }); return { ok: true }; });
  add('POST', '/api/progress/confidence', 'meta', async ({ body }) => { progress.setConfidence(String(body.area), Number(body.rating)); return { ok: true }; });
  add('DELETE', '/api/progress', 'meta', async () => { progress.wipe(); return { ok: true }; });
  add('POST', '/api/report-error', 'meta', async ({ body }) => { const it = corrections.report({ targetType: String(body.targetType), targetId: String(body.targetId), description: String(body.description ?? '') }); pipeline.refresh(); return { ok: true, id: it.id, relatedChunks: it.relatedChunks }; });
  add('GET', '/api/corrections', 'meta', async () => ({ open: corrections.open() }));
  add('GET', '/api/audit/verify', 'meta', async () => audit.verifyChain());

  const buckets = new Map();
  const limited = (ip) => { const now = Date.now(); const b = (buckets.get(ip) ?? []).filter((t) => now - t < 60000); b.push(now); buckets.set(ip, b); return b.length > 90; };
  const headers = (extra = {}) => ({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'", ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' } : {}), ...extra });
  const json = (res, status, obj) => { res.writeHead(status, headers({ 'content-type': 'application/json' })); res.end(JSON.stringify(obj)); };

  async function readBody(req) {
    let size = 0; const parts = [];
    for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('body too large'), { status: 413 }); parts.push(chunk); }
    if (!parts.length) return {};
    try { const v = JSON.parse(Buffer.concat(parts).toString('utf8')); return v && typeof v === 'object' ? v : {}; } catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'OPTIONS') { res.writeHead(204, headers()); return res.end(); }
      if (url.pathname.startsWith('/api/')) {
        const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
        if (!r) return json(res, 404, { error: 'not found' });
        if (r.kind !== 'public') {
          const auth = req.headers.authorization ?? '';
          if (!token || !safeEqual(auth, `Bearer ${token}`)) return json(res, 401, { error: 'unauthorised' });
          if (limited(req.socket.remoteAddress ?? 'x')) return json(res, 429, { error: 'rate limited' });
        }
        const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
        const out = await r.handler({ params: url.pathname.match(r.re).slice(1).map(decodeURIComponent), body });
        if (r.kind === 'technical') return json(res, 200, release(out)); // throws if not engine-issued
        return json(res, 200, out);
      }
      // static client
      let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
      if (p === '/' || p === '\\') p = '/index.html';
      const file = join(clientDir, p);
      if (!file.startsWith(resolve(clientDir)) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, headers()); return res.end('not found'); }
      res.writeHead(200, headers({ 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': extname(file) === '.html' ? 'no-store' : 'no-cache' }));
      res.end(readFileSync(file));
    } catch (e) {
      if (e instanceof UnverifiedOutputError) return json(res, 500, { error: 'blocked: output was not issued by the verification engine' });
      json(res, e.status ?? 500, { error: e.status ? e.message : 'internal error' });
    }
  });
}
