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

test('missing marketplace rating does not prevent a written-evidence decision', () => {
  const result = deriveDeterministicEvidenceResult({
    acceptedRecords: corpus().acceptedRecords,
    exactProductAccepted: true,
    rating: null,
    marketplaceReviewCount: 92,
  });
  assert.equal(result.buyScore, 8);
  assert.equal(result.customerVerdict, 'BUY');
});

test("mixed sufficient evidence does not collapse directly into AVOID", () => {
  const asin = "B0DWK4QQ7H";

  const records = [
    {
      body: "My RingConn Gen 2 Air battery lasts a long time and sleep tracking works well.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=1`,
      marketplaceProductId: asin,
      rating: 5,
    },
    {
      body: "The RingConn Gen 2 Air is very comfortable and easy to wear every day.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=2`,
      marketplaceProductId: asin,
      rating: 5,
    },
    {
      body: "My RingConn Gen 2 Air has good battery life and useful health tracking.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=3`,
      marketplaceProductId: asin,
      rating: 4,
    },
    {
      body: "The RingConn Gen 2 Air is comfortable and gives useful sleep insights.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=4`,
      marketplaceProductId: asin,
      rating: 4,
    },
    {
      body: "My RingConn Gen 2 Air works well overall and the battery life has been good.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=5`,
      marketplaceProductId: asin,
      rating: 4,
    },
    {
      body: "My RingConn Gen 2 Air battery stopped working after a few weeks.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=6`,
      marketplaceProductId: asin,
      rating: 1,
    },
    {
      body: "My RingConn Gen 2 Air had connection problems and I needed to reconnect it several times.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=7`,
      marketplaceProductId: asin,
      rating: 2,
    },
  ];

  const adjudication = adjudicateReviewEvidence(records, {
    brand: "RingConn",
    productName: "RingConn Gen 2 Air Smart Ring",
    model: "Gen 2 Air",
    exactListingAccepted: true,
    exactListingUrl: `https://www.amazon.ca/dp/${asin}`,
    exactListingTitle: "RingConn Gen 2 Air Smart Ring",
  });

  assert.equal(adjudication.acceptedRecordCount, 7);
  assert.equal(adjudication.sufficientByExistingThreshold, true);

  const result = deriveDeterministicEvidenceResult({
    acceptedRecords: adjudication.acceptedRecords,
    exactProductAccepted: true,
    rating: 4.1,
    marketplaceReviewCount: 1048,
    price: null,
  });

  assert.equal(
    result.customerVerdict,
    "DO NOT BUY YET",
    "mixed sufficient evidence must not collapse directly into AVOID",
  );
});

test("clearly poor sufficient evidence still reaches AVOID", () => {
  const asin = "B0DWK4QQ7H";

  const records = [
    {
      body: "My RingConn Gen 2 Air broke after two days and completely stopped working.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=11`,
      marketplaceProductId: asin,
      rating: 1,
    },
    {
      body: "The RingConn Gen 2 Air battery failed completely after one week of use.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=12`,
      marketplaceProductId: asin,
      rating: 1,
    },
    {
      body: "My RingConn Gen 2 Air broke and would not charge again.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=13`,
      marketplaceProductId: asin,
      rating: 1,
    },
    {
      body: "The RingConn Gen 2 Air stopped working and support could not fix the problem.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=14`,
      marketplaceProductId: asin,
      rating: 1,
    },
    {
      body: "My RingConn Gen 2 Air failed quickly and I returned it because it would not work.",
      source: "Amazon",
      sourceUrl: `https://www.amazon.ca/product-reviews/${asin}?pageNumber=15`,
      marketplaceProductId: asin,
      rating: 1,
    },
  ];

  const adjudication = adjudicateReviewEvidence(records, {
    brand: "RingConn",
    productName: "RingConn Gen 2 Air Smart Ring",
    model: "Gen 2 Air",
    exactListingAccepted: true,
    exactListingUrl: `https://www.amazon.ca/dp/${asin}`,
    exactListingTitle: "RingConn Gen 2 Air Smart Ring",
  });

  assert.equal(adjudication.acceptedRecordCount, 5);
  assert.equal(adjudication.sufficientByExistingThreshold, true);

  const result = deriveDeterministicEvidenceResult({
    acceptedRecords: adjudication.acceptedRecords,
    exactProductAccepted: true,
    rating: 2.1,
    marketplaceReviewCount: 500,
    price: null,
  });

  assert.equal(result.customerVerdict, "AVOID");
});

test("v10: zero-weight marketplace metadata cannot change evidence-derived identity; corpus changes still do", () => {
  const accepted = corpus().acceptedRecords;
  const base = deriveDeterministicEvidenceResult({ acceptedRecords: accepted, exactProductAccepted: true, rating: 4.1, marketplaceReviewCount: 2366, price: 129.99 });
  assert.equal(base.deterministicScoringInputs.marketplaceWeight, 0);
  for (const [rating, marketplaceReviewCount, price] of [[1, 3, 9999], [5, 100000, 1], [null, 0, null], [2.7, 62, 54.5]]) {
    const changed = deriveDeterministicEvidenceResult({ acceptedRecords: accepted, exactProductAccepted: true, rating, marketplaceReviewCount, price });
    for (const key of ["acceptedCorpusHash", "finalResultHash", "buyScore", "customerVerdict", "valueForMoney"]) assert.equal(changed[key], base[key], key);
    assert.deepEqual(changed.acceptedReviewHashes, base.acceptedReviewHashes);
    assert.deepEqual(changed.strengths, base.strengths);
    assert.deepEqual(changed.complaints, base.complaints);
    // Metadata stays available for display/telemetry.
    assert.equal(changed.marketplaceMetadataSnapshot.rating, rating);
    assert.equal(changed.marketplaceMetadataSnapshot.reviewCount, marketplaceReviewCount);
    assert.equal(changed.marketplaceMetadataSnapshot.price, price);
  }
  // Control: one accepted written review removed changes corpus identity and result hash.
  const smaller = deriveDeterministicEvidenceResult({ acceptedRecords: accepted.slice(1), exactProductAccepted: true, rating: 4.1, marketplaceReviewCount: 2366, price: 129.99 });
  assert.notEqual(smaller.acceptedCorpusHash, base.acceptedCorpusHash);
  assert.notEqual(smaller.finalResultHash, base.finalResultHash);
});
