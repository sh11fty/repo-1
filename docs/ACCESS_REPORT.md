# Access report

| Resource | Result | Consequence |
|---|---|---|
| Study Hub (studymaterials.accaglobal.com) | Login-gated; shell access returns a login page | Not read. No content claimed. No authentication bypass attempted. Provide material by uploading files or by signing in yourself in the desktop app. |
| Syllabus and study guide PDF (supplied) | Read, hashed, ingested (87 chunks) | Tier 2 source; 79 outcomes verified for page and level |
| ACCA Step-Up article PDF (supplied) | Image-only; OCR used (62 chunks) | Tier 3 source with OCR caveat |
| ifrs.org, Android SDK downloads, npm/pip registries | Blocked from the build shell | No IFRS text; no APK; zero-dependency Node used |
| Anthropic API | No key in the build environment | Live evaluation not run |

Credentials: none were received or stored. Do not send ACCA login details to this tool or commit them anywhere.
