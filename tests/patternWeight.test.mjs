// Authenticity pattern-weight rule (2026-10-18, owner decision).
//
// A "Strong AI-like pattern" grade (deterministic forensics,
// lib/aiPatternForensics.ts, points >= 5) must carry weight in the Buying
// Score v2:
//   (a) PRAISE CAN'T LIFT: positive written support is removed from the
//       score; negative/hostile written evidence still counts fully.
//   (b) BUY CAP: a praise-carried Buy is capped at Wait (score cap 74);
//       a Buy the marketplace aggregate carries alone stands.
//   (c) A capped page carries the manufactured-pattern reason in the
//       WHY WAIT block (DRAFT copy, owner approval pending).
// Grades "Few"/"Some" and insufficient corpora change NOTHING.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const bs = jiti(root + "lib/buyingScore.ts");
const vc = jiti(root + "lib/verdictComposition.ts");
const ra = jiti(root + "lib/reviewAnalysis.ts");

const mkSignals = (over) =>
  Object.assign(
    {
      rating: null,
      ratingCount: null,
      n: 0,
      meanSentiment: 0,
      visibleMeanStars: null,
      rel: 0,
      relSameTheme: 0,
      saf: 0,
      safSameHazard: 0,
      min: 0,
      themes: 0,
    },
    over
  );

// Praise-carried Buy: base Bayesian score 73, written praise lifts to 77.
const PRAISE_CARRIED = () =>
  mkSignals({ rating: 3.9, ratingCount: 2000, n: 10, nEff: 10, meanSentiment: 0.8 });

test("strong pattern zeroes positive support and demotes a praise-carried Buy to Wait", () => {
  const pre = bs.computeBuyingScore(PRAISE_CARRIED());
  assert.equal(pre.score, 77);
  assert.equal(pre.verdict, "Buy");
  assert.equal(pre.audit.Pos, 4);

  const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: "high" });
  assert.equal(post.score, 73);
  assert.equal(post.verdict, "Wait");
  assert.equal(post.audit.Pos, 0);
  // The negative ledger is untouched (nothing to keep here, nothing invented).
  assert.equal(post.audit.Neg, 0);
});

test("strong pattern: aggregate-carried Buy stands with support zeroed", () => {
  const carried = () =>
    mkSignals({ rating: 4.6, ratingCount: 359503, n: 13, nEff: 13, meanSentiment: 0.8 });
  const pre = bs.computeBuyingScore(carried());
  assert.equal(pre.verdict, "Buy");

  const post = bs.computeBuyingScore({ ...carried(), authenticityPattern: "high" });
  assert.equal(post.verdict, "Buy");
  assert.equal(post.score, 90); // marketplace aggregate alone
  assert.equal(post.audit.Pos, 0);
});

test("few AI-like signs: byte-identical verdict path", () => {
  const pre = bs.computeBuyingScore(PRAISE_CARRIED());
  const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: "low" });
  assert.equal(post.score, pre.score);
  assert.equal(post.verdict, pre.verdict);
  assert.equal(post.audit.Pos, pre.audit.Pos);
});

test("some AI-like signs: byte-identical verdict path", () => {
  const pre = bs.computeBuyingScore(PRAISE_CARRIED());
  const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: "moderate" });
  assert.equal(post.score, pre.score);
  assert.equal(post.verdict, pre.verdict);
  assert.equal(post.audit.Pos, pre.audit.Pos);
});

test("no grade (insufficient corpus): unchanged", () => {
  const pre = bs.computeBuyingScore(PRAISE_CARRIED());
  const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: null });
  assert.equal(post.score, pre.score);
  assert.equal(post.verdict, pre.verdict);
});

test("strong pattern: hostile written evidence still counts fully", () => {
  const hostile = () =>
    mkSignals({ rating: 4.6, ratingCount: 359503, n: 10, nEff: 10, meanSentiment: -0.6, rel: 1 });
  const pre = bs.computeBuyingScore(hostile());
  const post = bs.computeBuyingScore({ ...hostile(), authenticityPattern: "high" });
  // Negative sentiment support is kept (house asymmetry); only praise is removed.
  assert.equal(post.score, pre.score);
  assert.equal(post.score, 81);
});

