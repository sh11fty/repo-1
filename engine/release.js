/**
 * Output branding. Everything the server may send to the learner must have been issued by one of the functions
 * below, and only the engine modules on the allow-list (checked by tests/architecture.test.js) import them.
 * Unbranded objects cannot be released: release() throws. There is no code path that returns raw model text.
 */
const issued = new WeakSet();
export class UnverifiedOutputError extends Error {
  constructor(msg = 'refusing to release unverified output') { super(msg); this.name = 'UnverifiedOutputError'; }
}
function brand(payload, kind) {
  const o = Object.freeze({ ...payload, kind });
  issued.add(o);
  return o;
}
export const issueVerifiedAnswer = (p) => brand(p, 'verified_answer');
export const issueNonAnswer = (p) => brand(p, 'non_answer'); // abstention, conflict, unavailable, evidence-only
export const issueTemplate = (p) => brand(p, 'template');
export const issueMarking = (p) => brand(p, 'indicative_marking');
export function release(x) {
  if (!x || typeof x !== 'object' || !issued.has(x)) throw new UnverifiedOutputError();
  return x;
}
export const isReleasable = (x) => Boolean(x && typeof x === 'object' && issued.has(x));
