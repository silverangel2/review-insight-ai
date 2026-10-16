import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const {
  sortReviewBatch,
  matchThemeTags,
  isSeriousNegative,
  sorterBodyKey,
  directionForReview,
  adaptOwnerFeedReview,
  adaptCommunityRow,
  adaptCollectedRecord,
  SORTER_MIN_BODY,
} = jiti(root + "lib/reviewSorter.ts");

const rec = (over) => ({
  id: "r",
  body: "placeholder",
  title: null,
  stars: 5,
  provenance: "test_feed",
  ...over,
});

test("mixed batch: sorts, tags, rejects with named reasons", () => {
  const result = sortReviewBatch({
    feed: "collected",
    productKey: "amazon.ca:B0DGJDKHRQ",
    records: [
      rec({
        id: "r1",
        stars: 5,
        title: "Great battery life",
        body: "The battery life is excellent. Lasts for days on a single charge and the case charges fast.",
        provenance: "owner_fed",
      }),
      rec({
        id: "r2",
        stars: 5,
        body: "The battery life is excellent. Lasts for days on a single charge and the case charges fast.",
        reviewerName: "Someone Else",
      }), // duplicate body, different reviewer
      rec({
        id: "r3",
        stars: 1,
        title: "Stopped working",
        body: "Stopped working after two days. Completely dead, will not turn on. Terrible.",
      }),
      rec({ id: "r4", stars: 5, body: "ok" }),
      rec({ id: "r5", stars: 4, body: "n/a" }),
      rec({ id: "r6", stars: 1, body: "Caught fire" }), // 11 chars: short BUT serious
      rec({ id: "r7", stars: 5, body: "I love it" }), // 9 chars, real words, not serious
      rec({ id: "r8", stars: 3, body: "Great sound but the battery life is poor" }),
      rec({ id: "r9", stars: null, body: "This review has no stars attached to it at all." }),
      rec({
        id: "r10",
        stars: 5,
        body: "Not great. Not good at all. Nothing to love here.",
        productUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ?color=pink",
      }),
    ],
  });

  assert.equal(result.productKey, "amazon.ca:B0DGJDKHRQ");

  const byId = new Map(result.sorted.map((s) => [s.id, s]));
  // r1: kept, stars preserved, provenance preserved, tagged, for.
  const r1 = byId.get("r1");
  assert.ok(r1, "r1 should be sorted");
  assert.equal(r1.stars, 5);
  assert.equal(r1.provenance, "owner_fed");
  assert.ok(r1.themeTags.includes("battery life"), `tags: ${r1.themeTags.join(",")}`);
  assert.equal(r1.direction, "for");
  assert.ok(r1.sentimentScore > 0);
  assert.equal(r1.serious, false);
  assert.deepEqual(r1.sortFlags, []);

  // r3: serious negative passes with markers.
  const r3 = byId.get("r3");
  assert.ok(r3, "r3 should be sorted");
  assert.equal(r3.direction, "against");
  assert.equal(r3.serious, true);
  assert.ok(r3.seriousKinds.includes("stopped working"), `kinds: ${r3.seriousKinds.join(",")}`);

  // r6: short serious negative is NEVER dropped — flagged through.
  const r6 = byId.get("r6");
  assert.ok(r6, "r6 (short serious) must pass through, not be rejected");
  assert.equal(r6.serious, true);
  assert.ok(r6.seriousKinds.includes("fire"), `kinds: ${r6.seriousKinds.join(",")}`);
  assert.deepEqual(r6.sortFlags, ["serious_short"]);

  // r8: 3 stars with balanced lexicon -> mixed.
  const r8 = byId.get("r8");
  assert.ok(r8, "r8 should be sorted");
  assert.equal(r8.direction, "mixed");
  assert.ok(r8.themeTags.includes("battery life"));

  // r10: negated praise words do not count; variant attributed.
  const r10 = byId.get("r10");
  assert.ok(r10, "r10 should be sorted");
  const dir10 = directionForReview(5, "Not great. Not good at all. Nothing to love here.");
  assert.equal(dir10.positive, 0, "negated praise must not count as positive");
  assert.ok(r10.variant && r10.variant.color === "pink", JSON.stringify(r10.variant));
  assert.equal(r10.productKey, "amazon.ca:B0DGJDKHRQ");

  // Rejections, each named.
  const rejById = new Map(result.rejected.map((r) => [r.id, r]));
  assert.equal(rejById.get("r2").reason, "duplicate");
  assert.equal(rejById.get("r4").reason, "junk");
  assert.equal(rejById.get("r5").reason, "junk");
  assert.equal(rejById.get("r7").reason, "too_short");
  assert.ok(rejById.get("r7").detail.includes(String(SORTER_MIN_BODY)));
  assert.equal(rejById.get("r9").reason, "missing_stars");
  assert.equal(result.sorted.length, 5);
  assert.equal(result.rejected.length, 5);
});

