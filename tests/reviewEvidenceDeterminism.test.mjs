import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
const { buildAmazonReviewPageUrls, shouldContinueReviewRetrieval } = jiti("./lib/reviewRetrievalPolicy.ts");

function corpus(extra = "") {
  const records = Array.from({ length: 13 }, (_, index) => ({
    source: `https://amazon.ca/product-reviews/ALPHA15000/?reviewId=${index}`,
    body: `TEST PRODUCT ALPHA 150 review ${index}: it works reliably, is durable and easy to use. ${extra}`,
  }));
  return adjudicateReviewEvidence(records, {
    productName: "TEST PRODUCT ALPHA 150",
    brand: "TEST BRAND",
    model: "ALPHA-150",
    exactListingAccepted: true,
    exactListingUrl: "https://amazon.ca/dp/ALPHA15000",
    exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
  });
}

function score(adjudication) {
  return deriveDeterministicEvidenceResult({
    acceptedRecords: adjudication.acceptedRecords,
    exactProductAccepted: true,
    rating: 4.1,
    marketplaceReviewCount: 2366,
    price: 129.99,
    verifiedProductMetadata: { asin: "ALPHA15000" },
  });
}

test("same accepted evidence snapshot is deterministic", () => {
  const first = score(corpus());
  const second = score(corpus());
  assert.deepEqual(first, second);
  assert.equal(first.acceptedReviewHashes.length, 13);
  assert.equal(first.finalResultHash, second.finalResultHash);
});

test("different accepted corpus can legitimately change result", () => {
  const first = score(corpus());
  const second = score(corpus("the battery failed and was returned for a refund"));
  assert.notEqual(first.acceptedCorpusHash, second.acceptedCorpusHash);
  assert.notEqual(first.finalResultHash, second.finalResultHash);
});

test("unsupported complaint is omitted and supported complaint has provenance", () => {
  const result = score(corpus());
  assert.equal(result.complaints.length, 0);
  const supported = score(corpus("the battery failed and was returned for a refund"));
  assert.ok(supported.complaints.length > 0);
  assert.ok(supported.complaints.every((claim) => claim.provenance === "ACCEPTED_WRITTEN_REVIEW" && claim.sourceHashes.length > 0));
});


test("review semantics distinguish easy cleaning from easy use and preserve one-off durability complaints", () => {
  const records = [
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-1",
      body: "TEST PRODUCT ALPHA 150 is very easy to clean and looks great on the counter.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-2",
      body: "TEST PRODUCT ALPHA 150 cleanup is easy and the design looks beautiful.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-3",
      body: "TEST PRODUCT ALPHA 150 is simple to clean after cooking and the results are great.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-4",
      body: "TEST PRODUCT ALPHA 150 is easy to clean and cooked the food perfectly.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-5",
      body: "TEST PRODUCT ALPHA 150 cooked chicken perfectly and is good value for the money.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-6",
      body: "TEST PRODUCT ALPHA 150 has useful features and the cooking results are excellent.",
    },
    {
      source: "https://amazon.ca/product-reviews/ALPHA15000/?reviewId=semantic-7",
      body: "TEST PRODUCT ALPHA 150 worked well, but the plastic body cracked after normal use.",
    },
  ];

  const adjudication = adjudicateReviewEvidence(records, {
    productName: "TEST PRODUCT ALPHA 150",
    brand: "TEST BRAND",
    model: "ALPHA-150",
    exactListingAccepted: true,
    exactListingUrl: "https://amazon.ca/dp/ALPHA15000",
    exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
  });

  const result = deriveDeterministicEvidenceResult({
    acceptedRecords: adjudication.acceptedRecords,
    exactProductAccepted: true,
    rating: 4.3,
    marketplaceReviewCount: 500,
    price: 129.99,
    verifiedProductMetadata: { asin: "ALPHA15000" },
  });

  const easyClean = result.strengths.find(
    (claim) => claim.claim === "easy to clean or maintain",
  );

  const easyUse = result.strengths.find(
    (claim) => claim.claim === "easy to use or set up",
  );

  const cracking = result.complaints.find(
    (claim) => claim.claim === "cracking or material durability problems",
  );

  assert.ok(easyClean);
  assert.equal(easyClean.supportCount, 4);

  // "Easy to clean" must never be relabeled as "easy to use".
  assert.equal(easyUse, undefined);

  // A legitimate one-off accepted-review defect must remain visible.
  assert.ok(cracking);
  assert.equal(cracking.supportCount, 1);
  assert.equal(cracking.provenance, "ACCEPTED_WRITTEN_REVIEW");
  assert.ok(cracking.sourceHashes.length > 0);

  // The same evidence must reproduce exactly.
  const repeated = deriveDeterministicEvidenceResult({
    acceptedRecords: adjudication.acceptedRecords,
    exactProductAccepted: true,
    rating: 4.3,
    marketplaceReviewCount: 500,
    price: 129.99,
    verifiedProductMetadata: { asin: "ALPHA15000" },
  });

  assert.deepEqual(result, repeated);
  assert.equal(result.finalResultHash, repeated.finalResultHash);
});

test("insufficient evidence cannot fabricate a score", () => {
  const adjudication = adjudicateReviewEvidence([{ source: "https://amazon.ca/review/1", body: "TEST PRODUCT ALPHA 150 works well." }], {
    productName: "TEST PRODUCT ALPHA 150", brand: "TEST BRAND", model: "ALPHA-150", exactListingAccepted: true,
    exactListingUrl: "https://amazon.ca/dp/ALPHA15000", exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
  });
  const result = score(adjudication);
  assert.equal(result.buyScore, null);
  assert.equal(result.customerVerdict, "DO NOT BUY YET");
});

test("retrieval continues after minimum evidence and is bounded by cap", () => {
  assert.equal(shouldContinueReviewRetrieval({ uniqueReviews: 13, candidatePagesRemain: true }), true);
  assert.equal(shouldContinueReviewRetrieval({ uniqueReviews: 240, candidatePagesRemain: true }), false);
  assert.equal(shouldContinueReviewRetrieval({ uniqueReviews: 13, candidatePagesRemain: true, accessRestricted: true }), false);
  assert.equal(buildAmazonReviewPageUrls("https://amazon.ca/dp/ALPHA15000", "ALPHA15000").length, 24);
});

test('missing marketplace rating cannot turn a null score into AVOID', () => {
  const result = deriveDeterministicEvidenceResult({
    acceptedRecords: corpus().acceptedRecords,
    exactProductAccepted: true,
    rating: null,
    marketplaceReviewCount: 92,
  });
  assert.equal(result.buyScore, null);
  assert.equal(result.customerVerdict, 'DO NOT BUY YET');
});
