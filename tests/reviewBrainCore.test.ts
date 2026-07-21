import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductIdentity,
  dedupeEvidenceRecords,
  evidenceThreshold,
  isSafeRetrievalUrl,
  isUsefulWrittenReview,
  reviewTextMatchesProductIdentity,
  sourceReputationForUrl,
  sourceTypeForUrl,
  stableEvidenceHash,
  verifyProductMatch,
  verifyVerdictClaims,
  type ReviewEvidenceRecord,
} from "../lib/reviewBrainCore.ts";

function record(overrides: Partial<ReviewEvidenceRecord> = {}): ReviewEvidenceRecord {
  const sourceUrl = overrides.sourceUrl || "https://example.com/reviews/product-a";
  const reviewText =
    overrides.reviewText ||
    "I bought this product last month and used it daily. The quality feels durable, the fit is good, and the price feels fair.";

  return {
    id: overrides.id || stableEvidenceHash(`${sourceUrl}:${reviewText}`),
    sourceId: overrides.sourceId || new URL(sourceUrl).hostname,
    sourceName: overrides.sourceName || new URL(sourceUrl).hostname,
    sourceUrl,
    sourceType: overrides.sourceType || sourceTypeForUrl(sourceUrl),
    sourceReputation: overrides.sourceReputation || sourceReputationForUrl(sourceUrl),
    reviewText,
    rating: overrides.rating ?? 5,
    reviewDate: overrides.reviewDate ?? "2026-06-01",
    author: overrides.author ?? "reviewer",
    verifiedPurchase: overrides.verifiedPurchase ?? true,
    pageProductName: overrides.pageProductName || "Acme Blender Pro 500",
    productMatchScore: overrides.productMatchScore ?? 0.86,
    productMatchReason: overrides.productMatchReason || "same product match accepted",
    contentHash: overrides.contentHash || stableEvidenceHash(reviewText),
  };
}

test("no URLs found stays insufficient", () => {
  const threshold = evidenceThreshold([], { minIndependentSources: 3, minUsableReviews: 6 });
  assert.equal(threshold.status, "insufficient_evidence");
  assert.equal(threshold.confidence, null);
  assert.equal(threshold.acceptedIndependentSourceCount, 0);
});

test("blocked and local URLs are rejected before retrieval", () => {
  assert.equal(isSafeRetrievalUrl("http://127.0.0.1:3000/reviews"), false);
  assert.equal(isSafeRetrievalUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isSafeRetrievalUrl("file:///tmp/reviews.html"), false);
  assert.equal(isSafeRetrievalUrl("https://www.bestbuy.com/site/reviews/product"), true);
});

test("pages fetched but without written reviews do not count", () => {
  assert.equal(isUsefulWrittenReview("Customer reviews 4.7 stars Add to cart Sponsored"), false);
  assert.equal(isUsefulWrittenReview("2 people found this helpful Review 5: | Translate review to English"), false);
  assert.equal(
    isUsefulWrittenReview(
      "Brief content visible, double tap to read full content. Image Unavailable. The video showcases the product in use."
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "Related articles Frequently Asked Questions Check lowest prices Order the Renewed Version with reliable delivery option."
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "[Apple AirPods Pro 2 Review](https://example.com/review) [Bluetooth](https://example.com/bluetooth) [Value](https://example.com/value) [Sound](https://example.com/sound)"
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "[Apple AirPods Pro 2 video review](https://youtube.com/watch?v=abc) Visibility: Public Uploaded by: Example Channel 1,204 views Chapters descriptions"
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "User Rating No Rating1.0 Bad1.5 Meh2.0 Acceptable2.5 Average3.0 Good Related: Best ANC earbuds and headphone deals."
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "Skip to main content Home Active Noise Cancelling Apple AirPods Pro 2 Review Compare similar earbuds Our rating 5.0 4.0 Rate this model."
    ),
    false
  );
  assert.equal(
    isUsefulWrittenReview(
      "Description AirPods Pro 2 USB-C Amazon link. Uploaded by Example Channel. 20,000 views. Chapters descriptions and affiliate links."
    ),
    false
  );
});

