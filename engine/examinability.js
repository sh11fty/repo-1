/**
 * Examinability is tracked SEPARATELY from effective date and from "published".
 *
 * Rule encoded here is the one stated in the ACCA SBR-INT S26-J27 syllabus and study guide
 * (section 11, source ACCA-SYL-SBRINT-2627): regulations issued on or before 31 August are examinable
 * from 1 September of the following year to 31 August of the year after; regulations whose effective
 * date is in the future are not examinable unless the syllabus or examinable documents say otherwise.
 *
 * The syllabus does not define "in the future" relative to what date, and the ACCA examinable documents
 * list is the authority that resolves this. This function therefore NEVER returns a definitive
 * "examinable" for a future-effective item: it returns 'needs-verification'.
 */
export function assessExaminability({ issuedOn, effectiveFrom, sessionStart, sessionEnd, listedInExaminableDocuments = null }) {
  const reasons = [];
  if (listedInExaminableDocuments === true) {
    return { status: 'examinable', basis: 'listed-in-examinable-documents', reasons: ['Listed in ACCA examinable documents for the session.'] };
  }
  if (listedInExaminableDocuments === false) {
    return { status: 'not-examinable', basis: 'excluded-by-examinable-documents', reasons: ['Excluded by ACCA examinable documents for the session.'] };
  }
  const issued = issuedOn ? new Date(issuedOn) : null;
  const eff = effectiveFrom ? new Date(effectiveFrom) : null;
  const start = new Date(sessionStart);
  if (!issued || Number.isNaN(issued.getTime())) {
    return { status: 'needs-verification', basis: 'missing-issue-date', reasons: ['Issue date unknown.'] };
  }
  // cut-off: issued on/before 31 Aug preceding the session start (session start is 1 Sep of year Y => cut-off 31 Aug of Y-1)
  const cutoff = new Date(Date.UTC(start.getUTCFullYear() - 1, 7, 31, 23, 59, 59));
  if (issued > cutoff) {
    return { status: 'not-examinable', basis: 'issued-after-cutoff', reasons: [`Issued after ${cutoff.toISOString().slice(0, 10)}; not examinable in this session under the stated rule.`] };
  }
  reasons.push(`Issued on or before ${cutoff.toISOString().slice(0, 10)} (passes the issue-date rule).`);
  if (eff && !Number.isNaN(eff.getTime()) && eff > start) {
    reasons.push('Effective date is after the session start; the syllabus rule on future-effective regulations applies and its reference date is not defined in the syllabus.');
    return { status: 'needs-verification', basis: 'future-effective-date', reasons };
  }
  if (!eff) reasons.push('Effective date unknown.');
  return { status: eff ? 'examinable-by-rule' : 'needs-verification', basis: 'rule-derived', reasons: [...reasons, 'Rule-derived only; confirm against the ACCA examinable documents (not yet supplied).'] };
}
