import { VERIFIER_SYSTEM } from './prompts.js';
import { parseJsonObject } from './json.js';
import { validateCitation } from './citation.js';

const NEED_VERDICT = new Set(['source_statement', 'inference', 'explanation', 'application']);

/**
 * Independent model check. It is ADDITIVE ONLY: it can reject, and a missing or malformed verdict counts as a rejection.
 * It sees quotations re-read from the stored corpus, not text the generator supplied, and never sees the generator's reasoning.
 */
export async function modelVerify({ verifier, answer, ctx }) {
  if (!verifier || !verifier.available()) return { ok: false, error: 'verifier-unavailable', verdicts: [] };
  const lines = [];
  for (const c of answer.claims) {
    if (!NEED_VERDICT.has(c.type)) continue;
    const quotes = (c.citations ?? []).map((cit) => {
      const r = validateCitation(cit, ctx);
      return r.ok ? `"${r.chunk.text}"` : null;
    }).filter(Boolean);
    const deps = (c.dependsOn ?? []).map((d) => answer.claims.find((x) => x.id === d)).filter(Boolean).map((d) => `${d.id}: ${d.text}`);
    lines.push(`<CLAIM id="${c.id}" type="${c.type}">\n${c.text}\n<CITED_PASSAGES>\n${quotes.join('\n') || '(none)'}\n</CITED_PASSAGES>\n<DEPENDS_ON>\n${deps.join('\n') || '(none)'}\n</DEPENDS_ON>\n</CLAIM>`);
  }
  let raw;
  try {
    raw = await verifier.complete({ system: VERIFIER_SYSTEM, user: lines.join('\n'), maxTokens: 1500, temperature: 0 });
  } catch (e) {
    return { ok: false, error: 'verifier-call-failed', verdicts: [] };
  }
  const parsed = parseJsonObject(raw.text);
  if (!parsed || !Array.isArray(parsed.verdicts)) return { ok: false, error: 'verifier-output-malformed', verdicts: [] };
  const byId = new Map(parsed.verdicts.map((v) => [v?.claimId, v]));
  const verdicts = [];
  let ok = true;
  for (const c of answer.claims) {
    if (!NEED_VERDICT.has(c.type)) continue;
    const v = byId.get(c.id);
    const verdict = v?.verdict ?? 'missing';
    if (verdict !== 'entailed') ok = false;
    verdicts.push({ claimId: c.id, verdict, reason: String(v?.reason ?? '').slice(0, 300) });
  }
  return { ok, verdicts, error: null };
}