test("strong pattern: written-only Buy collapses to Wait", () => {
  const only = () => mkSignals({ n: 25, nEff: 25, meanSentiment: 0.9 });
  const pre = bs.computeBuyingScore(only());
  assert.equal(pre.verdict, "Buy");
  const post = bs.computeBuyingScore({ ...only(), authenticityPattern: "high" });
  assert.equal(post.score, 50);
  assert.equal(post.verdict, "Wait");
});

test("buyingScoreFromReviews threads the pattern grade onto the card", () => {
  const card = bs.buyingScoreFromReviews({
    authenticityPattern: "high",
    marketplace: { rating: 4.6, count: 359503 },
    reviews: [],
  });
  assert.equal(card.authenticityPattern, "high");
  const clean = bs.buyingScoreFromReviews({
    marketplace: { rating: 4.6, count: 359503 },
    reviews: [],
  });
  assert.equal(clean.authenticityPattern, null);
});

test("buildWaitLine: pattern-reason Wait prints the manufactured-pattern reason", () => {
  const line = vc.buildWaitLine("wait", {
    score: 74,
    reviewCount: 13,
    buyThreshold: 75,
    waitThreshold: 50,
    forThemes: [],
    againstThemes: [],
    patternReason: true,
  });
  assert.equal(line, vc.PATTERN_WAIT_LINE_DRAFT);
  assert.match(line, /manufactured pattern/);
  // Never an accusation against a person.
  assert.doesNotMatch(line, /seller faked|fake reviews/i);
});

test("buildWaitLine: non-wait verdicts never print the pattern line", () => {
  assert.equal(
    vc.buildWaitLine("buy", {
      score: 90,
      reviewCount: 13,
      buyThreshold: 75,
      waitThreshold: 50,
      forThemes: [],
      againstThemes: [],
      patternReason: true,
    }),
    null
  );
});

test("deriveReviewAnalysis: a strong_ai_pattern cap surfaces the DRAFT reason in the wait line", () => {
  const acceptedRecords = Array.from({ length: 13 }, (_, i) => ({
    id: `r${i + 1}`,
    stableEvidenceHash: `h${i + 1}`,
    body: "Accurate measurements and easy to use with the phone app.",
  }));
  const result = {
    verdict: "WAIT",
    buyScore: 74,
    score: 74,
    finalDecisionSource: "buyingScoreV2",
    finalVerdict: "WAIT",
    scanState: "COMPLETE",
    product: { name: "Body Fat Scale (example)", store: "Amazon" },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "buying_score",
      score: 74,
      verdict: "Wait",
      confidence: "Medium",
      audit: { n: 13, Rbar: 4.6, N: 359503, capsApplied: ["strong_ai_pattern"] },
    },
    reviewEvidence: { evidenceAdjudication: { acceptedRecords } },
  };
  const analysis = ra.deriveReviewAnalysis(result);
  assert.equal(analysis.waitLine, vc.PATTERN_WAIT_LINE_DRAFT);
});

// Extension (2026-10-18, owner decision): the manufactured-pattern reason
// also prints when praise-zeroing DEMOTED the verdict. computeBuyingScore
// records the machine-readable "strong_ai_pattern_demoted" audit marker when
// the counterfactual (praise intact) would have been a Buy (>= 75) and the
// final score is not. A corpus already a Wait with praise intact gets NO
// marker and NO pattern line — the pattern didn't change the verdict.
// Grades "Few"/"Some" and insufficient corpora change NOTHING.

const DEMOTED_RECORDS = Array.from({ length: 13 }, (_, i) => ({
  id: `r${i + 1}`,
  stableEvidenceHash: `h${i + 1}`,
  body: "Accurate measurements and easy to use with the phone app.",
}));

const mkWaitResult = (card, acceptedRecords) => ({
  verdict: "WAIT",
  buyScore: card.score,
  score: card.score,
  finalDecisionSource: "buyingScoreV2",
  finalVerdict: "WAIT",
  scanState: "COMPLETE",
  product: { name: "Body Fat Scale (example)", store: "Amazon" },
  buyingScoreV2: card,
  reviewEvidence: { evidenceAdjudication: { acceptedRecords } },
});

