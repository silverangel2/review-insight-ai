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
