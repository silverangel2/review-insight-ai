# ReviewIntel intelligence correction — local evidence report

Repository: `/Users/junel/review-insight-ai`.
Branch: `muse/reviewintel-handoff-20261007`.
No commit, staging, push, deploy, migration, cleanup, rollback, or live product scan was performed. The dirty tree was preserved. `lib/socialReelGenerator.ts` and unrelated social work were not edited. No Next build/dev processes were started.

This establishes offline correctness of the corrected paths and tests. It does not establish universal semantic understanding, statistical calibration, current retailer accessibility, or authenticated browser rendering.

1. **Root causes found.** An abandoned overlay merge left invalid JSX, references to removed state, and an inconsistent request signature. Storage verification failures were swallowed before navigation. Shared-listing association could bless accessory reviews; the existing sizing-kit correction also rejected legitimate accessory mentions. Sentiment missed curly contractions, past-tense failure, French content, and contextual claims. Aggregate ratings contributed 30% of the decision score and were required even with usable written evidence. Keyword volume rewarded verbose reviews. Broad durability rules inferred durability from battery duration. Source discovery could exhaust its page budget on the first retailer. Accepted-only re-adjudication erased rejection telemetry. Prefix truncation could collapse different reviews. Legacy display normalization could invent stronger scores/value. A synthetic-ASIN test lacked a network mock.

2. **Exact implementation changes made during this mission.** Earlier dirty work in these files was retained; this is the mission's change list, not attribution of the entire Git diff.

| File | Functions / change |
|---|---|
| `components/AnalyzerForm.tsx` | `postScanRequest`, `analyzeProduct`, render: remove overlay leftovers, retain ordinary upload UI and diagnostics; propagate local storage failure before navigation |
| `components/ResultsClient.tsx` | Result adapters: missing value defaults to Unknown rather than Fair |
| `app/api/analyze/route.ts` | `buildReviewEvidenceShopperResult`: confidence remains null; source distribution uses actual domains |
| `lib/finalVerdictConsistency.ts` | `enforceFinalVerdictConsistency`: canonical versioned results bypass legacy score/value inflation |
| `lib/nativeReviewRetrieval.ts` | Search queries, result-link parsing, source matching, `runNativeReviewRetrieval`: retailer diversity, fetched identity checks, pagination followups, Unicode dedupe, accurate rejection classification |
| `lib/productUrlRetrieval.ts` | `isProductUrl`: recognize legitimate retailer product-path shapes, including Best Buy and Lowe's |
| `lib/reviewCollector.ts` | Structured extraction and dedupe: preserve multilingual review-shaped records, Unicode identity, bounded fetch timeouts |
| `lib/reviewEvidence.ts` | Full-body fingerprints, collector merging, canonical adjudication: remove prefix truncation, retain original rejection ledger, increase adaptive merge cap from 80 to 240 |
| `lib/reviewEvidenceAdjudication.ts` | Cleaning, hashing, `identityAccepted`, adjudication: accessory subject/mention distinction, explicit generation contradiction rejection, source URL requirement, Unicode hashes, same-domain review-ID dedupe, avoid classifying every “review” source label as professional review |
| `lib/reviewEvidenceDeterminism.ts` | Clauses, sentiment, provenance, deterministic derivation: written-only scoring, three-way policy, contextual claims, distinct-record votes, severity/safety separation, coverage gating, source/date/language telemetry |
| `lib/reviewSemanticSignals.ts` | New `semanticText`, `reviewLanguageHint`: deterministic limited multilingual phrase normalization, conservative language hints |
| `lib/reviewRetrievalPolicy.ts` | New `discoverPublicReviewFollowups`: follow advertised same-product public review/pagination links only |
| `scripts/reviewintel-reanalyze-capture.mjs` | New guarded re-analysis; verifies original capture SHA, input equality, listing acceptance, and reproducibility |

Test/artifact changes: `tests/intelligenceMission.test.mjs` (new), `tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json` (new provenance-labelled input subset), `tests/devScanCapture.test.mjs`, `tests/reviewEvidenceDeterminism.test.mjs`, `tests/reviewIntelIntelligenceV2Replay.test.mjs`, `tests/scanStateGuards.test.mjs`, and `tests/retrievalCapability.test.mjs`.

3. **Why these defects caused bad decisions.** Accessory praise inflated the corpus. Missing failure terms and multilingual praise distorted the balance. Marketplace metadata could lift a mixed sample toward BUY or suppress scoring without a rating. A binary policy made “not BUY” look like AVOID. Prefix dedupe could remove contradictory endings; accepted-only re-adjudication concealed exclusions. Display code could change the decision after scoring. Swallowed storage errors could navigate without the required verified result.

4. **Retrieval improvements.** Native queries now include Best Buy, Target, Home Depot, Lowe's, Canadian Tire, Costco, and official customer-review discovery, alongside Amazon and Walmart. Queries retain model identity. Four initial pages at most are reserved for the first listing, preserving capacity for discovery. Distinct retailer domains and advertised review followups precede remaining synthetic pagination. Real fetched page identity overrides a misleading search title. Product URL gates recognize more retailer shapes. Existing caps remain bounded: default 24 pages, 240 records, 180 seconds; configurable limits remain. Collector fetches have nine-second timeouts. Public advertised pagination is supported, not guessed private review APIs. No challenge bypass was introduced.

