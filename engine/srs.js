// SM-2 style spaced repetition. Deterministic and unit-tested.
const DAY = 86400000;
export function newCard(id, now = Date.now()) { return { id, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now }; }
/** quality 0-5 (0-2 = failed recall). */
export function review(card, quality, now = Date.now()) {
  if (!(quality >= 0 && quality <= 5)) throw new Error('quality must be 0-5');
  const c = { ...card };
  if (quality < 3) { c.reps = 0; c.interval = 1; c.lapses += 1; }
  else {
    c.reps += 1;
    c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 6 : Math.round(c.interval * c.ease);
  }
  c.ease = Math.max(1.3, c.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  c.due = now + c.interval * DAY;
  return c;
}
export const dueCards = (cards, now = Date.now()) => cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
