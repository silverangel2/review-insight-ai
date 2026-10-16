// Phase 4: first-party community reviews + tier rule.
// No OpenAI anywhere in the lane. Junel's locked rules tested here:
// one review per account per product key, signed-in account required,
// Tier A (approved + purchase-verified) feeds the library, Tier B does not.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

// Guarantee "storage unconfigured" behavior in this file's process.
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "RESEND_API_KEY",
]) {
  delete process.env[key];
}

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const community = jiti(root + "lib/communityReviews.ts");

const goodInput = (overrides = {}) => ({
  accountEmail: "shopper@example.com",
  productKey: "amazon.ca:B0DGJDKHRQ",
  productName: "Apple AirPods 4",
  stars: 5,
  body: "Bought these for my teenager and they absolutely love them. Great sound and comfort.",
  store: "Amazon.ca",
  boughtIt: true,
  ...overrides,
});

test("normalizeProductKey: space form and colon form both canonicalize", () => {
  assert.equal(community.normalizeProductKey("amazon.ca b0dgjdkhrq"), "amazon.ca:B0DGJDKHRQ");
  assert.equal(community.normalizeProductKey("amazon.ca:B0DGJDKHRQ"), "amazon.ca:B0DGJDKHRQ");
  assert.equal(community.normalizeProductKey("www.walmart.ca 12345678"), "walmart.ca:12345678");
});

test("normalizeProductKey: junk returns null", () => {
  assert.equal(community.normalizeProductKey(""), null);
  assert.equal(community.normalizeProductKey("just-a-word"), null);
  assert.equal(community.normalizeProductKey(null), null);
  assert.equal(community.normalizeProductKey("amazon.ca x"), null);
});

test("submit validation: stars out of range is a VALIDATION error", async () => {
  for (const stars of [0, 6, -1]) {
    await assert.rejects(
      () => community.submitCommunityReview(goodInput({ stars })),
      (error) => error instanceof community.CommunityReviewError && error.code === "VALIDATION"
    );
  }
});

test("submit validation: short body is a VALIDATION error", async () => {
  await assert.rejects(
    () => community.submitCommunityReview(goodInput({ body: "Too short" })),
    (error) => error instanceof community.CommunityReviewError && error.code === "VALIDATION"
  );
});

test("submit validation: missing account or product key is a VALIDATION error", async () => {
  await assert.rejects(
    () => community.submitCommunityReview(goodInput({ accountEmail: "not-an-email" })),
    (error) => error instanceof community.CommunityReviewError && error.code === "VALIDATION"
  );
  await assert.rejects(
    () => community.submitCommunityReview(goodInput({ productKey: "junk" })),
    (error) => error instanceof community.CommunityReviewError && error.code === "VALIDATION"
  );
});

test("submit with storage unconfigured: STORAGE error, never a silent drop", async () => {
  await assert.rejects(
    () => community.submitCommunityReview(goodInput()),
    (error) => error instanceof community.CommunityReviewError && error.code === "STORAGE"
  );
});

test("one review per account per product key: re-submit replaces, back to pending", async () => {
  const rows = new Map();
  const fakeDeps = {
    select: async () => [],
    update: async () => null,
    upsert: async (_table, payload) => {
      const row = { ...payload[0], id: "row-1", status: "pending", created_at: "2026-10-15T00:00:00Z" };
      rows.set(`${row.account_email}|${row.product_key}`, row);
      return row;
    },
  };
  const first = await community.submitCommunityReview(goodInput({ stars: 5 }), fakeDeps);
  assert.equal(first.status, "pending");
  const second = await community.submitCommunityReview(
    goodInput({ stars: 2, body: "Changed my mind after two weeks of use, the case hinge feels cheap now." }),
    fakeDeps
  );
  assert.equal(second.stars, 2);
  assert.equal(second.status, "pending");
  assert.equal(rows.size, 1, "same (email,key) must upsert into one row");
});

test("verified_purchase requires bought_it: proof alone cannot verify", async () => {
  const seen = [];
  const fakeDeps = {
    select: async () => [],
    update: async () => null,
    upsert: async (_table, payload) => {
      seen.push(payload[0]);
      return { ...payload[0], id: "row-9", status: "pending" };
    },
  };
  await community.submitCommunityReview(
    goodInput({ boughtIt: false, verifiedPurchase: true, proofSha256: "abc" }),
    fakeDeps
  );
  assert.equal(seen[0].verified_purchase, false);
  assert.equal(seen[0].proof_sha256, null);
});

test("Tier A gate: only approved + purchase-verified reviews feed the library", async () => {
  const reviewRows = [
    { id: "a", stars: 5, body: "Loved it", store: "Amazon.ca", verified_purchase: true, created_at: "2026-10-15T00:00:00Z" },
    { id: "b", stars: 4, body: "Pretty good", store: null, verified_purchase: false, created_at: "2026-10-15T00:00:00Z" },
  ];
  let savedCorpus = null;
  const fakeDeps = {
    select: async (table, query) => {
      assert.ok(String(query).includes("status=eq.approved"));
      assert.ok(String(query).includes("verified_purchase=eq.true"));
      return reviewRows.filter((r) => r.verified_purchase);
    },
    update: async () => null,
    upsert: async () => null,
    loadCorpus: async () => ({ productKey: "amazon.ca:B0DGJDKHRQ", reviews: [], scanCount: 3 }),
    saveCorpus: async (input) => {
      savedCorpus = input;
      return true;
    },
  };
  const result = await community.feedTierAReviewsToLibrary("amazon.ca:B0DGJDKHRQ", fakeDeps);
  assert.equal(result.fed, true);
  assert.equal(result.fedCount, 1);
  assert.ok(savedCorpus);
  assert.equal(savedCorpus.productKey, "amazon.ca:B0DGJDKHRQ");
  assert.equal(savedCorpus.corpus.length, 1);
  const record = savedCorpus.corpus[0];
  assert.equal(record.reviewId, "community-a");
  assert.equal(record.provenance.source, "reviewintel_community");
  assert.equal(record.rating, 5);
});