5. **Identity improvements and preserved regressions.** Existing identity-token and verifier corrections were retained. Tests cover RingConn Gen 2 Air, Roborock Qrevo S Pro, Philips NA555/00, Kenmore capacity/category without an invented model, and Eufy E340 with S380 compatibility context. Marketing terms remain outside model identity. Cross-retailer review discovery no longer inherits the initial retailer restriction; requested primary-listing verification retains its existing rules.

6. **Accessory / parent-child safeguards.** A shared ASIN cannot override explicit accessory-only content or a contradictory generation. Sizing-kit evidence remains rejected. “I used the sizing kit first; my ring works well...” remains accepted. Charger/accessory subject is distinguished from product charging experience, including power-station reviews. Structured contradictory product names retain their rejection gate. Unavailable variant association stays uncertain; body rules cannot prove every hidden child-ASIN relationship.

7. **Semantic improvements.** Curly apostrophes and contractions normalize without replacing original evidence. “Died,” “dies,” “broke,” and cracking are recognized. Contrast/temporal clauses split on but/however/until. Expectations and negated claim anchors cannot borrow unrelated praise. Cleaning is separate from use/setup; battery duration is separate from durability. Comfort, battery experience, tracking/app insights, and unanswered support have targeted claims. Limited French/Spanish/German phrases normalize deterministically; French negation is tested. Structured multilingual review text is preserved. Uninterpretable text remains accepted where provenance is sound but cannot manufacture sentiment: fewer than five analyzable records or under 80% semantic coverage prevents scoring.

8. **Deduplication improvements.** Full normalized bodies use Unicode letters/numbers. Exact syndicated bodies deduplicate across URLs. Same-domain review IDs deduplicate edited/paginated copies. Reviews sharing long prefixes but differing endings remain distinct. Boilerplate is removed from normalized bodies; untouched text remains in `original`. Automatic translated-copy or fuzzy semantic dedupe was deliberately not claimed: reliable author/translation linkage is unavailable, and aggressive merging would erase independent evidence.

9. **Score / verdict calibration.** This is an explicit conservative policy, tested across synthetic scenarios and historical inputs, not empirical purchase-outcome calibration. For sufficient evidence, score is `round(5 + 3 × (positiveRecordCount − negativeRecordCount)/N − 2 × severeRecordCount/N, 1)`, clamped to 1–10. Marketplace rating/count has zero decision weight. A mixed record can contribute to both positive and negative counts. BUY needs score ≥6.5, positive coverage ≥70%, negative coverage ≤20%, severe ratio <20%, and no material safety report. AVOID requires predominantly negative evidence (≥60% negative plus negative dominance or score ≤4.5), or at least two failure records with ratio ≥35%, or at least two material safety records. Otherwise DO NOT BUY YET. Avoidance takes precedence. A single material safety report blocks BUY pending corroboration; one ordinary failure does not automatically force AVOID. Minimum five accepted and analyzable records plus 80% semantic coverage is an operational floor, not a claim of statistical representativeness. Numeric confidence stays null. Distinct texts are not represented as verified independent reviewers.

10. **Versions.** Scorer: `deterministic-evidence-scorer-v7`. Verdict policy: `buyer-verdict-policy-v2`. Provenance: `accepted-review-provenance-v3`. Semantic rules: `review-semantics-v1`. Historical captures/fixtures are unchanged and reject exact replay under a different scorer version. The previously skipped historical V5 test now verifies that refusal rather than requesting a replacement live scan.

11. **RingConn BEFORE → AFTER, from the existing capture.**

| Measure | Historical captured result | Current offline re-analysis |
|---|---:|---:|
| Accepted written reviews | 8 | 7 |
| Rejected reviews | 0 | 1 |
| Marketplace count (context only) | 1,048 | 1,048 |
| Score | 6.0 | 6.1 |
| Verdict | AVOID | DO NOT BUY YET |
| Failure review records recognized | 1 | 2 |
| Source domains | 1 | 1 |

The historical result used scorer V5; the starting dirty scorer was V6. This is a new offline re-analysis, not an exact replay of the historical scoring policy or a changed persisted live scan.

12. **Exact accepted count:** seven. The full original capture is checked, not merely assumed equivalent to the fixture subset. Exact listing remains accepted.

13. **Exact rejected count / reason:** one: the French sizing-kit review (“Je ne m’attendais pas à ce que ce kit de tailles soit aussi utile...”); reason: `review text identifies a sizing-kit accessory rather than the requested product`. No legitimate product review is rejected in this capture.

14. **Final RingConn result:** 6.1/10, DO NOT BUY YET. Six records contain some positive language, two contain negatives, and two contain failure reports. One positive signal belongs to a review praising the ring before battery failure; this is not “six satisfied current customers.” Failure-record ratio is 2/7 (28.57%). No material safety event is identified. All seven retain original dates; language hints are English 5, French 1, unknown 1. Verified independent reviewer count and numeric confidence are null.

