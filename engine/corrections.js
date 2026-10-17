import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { nowIso } from './util.js';
import { randomUUID } from 'node:crypto';

/**
 * Error reports. An OPEN report against a chunk, lesson or question blocks it from being served until a person
 * resolves it. Reports against an answer list the other items sharing its source chunks so they can be reviewed.
 */
export class Corrections {
  constructor(path, audit) {
    this.path = path; this.audit = audit;
    mkdirSync(dirname(path), { recursive: true });
    this.items = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  }
  save() { writeFileSync(this.path, JSON.stringify(this.items, null, 1)); }
  report({ targetType, targetId, description }) {
    if (!['answer', 'lesson', 'question', 'chunk'].includes(targetType)) throw new Error('invalid targetType');
    const item = { id: randomUUID(), targetType, targetId: String(targetId), description: String(description).slice(0, 2000), status: 'open', createdAt: nowIso(), history: [] };
    if (targetType === 'answer' && this.audit) {
      const rec = this.audit.find(targetId);
      item.relatedChunks = rec?.chunkIds ?? [];
    }
    this.items.push(item); this.save();
    return item;
  }
  resolve(id, note) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return null;
    it.history.push({ at: nowIso(), note: String(note).slice(0, 1000), from: it.status });
    it.status = 'resolved'; this.save();
    return it;
  }
  isBlocked(targetType, targetId) {
    return this.items.some((x) => x.status === 'open' && x.targetType === targetType && x.targetId === String(targetId));
  }
  blockedChunks() {
    return new Set(this.items.filter((x) => x.status === 'open').flatMap((x) => (x.targetType === 'chunk' ? [x.targetId] : [])));
  }
  open() { return this.items.filter((x) => x.status === 'open'); }
}
