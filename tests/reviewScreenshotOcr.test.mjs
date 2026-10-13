// Fixture PNG renders review bodies copied verbatim from a captured corpus (see source.json).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const m = jiti("./lib/reviewScreenshotOcr.ts");
const dir = root + "tests/fixtures/reviewintel-screenshot/";
const src = JSON.parse(readFileSync(dir + "source.json"));
const words = t => t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 3);

test("local OCR reads captured review text, keeps provenance, and adjudicates through the shared pipeline", { timeout: 120000 }, async () => {
  const ocr = await m.ocrReviewScreenshot(readFileSync(dir + "captured-reviews.png"));
  assert.match(ocr.fileSha256, /^[a-f0-9]{64}$/);
  assert.ok(ocr.ocrConfidence >= m.MIN_BLOCK_CONFIDENCE);
  const out = m.adjudicateScreenshotReviews(ocr, { productName: src.options.productName, brand: src.options.brand, exactListingUrl: src.options.exactListingUrl });
  assert.equal(out.titleVerified, true);
  assert.equal(out.candidates.length, src.reviews.length, "title/page chrome must not become a review");
  assert.equal(out.corpus.acceptedRecordCount, src.reviews.length);
  for (const [i, c] of out.candidates.entries()) {
    assert.equal(c.source, "user_screenshot");
    assert.equal(c.provenance.fileSha256, ocr.fileSha256);
    assert.ok(c.provenance.blockConfidence >= m.MIN_BLOCK_CONFIDENCE);
    // Every OCR word set must overlap the real captured body (no invented text).
    const real = new Set(words(src.reviews[i].body));
    const read = words(c.body);
    assert.ok(read.filter(w => real.has(w)).length / read.length >= 0.85, `block ${i} diverges from captured text`);
  }
});

test("unverified screenshot product is not accepted as exact-product evidence", { timeout: 120000 }, async () => {
  const ocr = await m.ocrReviewScreenshot(readFileSync(dir + "captured-reviews.png"));
  const out = m.adjudicateScreenshotReviews(ocr, { productName: "UnrelatedMaker Q9 Espresso Grinder", brand: "UnrelatedMaker" });
  assert.equal(out.titleVerified, false);
  assert.equal(out.corpus.acceptedRecordCount, 0);
});

test("noise and low-confidence OCR produce no candidate reviews", { timeout: 120000 }, async () => {
  const ocr = await m.ocrReviewScreenshot(readFileSync(dir + "noise.png"));
  assert.equal(m.screenshotTextToReviewCandidates(ocr).candidates.length, 0);
  const synthetic = { fileSha256: "0".repeat(64), ocrConfidence: 40, engine: "test", lines: [{ text: "5.0 out of 5 stars", confidence: 90 }, { text: "this blurred line could be anything at all really", confidence: 41 }] };
  const r = m.screenshotTextToReviewCandidates(synthetic);
  assert.equal(r.candidates.length, 0); assert.equal(r.droppedLowConfidence, 1);
});
