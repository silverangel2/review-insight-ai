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
  assert.match(analyzer, /saveLatestResult\(\{ \.\.\.data, resultSource: "analyze" \}/);

  assert.match(results, /readActiveScanId\(\)/);
  assert.match(results, /readLatestResult\(\s*account,\s*activeScanId \? \{ scanId: activeScanId \}/s);
  assert.match(results, /const parsedScanId = scanIdFromAnalyzeResponse\(parsed\)/);
  assert.match(results, /if \(activeScanId && parsedScanId && parsedScanId !== activeScanId\)/);
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
  assert.match(evidence, /await runNativeReviewRetrieval[\s\S]*const exactProductAgent = await runExactProductAgent/);
  assert.match(evidence, /nativeReviewRetrieval &&\s*collectedWrittenReviews\.reviewsCollected < 3 &&\s*\(\s*collectorSourceAccepted \|\| hasSpecificRecoveryIdentity/s);
  assert.match(evidence, /if \(!collectorSourceAccepted\) \{/);
  assert.match(evidence, /return insufficientEvidence;/);
  assert.match(evidence, /hasVariantMismatch \|\|\s*\(hasRatingMismatch && hasReviewCountMismatch\)/);
});

test("review evidence scan timeout stays below the production function timeout", () => {
  const analyzerRoute = source("app/api/analyze/route.ts");

  assert.match(analyzerRoute, /export const runtime = "nodejs"/);
  assert.match(analyzerRoute, /export const maxDuration = 180/);
  assert.match(analyzerRoute, /const reviewEvidenceTimeoutCeilingMs = Math\.max\(1000, maxDuration \* 1000 - 5000\)/);
  assert.match(analyzerRoute, /REVIEW_EVIDENCE_TIMEOUT_MS \|\| reviewEvidenceTimeoutCeilingMs/);
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

  assert.match(betterPicks, /return "REVIEW FIRST"/);
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
  assert.match(evidence, /const listingRejectedForCollection = !listingUrlForReviewCollector/);
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
    scanId: "jisulife-smoke",
    store: "Amazon.ca",
    brand: "JISULIFE",
    productName: "JISULIFE Mini Handheld Fan 5000mAh USB Rechargeable Portable Fan Gray 28 Hours 5 Speed",
    productKey: "JISULIFE Mini Handheld Fan 5000mAh Gray 28 Hours 5 Speed Amazon.ca",
    rating: 4.7,
    reviewCount: 671,
  });

  assert.deepEqual(queries, [
    "JISULIFE Mini Handheld Fan 5000mAh Gray Amazon.ca",
    "JISULIFE 5000mAh Gray 28 Hours 5 Speed Amazon.ca",
    "JISULIFE Gray 4.7 stars 671 reviews Amazon.ca",
    '"JISULIFE" "5000mAh" "Gray" "Amazon.ca"',
    "site:amazon.ca JISULIFE 5000mAh Gray Mini Handheld Fan",
  ]);
  assert.doesNotMatch(queries.join("\n"), /Amazon s|Amazon Amazon| Gray color | color Amazon| Handheld Fan Hours/i);
});

test("better picks does not auto-run during initial scan result load", () => {
  const panel = source("components/BetterPicksPanel.tsx");

  assert.match(panel, /autoLoad = false/);
  assert.match(panel, /window\.setTimeout/);
  assert.match(panel, /1800/);
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

test("review evidence uses one last-resort OpenAI URL discovery step", () => {
  const evidence = source("lib/reviewEvidence.ts");
  const helper = source("lib/openAiWebSearch.ts");

  assert.match(evidence, /REVIEWINTEL_RELIABLE_SIGNAL_TARGET \|\| 20/);
  assert.match(evidence, /Math\.min\(Number\(process\.env\.REVIEWINTEL_RELIABLE_SIGNAL_TARGET \|\| 20\), 30\)/);
  assert.match(evidence, /createOpenAiWebSearchContext\(\{ maxCalls: 1 \}\)/);
  assert.match(evidence, /discoverReviewUrlsWithOpenAi/);
  assert.match(evidence, /last-resort-review-url-discovery/);
  assert.match(evidence, /collectWrittenReviewsFromUrls/);
  assert.match(evidence, /callOpenAiResponseWithoutWebSearch/);
  assert.doesNotMatch(evidence, /REVIEWINTEL_DEEP_SEARCH_PASSES/);
  assert.doesNotMatch(evidence, /review-evidence-deep-pass/);
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
  assert.match(helper, /DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS = 1/);
  assert.match(helper, /skippedDuplicates/);
  assert.match(helper, /skippedDisabled/);
  assert.match(helper, /skippedEvidenceSatisfied/);
  assert.match(helper, /skippedLimitReached/);
  assert.match(helper, /context\.diagnostics\.calls \+= 1/);

  assert.equal((evidence.match(/await callOpenAiWebSearchResponse/g) || []).length, 1);
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
