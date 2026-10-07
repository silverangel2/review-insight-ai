# ReviewIntel Product Pipeline Hardening: Report and AI Turnover

Date: 2026-10-07

Disposition: READY_FOR_ONE_LIVE_RUNTIME_PROOF, not production acceptance or paid-launch certification.

## Start Here

- Actual checkout: `/Users/junel/review-insight-ai`.
- Current local branch: `main`; HEAD: `65b68f31126bed1a28d4a79d79e972187224c458`.
- This HEAD identifies local Git history only. The fixes are uncommitted in a substantially preexisting dirty tree. No current production SHA was established.
- Original instructions: `/Users/junel/.codex/attachments/60cad40c-4539-478a-af17-b20dff2a47e9/Pasted text.txt`.
- Do not use the old `/Users/junel/Documents/New project/review-insight-ai` path.
- This mission repaired the product pipeline, not the landing page, Seller UX, MT5 files, or social-media system.
- No live scan was initiated. The next step is ONE separately coordinated live proof, not further feature expansion or repeated scans.

## 1. ROOT CAUSES FOUND

1. Brand/model roles could be corrupted downstream: explicit brand lost authority; named models lost words; specs, compatibility identifiers, and promotional text polluted identity queries.
2. Candidate gates discarded legitimate manufacturer URLs or sparse retailer candidates before useful public enrichment. Redirects and canonical URLs could also erase or substitute identity.
3. Review extraction could strip structured Product context, re-extract recommended-product reviews without that context, or treat Product metadata and generic text/rating fields as individual reviews.
4. HTTP 200 sign-in pages, source redirects, and weak source association could misleadingly resemble usable review evidence.
5. Short prefix deduplication discarded distinct long reviews. Old uncalled snippet helpers remained misleading dead code.
6. Claim/scoring rules mishandled negation, expectations, and price mentions. A supplied source ID did not necessarily prove the actual claim. Generic praise could be manufactured to fill the display.
7. Completion could appear successful without a confirmed account-visible row, correct readback identity, usage persistence, and durable operation completion. Free users could be prevented from reloading their own exact completed scan.
8. Free-quota read failures could look like unused allowance. Completed-operation retry validation needed to remain fail-closed without downgrading an existing completed operation.
9. Historical replay could silently run a newer scorer against an older baseline. Missing capture inputs and monitor telemetry could be mistaken for observed zero or completed evaluation.

## 2. FILES CHANGED

Paths below are relative to the actual checkout above. They describe this mission's edits, not every file currently shown by `git status`.

### Production Files (17)

| File | Repair |
| --- | --- |
| `lib/productIdentityTokens.ts` | Authoritative brand, generic named-model boundaries, category/spec/compatibility roles. |
| `lib/productUrlRetrieval.ts` | Shared plausible-product URL gate, safe redirect/canonical enrichment, structured Product metadata. |
| `lib/productSearchVerifier.ts` | Bounded sparse-candidate enrichment and strict brand/model/capacity/category verification. |
| `lib/exactProductSearch.ts` | Manufacturer candidates, stable query phrases, shared candidate gate; remove unused private token helper. |
| `lib/reviewCollector.ts` | Genuine individual written reviews, Product context, blocked-page detection, full-body deduplication, final-source URL; remove unused legacy fallbacks. |
| `lib/nativeReviewRetrieval.ts` | Stable identity, bounded pagination, terminal restriction handling, source provenance; remove unused snippet parsers. |
| `lib/reviewEvidence.ts` | Stable discovery/retrieval identity and accepted-corpus handoff; remove unused private query helper. |
| `lib/reviewEvidenceAdjudication.ts` | Strict exact-source association, wrong-model/brand rejection, shared written-experience predicate, supported claim intersection. |
| `lib/reviewEvidenceDeterminism.ts` | Versioned, clause/negation-aware deterministic claims and scores; grounded value/quality; no forced five bullets. |
| `lib/scanCompletion.ts` | New testable production completion sequence with exact-owner/scan/row checks. |
| `lib/scanBudget.ts` | Narrow recovery of retired daily-cost blocks; durable completion confirmation. |
| `lib/supabaseServer.ts` | Failed usage insert is not success; quota reads fail closed and retain unknown state. |
| `app/api/analyze/route.ts` | Persist every completed result, exact readback before completion, safe retry identity, fingerprint includes link. |
| `app/api/account/analyses/route.ts` | Exact owner-scoped free result retrieval, strict legacy IDs, reject ambiguity; no destructive GET pruning or latest fallback. |
| `components/ResultsClient.tsx` | Explicit result URL uses the exact persisted result, not a stale cache or newer substitute. |
| `lib/accountSession.ts` | Malformed encoded cookies cannot throw outside safe session validation. |
| `lib/adminAccess.ts` | Same malformed-cookie safety for signed admin access. |

