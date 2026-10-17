# Source registry and versioning

`sources/registry.json` lists every approved source with: id, title, publisher, tier, version, sessions it applies to, status, access route, authenticity, sha256 of the raw file, extraction method, caveat. Raw PDFs and the extracted corpus are gitignored (protected content); the registry holds metadata and hashes.

Authority tiers: 1 IFRS/IAS standard text; 2 syllabus and ACCA examinable documents; 3 ACCA guidance; 4 supplementary; 5 textbook, usable only after cross-check.

Rules enforced in code (`engine/registry.js`, `engine/corpus.js`, `engine/examinability.js`):
- A source is usable only if approved, applicable to the target session, and its hash matches the stored corpus. A mismatch quarantines it.
- Superseded or wrong-session sources and uncross-checked textbooks are never retrieved.
- Effective date and examinability are tracked separately. Items effective after the syllabus cut-off return `needs-verification`.
- Conflicts between approved sources are reported, not resolved silently.
- To add a source: place the file in `sources/raw/`, add the record with its sha256, run `npm run ingest`, `npm run lessons:validate`, `npm run matrix`, `npm test`.

Currently approved: ACCA-SYL-SBRINT-2627 (tier 2, S26-J27) and ACCA-ART-SBR-STEPUP (tier 3, June 2025, OCR text, syllabus controls). Missing: examinable documents, IFRS/IAS text, IFRS S1/S2, Study Hub content, ACCA exam guidance and past papers, textbook.
