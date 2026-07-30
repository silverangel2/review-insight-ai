import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { scoreReviewEvidenceSignals } = jiti("./lib/reviewEvidenceScoring.ts");

test("review evidence scoring separates strong, mixed, and poor evidence", () => {
  const strong = scoreReviewEvidenceSignals({
    repeatedPraises: [
      { theme: "reliable and durable every day", count: 36 },
      { theme: "excellent value and easy to use", count: 24 },
      { theme: "buyers strongly recommended it", count: 16 },
    ],
    repeatedComplaints: [{ theme: "minor packaging scuffs", count: 2 }],
    productPros: ["durable build", "excellent value", "easy setup", "consistent performance"],
    productCons: ["box can arrive scuffed"],
    commentsAnalyzed: 80,
    marketplaceReviewCount: 6200,
    marketplaceRating: 4.7,
    evidenceStrength: "strong",
  });

  const mixed = scoreReviewEvidenceSignals({
    repeatedPraises: [{ theme: "good value for the price", count: 10 }],
    repeatedComplaints: [{ theme: "some buyers mention setup difficulty", count: 8 }],
    productPros: ["useful features", "solid value", "easy enough after setup", "compact design"],
    productCons: ["setup can be confusing", "noise is noticeable", "support is inconsistent", "accessory fit varies"],
    commentsAnalyzed: 55,
    marketplaceReviewCount: 1800,
    marketplaceRating: 4.1,
    evidenceStrength: "usable",
  });

  const poor = scoreReviewEvidenceSignals({
    repeatedPraises: [{ theme: "looks nice", count: 3 }],
    repeatedComplaints: [
      { theme: "stopped working after a few uses", count: 25 },
      { theme: "refund denied after defective unit", count: 12 },
      { theme: "unsafe overheating concern", count: 7 },
    ],
    productPros: ["looks nice", "low price"],
    productCons: ["defective unit", "stopped working", "unsafe overheating", "refund denied"],
    buyerExperienceSignals: ["buyers report returns and refunds after failures"],
    commentsAnalyzed: 48,
    marketplaceReviewCount: 900,
    marketplaceRating: 3.1,
    evidenceStrength: "usable",
  });

  assert.equal(strong.verdict, "BUY");
  assert.ok(strong.buyScore >= 8, `expected strong score >= 8, got ${strong.buyScore}`);

  assert.equal(mixed.verdict, "REVIEW FIRST");
  assert.ok(mixed.buyScore >= 5 && mixed.buyScore <= 7, `expected mixed score 5-7, got ${mixed.buyScore}`);

  assert.equal(poor.verdict, "AVOID");
  assert.ok(poor.buyScore <= 4, `expected poor score <= 4, got ${poor.buyScore}`);

  assert.ok(
    strong.buyScore - poor.buyScore >= 4,
    `expected meaningful score spread, got strong=${strong.buyScore} poor=${poor.buyScore}`
  );
});

test("four pros and four cons are not scored as automatically neutral", () => {
  const mildCons = scoreReviewEvidenceSignals({
    productPros: ["excellent durability", "reliable performance", "great value", "easy to use"],
    productCons: ["packaging can scuff", "color preference varies", "minor setup note", "small accessory wish"],
    commentsAnalyzed: 60,
    marketplaceReviewCount: 2400,
    marketplaceRating: 4.8,
    evidenceStrength: "strong",
  });

  const severeCons = scoreReviewEvidenceSignals({
    productPros: ["nice design", "low price", "simple controls", "compact size"],
    productCons: ["stopped working", "defective units", "unsafe overheating", "refund denied"],
    commentsAnalyzed: 60,
    marketplaceReviewCount: 2400,
    marketplaceRating: 3.0,
    evidenceStrength: "strong",
  });

  assert.notEqual(mildCons.buyScore, severeCons.buyScore);
  assert.ok(mildCons.buyScore >= 7, `expected mild-cons case to score above neutral, got ${mildCons.buyScore}`);
  assert.ok(severeCons.buyScore <= 4, `expected severe-cons case to score poorly, got ${severeCons.buyScore}`);
});