### Scripts (6)

- `scripts/reviewintel-replay.mjs`: missing evidence remains UNKNOWN; current scorer version supplied to replay.
- `scripts/reviewintel-replay-scan.mjs`: reject historical scorer-version mismatch explicitly.
- `scripts/reviewintel-create-offline-baseline.mjs`: new, exclusive-write versioned baseline generator using original raw inputs under the offline I/O guard.
- `scripts/reviewintel-capture-monitor.mjs`: absent extraction/telemetry/evaluation stays unknown; observed zero remains zero.
- `scripts/reviewintel-operation-snapshot.mjs`: new pure persisted-operation formatter; current claim provenance validated against accepted hashes; no credentials, polling, or network on import.
- `scripts/reviewintel-passive-monitor.mjs`: use the pure formatter; no invented public cost/depth certification from arbitrary thresholds.

### Tests (10 Edited or Added)

- Added: `tests/productPipelineHardening.test.mjs`, `tests/scanCompletion.test.mjs`, `tests/scanPersistenceRuntime.test.mjs`.
- Extended: `tests/resultHandoff.test.mjs`, `tests/retrievalCapability.test.mjs`, `tests/reviewEvidenceDeterminism.test.mjs`, `tests/reviewIntelIntelligenceV2Replay.test.mjs`, `tests/offlineReplay.test.mjs`, `tests/devScanCapture.test.mjs`, `tests/passiveMonitor.test.mjs`.

### New Versioned Baselines

- `tests/fixtures/reviewintel/ninja-crispi-intelligence-v3.json`: retained as historical after later scorer changes.
- `tests/fixtures/reviewintel/ninja-crispi-intelligence-v4.json`: retained as historical after stricter expectation/value grounding.
- `tests/fixtures/reviewintel/ninja-crispi-intelligence-v5.json`: current derived OFFLINE baseline, not a new live result.

This document is also new. Existing untracked files are not automatically new mission work; do not stage the whole tree.

## 3. WHAT EACH FIX DOES

### Identity, Discovery, and Verification

- Explicit upstream brand remains authoritative. Generic multiword models survive punctuation/format differences: RingConn Gen 2 Air, Roborock Qrevo S Pro, Philips NA555/00.
- Kenmore 7.0 cu ft remains capacity plus dryer/category/configuration, not a fake Front Load Electric model.
- Eufy E340 remains primary; S380 compatibility, price, rating, review count, years, Pa suction, battery-duration claims, and IP ratings cannot displace primary identity.
- Search query construction preserves useful stable phrases, including single-letter model components and slash identifiers.
- Plausible manufacturer/retailer URLs may reach the verifier. Search/social/category/auth/local/IP/credentialed URLs cannot auto-become trusted product candidates.
- Known search wrappers normalize safely. Amazon final/canonical links must retain the same ASIN; same-host canonical checks and relative canonical resolution preserve identity.
- Sparse candidates get one bounded public enrichment opportunity. Blocked/sign-in pages are not enrichment proof, and a bare URL/ASIN is not brand/model evidence.
- Wrong brand, primary model, category, capacity, accessory, or structured metadata conflicts still reject. Mutable price/rating/count drift does not by itself reject identity.