test("(x) strong pattern: a demoted Buy records the marker and surfaces the pattern line", () => {
  const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: "high" });
  assert.equal(post.score, 73);
  assert.equal(post.verdict, "Wait");
  // Counterfactual (praise intact) was Buy 77, final is not Buy — the drop
  // is attributable to the pattern rule by construction.
  assert.ok(post.audit.capsApplied.includes("strong_ai_pattern_demoted"));
  // The score itself is unchanged by the marker (metadata only).
  const analysis = ra.deriveReviewAnalysis(mkWaitResult(post, DEMOTED_RECORDS));
  assert.equal(analysis.waitLine, vc.PATTERN_WAIT_LINE_DRAFT);
});

test("(xi) already-Wait counterfactual: no marker, generic wait line", () => {
  // Praise lifts 73 -> 74: already a Wait with praise intact.
  const alreadyWait = () =>
    mkSignals({ rating: 3.9, ratingCount: 2000, n: 10, nEff: 10, meanSentiment: 0.2 });
  const pre = bs.computeBuyingScore(alreadyWait());
  assert.equal(pre.verdict, "Wait");
  assert.ok(pre.score < 75);
  const post = bs.computeBuyingScore({ ...alreadyWait(), authenticityPattern: "high" });
  assert.equal(post.verdict, "Wait");
  assert.ok(post.score <= pre.score); // praise was still set aside
  // The pattern did not change the verdict: no marker, no pattern line.
  assert.ok(!post.audit.capsApplied.includes("strong_ai_pattern_demoted"));
  assert.ok(!post.audit.capsApplied.includes("strong_ai_pattern"));
  const analysis = ra.deriveReviewAnalysis(mkWaitResult(post, DEMOTED_RECORDS));
  assert.ok(analysis.waitLine === null || analysis.waitLine !== vc.PATTERN_WAIT_LINE_DRAFT);
});

test("(xii) cap and demotion markers together still surface the reason", () => {
  const card = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: "high" });
  const both = {
    ...card,
    audit: { ...card.audit, capsApplied: [...card.audit.capsApplied, "strong_ai_pattern"] },
  };
  const analysis = ra.deriveReviewAnalysis(mkWaitResult(both, DEMOTED_RECORDS));
  assert.equal(analysis.waitLine, vc.PATTERN_WAIT_LINE_DRAFT);
});

test("(xiii) few/some grades on a demotion-shaped corpus: no marker, byte-identical", () => {
  for (const grade of ["low", "moderate"]) {
    const pre = bs.computeBuyingScore(PRAISE_CARRIED());
    const post = bs.computeBuyingScore({ ...PRAISE_CARRIED(), authenticityPattern: grade });
    assert.equal(post.score, pre.score);
    assert.equal(post.verdict, pre.verdict);
    assert.ok(!post.audit.capsApplied.includes("strong_ai_pattern_demoted"));
    assert.ok(!post.audit.capsApplied.includes("strong_ai_pattern"));
  }
});

test("deriveReviewAnalysis: no cap flag keeps the signal-derived wait line", () => {
  const acceptedRecords = Array.from({ length: 13 }, (_, i) => ({
    id: `r${i + 1}`,
    stableEvidenceHash: `h${i + 1}`,
    body: "Accurate measurements and easy to use with the phone app.",
  }));
  const result = {
    verdict: "WAIT",
    buyScore: 73,
    score: 73,
    finalDecisionSource: "buyingScoreV2",
    finalVerdict: "WAIT",
    scanState: "COMPLETE",
    product: { name: "Body Fat Scale (example)", store: "Amazon" },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "buying_score",
      score: 73,
      verdict: "Wait",
      confidence: "Medium",
      audit: { n: 13, Rbar: 3.9, N: 2000, capsApplied: [] },
    },
    reviewEvidence: { evidenceAdjudication: { acceptedRecords } },
  };
  const analysis = ra.deriveReviewAnalysis(result);
  assert.ok(analysis.waitLine === null || analysis.waitLine !== vc.PATTERN_WAIT_LINE_DRAFT);
});
