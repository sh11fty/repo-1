import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { newCard, review, dueCards } from './srs.js';

export const ERROR_CATEGORIES = ['correct-reasoning', 'right-answer-wrong-reason', 'partial-understanding', 'incorrect-technical-knowledge', 'incorrect-application', 'calculation-error', 'missing-fs-consequence', 'weak-exam-technique', 'unsupported-assertion'];

/** Local, single-learner progress store. Holds only ids, categories and timestamps; no free text is stored. */
export class Progress {
  constructor(path) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { cards: {}, attempts: [], confidence: {} };
  }
  save() { writeFileSync(this.path, JSON.stringify(this.data)); }
  recordAttempt({ questionId, syllabusRefs, score, max, category, hintsUsed = 0 }, now = Date.now()) {
    if (category && !ERROR_CATEGORIES.includes(category)) throw new Error('unknown category');
    this.data.attempts.push({ questionId, syllabusRefs, score, max, category: category ?? null, hintsUsed, at: now });
    const frac = max ? score / max : 0;
    const quality = Math.max(0, Math.min(5, Math.round(frac * 5) - Math.min(hintsUsed, 2)));
    this.data.cards[questionId] = review(this.data.cards[questionId] ?? newCard(questionId, now), quality, now);
    this.save();
  }
  setConfidence(area, rating) { if (!/^[A-G]$/.test(area) || !(rating >= 1 && rating <= 5)) throw new Error('invalid'); this.data.confidence[area] = rating; this.save(); }
  due(now = Date.now()) { return dueCards(Object.values(this.data.cards), now).map((c) => c.id); }
  weakAreas() {
    const agg = new Map();
    for (const a of this.data.attempts) for (const r of a.syllabusRefs ?? []) { const x = agg.get(r) ?? { s: 0, m: 0 }; x.s += a.score; x.m += a.max; agg.set(r, x); }
    return [...agg].map(([ref, x]) => ({ ref, mastery: x.m ? x.s / x.m : 0, attempts: x.m })).sort((a, b) => a.mastery - b.mastery);
  }
  recurringMistakes() {
    const c = {};
    for (const a of this.data.attempts) if (a.category && a.category !== 'correct-reasoning') c[a.category] = (c[a.category] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));
  }
  /** Compact, non-free-text profile that may be passed to the tutor as data. */
  profileForTutor() { return { weak: this.weakAreas().slice(0, 5).map((w) => w.ref), mistakes: this.recurringMistakes().slice(0, 3).map((m) => m.category) }; }
  wipe() { this.data = { cards: {}, attempts: [], confidence: {} }; if (existsSync(this.path)) rmSync(this.path); }
}