### Written Review Evidence

- Product specifications, aggregate ratings, search snippets, generic text/rating pairs, and blocked/sign-in pages are not individual written reviews.
- JSON-LD review Product/brand context is retained so reviews for nearby recommended products cannot inherit the requested listing's identity.
- Reviews can inherit exact listing context when the source association is proven; they need not repeat the product brand in every sentence.
- Final fetched source URLs are preserved. A redirect to a different product cannot retain the old source's identity.
- Distinct long reviews no longer collapse merely because the first 180 characters match. Accepted bodies are bounded at 5,000 characters.
- Native retrieval retains bounded depth: default 24 pages, 240 reviews, and 180 seconds. Pagination stops on repeated no-new-review pages or terminal access restrictions.
- HTTP 401/403/429 and sign-in/challenge pages do not trigger browser/proxy attempts to bypass restrictions.
- Firecrawl remains disabled in the product scan path.

### Grounded Intelligence and Scoring

- Current scorer: `deterministic-evidence-scorer-v5`; provenance version 2; verdict policy version 1.
- Only accepted exact-product written reviews authorize claims or numeric sentiment signals.
- Claim support is checked against the actual review language, not merely a provided accepted source ID.
- Sentences/contrast clauses and negation are respected: not reliable is not praise; never failed is not failure; does not work remains a failure.
- Supposed to be durable is an expectation, not observed quality. A high price is not good value. Generic reliability is not automatically physical build quality.
- Five strengths/complaints is a maximum. Fewer are correct when the evidence supports fewer.
- Recurring claims rank first. A grounded one-off cracking complaint remains visible with its support count and source hashes/IDs.
- Value-for-money is Unknown when accepted reviews do not support explicit price/value testimony.
- Numeric scoring still requires exact accepted evidence, at least five usable reviews, interpretable review signals, and a valid recorded aggregate rating. Missing required inputs remain unscored/DO NOT BUY YET, not invented recommendations.
- Reproducibility requires the same accepted evidence, recorded scoring inputs (including rating snapshot), scorer version, and verdict policy. Corpus hash alone is not the whole input ledger.

### Persistence, Quota, and Retry

The production completion sequence is:

1. Save the account-visible analysis row.
2. Read that exact inserted row back under the exact account.
3. Verify row ID, owner, and every available row/payload/nested scan ID.
4. Persist usage and require confirmed success.
5. Finish the durable operation and require matching physical/payload scan ID plus analysis ID.
6. Return success only after all checks pass.

- Missing inserts, missing readback, wrong owner, wrong scan/row, failed usage, and unconfirmed durable completion fail closed.
- A completed retry revalidates the exact persisted result; a failed retry check does not downgrade an already completed operation.
- Only the retired `DAILY_BUDGET_EXHAUSTED` block is resumable by compare-and-set. Other blocks and in-flight operations retain existing idempotency rules.
- Free users can retrieve their own explicit completed scan without unlocking general paid history. Ambiguous duplicate exact-match rows reject instead of picking the latest.
- `/results?scanId=<id>` cannot fall back to another cached/current/newest scan when that explicit persisted result is missing.
- Free quota read failures are unknown, not unused allowance; failed quota persistence is not success. Pro/admin access rules remain intact.

### Replay and Diagnostics

- Original historical captures/baselines are preserved. V2/V3/V4 replay with the current scorer fails explicitly with `SCORER_VERSION_MISMATCH`, not silent drift or rewritten history.
- The current V5 baseline is derived from the unchanged captured raw seven-review corpus and recorded inputs. Its provenance says `DERIVED_OFFLINE_NOT_LIVE_RUNTIME_PROOF`.
- Missing candidate/raw evidence stays UNKNOWN. Monitors do not silently report absent Firecrawl counts as zero or absent extraction as an empty corpus.
- Monitoring remains observational. Cost/token telemetry is not a hard daily customer scan blocker. Diagnostic public-cost/deep-retrieval certification remains NOT_VALIDATED.

