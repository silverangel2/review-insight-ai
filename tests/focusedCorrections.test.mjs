import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../focused-corrections-test.js", import.meta.url).pathname, {
  alias: { "@": new URL("../", import.meta.url).pathname },
});

// ─── P0: Negation contractions (D1) ─────────────────────────────────────────

function adjudicatedRecord(text, i) {
  return {
    id: `test-${i}`,
    body: text,
    source: `test-${i}`,
    sourceUrl: "https://example.test/r",
    reviewId: `r${i}`,
    retrievedAt: new Date().toISOString(),
    marketplaceProductId: null,
    sourceType: "marketplace",
    sourceReputation: "unknown",
    stableEvidenceHash: `hash-${i}-${text.length}`,
    independentSourceId: `src-${i}`,
    exactProductAccepted: true,
    accepted: true,
    rejectionReason: null,
    duplicateOf: null,
    original: { body: text },
  };
}

function deterministicResult(texts) {
  const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
  return deriveDeterministicEvidenceResult({
    acceptedRecords: texts.map((text, i) => adjudicatedRecord(text, i)),
    exactProductAccepted: true,
    rating: 4.0,
    marketplaceReviewCount: 100,
  });
}

test("negation contractions do not create false strengths", () => {
  const result = deterministicResult([
    "I don't love this product",
    "It didn't work for me",
    "I haven't seen any improvement",
    "It shouldn't be this difficult",
    "I wouldn't recommend it",
    "I couldn't get it to work",
  ]);
  // All reviews are negative; there must be no false strengths.
  const strengths = result.strengths || [];
  assert.equal(strengths.length, 0, `False strengths from negations: ${JSON.stringify(strengths)}`);
});

test("negation contractions do not suppress real complaints", () => {
  const result = deterministicResult([
    "It didn't last, broke after a week",
    "I don't think it's durable, the handle hasn't held up",
    "It didn't work, completely broke",
    "Hasn't lasted, broke twice",
  ]);
  // The negated complaints must be recognized: the verdict must not be
  // positive (BUY), and the score must not reflect false positivity.
  assert.notEqual(result.customerVerdict, "BUY", "Negated complaints were suppressed into a BUY");
  assert.ok(result.buyScore === null || result.buyScore < 6,
    `False positivity from negations: verdict=${result.customerVerdict}, score=${result.buyScore}`);
});

// ─── P0: 'broke' past-tense failure (D2) ─────────────────────────────────────

test("'broke' is recognized as a reliability failure", () => {
  const result = deterministicResult([
    "It broke after two weeks of normal use",
    "The zipper broke on the first trip",
    "Terrible, broke immediately",
    "Broke on day one",
    "It broke again",
    "Completely broke",
  ]);
  assert.equal(result.customerVerdict, "AVOID", "'broke' reviews should drive AVOID");
  assert.ok(result.buyScore !== null && result.buyScore < 5, "'broke' should lower the score");
});

// ─── P0: Governor canonical gating ──────────────────────────────────────────

test("governor cannot BUY from aggregate rating/count without verified evidence", () => {
  const { governBuyerDecision } = jiti("./lib/decisionGovernor.ts");
  const decision = governBuyerDecision({
    rating: 4.8,
    reviewCount: 5000,
    aiLikeRisk: 10,
    commentsAnalyzed: 0,
    severeComplaints: false,
    currentVerdict: "BUY",
    bottomLine: "Great product",
    productText: "Amazing widget, everyone loves it",
    exactListingAccepted: false,
    canonicalSufficiencyPassed: false,
  });
  assert.ok(decision, "Governor must return a decision, not null");
  assert.equal(decision.verdict, "REVIEW EVIDENCE NOT ENOUGH");
  assert.equal(decision.buyerConfidence, null);
  assert.equal(decision.buyScore, null);
});

test("governor cannot AVOID from unverified danger signals", () => {
  const { governBuyerDecision } = jiti("./lib/decisionGovernor.ts");
  const decision = governBuyerDecision({
    rating: null,
    reviewCount: null,
    aiLikeRisk: null,
    commentsAnalyzed: 0,
    severeComplaints: true,
    currentVerdict: "AVOID",
    bottomLine: "Dangerous product, do not buy",
    productText: "This product is dangerous and unsafe",
    exactListingAccepted: false,
    canonicalSufficiencyPassed: false,
  });
  assert.ok(decision);
  assert.equal(decision.verdict, "REVIEW EVIDENCE NOT ENOUGH");
});

// ─── P1: Identity precision ─────────────────────────────────────────────────

test("bare XL is not a primary model", () => {
  const { extractProductIdentityTokenRoles } = jiti("./lib/productIdentityTokens.ts");
  const roles = extractProductIdentityTokenRoles({
    brand: "Philips",
    productName: "Philips Airfryer NA555/00 Connected XL",
  });
  assert.ok(!roles.primaryModels.includes("XL"), `XL in primaryModels: ${roles.primaryModels}`);
  assert.ok(roles.primaryModels.includes("NA555/00"), "NA555/00 should remain a model");
});

test("explicit model field is truncated at marketing boundary", () => {
  const { extractProductIdentityTokenRoles } = jiti("./lib/productIdentityTokens.ts");
  const roles = extractProductIdentityTokenRoles({
    brand: "RingConn",
    productName: "RingConn Gen 2 Air",
    model: "Gen 2 Air AI",
  });
  const models = roles.primaryModels.join(" ");
  assert.doesNotMatch(models, /\bAI\b/, `AI leaked into models: ${models}`);
  assert.match(models, /GEN 2 AIR/, "Gen 2 Air should be preserved");
});

