# Architecture and data flow

```
question -> router -> [template: greeting/progress/help only]
                  \-> technical pipeline (engine/pipeline.js)
   1 strip instruction-like sentences (kept in audit log)
   2 retrieve (BM25, authority tie-break, usable sources only, withdrawn chunks excluded)
       conflict among hits  -> CONFLICT non-answer (both versions shown)
       insufficient evidence -> ABSTAIN (no model call, no memory fill)
   3 generator model (untrusted-data delimiters) -> structured claims JSON
       each claim: type, text, citations {chunkId, verbatim quote}, dependsOn, basis, calc
   4 deterministic verifier (engine/verify.js)  -- can reject, cannot be overridden
   5 independent model verifier (different provider name; additive; can only reject)
   6 reject -> retry with broader evidence (max 3 generator calls) -> UNVERIFIED + evidence excerpts
   7 pass -> render titles/versions/pages from the registry, brand output (engine/release.js), audit-log
generator/verifier unavailable, not independent, or unparseable -> UNAVAILABLE (fail closed)
```

## Deterministic checks (verify.js)
Schema; citation validity (chunk exists, source usable for the session, chunk not withdrawn, quote verbatim and 3 to 40 words, optional page/version/title/locator must match); numbers must appear in cited text; weak lexical support; negation mismatch; overstatement; possible omitted qualification; inference needs basis; standards and paragraph references must exist in the cited source; "official" status comes only from the registry; injection and secret leakage in output; dependency chains for ungrounded claims; calculations re-evaluated by a safe evaluator (no `eval`).

## Claim types shown to the learner
Source statement, explanation, inference (basis shown), application to scenario, illustration, calculation. Citations are expandable.

## No-bypass design
- Output objects are minted only by `engine/release.js` and tracked in a WeakSet. Spread copies and JSON round-trips lose the brand.
- Technical HTTP routes are passed through `release()`; an unbranded object gives a 500 and no content.
- The router whitelist allows only greeting, progress and help templates. There is no free-chat route.
- Model `.complete()` is called only from pipeline, modelVerifier, marking and the provider. Static tests enforce this (`tests/architecture.test.js`).
- Only the Anthropic provider reads the API key from the environment.
- Stored lessons and answers are re-verified against the current corpus every time they are served.

## Other components
Hash-chained audit log (`engine/audit.js`), corrections store where an open report withdraws content at once (`engine/corrections.js`), SM-2 spaced repetition and progress store holding ids and categories only, indicative-rubric marking (`engine/marking.js`) with evidence quotes required from the learner's own words.
