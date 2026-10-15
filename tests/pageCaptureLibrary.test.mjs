// Page-capture + product review library wiring (Phase 1).
// No OpenAI anywhere in the lane; storage-unconfigured tests must leave
// scoring output unchanged (fail-soft), exactly as the scan path behaves.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const pageCapture = jiti(root + "lib/pageCapture.ts");
const buyingScore = jiti(root + "lib/buyingScore.ts");

const captureFor = (overrides = {}) => ({
  url: "https://www.amazon.ca/dp/B0DGJDKHRQ",
  productId: "B0DGJDKHRQ",
  store: "amazon",
  title: "Apple AirPods 4",
  rating: 4.4,
  ratingCount: 2341,
  reviews: [
    {
      title: "Great sound",
      text: "The sound quality is clear and they connect to my iPhone very quickly every time.",
      stars: 5,
      date: "October 1, 2026",
      verified: true,
    },
  ],
  duplicatesRemoved: 0,
  ...overrides,
});

test("library key uses the capture URL hostname (matches the scan path key space)", () => {
  assert.equal(
    pageCapture.pageCaptureLibraryKey(captureFor()),
    "amazon.ca:B0DGJDKHRQ"
  );
  assert.equal(
    pageCapture.pageCaptureLibraryKey(
      captureFor({ url: "https://www.walmart.ca/en/ip/trail-bottle/600020176", productId: "600020176", store: "walmart" })
    ),
    "walmart.ca:600020176"
  );
  assert.equal(
    pageCapture.pageCaptureLibraryKey(
      captureFor({ url: "https://www.bestbuy.ca/en-ca/product/trail-bottle/6505432", productId: "6505432", store: "bestbuy" })
    ),
    "bestbuy.ca:6505432"
  );
});

test("library key is null without a product identity (no consolidation on fuzzy identity)", () => {
  // A URL with a parseable listing id still keys (matches the scan path's
  // URL fallback); only a fully unparseable identity refuses the library.
  assert.equal(
    pageCapture.pageCaptureLibraryKey(captureFor({ url: "https://www.amazon.ca/", productId: "" })),
    null
  );
  assert.equal(
    pageCapture.pageCaptureLibraryKey(captureFor({ url: "not a url", productId: "" })),
    null
  );
});

test("stored records map back to scorable reviews; unreadable ones are dropped", () => {
  const capture = captureFor();
  const good = pageCapture.libraryRecordToWrittenReview({
    body: "Stored review body with plenty of real words in it.",
    title: "Stored",
    rating: 4,
    date: "October 2, 2026",
    source: "amazon",
    sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    verified: false,
    provenance: "amazon-link-scan",
  });
  assert.equal(good.body, "Stored review body with plenty of real words in it.");
  assert.equal(good.provenance, "amazon-link-scan");
  assert.equal(good.sourceUrl, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(pageCapture.libraryRecordToWrittenReview({ body: "   " }), null);
  assert.equal(pageCapture.libraryRecordToWrittenReview(null), null);
});

test("merge dedupes a review present in both the stored and captured sets", () => {
  const capture = captureFor();
  const fresh = pageCapture.captureReviewToWritten(capture.reviews[0], capture);
  const storedDuplicate = {
    ...fresh,
    verified: false,
    provenance: "amazon-link-scan",
    sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
  };
  const storedNew = {
    body: "Battery life easily lasts me through two full days of heavy listening.",
    title: "Battery",
    rating: 5,
    date: "October 3, 2026",
    source: "amazon",
    sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    verified: true,
    provenance: "amazon-link-scan",
  };
  const merged = pageCapture.mergeCaptureReviewSets([fresh], [storedDuplicate, storedNew], 500);
  // Same body text with a different verified flag is not an exact JSON match...
  assert.equal(merged.length, 3);
  // ...but the cross-store fuzzy dedupe used by the scan path catches it.
  const deduped = buyingScore.dedupeAcrossStores(merged);
  assert.equal(deduped.length, 2);
  const bodies = deduped.map((r) => r.body);
  assert.ok(bodies.includes(fresh.body));
  assert.ok(bodies.includes(storedNew.body));
});

test("merge respects the corpus cap and fresh-first order", () => {
  const make = (i) => ({ body: `Distinct review body number ${i} with enough words to be readable.` });
  const merged = pageCapture.mergeCaptureReviewSets([make(1), make(2)], [make(2), make(3)], 3);
  assert.deepEqual(merged.map((r) => r.body), [
    "Distinct review body number 1 with enough words to be readable.",
    "Distinct review body number 2 with enough words to be readable.",
    "Distinct review body number 3 with enough words to be readable.",
  ]);
});

test("storage-unconfigured scoring is identical to the pre-library path (fail-soft)", async () => {
  // No Supabase env here: loadLibraryCorpus must read empty, saveLibraryCorpus
  // must report false, and the scored result must match scorePageCapture.
  const capture = captureFor();
  const baseline = pageCapture.scorePageCapture(capture, "scan_baseline");
  const consolidated = await pageCapture.scorePageCaptureWithLibrary(capture, "scan_consolidated");
  assert.equal(consolidated.pageCapture, true);
  assert.equal(consolidated.openAiCalls, 0);
  assert.equal(consolidated.score, baseline.score);
  assert.equal(consolidated.verdict, baseline.verdict);
  assert.equal(consolidated.buyingScoreV2.audit.n, baseline.buyingScoreV2.audit.n);
});

test("stored records carry the capture provenance", async () => {
  const capture = captureFor();
  const result = await pageCapture.scorePageCaptureWithLibrary(capture, "scan_provenance");
  const records = result.reviewEvidence.evidenceAdjudication.acceptedRecords;
  assert.ok(records.length >= 1);
  for (const record of records) {
    assert.equal(record.provenance, pageCapture.CAPTURE_LIBRARY_PROVENANCE);
  }
});
