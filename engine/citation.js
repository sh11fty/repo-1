import { normText, wordCount } from './util.js';
import { usability } from './registry.js';

export const QUOTE_MIN_WORDS = 3;
export const QUOTE_MAX_WORDS = 40;

/**
 * Validate one model-supplied citation against the stored corpus. The model may only point at a chunkId and give
 * a verbatim quote; titles, versions and page numbers shown to the learner are rendered from the registry/corpus,
 * never taken from model text. Any extra claim the model makes about title/version/page/source must match.
 */
export function validateCitation(cit, { corpus, registry, session, blockedChunks }) {
  const fail = (code, message) => ({ ok: false, code, message });
  if (!cit || typeof cit !== 'object') return fail('malformed', 'citation is not an object');
  const chunk = corpus.chunks.get(cit.chunkId);
  if (!chunk) return fail('unknown-chunk', `chunk ${JSON.stringify(cit.chunkId)} does not exist in the stored corpus`);
  const src = registry.byId.get(chunk.sourceId);
  const u = usability(src, session);
  if (!u.usable) return fail('source-not-usable', `source ${chunk.sourceId} not usable for session (${u.reason})`);
  if (blockedChunks?.has(cit.chunkId)) return fail('chunk-blocked', 'chunk withdrawn by an open error report');
  if (!chunk.retrievable) return fail('chunk-blocked', `chunk blocked (${chunk.blockedReason})`);
  if (cit.sourceId !== undefined && cit.sourceId !== chunk.sourceId) return fail('source-mismatch', 'sourceId does not match chunk');
  if (cit.page !== undefined && Number(cit.page) !== chunk.page) return fail('page-mismatch', `page ${cit.page} does not match chunk page ${chunk.page}`);
  if (cit.version !== undefined && cit.version !== src.version) return fail('version-mismatch', `version ${cit.version} does not match registry version ${src.version}`);
  if (cit.title !== undefined && normText(cit.title) !== normText(src.title)) return fail('title-mismatch', 'title does not match registry title');
  if (typeof cit.quote !== 'string') return fail('quote-missing', 'no quote supplied');
  const wc = wordCount(cit.quote);
  if (wc < QUOTE_MIN_WORDS) return fail('quote-too-short', `quote has ${wc} words (min ${QUOTE_MIN_WORDS})`);
  if (wc > QUOTE_MAX_WORDS) return fail('quote-too-long', `quote has ${wc} words (max ${QUOTE_MAX_WORDS}); use a shorter excerpt`);
  if (!normText(chunk.text).includes(normText(cit.quote))) return fail('quote-not-verbatim', 'quote does not appear verbatim in the cited chunk');
  if (cit.locator !== undefined) {
    const loc = String(cit.locator).replace(/^(para(graph)?s?\.?|section|s\.)\s*/i, '').trim();
    if (loc && !normText(chunk.text).includes(normText(loc))) return fail('locator-not-in-chunk', `locator ${JSON.stringify(cit.locator)} does not appear in the cited chunk`);
  }
  return { ok: true, chunk, source: src };
}

const STD = /\b(?:IFRS|IAS|IFRIC|SIC)\s?-?\s?(\d{1,3})\b|\bIFRS\s?S\s?([12])\b|\bESRS\s?[A-Z]?\d*\b/gi;
export function extractStandardRefs(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(STD)) out.add(m[0].replace(/\s+/g, ' ').replace(/-/g, ' ').toUpperCase().replace(/^(IFRS|IAS|IFRIC|SIC) ?(\d)/, '$1 $2'));
  return out;
}

const PARA = /\b(?:para(?:graph)?s?\.?|¶)\s*([A-Z]{0,2}\d+[A-Za-z]?(?:\([a-z0-9]+\))*)|\b(?:IFRS|IAS)\s?\d{1,3}\.([A-Z]{0,2}\d+[A-Za-z]?)/gi;
export function extractParagraphRefs(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(PARA)) out.add((m[1] ?? m[2]).toUpperCase());
  return out;
}

/** True if the standard reference (e.g. "IFRS 16") appears in the text, tolerant of spacing and hyphenation. */
export function textMentionsStandard(text, ref) {
  return extractStandardRefs(text).has(ref);
}
