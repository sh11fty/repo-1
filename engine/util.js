import { createHash, timingSafeEqual } from 'node:crypto';

export const sha256 = (bufOrStr) => createHash('sha256').update(bufOrStr).digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** Normalise text for verbatim comparison: NFKC, unify quotes/dashes, collapse whitespace, case-fold. */
export function normText(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const wordCount = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;

const STOP = new Set(('a an the and or of to in on for with by at from as is are was were be been being it its this that these those ' +
  'which who whom whose will would shall should can could may might must do does did has have had not no nor but if then than so such ' +
  'their there they them he she his her we our you your i into over under between about against up down out off per also any all each ' +
  'more most other some only own same too very s t').split(' '));

export function stem(w) {
  let x = w;
  if (x.length > 4 && x.endsWith('ies')) x = x.slice(0, -3) + 'y';
  else if (x.length > 5 && x.endsWith('ing')) x = x.slice(0, -3);
  else if (x.length > 4 && x.endsWith('ed')) x = x.slice(0, -2);
  else if (x.length > 7 && x.endsWith('ment')) x = x.slice(0, -4);
  else if (x.length > 3 && x.endsWith('es')) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) x = x.slice(0, -1);
  if (x.length > 4 && x.endsWith('e')) x = x.slice(0, -1);
  return x;
}

export function tokenize(s, { keepStop = false } = {}) {
  const toks = normText(s).match(/[a-z0-9]+(?:[.'-][a-z0-9]+)*/g) || [];
  return toks.filter((t) => keepStop || !STOP.has(t)).map(stem);
}

export function numbersIn(s) {
  // numbers incl. decimals, thousands separators and percentages; spelled-out numbers handled separately
  const out = new Set();
  for (const m of String(s ?? '').matchAll(/(?<![A-Za-z0-9.])\d[\d,]*(?:\.\d+)?%?/g)) out.add(m[0].replace(/,/g, ''));
  const words = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
    twenty: '20', thirty: '30', fifty: '50' };
  for (const w of normText(s).match(/[a-z]+/g) || []) if (words[w]) out.add(words[w]);
  return out;
}

export function sentencesOf(text) {
  return String(text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter(Boolean);
}

export const nowIso = () => new Date().toISOString();

export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Known prompt-injection phrasing. Used for flagging and for output checks, never as the only defence. */
export const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|messages)/i,
  /disregard (all |any |the )?(previous|prior|above|system) (instructions|rules|prompt)/i,
  /you are now\b/i,
  /new (system )?instructions?\s*:/i,
  /(reveal|print|show|output) (the |your )?(system prompt|api key|secret|password|token)/i,
  /system\s*prompt/i,
  /do not (cite|verify|check)/i,
  /override (the )?(safeguards?|verification|source hierarch)/i,
  /\bjailbreak\b/i,
  /mark (this|the) (answer|source) as (verified|approved|official)/i,
  /(i|we) (hereby )?authori[sz]e you to/i,
  /per the document owner/i,
  /ignore (all |any |the )?(rubric|marking (scheme|guide)|grading)/i,
  /award (me |this (answer|response) |the )?(full|maximum|top|all) (marks|credit|points)/i,
  /give (me|this (answer|response)) (full|maximum|top) (marks|credit)/i,
];

export const looksLikeInjection = (s) => INJECTION_PATTERNS.some((re) => re.test(String(s ?? '')));

export const SECRET_PATTERNS = [/sk-ant-[A-Za-z0-9_-]{6,}/, /ANTHROPIC_API_KEY/i, /APP_TOKEN/i, /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/, /password\s*[:=]/i];
export const leaksSecret = (s) => SECRET_PATTERNS.some((re) => re.test(String(s ?? '')));