## 4. REGRESSIONS PREVENTED

- RingConn brand becoming Gen, or losing Gen 2 Air to IP68/10-Day/Ultra.
- Roborock Qrevo S Pro becoming a suction/year token or losing S.
- Philips slash-model loss; Kenmore capacity/configuration becoming a bogus primary model; E340/S380 compatibility substitution.
- Manufacturer candidates discarded before verification; sparse candidate rejected before safe enrichment; bare ASIN accepted without proof.
- Recommended-product or wrong-brand/model reviews inheriting the target's Product context.
- Product specifications/aggregate metadata/sign-in HTML/search snippets counted as written customer reviews.
- Marketplace total relabeled as actually retrieved review count.
- Easy cleaning relabeled easy use; expectations relabeled quality; arbitrary price mentions relabeled value; legitimate one-off cracking erased.
- Negated praise/failure flipping score or verdict, ratings alone inventing a BUY for uninterpretable text.
- False successful completion, wrong-account readback, conflicting scan IDs, duplicate exact-row ambiguity, free result reload denied, stale/latest result substitution.
- Missing historical evidence becoming zero, telemetry absence becoming zero, or old scorer baselines silently rewritten.

## 5. TEST RESULTS

Final focused run: **221 passed, 0 failed, 0 skipped, 24 files**, approximately 8.66 seconds.

| Check | Result | Scope |
| --- | --- | --- |
| Focused regressions | PASS, 221/221 | Identity, verification, real orchestration with mocked HTTP boundaries, native collection, adjudication, scoring, authenticated GET/persistence boundaries, capture/replay/monitors. |
| Strict ESLint | PASS, zero warnings/errors | The 17 production files and six mission scripts listed above. |
| Typecheck | PASS | `npm run typecheck -- --incremental false`. |
| Tracked whitespace check | PASS | `git diff --check` restricted to mission files. |
| New-file whitespace check | PASS | Additional read-only check for new/untracked mission files; Git diff does not cover them automatically. |
| Real browser/live database/current retailer proof | NOT RUN | Intentionally reserved for the one live runtime proof. |
| Full repository suite/build | NOT RUN | Unrelated dirty work is outside this focused mission. No build was run alongside a dev server. |

Evidence artifacts:

- `/private/tmp/reviewintel-hardening-regressions.log`
- `/private/tmp/reviewintel-hardening-test-files.json`
- `/private/tmp/reviewintel-hardening-v5-replay.json`
- `/private/tmp/reviewintel-hardening-takki-replay.log`
- `/private/tmp/reviewintel-hardening-manifest.json` (generated final file hashes and whitespace check)

The tests exercise production logic at injected/mock external boundaries. They do not replace rendered browser acceptance or prove actual Supabase schema/RPC state. ResultsClient checks are source regressions, not a physical UI run.

### Reproduce the Focused Suite Only if Needed

From the actual checkout:

```sh
node --test tests/productIdentityNamedModel.test.mjs tests/productIdentityAuthoritativeBrand.test.mjs tests/kenmoreRegression.test.mjs tests/productUrlRetrievalCandidateGate.test.mjs tests/manufacturerProductUrlCandidate.test.mjs tests/reviewEvidenceAdjudication.test.mjs tests/reviewEvidenceDeterminism.test.mjs tests/reviewIntelIntelligenceV2Replay.test.mjs tests/resultHandoff.test.mjs tests/retrievalCapability.test.mjs tests/unknownProductSafety.test.mjs tests/offlineReplay.test.mjs tests/devScanCapture.test.mjs tests/scanBudgetSafety.test.mjs tests/scanCostTelemetry.test.mjs tests/productPipelineHardening.test.mjs tests/scanCompletion.test.mjs tests/scanPersistenceRuntime.test.mjs tests/adaptiveReviewResearch.test.mjs tests/retrievalSourceMetrics.test.mjs tests/canonicalEvidenceArchitecture.test.mjs tests/reviewEvidenceScoring.test.mjs tests/scanStateGuards.test.mjs tests/passiveMonitor.test.mjs
npm run typecheck -- --incremental false
```