test("retrieved professional review paragraphs can count as written evidence", () => {
  assert.equal(
    isUsefulWrittenReview(
      "After testing the earbuds for two weeks, the noise cancellation stayed strong, the charging case was reliable, and the sound performance was better than expected."
    ),
    true
  );
});

test("wrong model pages are rejected", () => {
  const identity = buildProductIdentity({
    productName: "Acme Blender Pro 500",
    brand: "Acme",
    model: "Pro 500",
  });
  const match = verifyProductMatch(identity, {
    pageProductName: "Acme Blender Pro 300",
    pageText: "Reviews for the Acme Blender Pro 300 compact model.",
    sourceUrl: "https://reviews.example.com/acme-pro-300",
  });

  assert.equal(match.accepted, false);
  assert.match(match.reason, /model mismatch|overlap/i);
});

test("accessories are rejected when the target is the main product", () => {
  const identity = buildProductIdentity({
    productName: "Acme Blender Pro 500",
    brand: "Acme",
    model: "Pro 500",
  });
  const match = verifyProductMatch(identity, {
    pageProductName: "Acme Blender Pro 500 replacement lid seal accessory",
    pageText: "Customer reviews for replacement parts and accessories.",
    sourceUrl: "https://retailer.example.com/acme-pro-500-lid",
  });

  assert.equal(match.accepted, false);
  assert.match(match.reason, /accessory|overlap/i);
});

test("ordinary used and tested wording does not mean refurbished mismatch", () => {
  const identity = buildProductIdentity({
    productName: "Apple AirPods Pro 2 USB-C",
    brand: "Apple",
    model: "AirPods Pro 2",
  });
  const match = verifyProductMatch(identity, {
    pageProductName: "Apple AirPods Pro 2 USB-C review",
    pageText:
      "We used and tested the Apple AirPods Pro 2 for daily commuting. The noise cancellation, sound quality, battery, and charging case were reviewed in detail.",
    sourceUrl: "https://reviews.example.com/apple-airpods-pro-2-usb-c-review",
  });

  assert.equal(match.accepted, true);
});

test("refurbished wording in review body does not reject a same-product editorial review", () => {
  const identity = buildProductIdentity({
    productName: "Apple AirPods Pro 2 USB-C",
    brand: "Apple",
    model: "AirPods Pro 2",
  });
  const match = verifyProductMatch(identity, {
    pageProductName: "Apple AirPods Pro 2 USB-C review",
    pageText:
      "This review tested the Apple AirPods Pro 2 USB-C with noise cancellation, charging case, controls, and sound quality. A sidebar mentions refurbished availability, but the article reviews the new model.",
    sourceUrl: "https://reviews.example.com/apple-airpods-pro-2-usb-c-review",
  });

  assert.equal(match.accepted, true);
});

test("same-product review URL can pass when retrieved page title is sparse", () => {
  const identity = buildProductIdentity({
    productName: "Apple AirPods Pro 2 USB-C",
    brand: "Apple",
    model: "AirPods Pro 2",
  });
  const match = verifyProductMatch(identity, {
    pageProductName: "What Hi-Fi?",
    pageText:
      "In our testing, the noise cancellation, case, transparency mode, and sound quality made these earbuds a clear upgrade for commuters.",
    sourceUrl: "https://www.whathifi.com/reviews/apple-airpods-pro-2",
  });

  assert.equal(match.accepted, true);
  assert.match(match.reason, /review URL|same product/i);
});

test("duplicate written reviews are deduplicated", () => {
  const duplicateText =
    "I purchased this product and used it every day. The quality is durable, the fit is excellent, and the price feels fair.";
  const records = dedupeEvidenceRecords([
    record({ sourceUrl: "https://store-a.example/reviews", reviewText: duplicateText }),
    record({ sourceUrl: "https://store-a.example/reviews", reviewText: duplicateText }),
    record({ sourceUrl: "https://store-b.example/reviews", reviewText: duplicateText }),
  ]);

  assert.equal(records.length, 1);
});

test("search snippets and metadata do not pass as review evidence", () => {
  const records = dedupeEvidenceRecords([
    record({
      reviewText: "Acme Blender Pro 500 has 4.8 stars from 120 reviews. Product description, price, and shipping options.",
    }),
  ]);

  assert.equal(records.length, 0);
});

