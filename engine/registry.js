import { readFileSync, existsSync } from 'node:fs';
import { sha256 } from './util.js';

export const TIERS = Object.freeze({
  1: 'Official IFRS/IAS standard text',
  2: 'ACCA syllabus / examinable documents for the session',
  3: 'Official ACCA exam guidance, examiner reports, technical articles, past papers',
  4: 'Other reputable technical reference (supplementary)',
  5: 'Textbook (supplementary; usable only after cross-check)',
});
export const STATUSES = ['approved', 'pending', 'superseded', 'rejected', 'quarantined'];

const REQUIRED = ['id', 'title', 'publisher', 'tier', 'version', 'status', 'sha256', 'sessions', 'access', 'authenticity'];

export function validateSourceRecord(s) {
  const errs = [];
  for (const f of REQUIRED) if (s[f] === undefined || s[f] === null || s[f] === '') errs.push(`missing ${f}`);
  if (![1, 2, 3, 4, 5].includes(s.tier)) errs.push('tier must be 1-5');
  if (!STATUSES.includes(s.status)) errs.push('invalid status');
  if (s.sha256 && !/^[0-9a-f]{64}$/.test(s.sha256)) errs.push('sha256 malformed');
  if (!Array.isArray(s.sessions) || s.sessions.length === 0) errs.push('sessions must be a non-empty array');
  if (s.tier === 5 && s.crossChecked === undefined) errs.push('tier 5 sources must declare crossChecked');
  return errs;
}

export function loadRegistry(path) {
  return buildRegistry(JSON.parse(readFileSync(path, 'utf8')));
}

export function buildRegistry(raw) {
  const errors = [];
  const ids = new Set();
  for (const s of raw.sources) {
    const e = validateSourceRecord(s);
    if (ids.has(s.id)) e.push('duplicate id');
    ids.add(s.id);
    if (e.length) errors.push(`${s.id ?? '(no id)'}: ${e.join('; ')}`);
  }
  if (errors.length) throw new Error(`Invalid source registry:\n${errors.join('\n')}`);
  return Object.freeze({ ...raw, byId: new Map(raw.sources.map((s) => [s.id, s])) });
}

/** A source is usable only if approved, applicable to the session, not superseded and (tier 5) cross-checked. */
export function usability(source, sessionId) {
  if (!source) return { usable: false, reason: 'unknown-source' };
  if (source.status !== 'approved') return { usable: false, reason: `status-${source.status}` };
  if (!source.sessions.includes(sessionId)) return { usable: false, reason: 'not-applicable-to-session' };
  if (source.tier === 5 && source.crossChecked !== true) return { usable: false, reason: 'textbook-not-cross-checked' };
  return { usable: true, reason: 'ok' };
}

/** Verify a stored file (if present) against its registered hash. */
export function verifyFileHash(source, baseDir) {
  if (!source.file) return { checked: false, ok: null, reason: 'no-file-recorded' };
  const p = `${baseDir}/${source.file}`;
  if (!existsSync(p)) return { checked: false, ok: null, reason: 'file-absent' };
  const actual = sha256(readFileSync(p));
  return { checked: true, ok: actual === source.sha256, actual };
}
