import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { adjudicateReviewEvidence, claimSourceIds, verifyEvidenceClaims } = jiti("./lib/reviewEvidenceAdjudication.ts");

const options = {
  productName: "TEST PRODUCT ALPHA 150",
  brand: "TEST BRAND",
  model: "ALPHA-150",
  exactListingAccepted: true,
  exactListingUrl: "https://marketplace.example/products/alpha-150",
  exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
};

function review(id, sourceUrl, body = `TEST BRAND TEST PRODUCT ALPHA 150 review ${id}: it works well and feels durable.`) {
  return { body, source: sourceUrl, sourceUrl };
}

test("same written review copied to two URLs is accepted once", () => {
  const result = adjudicateReviewEvidence([
    review("one", "https://reviews-one.example/alpha"),
    review("copy", "https://reviews-two.example/alpha", "TEST BRAND TEST PRODUCT ALPHA 150 review one: it works well and feels durable."),
  ], options);

  assert.equal(result.acceptedRecordCount, 1);
  assert.equal(result.deduplicatedRecordCount, 1);
  assert.equal(result.rejectedRecords[0].rejectionReason, "duplicate of previously accepted evidence");
  assert.equal(result.independentSourceCount, 1);
});

test("one source with many reviews does not masquerade as many independent sources", () => {
  const result = adjudicateReviewEvidence(
    Array.from({ length: 50 }, (_, index) => review(String(index), "https://marketplace.example/alpha", `TEST BRAND TEST PRODUCT ALPHA 150 review ${index}: battery lasts and performance is stable.`)),
    options
  );

  assert.equal(result.acceptedRecordCount, 50);
  assert.equal(result.independentSourceCount, 1);
  assert.deepEqual(result.independentSourceIds, ["marketplace.example"]);
});

test("wrong-product and ambiguous records are rejected", () => {
  const result = adjudicateReviewEvidence([
    review("wrong", "https://reviews.example/beta", "TEST BRAND TEST PRODUCT BETA review: the battery failed."),
    { body: "It is good and easy to use.", source: "anonymous discussion" },
  ], options);

  assert.equal(result.acceptedRecordCount, 0);
  assert.match(result.rejectedRecords[0].rejectionReason, /product|identity/i);
  assert.match(result.rejectedRecords[1].rejectionReason, /product|identity|source/i);
});

test("exact listing rejection never becomes an authorization to score", () => {
  const result = adjudicateReviewEvidence(
    Array.from({ length: 50 }, (_, index) => review(String(index), `https://marketplace.example/alpha/${index}`)),
    { ...options, exactListingAccepted: false }
  );

  assert.equal(result.acceptedRecordCount, 50);
  assert.equal(result.exactProductAccepted, false);
  assert.equal(result.sufficientByExistingThreshold, false);
});

test("exact listing accepted but fewer than the existing three-review threshold stays insufficient", () => {
  const result = adjudicateReviewEvidence([
    review("one", "https://marketplace.example/alpha/1"),
    review("two", "https://marketplace.example/alpha/2", "TEST BRAND TEST PRODUCT ALPHA 150 review two: setup is easy."),
  ], options);

  assert.equal(result.acceptedRecordCount, 2);
  assert.equal(result.sufficientByExistingThreshold, false);
});

test("trusted exact-product records provide traceable claim sources", () => {
  const records = [
    review("one", "https://marketplace.example/alpha/1", "TEST BRAND TEST PRODUCT ALPHA 150 review: durable and reliable for daily use."),
    review("two", "https://retailer.example/alpha/2", "TEST BRAND TEST PRODUCT ALPHA 150 review: reliable performance and easy setup."),
    review("three", "https://forum.example/alpha/3", "TEST BRAND TEST PRODUCT ALPHA 150 review: setup is easy and performance is stable."),
  ];
  const result = adjudicateReviewEvidence(records, options);
  const ids = claimSourceIds("reliable performance", result.acceptedRecords);
  const claims = verifyEvidenceClaims([{ claim: "reliable performance", sourceIds: ids }], result);

  assert.equal(result.acceptedRecordCount, 3);
  assert.equal(result.independentSourceCount, 3);
  assert.equal(result.sufficientByExistingThreshold, true);
  assert.equal(claims.passed, true);
  assert.ok(claims.claims[0].sourceIds.length > 0);
});

test('same marketplace host does not authorize a different ASIN corpus', () => {
  const result = adjudicateReviewEvidence([
    review('wrong-product-id', 'https://www.amazon.ca/product-reviews/B0WRONG001'),
  ], { ...options, exactListingUrl: 'https://www.amazon.ca/dp/B0RIGHT001' });
  assert.equal(result.acceptedRecordCount, 0);
  assert.match(result.rejectedRecords[0].rejectionReason, /different product ID/);
});

test("verified exact listing does not bless a sizing-kit accessory review", () => {
  const result = adjudicateReviewEvidence(
    [
      {
        body: "I used this sizing kit for 24 hours and tried several different sizes before choosing the right one. The kit was helpful and easy to use.",
        source: "Amazon",
        sourceUrl: "https://www.amazon.ca/product-reviews/B0DWJDFLT8",
        marketplaceProductId: "B0DWJDFLT8",
        rating: 5,
      },
    ],
    {
      brand: "RingConn",
      productName: "RingConn Gen 2 Air Smart Ring",
      model: "Gen 2 Air",
      exactListingAccepted: true,
      exactListingUrl: "https://www.amazon.ca/dp/B0DWJDFLT8",
      exactListingTitle: "RingConn Gen 2 Air Smart Ring",
    },
  );

  assert.equal(result.acceptedRecordCount, 0);
  assert.equal(result.rejectedRecordCount, 1);
  assert.match(
    result.rejectedRecords[0]?.rejectionReason || "",
    /sizing-kit accessory/i,
  );
});

test("verified exact listing still accepts a genuine product review", () => {
  const result = adjudicateReviewEvidence(
    [
      {
        body: "My RingConn Gen 2 Air battery lasted about nine days and sleep tracking has been consistent.",
        source: "Amazon",
        sourceUrl: "https://www.amazon.ca/product-reviews/B0DWJDFLT8",
        marketplaceProductId: "B0DWJDFLT8",
        rating: 5,
      },
    ],
    {
      brand: "RingConn",
      productName: "RingConn Gen 2 Air Smart Ring",
      model: "Gen 2 Air",
      exactListingAccepted: true,
      exactListingUrl: "https://www.amazon.ca/dp/B0DWJDFLT8",
      exactListingTitle: "RingConn Gen 2 Air Smart Ring",
    },
  );

  assert.equal(result.acceptedRecordCount, 1);
  assert.equal(result.rejectedRecordCount, 0);
});

test("mentioning a sizing kit does not reject a review that explicitly identifies the requested model", () => {
  const result = adjudicateReviewEvidence(
    [
      {
        body: "I used the sizing kit first, then bought the RingConn Gen 2 Air. The ring itself has been comfortable and the battery lasts over a week.",
        source: "Amazon",
        sourceUrl: "https://www.amazon.ca/product-reviews/B0DWJDFLT8",
        marketplaceProductId: "B0DWJDFLT8",
        rating: 5,
      },
    ],
    {
      brand: "RingConn",
      productName: "RingConn Gen 2 Air Smart Ring",
      model: "Gen 2 Air",
      exactListingAccepted: true,
      exactListingUrl: "https://www.amazon.ca/dp/B0DWJDFLT8",
      exactListingTitle: "RingConn Gen 2 Air Smart Ring",
    },
  );

  assert.equal(result.acceptedRecordCount, 1);
  assert.equal(result.rejectedRecordCount, 0);
});
