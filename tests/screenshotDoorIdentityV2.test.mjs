// Screenshot-door identity, round 2 (2026-10-21). Two failure modes from the
// live backfill of 2026-10-21 (10 real Walmart listing screenshots, Premium
// shopper session): (A) title selection crowned decoy text on 7 of 10 pages —
// delivery banners, seller-price lines, protection plans, merged carousel
// lines — and the one correctly read Roomba title was discarded by the
// corroboration gate; (B) a correctly identified Hamilton Beach toaster
// collected zero evidence because its fingerprint could not anchor (pure-
// numeric model "(22633)" + first-token-truncated brand "Hamilton"), so the
// library pool and the review hunt both skipped it.
// These tests pin the fixes: decoy-line shapes, geometry-aware title
// scoring, camelCase brand handling, self-corroboration, numeric model
// anchoring, spelled-out fluid ounces, unit-free kind words, and truncated-
// brand compatibility — while the strict gates stay strict (different
// models and different brands still refuse to merge).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const ocrMod = jiti("./lib/reviewScreenshotOcr.ts");
const factsMod = jiti("./lib/screenshotProductFacts.ts");
const fpMod = jiti("./lib/productFingerprint.ts");
const dir = root + "tests/fixtures/reviewintel-screenshot/";

const { isScreenshotDecoyLine, productFactsFromOcr } = factsMod;
const { extractProductFingerprint, matchListingToFingerprint, scanModelCodes, extractVariantWords } = fpMod;
const ocrOf = (lines, ocrConfidence = 90) => ({ fileSha256: "0".repeat(64), ocrConfidence, engine: "test", lines });
const line = (text, y, h = 10, confidence = 90) => ({ text, confidence, bbox: { x0: 10, y0: y, x1: 400, y1: y + h } });

test("decoy lines: every 2026-10-21 crowning shape is rejected", () => {
  const decoys = [
    "E> Free delivery over $35, arrives today to Mississauga, L5V 2N6",
    "Free pickup over $35, today at MISSISSAUGA HEARTLAND",
    "Free delivery, arrives tomorrow to Brampton",
    "Starting from $498.00 Compare all sellers",
    "Starting from 219.98 all sellers",
    "] 2-Year Plan - $59.97",
    "One-time purchase $498.00",
    "Fulfilled by Walmart > Return policy > Free Delivery",
    "Return policy > (=) Free Delivery",
    "Notreturnable Details",
    // merged carousel lines: several products concatenated, words repeat
    "Combo Robot Vacuum u and Mop Combo with and Mop, 4000Pa Robot Vacuumand",
    "iRobot Roomba 1110 1) GOOVI Robot Vacuum 2-in-1Robot Vacuum PrettyCare C2-v2",
    "Browse similar items &Mop with AutoEmp... Bagless Self Emptyin... Suction, 120 Min...",
  ];
  for (const d of decoys) assert.equal(isScreenshotDecoyLine(d), true, d);
});

test("decoy lines: real titles are never flagged", () => {
  const titles = [
    "Crock-Pot 7 qt Polished Silver Slow Cooker",
    "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
    "iRobot Roomba 694 Robot Vacuum-Wi-Fi Connectivity, Personalized Cleaning Recommendations, Works with Alexa, Good for Pet Hair, Carpets, Hard Floors, Self-Charging, Roomba 694",
    "Dr. Brown's Natural Flow Anti-Colic Options+ Narrow Baby Bottles with Level 1Slow Flow Nipples, Om+, 4x8oz Bottles",
    "Sony WH-1000XM5 Wireless Noise Canceling Headphones, Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling, and Alexa Voice Control, Black",
    "Armor All Original Protectant (16 fluid ounces)",
    "Milk-Bone Original Crunchy Biscuit Dog Treats, Mini's",
    "Logitech K380 Multi-Device Bluetooth Keyboard for Mac with Compact Slim Profile, Easy-Switch, 2 Year Battery",
  ];
  for (const t of titles) assert.equal(isScreenshotDecoyLine(t), false, t);
});

test("mergeOcrLines rescales extra-pass boxes into the primary coordinate space", () => {
  const primary = [{ text: "Native title", confidence: 80, bbox: { x0: 0, y0: 10, x1: 50, y1: 20 } }];
  const extra = [{ text: "Upscaled only line", confidence: 80, bbox: { x0: 0, y0: 60, x1: 150, y1: 90 } }];
  const merged = ocrMod.mergeOcrLines(primary, extra, { width: 100, height: 100 }, { width: 300, height: 300 });
  const up = merged.find((l) => l.text === "Upscaled only line");
  assert.deepEqual(up.bbox, { x0: 0, y0: 20, x1: 50, y1: 30 });
});

test("facts: camelCase brand title wins over a merged carousel line above it", () => {
  const ocr = ocrOf([
    line("Combo Robot Vacuum u and Mop Combo with and Mop, 4000Pa Robot Vacuumand", 30, 12, 92),
    line("Visit the IRobot Store", 300, 10, 92),
    line("iRobot Roomba 694 Robot Vacuum-Wi-Fi Connectivity, Personalized Cleaning Recommendations, Works with Alexa, Good for Pet Hair, Carpets, Hard Floors, Self-Charging", 320, 12, 95),
    line("Automatically Recharges", 400, 8, 80),
  ], 77);
  const facts = productFactsFromOcr(ocr);
  assert.ok(facts.name.startsWith("iRobot Roomba 694"), facts.name);
});

