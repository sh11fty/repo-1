import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { looksLikeInjection } from './util.js';
import { usability } from './registry.js';

/**
 * Load the chunk store built by scripts/ingest.js. A source whose corpus hash does not match the registry
 * is quarantined: its chunks remain known (so citations to them are rejected with a reason) but are never retrievable.
 */
export function loadCorpus(dir, registry, sessionId) {
  const chunks = new Map();
  const quarantined = [];
  const missing = [];
  if (!existsSync(dir)) return { chunks, quarantined, missing: registry.sources.map((s) => s.id), sessionId };
  const present = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const src = registry.byId.get(doc.sourceId);
    if (!src) { quarantined.push({ sourceId: doc.sourceId, reason: 'not-in-registry' }); continue; }
    present.add(doc.sourceId);
    const hashOk = doc.sourceSha256 === src.sha256;
    if (!hashOk) quarantined.push({ sourceId: doc.sourceId, reason: 'hash-mismatch-with-registry' });
    const u = usability(src, sessionId);
    for (const c of doc.chunks) {
      chunks.set(c.chunkId, {
        ...c,
        sourceId: doc.sourceId,
        tier: src.tier,
        version: src.version,
        retrievable: hashOk && u.usable && !c.flags?.includes('injection-suspected'),
        blockedReason: !hashOk ? 'hash-mismatch' : !u.usable ? u.reason : c.flags?.includes('injection-suspected') ? 'injection-suspected' : null,
      });
    }
  }
  for (const s of registry.sources) if (s.status === 'approved' && !present.has(s.id)) missing.push(s.id);
  return { chunks, quarantined, missing, sessionId };
}

export function flagChunk(text) {
  return looksLikeInjection(text) ? ['injection-suspected'] : [];
}

/** Build a corpus object directly from fixtures (tests). */
export function corpusFromChunks(registry, sessionId, chunkList) {
  const chunks = new Map();
  for (const c of chunkList) {
    const src = registry.byId.get(c.sourceId);
    const u = usability(src, sessionId);
    const flags = c.flags ?? flagChunk(c.text);
    chunks.set(c.chunkId, {
      ...c, flags, tier: src?.tier, version: src?.version,
      retrievable: u.usable && !flags.includes('injection-suspected'),
      blockedReason: !u.usable ? u.reason : flags.includes('injection-suspected') ? 'injection-suspected' : null,
    });
  }
  return { chunks, quarantined: [], missing: [], sessionId };
}
