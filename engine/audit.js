import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sha256, nowIso } from './util.js';

/** Append-only, hash-chained JSONL log. Tampering with any earlier record breaks verifyChain(). */
export class AuditLog {
  constructor(path, { storeQuestionText = true } = {}) {
    this.path = path;
    this.storeQuestionText = storeQuestionText;
    mkdirSync(dirname(path), { recursive: true });
    this.seq = 0;
    this.head = 'GENESIS';
    if (existsSync(path)) {
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      if (lines.length) { const last = JSON.parse(lines.at(-1)); this.seq = last.seq; this.head = last.hash; }
    }
  }
  append(record) {
    const body = { ...record, seq: this.seq + 1, ts: nowIso(), prevHash: this.head };
    if (!this.storeQuestionText && body.question) { body.questionHash = sha256(body.question); delete body.question; }
    const hash = sha256(JSON.stringify(body));
    const line = JSON.stringify({ ...body, hash });
    appendFileSync(this.path, line + '\n');
    this.seq = body.seq; this.head = hash;
    return { seq: body.seq, hash };
  }
  verifyChain() {
    if (!existsSync(this.path)) return { ok: true, records: 0 };
    let prev = 'GENESIS', n = 0;
    for (const line of readFileSync(this.path, 'utf8').split('\n').filter(Boolean)) {
      const rec = JSON.parse(line);
      const { hash, ...body } = rec;
      if (rec.prevHash !== prev || sha256(JSON.stringify(body)) !== hash) return { ok: false, brokenAt: rec.seq, records: n };
      prev = hash; n++;
    }
    return { ok: true, records: n };
  }
  find(id) {
    if (!existsSync(this.path)) return null;
    for (const line of readFileSync(this.path, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(line); if (r.answerId === id) return r; }
    return null;
  }
}