test("missing body is a named rejection", () => {
  const result = sortReviewBatch({ feed: "owner_feed", records: [rec({ id: "x", body: "   " })] });
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "missing_body");
});

test("existingBodyKeys dedupe against the stored corpus", () => {
  const seen = new Set([sorterBodyKey("Already stored review body here.")]);
  const result = sortReviewBatch({
    feed: "community",
    productKey: "amazon.ca:X",
    existingBodyKeys: seen,
    records: [rec({ id: "a", body: "Already stored review body here." }), rec({ id: "b", body: "A brand new review body here." })],
  });
  assert.equal(result.sorted.length, 1);
  assert.equal(result.sorted[0].id, "b");
  assert.equal(result.rejected[0].reason, "duplicate");
});

test("productKey falls back to productUrl parsing; null when unknowable", () => {
  const fromUrl = sortReviewBatch({
    feed: "collected",
    productUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    records: [rec({ id: "a", body: "A perfectly fine review body for testing purposes." })],
  });
  assert.equal(fromUrl.productKey, "amazon.ca:B0DGJDKHRQ");
  assert.equal(fromUrl.sorted[0].productKey, "amazon.ca:B0DGJDKHRQ");

  const unknown = sortReviewBatch({
    feed: "collected",
    records: [rec({ id: "a", body: "A perfectly fine review body for testing purposes." })],
  });
  assert.equal(unknown.productKey, null); // never invented
});

test("matchThemeTags uses the single dimension map; never emits __generic_concern", () => {
  assert.ok(matchThemeTags("This might be counterfeit, not genuine at all").includes("suspected counterfeit"));
  assert.ok(matchThemeTags("The heater started smoking and I saw flames").includes("fire"));
  assert.deepEqual(matchThemeTags("I bought this yesterday and it arrived"), []);
  assert.ok(!matchThemeTags("utterly unmatchable zzz qqq text").includes("__generic_concern"));
});

test("isSeriousNegative marks red dimensions only", () => {
  const s1 = isSeriousNegative("I believe this unit is fake, a knockoff");
  assert.equal(s1.serious, true);
  assert.ok(s1.kinds.includes("suspected counterfeit"));
  const s2 = isSeriousNegative("The battery life is excellent and the sound is great");
  assert.equal(s2.serious, false);
});

test("adapters normalize each feed shape without losing fields", () => {
  const a = adaptOwnerFeedReview(
    { index: 51, body: "A decent owner fed body for testing.", title: "T", rating: 5, reviewer: "Ann", reviewDate: "2026-09-01" },
    { productId: "B0DGJDKHRQ", productUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" }
  );
  assert.equal(a.id, "owner-fed-b0dgjdkhrq-51");
  assert.equal(a.stars, 5);
  assert.equal(a.provenance, "owner_fed");

  const c = adaptCommunityRow({ id: "abc", stars: 2, body: "Community body with enough words here.", created_at: "2026-10-01", product_url: null });
  assert.equal(c.id, "community-abc");
  assert.equal(c.stars, 2);
  assert.equal(c.provenance, "reviewintel_community");

  const s = adaptCollectedRecord({
    reviewId: "scan-9",
    body: "Scan collected body with enough words here.",
    title: "TT",
    rating: 4,
    reviewerName: "Zed",
    date: "2026-08-01",
    sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    provenance: "scan",
  });
  assert.equal(s.id, "scan-9");
  assert.equal(s.stars, 4);
  assert.equal(s.provenance, "scan");
  assert.equal(s.productUrl, "https://www.amazon.ca/dp/B0DGJDKHRQ");
});

test("sortReviewBatch throws only on programmer-shaped input", () => {
  assert.throws(() => sortReviewBatch({ feed: "collected", records: null }), /records must be an array/);
});
