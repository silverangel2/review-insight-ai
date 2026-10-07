import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("new product scans are stamped and stale results are rejected", () => {
  const analyzer = source("components/AnalyzerForm.tsx");
  const results = source("components/ResultsClient.tsx");

  assert.match(analyzer, /formData\.append\("scanId", scanId\)/);
  assert.match(analyzer, /data\?\.scanId !== scanId/);
  assert.match(analyzer, /saveLatestResult\(storedResult, account\)/);

  assert.match(results, /readActiveScanId\(\)/);
  assert.match(results, /readLatestResult\(\s*account,\s*activeScanId \? \{ scanId: activeScanId \}/s);
  assert.match(results, /const parsedScanId = scanIdFromAnalyzeResponse\(parsed\)/);
  assert.match(results, /if \(activeScanId && parsedScanId !== activeScanId\)/);
  assert.match(results, /parsed = null/);
});

test("fresh current results win over delayed history recovery", () => {
  const results = source("components/ResultsClient.tsx");

  assert.match(results, /const currentResult = selectedHistoryId\s*\? null\s*:\s*readLatestResult/s);
  assert.match(results, /if \(currentResult\) return;/);
  assert.match(results, /const currentResultAfterFetch = selectedHistoryId/s);
  assert.match(results, /if \(currentResultAfterFetch\) return;/);
  assert.match(results, /const recoveredIsCurrentScan = Boolean\(/);
  assert.match(results, /const recoveredResultSource = recoveredIsCurrentScan \? "analyze" : "history"/);
  assert.doesNotMatch(results, /resultSource: "history",\s*analysisId: latest\.id/);
});

test("recommendations are isolated from the main scan result", () => {
  const panel = source("components/BetterPicksPanel.tsx");
  const route = source("app/api/product-recommendations/route.ts");

  assert.match(panel, /cacheKeyFor\(productName, verdict, locale, scanId\)/);
  assert.match(panel, /scanId,\s*locale,\s*affiliatePlacement/s);
  assert.match(panel, /data\.scanId && scanId && data\.scanId !== scanId/);

  assert.match(route, /resultSource: "recommendations"/);
  assert.match(route, /scanId,/);
});

test("rejected exact listings cannot collect unrelated written reviews", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /let collectorSourceAccepted = Boolean\(\s*exactListingAccepted && listingUrlForReviewCollector\s*\)/s);
  assert.ok(
    evidence.indexOf("const exactProductAgent = await runExactProductAgent") >= 0,
    "exact-product verification must be present",
  );
  assert.ok(
    evidence.indexOf("const exactProductAgent = await runExactProductAgent") <
      evidence.indexOf("await runNativeReviewRetrieval"),
    "native review retrieval must follow exact-product verification",
  );
  assert.match(evidence, /exactListingAccepted && listingUrlForReviewCollector/);
  assert.match(evidence, /collectorSourceAccepted && exactListingAccepted/);
  assert.match(evidence, /if \(exactListingAccepted && listingUrlForReviewCollector\)/);
  assert.match(evidence, /if \(!collectorSourceAccepted\) \{/);
  assert.match(evidence, /return insufficientEvidence;/);
  assert.doesNotMatch(evidence, /Requested price .*matched listing price was not confirmed/);
  assert.doesNotMatch(evidence, /hasRatingMismatch && hasReviewCountMismatch/);
});

test("review evidence has no premature metadata-only race", () => {
  const analyzerRoute = source("app/api/analyze/route.ts");

  assert.match(analyzerRoute, /export const runtime = "nodejs"/);
  assert.match(analyzerRoute, /export const maxDuration = 180/);
  assert.doesNotMatch(analyzerRoute, /Promise\.race\(\[/);
  assert.doesNotMatch(analyzerRoute, /reviewEvidenceTimeoutMs/);
  assert.match(analyzerRoute, /collectAndAnalyzeReviewEvidence\(\{/);
  assert.match(analyzerRoute, /reviewEvidenceRecoveryFailed/);
});

test("shopper verdict paths use review first instead of obsolete middle verdict output", () => {
  const analyzerRoute = source("app/api/analyze/route.ts");
  const results = source("components/ResultsClient.tsx");
  const betterPicks = source("components/BetterPicksPanel.tsx");
  const productStability = source("lib/productStability.ts");
  const obsoleteMiddleVerdict = "CONSIDER";

  assert.match(analyzerRoute, /type Verdict = "BUY" \| "REVIEW FIRST" \| "AVOID"/);
  assert.match(analyzerRoute, /verdict = "REVIEW FIRST"/);
  assert.match(analyzerRoute, /normalizeOptionalShopperVerdict/);
  assert.doesNotMatch(analyzerRoute, new RegExp(`verdict\\s*[:=]\\s*["']${obsoleteMiddleVerdict}`));
  assert.doesNotMatch(analyzerRoute, new RegExp(`return\\s+["']${obsoleteMiddleVerdict}`));

  assert.match(results, /type ShopperVerdict = "BUY" \| "REVIEW FIRST" \| "AVOID" \| "NOT_ENOUGH"/);
  assert.match(results, /displayShopperVerdict/);
  assert.doesNotMatch(results, new RegExp(`return\\s+["']${obsoleteMiddleVerdict}`));
  assert.doesNotMatch(results, new RegExp(`verdict:\\s*["']${obsoleteMiddleVerdict}`));

  assert.match(betterPicks, /return "DO NOT BUY YET"/);
  assert.doesNotMatch(betterPicks, new RegExp(`return\\s+["']${obsoleteMiddleVerdict}`));

  assert.match(productStability, /normalizeStoredVerdict/);
  assert.doesNotMatch(productStability, new RegExp(`last_verdict:\\s*["']${obsoleteMiddleVerdict}`));
  assert.doesNotMatch(productStability, new RegExp(`return\\s+["']${obsoleteMiddleVerdict}`));
});

test("exact product search uses candidate collection instead of one guessed URL", () => {
  const exactSearch = source("lib/exactProductSearch.ts");

  assert.match(exactSearch, /export async function findExactProductCandidates/);
  assert.match(exactSearch, /retrieveProductUrls/);
  assert.match(exactSearch, /fetchFastProductUrlCandidates/);
  assert.match(exactSearch, /fetchAmazonSearchCandidates/);
  assert.match(exactSearch, /searchQueries/);
  assert.match(exactSearch, /appendProductQuery/);
  assert.doesNotMatch(exactSearch, /callOpenAiWebSearchResponse/);
  assert.doesNotMatch(exactSearch, /tools:\s*\[\s*\{\s*type:\s*["']web_search/);
  assert.doesNotMatch(exactSearch, /Primary search query to run first/);
  assert.doesNotMatch(exactSearch, /if \(!url \|\| !isProductCandidateUrl\(url\)\) return null/);
  assert.match(exactSearch, /isLikelyProductUrl/);
  assert.match(exactSearch, /AbortController/);
});

test("review evidence runs a bounded verifier retry loop before collection", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /async function runExactProductAgent/);
  assert.match(evidence, /const maxCandidates = 5/);
  assert.match(evidence, /const maxRetryRounds = 2/);
  assert.match(evidence, /REVIEWINTEL_EXACT_SEARCH_TIMEOUT_MS \|\| 12000/);
  assert.match(evidence, /const perAttemptTimeoutMs = 3500/);
  assert.match(evidence, /takeNextAgentQuery/);
  assert.match(evidence, /usedSearchQueries/);
  assert.match(evidence, /const candidatesThisRound =/);
  assert.match(evidence, /Math\.min\(2, remainingCandidateSlots\)/);
  assert.match(evidence, /const initialSearchQueries = mergeUniqueStrings\(\[\s*\.\.\.retrySearchQueries,/s);
  assert.match(evidence, /\[ReviewIntel DEBUG exactProductAgentRound\]/);
  assert.match(evidence, /\[ReviewIntel DEBUG exactProductCandidateVerifier\]/);
  assert.match(evidence, /searchQueries: \[primaryQuery\]/);
  assert.match(evidence, /appendProductQuery: false/);
  assert.match(evidence, /rejectedListingUrls\.push\(result\.rejectedListingUrl \|\| candidateUrl\)/);
  assert.match(evidence, /No product candidates returned for agent round/);
  assert.match(evidence, /const hasMoreAgentRounds =/);
  assert.match(evidence, /findExactProductCandidates/);
  assert.match(evidence, /\[ReviewIntel DEBUG exactProductAgent\]/);
  assert.match(evidence, /productVerifierResult\.canCollectReviews/);
  assert.match(evidence, /verifiedListingUrlForCollection/);
  assert.doesNotMatch(evidence, /if \(searchResult\.timedOut\) exactSearchTimedOut = true/);
  assert.doesNotMatch(evidence, /!retrySearchQueries\.length \|\| exactSearchTimedOut\) break/);
  assert.match(evidence, /(?:const|let) listingRejectedForCollection = !listingUrlForReviewCollector/);
  assert.match(evidence, /void saveReviewEvidenceToMemory\(input, insufficientEvidence\)/);
});

test("exact product verifier treats other stores as strict fallback sources", () => {
  const verifier = source("lib/productSearchVerifier.ts");

  assert.match(verifier, /preferredStoreMismatch/);
  assert.match(verifier, /const requiredTermCoverage = preferredStoreMismatch \? 0\.82 : 0\.55/);
  assert.match(verifier, /strict exact-product fallback checks/);
  assert.match(verifier, /function cleanRetryQuery/);
  assert.match(verifier, /Amazon\\s\+s/);
  assert.match(verifier, /function featureTermsForJob/);
  assert.match(verifier, /function productTypeTermsForJob/);
  assert.match(verifier, /site:\$\{siteTarget\}/);
  assert.match(verifier, /void reason/);
});

test("exact product retry queries are clean and intent-specific", () => {
  const jiti = require("jiti")(new URL("../query-test.js", import.meta.url).pathname);
  const { buildProductRetryQueries } = jiti("./lib/productSearchVerifier.ts");

  const queries = buildProductRetryQueries({
    scanId: "zzq-unknown-product-smoke",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 USB Rechargeable Portable Device Gray 28 Hours 5 Speed",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Gray 28 Hours 5 Speed Amazon.ca",
    rating: 4.7,
    reviewCount: 671,
  });

  assert.ok(queries.some((query) => /X9/i.test(query)));
  assert.ok(queries.some((query) => /site:amazon\.ca/i.test(query)));
  assert.doesNotMatch(queries.join("\n"), /4\.7 stars|671 reviews|149\.99|Amazon s|Amazon Amazon| Gray color | color Amazon| Mini Handheld Fan|5000mAh/i);
});

test("better picks does not auto-run during initial scan result load", () => {
  const panel = source("components/BetterPicksPanel.tsx");

  assert.match(panel, /autoLoad = false/);
  assert.match(panel, /window\.setTimeout/);
  assert.match(panel, /1800/);
});

test("insufficient review evidence cannot reach the sufficient-but-no-pattern empty copy", () => {
  const results = source("components/ResultsClient.tsx");

  assert.match(results, /const evidenceState = reviewEvidenceDecisionState\(result\)/);
  assert.match(results, /const strengthEmpty = evidenceState === "not_enough"/);
  assert.match(results, /const complaintEmpty = evidenceState === "not_enough"/);
  assert.match(results, /Not enough written review evidence to determine strengths\./);
  assert.match(results, /Not enough written review evidence to determine repeated complaints\./);
  assert.match(results, /verdict === "NOT_ENOUGH"/);
  assert.match(results, /evidenceSufficiency/);
  assert.match(results, /not enough \(\?:written \)\?review evidence/);
});

test("analyze verifies local result storage before navigating to results", () => {
  const analyzer = source("components/AnalyzerForm.tsx");
  const storage = source("lib/resultStorage.ts");
  const results = source("components/ResultsClient.tsx");

  assert.match(analyzer, /const storageSuccess = saveLatestResult\(storedResult, account\)/);
  assert.match(analyzer, /const storedScan = readLatestResult\(account, \{ scanId \}\)/);
  assert.match(analyzer, /if \(!storageSuccess \|\| !storedScan\)/);
  assert.match(analyzer, /reviewIntelDevDiagnostic\("NAVIGATION_TARGET"/);
  assert.match(storage, /const success = sessionVerified && localVerified/);
  assert.match(storage, /reviewIntelDevDiagnostic\("RESULT_STORAGE_WRITE"/);
  assert.match(results, /reviewIntelDevDiagnostic\("RESULTS_SCAN_ID"/);
  assert.match(results, /reviewIntelDevDiagnostic\("RESULTS_RESULT_FOUND"/);
  assert.match(results, /branch: "no_scan_loaded"/);
});

test("analyze preserves auth and free-quota enforcement", () => {
  const analyzer = source("app/api/analyze/route.ts");

  assert.match(analyzer, /if \(role === "guest"\)/);
  assert.match(analyzer, /readPersistentQuota/);
  assert.match(analyzer, /consumePersistentQuota/);
  assert.match(analyzer, /DAILY_SCAN_LIMIT_REACHED/);
});

test("runtime display guards cannot turn missing evidence fields into conclusions", () => {
  const client = source("components/ResultsClient.tsx");
  const dashboard = source("components/ResultsDashboard.tsx");
  const governor = source("lib/decisionGovernor.ts");
  const stability = source("lib/productStability.ts");
  const consistency = source("lib/finalVerdictConsistency.ts");
  const compare = source("app/api/shopper-compare/route.ts");
  const sellerCompare = source("app/api/seller-compare/route.ts");

  assert.match(client, /if \(String\(result\.analysisVersion \|\| \"\"\) !== \"review-evidence-v2\"\) \{\s*return \"not_enough\";/s);
  assert.match(client, /if \(reviewEvidenceDecisionState\(result\) === \"not_enough\"\) \{\s*return result;/s);
  assert.match(client, /return \"NOT_ENOUGH\";/);
  assert.match(client, /const productScore = numericOrNull/);
  assert.match(client, /const buyingConfidence = numericOrNull/);
  assert.match(client, /const fakeReviewPercent = numericOrNull/);
  assert.match(client, /valueForMoney = String\([^;]+\|\| \"Unknown\"\)/);
  assert.match(client, /const zeroWrittenReviewEvidence =/);
  assert.match(client, /valueForMoney: zeroWrittenReviewEvidence \? \"Unknown\"/);
  assert.match(client, /fakeReviewPercent === null/);
  assert.match(dashboard, /function hasGroundedSellerResult/);
  assert.match(dashboard, /writtenMode !== "listing_metadata"/);
  assert.match(dashboard, /return writtenEvidence && completeNumbers && completeRecommendation && hasSummary/);
  assert.match(dashboard, /Not enough verified written review evidence/);
  assert.match(governor, /typeof input\.commentsAnalyzed === "number" && input\.commentsAnalyzed >= 3/);
  assert.doesNotMatch(governor, /\(rating !== null && rating > 0\) \|\|/);
  assert.match(stability, /const hasReviewEvidence = canonicalSufficiencyPassed && commentsAnalyzed >= 3/);
  assert.match(stability, /const finalReviewEvidence = currentReviewEvidence \|\| rememberedReviewEvidence \|\| null/);
  assert.match(stability, /buyerConfidence: null/);
  assert.match(consistency, /nextScore = null;/);
  assert.match(consistency, /nextConfidence = null;/);
  assert.match(compare, /confidence: hasConfidence/);
  assert.match(compare, /Comparison not scored/);
  assert.match(compare, /if \(!hasWrittenReviewEvidence\(productAWithReviewEvidence\) \|\| !hasWrittenReviewEvidence\(productBWithReviewEvidence\)\)/);
  assert.match(sellerCompare, /confidence: readNumber\(raw\.confidence\)/);
  assert.match(sellerCompare, /if \(!hasWrittenReviewEvidence\(yourProductWithReviewEvidence\) \|\| !hasWrittenReviewEvidence\(competitorProductWithReviewEvidence\)\)/);
});

test("rejected exact listings and thin evidence cannot reach scoring", () => {
  const evidence = source("lib/reviewEvidence.ts");
  const analyzer = source("app/api/analyze/route.ts");
  const client = source("components/ResultsClient.tsx");

  assert.match(evidence, /(?:const|let) exactListingAccepted = Boolean\(listingUrlForReviewCollector\)/);
  assert.doesNotMatch(evidence, /(?:^|\n)\s*exactListingAccepted = true;/);
  assert.match(analyzer, /const canonicalEvidenceEligible = exactListingAccepted && canonicalSufficiencyPassed/);
  assert.doesNotMatch(analyzer, /isSufficientReviewEvidence\(\{/);
  assert.match(analyzer, /topStrengths: canonicalEvidenceEligible &&/);
  assert.match(analyzer, /topComplaints: canonicalEvidenceEligible &&/);
  assert.match(analyzer, /commentsAnalyzed,/);
  assert.match(client, /!exactListingAccepted/);
  assert.match(client, /commentsAnalyzed < 3/);
  assert.match(client, /reviewSignals < 3/);
  assert.match(evidence, /score: hasAnalyzedReviewText \? score : null/);
});

test("compare routes and seller dashboard use the canonical exact-and-sufficient evidence gate", () => {
  const shopperCompare = source("app/api/shopper-compare/route.ts");
  const sellerCompare = source("app/api/seller-compare/route.ts");
  const dashboard = source("components/ResultsDashboard.tsx");
  const scoring = source("lib/reviewEvidenceScoring.ts");

  assert.match(scoring, /export function hasSufficientReviewEvidenceRecord/);
  assert.match(scoring, /evidence\.exactListingAccepted === true/);
  assert.match(scoring, /listingEvidence\.exactListingUrl/);
  assert.match(shopperCompare, /hasSufficientReviewEvidenceRecord/);
  assert.match(shopperCompare, /return hasSufficientReviewEvidenceRecord\(value\)/);
  assert.match(sellerCompare, /hasSufficientReviewEvidenceRecord/);
  assert.match(sellerCompare, /return hasSufficientReviewEvidenceRecord\(value\)/);
  assert.match(dashboard, /hasSufficientReviewEvidenceRecord/);
  assert.match(dashboard, /if \(!hasSufficientReviewEvidenceRecord\(result\)\) return false/);
});

test("collector review evidence is normalized before counting", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /REVIEWINTEL_COLLECTOR_EVIDENCE_HARDENING/);
  assert.match(evidence, /function hardenedCollectorReviews/);
  assert.match(evidence, /const incomingReviews = input\.reviews \?\? current\.reviews/);
  assert.match(evidence, /const reviews = hardenedCollectorReviews\(incomingReviews\)/);
  assert.match(evidence, /reviewsCollected: reviews\.length/);
  assert.match(evidence, /collectorHasWrittenReviews: reviews\.length > 0/);
});

test("collector removes duplicate and unusable review text", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /normalizedReviewFingerprint/);
  assert.match(evidence, /seenExact\.has\(fingerprint\)/);
  assert.match(evidence, /seenNearDuplicate\.has\(nearDuplicateKey\)/);
  assert.match(evidence, /fingerprint\.length < 12/);
  assert.match(evidence, /\.normalize\("NFKC"\)/);
});

test("collector preserves unknown structured provider review shapes", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /Structured collector entries without a recognized text field are kept/);
  assert.match(evidence, /if \(!fingerprint\) \{\s*return true;/s);
});

test("collector fallback URLs are unique, trimmed and bounded", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /\.map\(\(url\) => String\(url \|\| ""\)\.trim\(\)\)/);
  assert.match(evidence, /\.filter\(Boolean\)/);
  assert.match(evidence, /\.slice\(0, 24\)/);
});

test("review evidence uses bounded adaptive OpenAI URL discovery", () => {
  const evidence = source("lib/reviewEvidence.ts");
  const helper = source("lib/openAiWebSearch.ts");

  assert.match(evidence, /const canonicalSufficiencyFor =/);
  assert.match(evidence, /sufficientByExistingThreshold/);
  assert.match(evidence, /createOpenAiWebSearchContext\(\{ maxCalls: 2, stage: "identity" \}\)/);
  assert.match(evidence, /openAiWebSearchContext\.maxCalls = 5/);
  assert.match(evidence, /discoverReviewUrlsWithOpenAi/);
  assert.match(evidence, /last-resort-review-url-discovery/);
  assert.match(evidence, /collectWrittenReviewsFromUrls/);
  assert.match(evidence, /callOpenAiResponseWithoutWebSearch/);
  assert.match(evidence, /runAdaptiveReviewResearch/);
  assert.match(evidence, /stagnantPasses: 2/);
  assert.doesNotMatch(evidence, /usedOpenAiWebReviewSearch/);
  assert.match(helper, /search_context_size/);
});

test("OpenAI Web Search calls are centralized and budgeted", () => {
  const helper = source("lib/openAiWebSearch.ts");
  const evidence = source("lib/reviewEvidence.ts");
  const exactSearch = source("lib/exactProductSearch.ts");
  const productUrlRetrieval = source("lib/productUrlRetrieval.ts");
  const recommendations = source("app/api/product-recommendations/route.ts");
  const adminCheck = source("app/api/admin/review-tools-check/route.ts");

  assert.match(helper, /REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED/);
  assert.match(helper, /gpt-4\.1-mini/);
  assert.match(helper, /DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS = 5/);
  assert.match(helper, /skippedDuplicates/);
  assert.match(helper, /skippedDisabled/);
  assert.match(helper, /skippedEvidenceSatisfied/);
  assert.match(helper, /skippedLimitReached/);
  assert.match(helper, /context\.diagnostics\.calls \+= 1/);

  assert.equal((evidence.match(/await callOpenAiWebSearchResponse/g) || []).length, 2);
  assert.match(evidence, /purpose: "exact-product-identity-recovery"/);
  assert.match(evidence, /purpose: "last-resort-review-url-discovery"/);
  assert.doesNotMatch(evidence, /purpose: "review-evidence-first-pass"/);
  assert.doesNotMatch(evidence, /allowWithoutWebSearch/);
  assert.doesNotMatch(exactSearch, /callOpenAiWebSearchResponse/);
  assert.doesNotMatch(productUrlRetrieval, /callOpenAiWebSearchResponse/);

  for (const file of [evidence, exactSearch, productUrlRetrieval, recommendations, adminCheck]) {
    assert.doesNotMatch(file, /tools:\s*\[\s*\{\s*type:\s*["']web_search/);
    assert.doesNotMatch(file, /tools:\s*\[\s*\{\s*type:\s*["']web_search_preview/);
  }
});
