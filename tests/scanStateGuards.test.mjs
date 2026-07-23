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
  assert.match(results, /scanIdFromAnalyzeResponse\(parsed\) !== activeScanId/);
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

  assert.match(evidence, /const collectorSourceAccepted = Boolean\(exactListingAccepted && listingUrlForReviewCollector\)/);
  assert.match(evidence, /if \(collectorSourceAccepted && collectedWrittenReviews\.reviewsCollected < 3\)/);
  assert.match(evidence, /if \(!collectorSourceAccepted\) \{/);
  assert.match(evidence, /return insufficientEvidence;/);
  assert.match(evidence, /hasVariantMismatch \|\|\s*\(hasRatingMismatch && hasReviewCountMismatch\)/);
});

test("exact product search uses candidate collection instead of one guessed URL", () => {
  const exactSearch = source("lib/exactProductSearch.ts");

  assert.match(exactSearch, /export async function findExactProductCandidates/);
  assert.match(exactSearch, /"candidates": \[/);
  assert.match(exactSearch, /candidateCountInstruction/);
  assert.match(exactSearch, /Return up to \$\{maxCandidates\} candidates/);
  assert.match(exactSearch, /searchQueries/);
  assert.match(exactSearch, /appendProductQuery/);
  assert.match(exactSearch, /Primary search query to run first/);
  assert.doesNotMatch(exactSearch, /if \(!url \|\| !isProductCandidateUrl\(url\)\) return null/);
  assert.match(exactSearch, /Candidate appears to be a non-product or search\/category URL/);
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