test("legitimate Pro suffix is preserved in explicit model", () => {
  const { extractProductIdentityTokenRoles } = jiti("./lib/productIdentityTokens.ts");
  const roles = extractProductIdentityTokenRoles({
    brand: "Roborock",
    productName: "Roborock Qrevo S Pro",
    model: "Qrevo S Pro",
  });
  assert.ok(roles.primaryModels.includes("QREVO S PRO"), `Pro was truncated: ${roles.primaryModels}`);
});

test("unitless Size N is extracted as a variant, not family", () => {
  const { extractProductIdentityTokenRoles } = jiti("./lib/productIdentityTokens.ts");
  const roles = extractProductIdentityTokenRoles({
    brand: "RingConn",
    productName: "RingConn Gen 2 Air Smart Ring Size 10",
  });
  assert.ok(roles.primaryVariants.some((v) => /size 10/i.test(v)), `Size 10 not in variants: ${roles.primaryVariants}`);
  assert.ok(!roles.primaryProductFamily.includes("size"), "size should not be in family");
});

// ─── P2: Discovery ──────────────────────────────────────────────────────────

test("JSON-LD prefers the longest matching product name", () => {
  const { extractProductEvidenceFromHtml } = jiti("./lib/productUrlRetrieval.ts");
  const html = `
    <html><head><title>RingConn Gen 2 Air Smart Ring</title>
    <script type="application/ld+json">
    {"@type": "Product", "name": "RingConn Gen 2", "brand": "RingConn"}
    </script>
    <script type="application/ld+json">
    {"@type": "Product", "name": "RingConn Gen 2 Air", "brand": "RingConn", "model": "Gen 2 Air"}
    </script>
    </head><body></body></html>`;
  const evidence = extractProductEvidenceFromHtml(html, "https://ringconn.com/products/gen-2-air");
  // The more specific "Gen 2 Air" record should win over "Gen 2".
  const title = (evidence.title || "").toLowerCase();
  const model = (evidence.model || "").toLowerCase();
  assert.ok(model.includes("gen 2 air") || title.includes("gen 2 air"),
    `Longest match not selected: title=${evidence.title}, model=${evidence.model}`);
});

test("tracking params do not reject legitimate product URLs", () => {
  const { normalizeProductUrl, isProductUrl } = jiti("./lib/productUrlRetrieval.ts");
  const normalized = normalizeProductUrl("https://www.bestbuy.ca/en-ca/product/12345?q=tracking123");
  assert.ok(!/[?&](q|k|keyword|search)=/.test(normalized), `Tracking param not stripped: ${normalized}`);
  assert.ok(isProductUrl(normalized), "Product URL with stripped tracking param should pass");
});

test("manufacturer deep product paths pass the candidate gate", () => {
  const { isProductUrl } = jiti("./lib/productUrlRetrieval.ts");
  assert.ok(isProductUrl("https://www.samsung.com/us/smartphones/galaxy-s24-ultra/"),
    "Samsung smartphone product path rejected");
  assert.ok(isProductUrl("https://www.sony.com/electronics/headphones/wh-1000xm5"),
    "Sony electronics product path rejected");
  // Bare category pages must still be rejected.
  assert.ok(!isProductUrl("https://www.samsung.com/us/smartphones/"),
    "Samsung category listing should not pass as product");
});

test("retry queries do not quote the family bag as a phrase", () => {
  const { buildProductRetryQueries } = jiti("./lib/productSearchVerifier.ts");
  const queries = buildProductRetryQueries({
    scanId: "test-scan",
    store: "Amazon.ca",
    brand: "RingConn",
    productName: "RingConn Gen 2 Air Smart Ring Size 10",
    productKey: "RingConn Gen 2 Air Smart Ring",
  });
  const joined = queries.join("\n");
  // The family words should appear as separate terms, not a single quoted phrase.
  assert.doesNotMatch(joined, /"ring life size galaxy"|"smart ring size"/i,
    `Family bag quoted as phrase: ${joined}`);
});

// ─── P3: Hygiene ────────────────────────────────────────────────────────────

test("wrong-product rejections are not labeled access_restricted", () => {
  const source = require("node:fs").readFileSync(
    new URL("../lib/nativeReviewRetrieval.ts", import.meta.url), "utf8");
  // The stop reason must use the genuinely-restricted counter, not the
  // all-failures counter.
  assert.match(source, /restrictedProductPages >= attemptedPages/);
  assert.match(source, /restrictedProductPages \+= 1/);
});

test("explicit scanId is never overridden by allowAnyScan", () => {
  const source = require("node:fs").readFileSync(
    new URL("../lib/resultStorage.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /if \(!requestedScanId \|\| options\.allowAnyScan\)/);
  assert.match(source, /if \(!requestedScanId\) return true;/);
});

test("analyzer navigates with scanId in URL", () => {
  const source = require("node:fs").readFileSync(
    new URL("../components/AnalyzerForm.tsx", import.meta.url), "utf8");
  assert.match(source, /const resultUrl = `\/results\?scanId=\$\{encodeURIComponent\(data\.scanId\)\}`/);
  assert.match(source, /router\.push\(resultUrl\)/);
});