Do not rerun the already-passed suite reflexively if the tree has not changed. Capture command status and report failures; do not use `exit`, `exit 1`, `set -e`, or terminal-terminating shell constructs.

## 6. OFFLINE REPLAY RESULTS

| Fixture/scenario | Result | Qualification |
| --- | --- | --- |
| Ninja Crispi V5 | Seven accepted reviews; 7.4 BUY; exact replay repeated identically. | New versioned OFFLINE baseline from unchanged original evidence. |
| Ninja strengths | Cleaning 4, appearance 2, cooking results 2, useful features 1. | All ACCEPTED_WRITTEN_REVIEW provenance; no invented fifth strength. |
| Ninja complaint | Cracking/material durability 1. | Grounded one-off warning preserved. Value remains Unknown. |
| Takki historical fixture | Thirteen accepted reviews; 5.9 AVOID; deterministic fixture replay. | Combined historical metadata snapshot; HTTP/challenge state UNKNOWN; not current owner/live scan proof. |
| RingConn/Roborock/Philips/Kenmore | Identity/query/verifier/orchestration regressions pass. | Synthetic HTTP fixtures plus source logic, not new real-site scans. |
| Native depth | 65 unique written reviews collected across seven fixture pages. | Bounded synthetic pagination, not a guarantee of retailer coverage. |
| Cosori-style Amazon sign-in | HTTP 200 sign-in fixture rejects, no protection-bypass retry. | External restriction represented truthfully. |
| Missing Kenmore/Ninja historical captures | UNKNOWN inputs/count/hash/evaluation preserved. | No invented zero or final verdict. |

Every offline replay used **network = 0, OpenAI = 0, search-provider = 0, Firecrawl = 0**. The I/O tripwire blocks external I/O before it occurs, including attempts swallowed by callers.

Ninja corpus hash:
`428546f02968a7b5bb8a9b44f30db0358e1b1775418b099624364078a26d312b`

Takki corpus hash:
`e5a62a80a605951a5ff1e8d2cebafb7c5a0e345024b47cf0e09528aaf718a561`

### Preserved Artifact Hashes (SHA-256)

| Artifact | Hash |
| --- | --- |
| Untouched `lib/socialReelGenerator.ts` | `29a3b26ebe0e37f5c734ab4abaef03ce88759c4648184259adea81937bb12e8b` |
| Original V2 baseline | `4af7a6057610d8b0d2fdf6e26b5745e08b0bb107456b96280ca499b3f6d0bac9` |
| Retained V3 baseline | `eab92f398850ffd8e9894ec0b0506fd589274074bb14a06645f42d052b83cebf` |
| Retained V4 baseline | `8c0e90d299127b9e4482a9adecd36a407c497088ea28fa5253e612a868274b9d` |
| Current V5 baseline | `5a03731dfaa52b5100781886c3c2cde124b5aa90b45a742007fca2e96fc1ba6e` |
| Original `scan_f3611065-00cd-4666-adcc-70a162ef8227.json` capture in `/private/tmp/reviewintel-replay-captures` | `5048fa4dcf166c5208af2396291ee30762162c57b045e3d21874d1e89bb517d2` |

## 7. REMAINING KNOWN LIMITATIONS

