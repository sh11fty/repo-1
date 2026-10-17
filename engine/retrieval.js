import { tokenize } from './util.js';

const K1 = 1.5;
const B = 0.75;

export function buildIndex(corpus) {
  const docs = [];
  const df = new Map();
  let total = 0;
  for (const c of corpus.chunks.values()) {
    if (!c.retrievable) continue;
    const toks = tokenize(c.text);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push({ chunk: c, tf, len: toks.length, vocab: new Set(tf.keys()) });
    total += toks.length;
  }
  return { docs, df, N: docs.length, avgLen: docs.length ? total / docs.length : 0 };
}

function score(index, doc, qTokens) {
  let s = 0;
  for (const t of new Set(qTokens)) {
    const f = doc.tf.get(t);
    if (!f) continue;
    const n = index.df.get(t) ?? 0;
    const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
    s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.len) / (index.avgLen || 1))));
  }
  return s;
}

/**
 * Retrieve approved, session-applicable chunks. Returns an explicit sufficiency verdict so the pipeline can abstain.
 * Ordering: score first; within 10% of each other, the more authoritative tier (lower number) wins.
 */
export function retrieve(index, registry, query, { k = 6, minScore = 2.5, minCoverage = 0.6 } = {}) {
  const qTokens = tokenize(query);
  const uniq = [...new Set(qTokens)];
  if (uniq.length === 0 || index.N === 0) {
    return { hits: [], queryTokens: uniq, coverage: 0, conflicts: [], sufficient: false, reason: index.N === 0 ? 'no-approved-sources-loaded' : 'empty-query' };
  }
  const scored = index.docs.map((d) => ({ chunk: d.chunk, vocab: d.vocab, score: score(index, d, qTokens) })).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(k * 2, k));
  const best = top[0]?.score ?? 0;
  top.sort((a, b) => (Math.abs(a.score - b.score) < 0.1 * best ? a.chunk.tier - b.chunk.tier || b.score - a.score : b.score - a.score));
  const hits = top.slice(0, k).map(({ chunk, score: s }) => ({ chunk, score: Number(s.toFixed(3)) }));

  const covered = new Set();
  for (const h of top.slice(0, k)) for (const t of h.vocab) if (uniq.includes(t)) covered.add(t);
  const coverage = covered.size / uniq.length;

  // Conflict detection between sources of different versions
  const srcIds = [...new Set(hits.filter((h) => h.score >= 0.6 * best).map((h) => h.chunk.sourceId))];
  const conflicts = [];
  for (const a of srcIds) {
    const sa = registry.byId.get(a);
    for (const b of srcIds) {
      if (a === b) continue;
      if ((sa.supersedes ?? []).includes(b) || (sa.conflictsWith ?? []).includes(b)) conflicts.push({ newer: a, older: b, kind: (sa.supersedes ?? []).includes(b) ? 'supersedes' : 'conflictsWith' });
    }
  }

  const sufficient = best >= minScore && coverage >= minCoverage;
  return {
    hits, queryTokens: uniq, coverage: Number(coverage.toFixed(2)), conflicts, sufficient,
    reason: sufficient ? 'ok' : best < minScore ? 'low-relevance' : 'low-term-coverage',
    bestScore: Number(best.toFixed(3)),
  };
}
