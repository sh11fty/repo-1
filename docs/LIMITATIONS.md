# Known limitations and unresolved risks

1. **No tier 1 or examinable-document sources.** The app cannot teach or verify IFRS/IAS treatments. Technical lessons are placeholders and technical questions are declined. Coverage is not claimed (1/79 outcomes has a verified lesson, 2/79 a verified question).
2. **No Study Hub or official ACCA questions/marking schemes.** All questions are original AI-generated and labelled so. Marks are indicative and never ACCA marks.
3. **Live-model behaviour is untested.** No API key was available. The adversarial suite uses scripted stub models and synthetic fixtures. It proves the pipeline rejects bad output; it does not measure a real model's hallucination rate. Run `npm run eval:live`.
4. **No independent human review** of high-risk cases or of marking agreement. Marking agreement was checked only against author-written reference judgements.
5. **Deterministic checks are lexical.** Support, negation, overstatement and omitted-qualification checks are heuristics. They can miss subtle semantic errors and can over-reject. The model verifier is an additional check, not an authority.
6. **Retrieval is BM25.** Paraphrased questions may abstain wrongly or retrieve loosely related text.
7. **OCR text** (Step-Up article) may contain errors; answers citing it carry a warning.
8. **Zero real-world hallucinations cannot be guaranteed.** The release gate shows zero critical failures in the defined suite only.
9. **Android:** no APK was built (SDK downloads blocked here). The client is a PWA. The server must be hosted somewhere reachable from the phone; this is a real set-up burden. Capacitor packaging is untested.
10. **Single user, bearer-token auth,** HTTP on localhost by default. Put it behind HTTPS before exposing it.
11. **Standards hints in the coverage matrix** come from model memory, are marked unverified, and are never used as evidence.