1. No current real retailer access, owner-authenticated persistence, durable RPC, or rendered exact result has been proven. Local tests cannot certify production.
2. Sites can legitimately block public access. No code can promise a scored result without sufficient legitimate exact-product reviews; do not bypass CAPTCHA/auth or fabricate evidence to force BUY.
3. Retrieval is bounded, not exhaustive. Pagination limits do not guarantee all written reviews or balanced sampling across every retailer.
4. Written-experience detection includes bounded French/German/Spanish markers, but claim/sentiment rules remain predominantly English and lexical. Sarcasm, unsupported languages, complex discourse, and unseen wording are not universally understood. A ratings-only numeric verdict is prohibited when text signals cannot be interpreted.
5. Exact replay requires the full recorded input ledger and version, not just the same text corpus. Aggregate rating changes can legitimately change a later result.
6. Completion is a fail-closed sequence, NOT an atomic database transaction. A later usage/durable failure may leave a partial analysis row. Retry/reconciliation requires care; do not claim automatic rollback.
7. Existing admission for concurrent different free scan IDs is not an atomic quota reservation. This mission did not apply a migration or certify abuse-resistant launch quota behavior.
8. Exact result retrieval supports bounded legacy scan columns; absent optional columns may produce query errors during probes. Actual production schema/catalog state was not inspected here.
9. URL local/IP/credential gates are not a comprehensive DNS-rebinding/SSRF security audit. Do not advertise universal hostile-URL safety from these regressions.
10. Untouched unrelated social/admin/TikTok changes, full repository tests/build, deployed release identity, and subscription production acceptance remain outside scope.
11. The legacy `scripts/reviewintel-live-blind-monitor.mjs` recursively searches arbitrary event fields and is not authoritative final-result proof. Use captured event stages and the exact result/operation records, not first recursive matches. The default database passive-monitor branch still uses a broad row projection; do not use that branch for the bounded forensic proof below.
12. Runtime server availability, live credentials/billing/provider access, and current production health are UNKNOWN. No secret values were printed and no provider work was started to check them.

## 8. WHETHER ONE LIVE PROOF IS NOW JUSTIFIED

**Yes, for the repaired product-intelligence pipeline, with an owner-coordinated single local runtime proof.** The known pipeline blockers covered by this mission are fixed and the focused offline gates pass. This does NOT authorize deployment, migration application, repeated scans, or a blanket paid-launch claim.

Offline readiness gates (covered scenarios, not proof for every possible internet input):

```text
AUTHORITATIVE_BRAND_PRESERVED=YES
NAMED_MODEL_PRESERVED=YES
SPEC_MARKETING_NOISE_EXCLUDED=YES
KENMORE_CAPACITY_ROLE_PRESERVED=YES
ROBOROCK_MODEL_PRESERVED=YES
PHILIPS_EXPLICIT_MODEL_PRESERVED=YES
RINGCONN_GEN_2_AIR_PRESERVED=YES
MANUFACTURER_URL_CAN_REACH_VERIFIER=YES
SEARCH_SOCIAL_CATEGORY_URLS_REJECTED=YES
SPARSE_CANDIDATE_GETS_SAFE_ENRICHMENT=YES
BARE_URL_NOT_AUTO_TRUSTED=YES
AMAZON_SIGNIN_CHALLENGE_REJECTED=YES
EXACT_PRODUCT_VERIFIER_STILL_STRICT=YES
FIRECRAWL_REACHABLE=NO
ACCEPTED_REVIEWS_REQUIRE_REAL_WRITTEN_EVIDENCE=YES
SPECS_CANNOT_BECOME_REVIEWS=YES
CLAIMS_REQUIRE_ACCEPTED_REVIEW_PROVENANCE=YES
RESULT_SCAN_ID_PERSISTENCE_STRICT=YES
SAME_CORPUS_REPLAY_DETERMINISTIC=YES
TYPECHECK=PASS
DIFF_CHECK=PASS
```

## Successor AI: Exact Next Step

### Preserve These Boundaries

