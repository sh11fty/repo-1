# SBR Tutor (ACCA SBR-INT, exams September 2026 to June 2027)

A personal study app built around a fail-closed, evidence-only tutor. Technical statements are shown only when they are traced to stored source passages and pass verification. Otherwise the app abstains and shows what it could and could not verify.

**Current state (read this first):** only two sources are loaded, the SBR-INT syllabus/study guide (tier 2) and the ACCA Step-Up article (tier 3, OCR). No IFRS/IAS text, ACCA examinable documents, Study Hub content or official questions are loaded. So the tutor teaches and marks exam structure and approach only, and declines technical accounting questions. Syllabus coverage is not claimed. See `docs/LIMITATIONS.md` and `docs/ACCESS_REPORT.md`.

## Run
```
cp .env.example .env     # set APP_TOKEN (24+ random chars); ANTHROPIC_API_KEY for live answers
npm run ingest           # needs sources/raw/*.pdf (gitignored, protected content); needs pdftotext (+tesseract for OCR)
npm run lessons:validate && npm run matrix
npm start                # http://127.0.0.1:8787, serves the PWA in client/
npm test                 # 112 tests including the adversarial suite
npm run release-gate     # writes docs/RELEASE_REPORT.md and reports/release_report.json
npm run eval:live        # same cases against real models (needs a key; not run in the build environment)
```
Without an API key the server still starts and every technical answer fails closed.

## Modes
Teach, First principles, Socratic, Test, Apply, Explain my mistake, Compare, Exam coach, Mark my answer, Challenge, Revision. All go through the same pipeline. Socratic, Test, Apply, Challenge and Revision hide the solution until you reveal it.

## Documents
- `docs/ARCHITECTURE.md` data flow and verification logic
- `docs/SOURCES.md` source registry, authority tiers and versioning
- `docs/LIMITATIONS.md` known limitations and unresolved risks
- `docs/ACCESS_REPORT.md` what was and was not accessible
- `docs/ANDROID.md` install route
- `docs/COVERAGE_MATRIX.md` generated coverage matrix
- `docs/RELEASE_REPORT.md` latest release-gate result

## Security
Credentials (API key, APP_TOKEN, any ACCA login) are never stored in the repo, logs or client code. Do not enter ACCA or Study Hub credentials anywhere in this app.
