// Screenshot-door enhancement (2026-10-20): dual-pass OCR with an upscaled second
// pass, geometry-ordered line merge, and the facts-layer guards that keep decoy
// lines (installments, delivery copy, recommendation rows) from becoming identity.
// Fixture listing-small.png is a RENDERED listing page (small text on purpose):
// pristine modules crowned the Klarna installment line as the product name on it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const ocrMod = jiti("./lib/reviewScreenshotOcr.ts");
const factsMod = jiti("./lib/screenshotProductFacts.ts");
const dir = root + "tests/fixtures/reviewintel-screenshot/";

const ocrOf = (lines, ocrConfidence = 90) => ({ fileSha256: "0".repeat(64), ocrConfidence, engine: "test", lines });

test("upscale factor: small screenshots upscale, large ones and non-images do not", () => {
  const pngHeader = (w, h) => {
    const b = Buffer.alloc(29);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
    return b;
  };
  assert.equal(ocrMod.ocrUpscaleFactor(pngHeader(620, 860)), 3);
  assert.equal(ocrMod.ocrUpscaleFactor(pngHeader(935, 1210)), 3);
  assert.equal(ocrMod.ocrUpscaleFactor(pngHeader(1170, 2532)), 2);
  assert.equal(ocrMod.ocrUpscaleFactor(pngHeader(3000, 2000)), 1);
  assert.equal(ocrMod.ocrUpscaleFactor(Buffer.from("not an image")), 1);
  assert.deepEqual(ocrMod.imagePixelSize(pngHeader(935, 1210)), { width: 935, height: 1210 });
});

test("mergeOcrLines dedupes, keeps the better confidence, and restores page geometry order", () => {
  const primary = [
    { text: "Bottom line here", confidence: 60, bbox: { x0: 0, y0: 80, x1: 50, y1: 90 } },
    { text: "Shared Title Line", confidence: 40, bbox: { x0: 0, y0: 10, x1: 50, y1: 20 } },
  ];
  const extra = [
    { text: "Shared Title Line", confidence: 88, bbox: { x0: 0, y0: 30, x1: 150, y1: 60 } },
    { text: "Middle extra", confidence: 70, bbox: { x0: 0, y0: 120, x1: 150, y1: 150 } },
  ];
  const merged = ocrMod.mergeOcrLines(primary, extra, { width: 100, height: 100 }, { width: 300, height: 300 });
  assert.equal(merged.length, 3);
  assert.equal(merged[0].text, "Shared Title Line");
  assert.equal(merged[0].confidence, 88);
  assert.equal(merged[1].text, "Middle extra");
  assert.equal(merged[2].text, "Bottom line here");
});

test("facts: an installment line is never crowned as the product title", () => {
  const facts = factsMod.productFactsFromOcr(ocrOf([
    { text: "4 biweekly payments of $22.07 with Klarna. Learn how", confidence: 95 },
    { text: "Crock-Pot 7 qt Polished Silver Slow Cooker", confidence: 90 },
    { text: "$88.27", confidence: 95 },
    { text: "4.6 out of 5 stars", confidence: 90 },
  ]));
  assert.equal(facts.name, "Crock-Pot 7 qt Polished Silver Slow Cooker");
  assert.equal(facts.price, "$88.27");
  assert.equal(facts.rating, "4.6");
});

test("facts: a title-like line with no price/rating/count/store context is not trusted", () => {
  const facts = factsMod.productFactsFromOcr(ocrOf([
    { text: "Low High Warm Deluxe Control Panel", confidence: 95 },
    { text: "some unreadable fragment here", confidence: 60 },
  ]));
  assert.equal(facts.name, "");
  assert.equal(facts.normalizedSearchQuery, "");
  assert.ok(facts.identityWarnings.some(w => /not trusted/.test(w)));
});

test("facts: recommendation-section lines cannot supply the title or the price", () => {
  const facts = factsMod.productFactsFromOcr(ocrOf([
    { text: "Crock-Pot 7 qt Polished Silver Slow Cooker", confidence: 90 },
    { text: "$88.27", confidence: 95 },
    { text: "Best sellers you might like", confidence: 95 },
    { text: "Toastmaster 10 Cup Rice Cooker Black Decker 16-Cup Multi-Use", confidence: 95 },
    { text: "$999.99", confidence: 96 },
  ]));
  assert.equal(facts.name, "Crock-Pot 7 qt Polished Silver Slow Cooker");
  assert.equal(facts.price, "$88.27");
});

test("ffmpeg binary is traced into the analyze and review-screenshot functions", () => {
  const cfg = readFileSync(root + "next.config.ts", "utf8");
  for (const route of ['"/api/analyze"', '"/api/review-screenshot"']) {
    const i = cfg.indexOf(route);
    assert.ok(i > 0, `${route} tracing include missing`);
    const block = cfg.slice(i, cfg.indexOf("]", i));
    assert.match(block, /@ffmpeg-installer\/linux-x64\/ffmpeg/);
  }
});

test("end-to-end: a small listing screenshot is identified by the enhanced OCR", { timeout: 120000 }, async () => {
  const image = readFileSync(dir + "listing-small.png");
  assert.ok(ocrMod.ocrUpscaleFactor(image) >= 2);
  const ocr = await ocrMod.ocrReviewScreenshot(image);
  const facts = factsMod.productFactsFromOcr(ocr);
  assert.equal(facts.name, "Crock-Pot 7 qt Polished Silver Slow Cooker");
  assert.equal(facts.brand, "Crock-Pot");
  assert.equal(facts.price, "$88.27");
  assert.equal(facts.rating, "4.6");
  assert.equal(facts.reviewCount, "8230");
  assert.ok(facts.imageConfidence >= 45, "must clear the analyze route's no-identity gate");
});