- Re-read the original request and this report before acting. Verify the actual checkout and dirty status; compare the manifest hashes for changed code.
- Do not reset/restore/checkout/stash/clean, stage all files, commit, push, deploy, apply migrations, or edit `lib/socialReelGenerator.ts`.
- Do not add features, redesign the UI, rebuild the backend, reintroduce cost hard-blocking, or weaken evidence/ownership to manufacture success.
- Do not rewrite V2/V3/V4, the original capture, or V5 to hide drift. Intentional later scorer changes require a new version and separate baseline from original raw inputs.
- No credential/password inspection, cookie extraction/decryption/cloning, or modification of the owner's existing browser profile.
- No Firecrawl, CAPTCHA/auth bypass, private scraping, or additional scans/provider retries merely to obtain a favorable score.

### Prepare the One Proof

1. Coordinate the single scan with the owner; do not silently spend provider credits. Confirm one product/input and one account. RingConn Gen 2 Air is the most recent identity/discovery regression target, but do not substitute it for an owner-selected product.
2. Confirm the local server is the actual patched checkout immediately before testing. Development capture only writes when `NODE_ENV === development`. Do not build concurrently with `next dev` or mix `.next` outputs.
3. Use a fresh temporary browser profile under `/private/tmp` and have the owner log in manually. Do not inspect their password or session tokens.
4. Start only the LOCAL capture monitor before the scan:

   ```sh
   node scripts/reviewintel-passive-monitor.mjs --captures
   ```

   This explicit flag avoids the credential-reading/database-polling branch. Stop the monitor when the single proof is finished; do not leave it running indefinitely.

5. Verify the UI's product identity/link or one screenshot preview and enabled Analyze button. Click Analyze exactly once. Do not submit a parallel direct API scan.
6. Track that new scanId from request/response/capture, not a historical/newest row chosen after the fact. Keep missing diagnostics as NOT_CAPTURED/UNKNOWN.
7. Prove the exact account-visible result and rendered result under `/results?scanId=<that exact id>`, including reload. Require URL scanId == persisted scanId == rendered scanId and the same account association.
8. If database evidence is needed, first identify the actual schema and then use narrow exact-owner/exact-scan projections. Never `select=*`, query unrelated customers, use cache tables as historical proof, or substitute another record.
9. Replay that NEW capture with the unchanged current scorer under the offline guard:

   ```sh
   npm run reviewintel:replay -- --scan=<the-new-scan-id>
   ```

   A missing evaluation is not completed proof. A scorer-version mismatch is expected for old captures, not permission to rewrite them.
10. If retailer access is blocked, classify EXTERNAL_ACCESS_RESTRICTION separately from CODE_DEFECT. A truthful unscored result can be correct. Do not rerun a scan automatically.

### Required Runtime Evidence (30 Fields)

1. Submitted product identity.
2. Authoritative brand.
3. Named model/family.
4. Stable query terms.
5. Queries issued.
6. Search-provider call count.
7. Candidate URLs discovered.
8. Candidates rejected before fetch.
9. Candidates enriched.
10. Enrichment failures.
11. Candidate verification attempts.
12. Verified exact listing.
13. Canonical product identifier/ASIN, if available.
14. Native review retrieval started.
15. Pages attempted.
16. Blocked pages detected.
17. Raw written reviews discovered (not marketplace total).
18. Deduplicated written reviews.
19. Accepted exact-product reviews.
20. Rejected evidence and reasons.
21. Corpus hash.
22. Grounded strengths with support/provenance.
23. Grounded complaints with support/provenance.
24. Score, or explicit unscored state.
25. Verdict.
26. Confidence.
27. Account-visible persistence result.
28. Exact scanId/resultId/account association, including rendered URL/reload.
29. Firecrawl calls (must be observed zero, not missing-as-zero).
30. OpenAI/search/token/duration/cost telemetry, with unknown values preserved.

### Completion Standard

Report observed evidence, not inferred success. Offline green plus one live proof does not automatically certify all plan modes, production subscriptions, concurrency, security, mobile rendering, or deployment. If the proof exposes a deterministic code blocker, preserve its capture and report it; do not launch repeated paid scans as a debugging loop.

READY_FOR_ONE_LIVE_RUNTIME_PROOF