test("facts: a decisive brand-corroborated title is trusted without price/store context", () => {
  // The 2026-10-21 Roomba page shape: no price, store, rating or count read
  // anywhere (wordmark is a graphic, rating line garbled) — the title used
  // to be discarded as "not trusted" and the scan shipped nameless.
  const ocr = ocrOf([
    line("Visit the IRobot Store", 300, 10, 92),
    line("iRobot Roomba 694 Robot Vacuum-Wi-Fi Connectivity, Personalized Cleaning Recommendations, Works with Alexa, Good for Pet Hair, Carpets, Hard Floors, Self-Charging", 320, 12, 95),
  ], 77);
  const facts = productFactsFromOcr(ocr);
  assert.ok(facts.name.startsWith("iRobot Roomba 694"), JSON.stringify(facts));
  assert.equal(facts.imageConfidence, 77);
});

test("facts: a feature sentence does not beat the title it describes", () => {
  const ocr = ocrOf([
    line("Armor All fr drdd (46) | 31", 200, 8, 89),
    line("Armor All Original Protectant (16 fluid ounces)", 220, 12, 89),
    line("Cleans And Shines", 300, 8, 90),
    line("Cleans away everyday dirt and dust while leaving a medium shine on surfaces.", 320, 7, 90),
    line("Fulfilled by Walmart", 500, 8, 90),
  ], 72);
  const facts = productFactsFromOcr(ocr);
  assert.ok(facts.name.includes("Armor All Original Protectant"), facts.name);
});

test("e2e: Sony page is named after the product, not the seller-price line", async () => {
  const ocr = await ocrMod.ocrReviewScreenshot(readFileSync(dir + "walmart-sony-decoy-page.png"));
  const facts = productFactsFromOcr(ocr);
  assert.ok(facts.name.includes("Sony"), facts.name);
  assert.ok(!/starting from/i.test(facts.name), facts.name);
  assert.ok(!/2-Year Plan/.test(facts.name), facts.name);
});

test("e2e: Milk-Bone page is named after the product, not the delivery banner", async () => {
  const ocr = await ocrMod.ocrReviewScreenshot(readFileSync(dir + "walmart-milkbone-delivery-page.png"));
  const facts = productFactsFromOcr(ocr);
  assert.ok(facts.name.includes("Milk-Bone"), facts.name);
  assert.ok(facts.name.includes("Dog Treats"), facts.name);
  assert.ok(!/delivery/i.test(facts.name), facts.name);
});

test("fingerprint: a parenthesized pure-numeric model anchors the fingerprint", () => {
  const codes = scanModelCodes("Hamilton Beach 2 Slice Toaster (22633)");
  assert.ok(codes.includes("22633"), JSON.stringify(codes));
  // Years, prices and long identifiers are not model numbers.
  assert.ok(!scanModelCodes("Widget (2024) Special Edition").includes("2024"));
  assert.ok(!scanModelCodes("Widget Gift Card (123456789012)").includes("123456789012"));
  const fp = extractProductFingerprint({
    brand: "Hamilton",
    productName: "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
  });
  assert.equal(fp.identityBasis, "model");
  assert.equal(fp.fingerprintKey, "fp:hamilton:22633");
});

test("fingerprint: truncated screenshot brand pools with the full stored brand", () => {
  // The screenshot side states brand "Hamilton" (first title token); the
  // stored library row states "Hamilton Beach". Before the fix the pool
  // match died on brand_mismatch in both directions.
  const ssIdentity = {
    brand: "Hamilton",
    productName: "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
    title: "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
  };
  const storedRow = {
    brand: "Hamilton Beach",
    productName: "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
    title: "Hamilton Beach 2 Slice Extra Wide Slot Toaster with Bagel & Defrost Settings, Shade Selector with 7 Browning Levels, Toast Boost, Auto Shutoff, Black & Stainless Steel (22633)",
  };
  const fp = extractProductFingerprint(ssIdentity);
  assert.equal(matchListingToFingerprint(fp, storedRow).verdict, "match");
  assert.equal(matchListingToFingerprint(extractProductFingerprint(storedRow), ssIdentity).verdict, "match");
});

test("fingerprint: brand gate stays hard for different brands and near prefixes", () => {
  const hb = extractProductFingerprint({ brand: "Hamilton", productName: "Hamilton Beach 2 Slice Toaster (22633)" });
  const sonyRow = { brand: "Sony", productName: "Sony 2 Slice Toaster (22633)" };
  assert.equal(matchListingToFingerprint(hb, sonyRow).verdict, "no_match");
  // A prefix must end at a word boundary: "dr" is not the brand "dremel".
  const dr = extractProductFingerprint({ brand: "Dr.", productName: "Dr. Comfort Shoes (12345)" });
  const dremelRow = { brand: "Dremel", productName: "Dremel Comfort Shoes (12345)" };
  assert.notEqual(matchListingToFingerprint(dr, dremelRow).verdict, "match");
});

test("fingerprint: model gate stays strict — near model codes never merge", () => {
  const xm5 = extractProductFingerprint({ brand: "Sony", productName: "Sony WH-1000XM5 Wireless Headphones" });
  const xm4Row = { brand: "Sony", productName: "Sony WH-1000XM4 Wireless Headphones", title: "Sony WH-1000XM4 Wireless Headphones" };
  assert.equal(matchListingToFingerprint(xm5, xm4Row).verdict, "no_match");
});

test("fingerprint: spelled-out fluid ounces is a capacity variant; units are not kind words", () => {
  assert.ok(extractVariantWords("Armor All Original Protectant (16 fluid ounces)").includes("cap-floz:16"));
  const fp = extractProductFingerprint({ brand: "Armor", productName: "Armor All Original Protectant (16 fluid ounces)" });
  assert.ok(fp.variantWords.includes("cap-floz:16"));
  assert.ok(!fp.kindWords.includes("ounces"), JSON.stringify(fp.kindWords));
});
