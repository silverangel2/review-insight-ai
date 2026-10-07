import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, {
  alias: { "@": new URL("../", import.meta.url).pathname },
});
const { adjudicateReviewEvidence, verifyEvidenceClaims } = jiti("./lib/reviewEvidenceAdjudication.ts");
const { governBuyerDecision } = jiti("./lib/decisionGovernor.ts");
const { enforceFinalVerdictConsistency } = jiti("./lib/finalVerdictConsistency.ts");

const product = {
  brand: "ZZQ_TEST_BRAND_84721",
  productName: "ZZQ_TEST_PRODUCT_X9_59317",
  model: "ZZQ_MODEL_44192",
};

const exactOptions = {
  ...product,
  exactListingAccepted: true,
  exactListingUrl: "https://a.test.invalid/products/ZZQ_MODEL_44192",
  exactListingTitle: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
};

function unknownProductMetadata() {
  return governBuyerDecision({
    rating: 4.8,
    reviewCount: 50000,
    commentsAnalyzed: 0,
    exactListingAccepted: false,
    canonicalSufficiencyPassed: false,
    productText: `${product.brand} ${product.productName} ${product.model}`,
  });
}

test("unknown product metadata alone cannot create substantive conclusions", () => {
  const adjudication = adjudicateReviewEvidence([], { ...product, exactListingAccepted: false });
  const decision = unknownProductMetadata();
  const normalized = enforceFinalVerdictConsistency({
    verdict: "REVIEW EVIDENCE NOT ENOUGH",
    buyScore: 6,
    buyerConfidence: 50,
    valueForMoney: "Fair",
    bottomLine: "",
  });

  assert.equal(adjudication.acceptedRecordCount, 0);
  assert.equal(adjudication.sufficientByExistingThreshold, false);
  assert.equal(decision.verdict, "REVIEW EVIDENCE NOT ENOUGH");
  assert.equal(decision.buyScore, null);
  assert.equal(decision.buyerConfidence, null);
  assert.equal(decision.valueForMoney, "Unknown");
  assert.equal(normalized.buyScore, null);
  assert.equal(normalized.buyerConfidence, null);
  assert.equal(normalized.valueForMoney, "Unknown");
});

test("unverified plausible review claims cannot reach the result", () => {
  const adjudication = adjudicateReviewEvidence([
    { body: "Large capacity, easy to use, and durable performance.", sourceUrl: "https://one.test.invalid/review" },
    { body: "Good value with compact design and great performance.", sourceUrl: "https://two.test.invalid/review" },
    { body: "Reliable and quiet for everyday use.", sourceUrl: "https://three.test.invalid/review" },
  ], { ...product, exactListingAccepted: false });
  const claims = verifyEvidenceClaims([
    { claim: "large capacity" },
    { claim: "good value" },
    { claim: "reliable and quiet" },
  ], adjudication);
  const decision = governBuyerDecision({
    rating: 4.8,
    reviewCount: 50000,
    commentsAnalyzed: adjudication.acceptedRecordCount,
    exactListingAccepted: false,
    canonicalSufficiencyPassed: adjudication.sufficientByExistingThreshold,
    productText: `${product.brand} ${product.productName} ${product.model}`,
  });

  assert.equal(adjudication.acceptedRecordCount, 0);
  assert.equal(claims.passed, false);
  assert.ok(claims.claims.every((claim) => claim.verified === false));
  assert.equal(decision.verdict, "REVIEW EVIDENCE NOT ENOUGH");
  assert.equal(decision.buyScore, null);
  assert.equal(decision.buyerConfidence, null);
});

test("only exact verified written reviews unlock the existing scoring path", () => {
  const adjudication = adjudicateReviewEvidence([
    { body: `${product.brand} ${product.productName} ${product.model}: works well and durable for daily use.`, sourceUrl: "https://a.test.invalid/review/1" },
    { body: `${product.brand} ${product.productName} ${product.model}: reliable performance and easy setup.`, sourceUrl: "https://b.test.invalid/review/2" },
    { body: `${product.brand} ${product.productName} ${product.model}: works well and good value.`, sourceUrl: "https://c.test.invalid/review/3" },
  ], exactOptions);
  const claims = verifyEvidenceClaims([
    { claim: "reliable performance" },
    { claim: "easy setup" },
  ], adjudication);
  const decision = governBuyerDecision({
    rating: 4.8,
    reviewCount: 50000,
    commentsAnalyzed: adjudication.acceptedRecordCount,
    exactListingAccepted: adjudication.exactProductAccepted,
    canonicalSufficiencyPassed: adjudication.sufficientByExistingThreshold,
    productText: `${product.brand} ${product.productName} ${product.model} works well and durable https://a.test.invalid/review/1 https://b.test.invalid/review/2 https://c.test.invalid/review/3`,
  });

  assert.equal(adjudication.acceptedRecordCount, 3);
  assert.equal(adjudication.independentSourceCount, 3);
  assert.equal(adjudication.sufficientByExistingThreshold, true);
  assert.equal(claims.passed, true);
  assert.equal(decision.verdict, "BUY");
  assert.ok(typeof decision.buyScore === "number");
  assert.ok(typeof decision.buyerConfidence === "number");
});
