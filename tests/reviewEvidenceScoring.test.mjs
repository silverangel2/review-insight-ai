import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { scoreReviewEvidenceSignals } = jiti("./lib/reviewEvidenceScoring.ts");

function shopperVerdict(result) {
  return result.verdict;
}

test("clearly strong review evidence reaches BUY in the high score band", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.7,
    marketplaceReviewCount: 6200,
    commentsAnalyzed: 84,
    evidenceStrength: "strong",
    reviewSnippets: [
      { sentiment: "positive", snippet: "buyers say it works well every day" },
      { sentiment: "positive", snippet: "recommended for reliable performance" },
      { sentiment: "positive", snippet: "great value and easy to use" },
    ],
    repeatedPraises: [
      { theme: "reliable and durable every day", evidenceCount: 36 },
      { theme: "excellent value and easy to use", evidenceCount: 24 },
      { theme: "buyers strongly recommend it", evidenceCount: 16 },
    ],
    repeatedComplaints: [{ theme: "minor packaging scuffs", evidenceCount: 2 }],
    productPros: ["durable build", "excellent value", "easy setup", "consistent performance"],
    productCons: ["box can arrive scuffed"],
  });

  assert.equal(shopperVerdict(result), "BUY");
  assert.ok(result.buyScore >= 8 && result.buyScore <= 10, `expected 8-10, got ${result.buyScore}`);
});

test("moderately positive evidence reaches BUY around 7 to 8", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.0,
    marketplaceReviewCount: 600,
    commentsAnalyzed: 42,
    evidenceStrength: "usable",
    repeatedPraises: [
      { theme: "works well and is easy to use", evidenceCount: 6 },
      { theme: "good value for everyday use", evidenceCount: 4 },
    ],
    repeatedComplaints: [{ theme: "setup takes a little patience", evidenceCount: 4 }],
    productPros: ["works well", "good value", "easy once configured"],
    productCons: ["setup instructions could be clearer", "accessory fit varies"],
  });

  assert.equal(shopperVerdict(result), "BUY");
  assert.ok(result.buyScore >= 7 && result.buyScore <= 8.5, `expected about 7-8, got ${result.buyScore}`);
});

test("genuinely mixed evidence stays REVIEW FIRST around 4 to 7", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.1,
    marketplaceReviewCount: 900,
    commentsAnalyzed: 48,
    evidenceStrength: "usable",
    repeatedPraises: [{ theme: "good value for the price", evidenceCount: 9 }],
    repeatedComplaints: [{ theme: "setup and support are inconsistent", evidenceCount: 8 }],
    productPros: ["useful features", "compact design", "solid value"],
    productCons: ["setup can be confusing", "support is inconsistent", "accessory fit varies"],
  });

  assert.equal(shopperVerdict(result), "REVIEW FIRST");
  assert.ok(result.buyScore >= 4 && result.buyScore <= 7, `expected 4-7, got ${result.buyScore}`);
});

test("clearly poor evidence reaches AVOID in the low score band", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 3.1,
    marketplaceReviewCount: 700,
    commentsAnalyzed: 44,
    evidenceStrength: "usable",
    repeatedPraises: [{ theme: "looks nice", evidenceCount: 2 }],
    repeatedComplaints: [
      { theme: "stopped working after a few uses", evidenceCount: 20 },
      { theme: "defective units and refund problems", evidenceCount: 14 },
      { theme: "unsafe overheating concern", evidenceCount: 7 },
    ],
    productPros: ["looks nice", "low price"],
    productCons: ["defective units", "stopped working", "unsafe overheating", "refund problems"],
  });

  assert.equal(shopperVerdict(result), "AVOID");
  assert.ok(result.buyScore >= 1 && result.buyScore <= 3.5, `expected about 1-3, got ${result.buyScore}`);
});

test("high rating with many reviews and isolated minor complaints does not become REVIEW FIRST", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.8,
    marketplaceReviewCount: 18000,
    commentsAnalyzed: 36,
    evidenceStrength: "usable",
    repeatedPraises: [
      { theme: "sturdy and reliable", evidenceCount: 18 },
      { theme: "great value and easy to use", evidenceCount: 14 },
    ],
    repeatedComplaints: [{ theme: "packaging can arrive scuffed", evidenceCount: 2 }],
    productPros: ["sturdy build", "reliable performance", "great value"],
    productCons: ["box can arrive scuffed"],
  });

  assert.equal(shopperVerdict(result), "BUY");
  assert.ok(result.buyScore >= 7, `expected supported BUY score, got ${result.buyScore}`);
});

test("severe repeated complaints can override a high marketplace rating", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.7,
    marketplaceReviewCount: 9500,
    commentsAnalyzed: 52,
    evidenceStrength: "strong",
    repeatedPraises: [{ theme: "nice design and low price", evidenceCount: 9 }],
    repeatedComplaints: [
      { theme: "battery overheats and creates unsafe use", evidenceCount: 12 },
      { theme: "stopped working after a few uses", evidenceCount: 16 },
      { theme: "refund denied for defective units", evidenceCount: 10 },
    ],
    productPros: ["nice design", "low price"],
    productCons: ["unsafe overheating", "stopped working", "defective units", "refund problems"],
  });

  assert.equal(shopperVerdict(result), "AVOID");
  assert.ok(result.buyScore <= 3.5, `expected severe complaints to cap score low, got ${result.buyScore}`);
});

test("not enough is reserved for insufficient written-review evidence", () => {
  const result = scoreReviewEvidenceSignals({
    rating: 4.9,
    marketplaceReviewCount: 25000,
    commentsAnalyzed: 0,
    evidenceStrength: "none",
    productPros: [],
    productCons: [],
    repeatedPraises: [],
    repeatedComplaints: [],
    reviewSnippets: [],
  });

  assert.equal(shopperVerdict(result), "REVIEW EVIDENCE NOT ENOUGH");
  assert.equal(result.buyScore, null);
});
