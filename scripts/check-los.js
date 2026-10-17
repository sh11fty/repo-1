// Verifies every learning outcome record against the ingested syllabus text: anchor present on the stated page and the
// intellectual level that follows it matches. Used by build-matrix and the release gate.
import { readFileSync } from 'node:fs';
import { normText } from '../engine/util.js';

export function checkLOs(root) {
  const lo = JSON.parse(readFileSync(`${root}/data/syllabus_los.json`, 'utf8'));
  const corpus = JSON.parse(readFileSync(`${root}/data/corpus/ACCA-SYL-SBRINT-2627.json`, 'utf8'));
  const byPage = new Map();
  for (const c of corpus.chunks) byPage.set(c.page, `${byPage.get(c.page) ?? ''} ${c.text}`);
  const results = [];
  for (const x of lo.los) {
    const page = normText(byPage.get(x.page) ?? '');
    const anchor = normText(x.anchor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${anchor}\\.?\\s*(?:\\[(\\d)\\])?`, 'g');
    const matches = [...page.matchAll(re)];
    let status = 'anchor-not-found-on-page', level = null;
    if (matches.length) {
      level = matches.map((m) => (m[1] ? Number(m[1]) : null)).find((v) => v !== null) ?? null;
      if (x.level === null) status = 'verified-anchor';
      else if (level === x.level) status = 'verified-anchor-and-level';
      else status = level === null ? 'anchor-found-level-not-seen' : `level-mismatch(found ${level})`;
    }
    results.push({ id: x.id, status });
  }
  return { results, ok: results.every((r) => r.status.startsWith('verified')) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkLOs(new URL('..', import.meta.url).pathname);
  const bad = r.results.filter((x) => !x.status.startsWith('verified'));
  console.log(`${r.results.length - bad.length}/${r.results.length} LOs verified`);
  for (const b of bad) console.log(' ', b.id, b.status);
}