15. **Why this verdict is defensible.** Customers report comfortable fit (2 supporting reviews), long battery life (2), useful tracking/app insights (2), and an explicit positive value judgment (1). Two distinct records report serious battery deterioration/failure; one discusses two rings, counted as one record rather than two independent reviewers. Unanswered customer support has one supporting review. The generic reliability complaint and battery complaint cite the same two records and do not create four independent failures. These risks justify caution; this small, single-retailer sample does not establish population failure rate or justify an unqualified purchase recommendation. It also does not establish clearly dominant negative experience. All claims carry support counts, accepted hashes/IDs, source URLs, and source-domain diversity. No medical accuracy claim is inferred from the French reviewer’s sleep-apnea opinion.

16. **Focused suites:** all 16 requested suites pass, 200 tests, no skips. The final full run re-exercises these suites after the final edits. Covered identity, adjudication, scoring, handoff, ownership, state guards, completion, and persistence.

17. **Broader results:** final guarded full repository run: 311 tests, 306 passed, five failed, zero skipped. All five failures are in unchanged `tests/socialAutoPost.test.mjs`: fresh Facebook media selection; video_reels start/upload/finish; cooldown wording; Codex media guard/source mode; default mixed source mode. They concern unrelated existing dirty social code and were not repaired. Earlier additional ReviewIntel subset: 80/80 passed; the final full run also includes the subsequently added unsourced-evidence regression. New mission suite contains 13 tests. The tests exercise real research orchestration, captured HTML extraction, cross-retailer retrieval, fetched identity rejection, full-body dedupe, retention of accessory rejection, scorer policy, durable completion ordering, exact browser-storage reload, foreign-owner rejection, and canonical display preservation. Browser rendering itself is not exercised by the Node storage test.

18. **Typecheck:** `npm run typecheck -- --incremental false` clean for the full repository, exit 0.

19. **Diff check:** scoped `git diff --check` clean across mission implementation/test files. Untracked new files were also inspected for trailing whitespace. Unrelated dirty files were excluded.

20. **Network / provider validation usage:** final full validation inherits `/private/tmp/reviewintel-validation-tripwire.mjs` through `NODE_OPTIONS`; actual network APIs are blocked before I/O in test and child processes, while mocked provider boundaries and local test subprocesses remain usable. Final guarded run made zero external network/provider requests and consumed zero provider tokens/paid cost. Mock requests are not live calls. Earlier unguarded runs included an existing synthetic-ASIN test with an unmocked public URL enrichment request; exact early network count was not captured and is UNKNOWN. The guard caught it, the test was corrected, and guarded validation was repeated. No live product scan was performed. Do not interpret this report as zero external requests across every earlier command.

21. **Firecrawl:** zero in guarded validation and captured-path re-analysis. Active ReviewIntel scan/retrieval modules do not import/call the Firecrawl fallback. Existing per-scan telemetry disables Firecrawl requests. Historical backup text and the unused fallback module are not the active scan path.

22. **Remaining limitations:** current retailer accessibility was not live-tested. CAPTCHA, login, robots restrictions, opaque client-side/private review APIs, and source rate limits still restrict collection. URL/record/duration ceilings prevent exhaustive harvesting. Manufacturer and retailer source diversity is sought, not guaranteed. Semantic rules are a limited deterministic lexicon, not general multilingual understanding; sarcasm, idioms, nuanced comparisons, and unrecognized languages can remain unknown or imperfectly classified. Product association cannot prove invisible shared-pool child variants; translated syndication and reviewer independence remain unresolved when source metadata is absent. Original dates are retained and counted, but recent-vs-old failure concentration and revision linkage are not claimed. Thresholds have scenario calibration, not representative real-world outcome validation. These internal limitations must not be mislabeled external site limitations.

23. **Final live proof:** no further live scan is needed to reproduce the corrected captured RingConn analysis. An authenticated browser journey is still needed before claiming rendered end-to-end runtime acceptance under the current code (requested scanId = persisted scanId = rendered scanId, actual owner and storage behavior). No such claim is made here. No live scan was spent on debugging; any later runtime proof should be one deliberate local scan with corpus, persistence, rendering, and Firecrawl telemetry inspected.

Artifacts:
- Existing capture: `/private/tmp/reviewintel-replay-captures/scan_e64e9b30-5931-41d3-a9e1-dbb2585c95af.json`.
- Original capture SHA256: `bce06924f0f385b550e613593790ac936a4c82e428e7e134185b7ff0e8e09304`.
- Complete before/after, accepted text, rejection ledger, claims and hashes: `/private/tmp/reviewintel-ringconn-after.json`.
- Current result hash: `4435da7091efaa049ca3318d19c1768815a121ce6d122eaccff1b22e86a352e9`.
- Full guarded test log: `/private/tmp/reviewintel-full-offline-final.log`.
- Typecheck log: `/private/tmp/reviewintel-typecheck-final.log`.
- Repeat the offline re-analysis: `node scripts/reviewintel-reanalyze-capture.mjs`.
