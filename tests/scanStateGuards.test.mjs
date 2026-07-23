import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(exactSearch, /Return 3 to \$\{maxCandidates\} candidates when possible/);
  assert.match(exactSearch, /searchQueries/);
  assert.match(exactSearch, /AbortController/);
});

test("review evidence runs a bounded verifier retry loop before collection", () => {
  const evidence = source("lib/reviewEvidence.ts");

  assert.match(evidence, /async function runExactProductAgent/);
  assert.match(evidence, /const maxCandidates = 5/);
  assert.match(evidence, /const maxRetryRounds = 2/);
  assert.match(evidence, /REVIEWINTEL_EXACT_SEARCH_TIMEOUT_MS \|\| 18000/);
  assert.match(evidence, /const perAttemptTimeoutMs = 5500/);
  assert.match(evidence, /const candidatesThisRound =/);
  assert.match(evidence, /Math\.min\(3, remainingCandidateSlots\)/);
  assert.match(evidence, /findExactProductCandidates/);
  assert.match(evidence, /\[ReviewIntel DEBUG exactProductAgent\]/);
  assert.match(evidence, /productVerifierResult\.canCollectReviews/);
  assert.match(evidence, /verifiedListingUrlForCollection/);
  assert.doesNotMatch(evidence, /!retrySearchQueries\.length \|\| exactSearchTimedOut\) break/);
  assert.match(evidence, /const listingRejectedForCollection = !listingUrlForReviewCollector/);
});

test("exact product verifier treats other stores as strict fallback sources", () => {
  const verifier = source("lib/productSearchVerifier.ts");

  assert.match(verifier, /preferredStoreMismatch/);
  assert.match(verifier, /const requiredTermCoverage = preferredStoreMismatch \? 0\.82 : 0\.55/);
  assert.match(verifier, /strict exact-product fallback checks/);
  assert.match(verifier, /function cleanRetryQuery/);
  assert.match(verifier, /Amazon\\s\+s/);
});

test("better picks does not auto-run during initial scan result load", () => {
  const panel = source("components/BetterPicksPanel.tsx");

  assert.match(panel, /autoLoad = false/);
  assert.match(panel, /window\.setTimeout/);
  assert.match(panel, /1800/);
});
