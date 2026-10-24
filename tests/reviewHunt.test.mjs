// Review hunt wiring tests (owner design, 2026-10-20).
// Runs the REAL lib/reviewHunt.ts with an INJECTED retrieval function —
// zero network. The fake retrieval returns the record groups the native
// engine would return for the Sony WH-1000XM5 zero-accept shape: the
// primary Amazon listing's own pages, a fingerprint-matching Walmart
// listing, a sibling-model Best Buy listing, a model-less Target listing,
// and an untitled group. Both sides are asserted: what pools (with
// provenance) and what is excluded (with reasons).
import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const hunt = await import("../lib/reviewHunt.ts");
const fp = await import("../lib/productFingerprint.ts");

const { runReviewHunt, shouldRunReviewHunt, isReviewHuntEnabled } = hunt;
const { extractProductFingerprint } = fp;

const SONY = {
  brand: "Sony",
  productName: "Sony WH-1000XM5 Premium Noise Cancelling Wireless Headphones, Black",
  model: "WH-1000XM5",
};
const SONY_LISTING_URL = "https://www.amazon.com/dp/B09XS7JWHH";
const sonyFingerprint = extractProductFingerprint(SONY);

function record(overrides) {
  return {
    body: "I bought these a month ago and the noise cancelling is superb for flights.",
    source: "Public review page",
    rating: 5,
    ...overrides,
  };
}

function fakeRetrieval(groups) {
  return async () => ({
    attempted: true,
    queries: ["Sony WH-1000XM5 reviews"],
    sourcesChecked: ["native-search:bing:Sony WH-1000XM5 reviews", ...groups.map((g) => g[0])],
    sourceLinks: [],
    reviews: groups.flatMap(([, records]) => records),
    reviewsCollected: groups.reduce((n, [, records]) => n + records.length, 0),
    coverageNote: "fake",
    diagnostics: {},
  });
}

const amazonOwnGroup = [
  "https://www.amazon.com/dp/B09XS7JWHH",
  [
    record({ sourceUrl: "https://www.amazon.com/dp/B09XS7JWHH", reviewedProductName: SONY.productName, reviewedBrand: "Sony" }),
    record({ sourceUrl: "https://www.amazon.com/dp/B09XS7JWHH", reviewedProductName: SONY.productName, reviewedBrand: "Sony" }),
  ],
];
const walmartGroup = [
  "https://www.walmart.com/ip/987654321",
  [
    record({ sourceUrl: "https://www.walmart.com/ip/987654321", reviewedProductName: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", reviewedBrand: "Sony" }),
    record({ sourceUrl: "https://www.walmart.com/ip/987654321", reviewedProductName: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", reviewedBrand: "Sony", body: "Battery easily lasts my whole work week and the multipoint pairing works." }),
  ],
];
const bestBuySiblingGroup = [
  "https://www.bestbuy.com/site/1234567.p",
  [
    record({ sourceUrl: "https://www.bestbuy.com/site/1234567.p", reviewedProductName: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones", reviewedBrand: "Sony" }),
  ],
];
const targetNoModelGroup = [
  "https://www.target.com/p/-/A-12345678",
  [
    record({ sourceUrl: "https://www.target.com/p/-/A-12345678", reviewedProductName: "Sony Wireless Noise Cancelling Headphones", reviewedBrand: "Sony" }),
  ],
];
const untitledGroup = [
  "https://www.homedepot.com/p/123456789",
  [record({ sourceUrl: "https://www.homedepot.com/p/123456789" })],
];

test("kill switch: off only when the flag is exactly '0'; unset stays on", () => {
  assert.equal(isReviewHuntEnabled({}), true);
  assert.equal(isReviewHuntEnabled({ REVIEWINTEL_REVIEW_HUNT_ENABLED: "" }), true);
  assert.equal(isReviewHuntEnabled({ REVIEWINTEL_REVIEW_HUNT_ENABLED: "0" }), false);
  assert.equal(isReviewHuntEnabled({ REVIEWINTEL_REVIEW_HUNT_ENABLED: "true" }), false);
  assert.equal(isReviewHuntEnabled({ REVIEWINTEL_REVIEW_HUNT_ENABLED: "1" }), true);
});

test("trigger: fires on zero or thin written reviews when identity is anchored", () => {
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: false, acceptedRecordCount: 0, fingerprint: sonyFingerprint }),
    { fire: false, reason: "flag_off" }
  );
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 3, fingerprint: sonyFingerprint }),
    { fire: false, reason: "enough_written_reviews" }
  );
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 2, fingerprint: sonyFingerprint }),
    { fire: true, reason: "thin_written_reviews" }
  );
  const unanchored = extractProductFingerprint({ brand: "Sony", productName: "Sony headphones" });
  assert.equal(unanchored.fingerprintKey, null);
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 0, fingerprint: unanchored }),
    { fire: false, reason: "identity_not_anchored" }
  );
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 0, fingerprint: sonyFingerprint }),
    { fire: true, reason: "zero_accepted_reviews" }
  );
});

