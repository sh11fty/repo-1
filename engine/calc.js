// Safe arithmetic evaluator (no eval). Validates ARITHMETIC only; it cannot validate that a formula is the right accounting rule.
export function evaluate(expression, inputs = {}) {
  const src = String(expression);
  if (src.length > 300) throw new Error('expression too long');
  const toks = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/^])/y;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error(`unexpected character at ${pos}`); }
    toks.push(m[1]); pos = re.lastIndex;
  }
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  function primary() {
    const t = next();
    if (t === undefined) throw new Error('unexpected end');
    if (t === '(') { const v = expr(); if (next() !== ')') throw new Error('missing )'); return v; }
    if (t === '-') return -power();
    if (t === '+') return power();
    if (/^\d/.test(t)) return Number(t);
    if (/^[A-Za-z_]/.test(t)) {
      if (!Object.hasOwn(inputs, t) || typeof inputs[t] !== 'number' || !Number.isFinite(inputs[t])) throw new Error(`unknown or non-numeric input ${t}`);
      return inputs[t];
    }
    throw new Error(`unexpected token ${t}`);
  }
  function power() { const b = primary(); if (peek() === '^') { next(); return b ** power(); } return b; }
  function term() { let v = power(); while (peek() === '*' || peek() === '/') { const op = next(); const r = power(); if (op === '/' && r === 0) throw new Error('division by zero'); v = op === '*' ? v * r : v / r; } return v; }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  const v = expr();
  if (i !== toks.length) throw new Error('trailing tokens');
  return v;
}

export function checkCalculation(calc) {
  if (!calc || typeof calc.expression !== 'string' || typeof calc.result !== 'number') return { ok: false, reason: 'calc requires expression (string) and result (number)' };
  try {
    const dp = Number.isInteger(calc.dp) ? calc.dp : 2;
    const got = evaluate(calc.expression, calc.inputs ?? {});
    const f = 10 ** dp;
    const ok = Math.round(got * f) / f === Math.round(calc.result * f) / f;
    return { ok, computed: Math.round(got * f) / f, claimed: calc.result, reason: ok ? 'ok' : 'claimed result differs from recomputation' };
  } catch (e) {
    return { ok: false, reason: `calculation could not be evaluated: ${e.message}` };
  }
}