test("Tier A: nothing eligible feeds nothing (no unverified leak)", async () => {
  const fakeDeps = {
    select: async () => [],
    update: async () => null,
    upsert: async () => null,
    loadCorpus: async () => ({ productKey: "amazon.ca:B0DGJDKHRQ", reviews: [], scanCount: 0 }),
    saveCorpus: async () => {
      throw new Error("must not be called");
    },
  };
  const result = await community.feedTierAReviewsToLibrary("amazon.ca:B0DGJDKHRQ", fakeDeps);
  assert.deepEqual(result, { fed: false, fedCount: 0 });
});

test("Tier A: already-fed reviews are not duplicated", async () => {
  const existing = {
    source: "reviewintel_community",
    reviewId: "community-a",
    rating: 5,
    body: "Loved it",
    provenance: { source: "reviewintel_community" },
  };
  let savedCorpus = null;
  const fakeDeps = {
    select: async () => [
      { id: "a", stars: 5, body: "Loved it", store: null, verified_purchase: true, created_at: "2026-10-15T00:00:00Z" },
    ],
    update: async () => null,
    upsert: async () => null,
    loadCorpus: async () => ({ productKey: "amazon.ca:B0DGJDKHRQ", reviews: [existing], scanCount: 3 }),
    saveCorpus: async (input) => {
      savedCorpus = input;
      return true;
    },
  };
  const result = await community.feedTierAReviewsToLibrary("amazon.ca:B0DGJDKHRQ", fakeDeps);
  assert.deepEqual(result, { fed: false, fedCount: 0 });
  assert.equal(savedCorpus, null);
});

test("Tier A: storage failure is fail-soft, never throws", async () => {
  const fakeDeps = {
    select: async () => {
      throw new Error("db down");
    },
    update: async () => null,
    upsert: async () => null,
    loadCorpus: async () => {
      throw new Error("db down");
    },
    saveCorpus: async () => false,
  };
  const result = await community.feedTierAReviewsToLibrary("amazon.ca:B0DGJDKHRQ", fakeDeps);
  assert.deepEqual(result, { fed: false, fedCount: 0 });
});

test("listApprovedReviews with storage unconfigured returns []", async () => {
  const reviews = await community.listApprovedReviews("amazon.ca:B0DGJDKHRQ");
  assert.deepEqual(reviews, []);
});

test("shopper-facing copy contains no forbidden strings", () => {
  const forbidden = [
    "Vercel",
    "evidenceState",
    "NOT_ENOUGH",
    "Not scored",
    "Review evidence not enough",
    "OpenAI review analysis failed",
  ];
  const files = [
    "components/CommunityReviewForm.tsx",
    "components/CommunityReviewsSection.tsx",
    "app/results/page.tsx",
    "app/api/community-reviews/route.ts",
    "app/api/cron/review-ask-email/route.ts",
  ];
  for (const file of files) {
    const content = readFileSync(`${root}${file}`, "utf8");
    for (const phrase of forbidden) {
      // The cron route only mentions "Vercel" inside the platform's own
      // required cron header name ("x-vercel-cron-schedule"), which is never
      // shopper-visible. Junel's rule targets shopper-facing text.
      if (file.endsWith("review-ask-email/route.ts") && phrase === "Vercel") continue;
      assert.ok(!content.includes(phrase), `${file} contains forbidden phrase: ${phrase}`);
    }
  }
});

test("Tier A sorter seam: annotations stamped, gate never overruled, body dupes dropped", async () => {
  const storedBody = "The battery life is excellent and lasts for days on a single charge.";
  const reviewRows = [
    { id: "a", stars: 5, body: "The sound quality is great and the battery life is excellent overall.", store: "Amazon.ca", verified_purchase: true, created_at: "2026-10-15T00:00:00Z" },
    { id: "b", stars: 1, body: storedBody, store: null, verified_purchase: true, created_at: "2026-10-15T00:00:00Z" }, // body-duplicate of stored
  ];
  let savedCorpus = null;
  const fakeDeps = {
    select: async () => reviewRows,
    update: async () => null,
    upsert: async () => null,
    loadCorpus: async () => ({
      productKey: "amazon.ca:B0DGJDKHRQ",
      reviews: [{ reviewId: "scan-1", body: storedBody, provenance: "scan" }],
      scanCount: 3,
    }),
    saveCorpus: async (input) => {
      savedCorpus = input;
      return true;
    },
  };
  const result = await community.feedTierAReviewsToLibrary("amazon.ca:B0DGJDKHRQ", fakeDeps);
  assert.equal(result.fed, true);
  assert.equal(result.fedCount, 1); // the duplicate is dropped by the sorter
  const record = savedCorpus.corpus.find((r) => r.reviewId === "community-a");
  assert.ok(record, "annotated record must be in the merged corpus");
  assert.ok(Array.isArray(record.themeTags) && record.themeTags.includes("battery life"), `tags: ${JSON.stringify(record.themeTags)}`);
  assert.equal(record.sortDirection, "for");
  assert.equal(record.sortSerious, false);
  assert.ok(!savedCorpus.corpus.some((r) => r.reviewId === "community-b"), "body-duplicate must not feed");
  assert.equal(savedCorpus.previousScanCount, 3);
});