test("hunt pools only the fingerprint-matched store, with provenance; siblings/ambiguous excluded with reasons", async () => {
  const { diagnostics, reviews } = await runReviewHunt({
    brand: SONY.brand,
    model: SONY.model,
    productName: SONY.productName,
    listingUrl: SONY_LISTING_URL,
    fingerprint: sonyFingerprint,
    retrieval: fakeRetrieval([amazonOwnGroup, walmartGroup, bestBuySiblingGroup, targetNoModelGroup, untitledGroup]),
  });

  assert.equal(diagnostics.fired, true);
  assert.equal(diagnostics.reason, "ok");
  assert.equal(diagnostics.fingerprintKey, sonyFingerprint.fingerprintKey);
  // The primary listing's own group is not a candidate; the other four are.
  assert.equal(diagnostics.candidatesChecked, 4);
  assert.equal(diagnostics.matchedListings.length, 1);
  assert.equal(diagnostics.matchedListings[0].host, "walmart.com");
  assert.equal(diagnostics.matchedListings[0].reviews, 2);
  assert.equal(diagnostics.pooledCount, 2);
  assert.equal(reviews.length, 2);
  assert.ok(reviews.every((r) => r.sourceUrl === "https://www.walmart.com/ip/987654321"));
  assert.ok(reviews.every((r) => r.sourceMarketplace === "walmart.com"), "pooled reviews carry source provenance");

  const excludedByHost = new Map(diagnostics.excluded.map((e) => [e.host, e]));
  assert.equal(excludedByHost.get("bestbuy.com")?.verdict, "no_match");
  assert.equal(excludedByHost.get("target.com")?.verdict, "ambiguous");
  assert.equal(excludedByHost.get("homedepot.com")?.verdict, "ambiguous");
  assert.equal(excludedByHost.get("homedepot.com")?.reason, "candidate_listing_title_unavailable");
});

test("hunt failure leaves the scan unchanged: retrieval error resolves empty, never throws", async () => {
  const { diagnostics, reviews } = await runReviewHunt({
    brand: SONY.brand,
    model: SONY.model,
    productName: SONY.productName,
    listingUrl: SONY_LISTING_URL,
    fingerprint: sonyFingerprint,
    retrieval: async () => {
      throw new Error("search provider unavailable");
    },
  });
  assert.equal(reviews.length, 0);
  assert.equal(diagnostics.pooledCount, 0);
  assert.match(diagnostics.reason, /^error: /);
});

test("hunt is time-boxed: a retrieval that never answers resolves as timeout", async () => {
  const { diagnostics, reviews } = await runReviewHunt({
    brand: SONY.brand,
    model: SONY.model,
    productName: SONY.productName,
    listingUrl: SONY_LISTING_URL,
    fingerprint: sonyFingerprint,
    timeoutMs: 100,
    retrieval: () => new Promise(() => {}),
  });
  assert.equal(reviews.length, 0);
  assert.equal(diagnostics.reason, "timeout");
});

test("hunt with no matching store anywhere pools nothing and says so", async () => {
  const { diagnostics, reviews } = await runReviewHunt({
    brand: SONY.brand,
    model: SONY.model,
    productName: SONY.productName,
    listingUrl: SONY_LISTING_URL,
    fingerprint: sonyFingerprint,
    retrieval: fakeRetrieval([bestBuySiblingGroup]),
  });
  assert.equal(reviews.length, 0);
  assert.equal(diagnostics.reason, "no_match_anywhere");
  assert.equal(diagnostics.excluded.length, 1);
});

test("existing provenance is never overwritten by pooling stamps", async () => {
  const stampedGroup = [
    "https://www.walmart.com/ip/987654321",
    [
      record({
        sourceUrl: "https://www.walmart.com/ip/987654321",
        reviewedProductName: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
        reviewedBrand: "Sony",
        sourceMarketplace: "walmart.ca",
      }),
    ],
  ];
  const { reviews } = await runReviewHunt({
    brand: SONY.brand,
    model: SONY.model,
    productName: SONY.productName,
    listingUrl: SONY_LISTING_URL,
    fingerprint: sonyFingerprint,
    retrieval: fakeRetrieval([stampedGroup]),
  });
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].sourceMarketplace, "walmart.ca");
});