test("generic service text does not match product-specific review evidence", () => {
  const relevance = reviewTextMatchesProductIdentity(
    "Customer service was helpful with setup instructions, shipping was fast, and the packaging arrived clean.",
    {
      productName: "PLANTIFIQUE PDRN Exosome Reedle",
      brand: "PLANTIFIQUE",
      sourceUrl: "https://example-shop.test/products/plantifique-pdrn-exosome-reedle",
      sourceType: "retailer",
    }
  );

  assert.equal(relevance.accepted, false);
  assert.match(relevance.reason, /service-only|not specific|generic|not useful/i);
});

test("product-scoped skincare experience can match without repeating full product name", () => {
  const relevance = reviewTextMatchesProductIdentity(
    "I used it for two weeks and my skin felt smoother with a visible glow. The serum texture absorbs quickly and did not feel sticky.",
    {
      productName: "PLANTIFIQUE PDRN Exosome Reedle",
      brand: "PLANTIFIQUE",
      sourceUrl: "https://www.amazon.com/PLANTIFIQUE-Korean-Reedle-Collagen-Niacinamide/dp/B0GS21CRZ8",
      sourceType: "marketplace",
    }
  );

  assert.equal(relevance.accepted, true);
});

test("fewer than minimum accepted sources remains insufficient", () => {
  const records = [
    record({ sourceUrl: "https://amazon.example/reviews/1" }),
    record({ sourceUrl: "https://amazon.example/reviews/2", reviewText: "I bought this and used it often. The material feels good, but the instructions are confusing." }),
    record({ sourceUrl: "https://amazon.example/reviews/3", reviewText: "My family used this product for weeks. The quality is solid and the setup worked well." }),
  ];
  const threshold = evidenceThreshold(records, { minIndependentSources: 3, minUsableReviews: 3 });

  assert.equal(threshold.status, "insufficient_evidence");
  assert.equal(threshold.confidence, null);
});

test("valid written reviews from multiple sources pass the threshold", () => {
  const records = [
    record({ sourceUrl: "https://amazon.example/reviews/a" }),
    record({ sourceUrl: "https://walmart.example/reviews/b", reviewText: "I received this product and used it for smoothies. The quality is durable and the value is good." }),
    record({ sourceUrl: "https://bestbuy.example/reviews/c", reviewText: "We purchased it for daily use. It works well, the setup is simple, and the material feels strong." }),
    record({ sourceUrl: "https://target.example/reviews/d", reviewText: "My unit fit our counter and worked as expected. The price was fair and delivery was fine." }),
    record({ sourceUrl: "https://reviews.example/reviews/e", reviewText: "I tried this product for two weeks. The quality is good, although the instructions could be clearer." }),
    record({ sourceUrl: "https://retailer.example/reviews/f", reviewText: "We bought it for home use. It works reliably, feels durable, and the seller packaging arrived clean." }),
  ];
  const threshold = evidenceThreshold(records, { minIndependentSources: 3, minUsableReviews: 6 });

  assert.equal(threshold.status, "sufficient_evidence");
});

test("high-volume written evidence from two independent sources can pass safely", () => {
  const records = Array.from({ length: 24 }, (_, index) =>
    record({
      sourceUrl: index % 2 === 0 ? "https://review-a.example/product" : "https://review-b.example/product",
      reviewText: `I tested this product for daily use number ${index}. The sound quality, charging case, comfort, and value were described with enough detail to count as written review evidence.`,
    })
  );
  const threshold = evidenceThreshold(records, { minIndependentSources: 3, minUsableReviews: 6 });

  assert.equal(threshold.status, "sufficient_evidence");
  assert.equal(threshold.acceptedIndependentSourceCount, 2);
});

test("missing confidence remains null when evidence is insufficient", () => {
  const threshold = evidenceThreshold([], { minIndependentSources: 3, minUsableReviews: 6 });
  assert.equal(threshold.confidence, null);
});

test("unsupported verdict claims fail verification", () => {
  const result = verifyVerdictClaims(
    [
      { id: "claim-supported", claim: "Customers like durability.", sourceIds: ["source-a"] },
      { id: "claim-unsupported", claim: "Customers love battery life.", sourceIds: ["missing-source"] },
    ],
    ["source-a"],
    true
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.unsupportedClaims, ["claim-unsupported"]);
});
