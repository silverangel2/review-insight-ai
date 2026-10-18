// Buy-57 band-consistency fence + finality guard regressions (2026-10-18).
//
// Production incident: scan_93a6ec62 (RENPHO scale, B01N1UX8RW) rendered
// verdict "Buy" with Buying Score 57 — a pair that violates the house bands
// (Buy >= 75, Wait 50-74, Skip < 50). These tests pin the three guards:
//
//   1. lib/shopperAnswer.ts deriveShopperAnswer / shopperVerdictWord — the
//      shopper render seam: when a 0-100 Buying Score prints, the verdict
//      word must sit in the score's band. On mismatch the WORD follows the
//      SCORE. Provisional, thin/not-enough, and score-less states are
//      untouched.
//   2. lib/finalVerdictConsistency.ts enforceFinalVerdictConsistency — the
//      BUY branch is scale-aware: 0-100 records get the verdict clamped to
//      the score's band; genuine 0-10-scale legacy records keep prior behavior.
//   3. app/api/analyze/route.ts persistedBandVerdict — the persistence guard
//      (exercised here through the same verdictFromScore band mapping it
//      uses): only v2 0-100 decisions with a finite score get a band word;
//      anything else passes through untouched.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const sa = jiti(root + "lib/shopperAnswer.ts");
const fvc = jiti(root + "lib/finalVerdictConsistency.ts");
const bs = jiti(root + "lib/buyingScore.ts");

// ---------- Fixtures shaped like the REAL v2 analyze record ----------
function v2Record({ verdictWord, score, verdict }) {
  return {
    verdict,
    buyScore: score,
    score,
    productScore: score,
    verdictConfidence: 72,
    finalDecisionSource: "buyingScoreV2",
    finalVerdict: verdict,
    stableVerdict: verdict,
    scanState: "COMPLETE",
    product: { name: "RENPHO Body Fat Scale", store: "Amazon" },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "buying_score",
      score,
      verdict: verdictWord,
      confidence: "Medium",
      audit: { n: 13 },
    },
  };
}

function answerFor(fixture) {
  const answer = sa.deriveShopperAnswer(fixture, "en");
  return { kind: answer.kind, score: answer.score, word: sa.shopperVerdictWord(fixture) };
}

// ---------- (a) The incident pair: BUY + 57 must print Wait + 57 ----------
test("(a) render seam: BUY + 57 prints Wait + 57 (word follows the score)", () => {
  const got = answerFor(v2Record({ verdictWord: "Buy", score: 57, verdict: "BUY" }));
  assert.equal(got.kind, "wait");
  assert.equal(got.score, 57);
  assert.equal(got.word, "Wait");
});

// ---------- (b) BUY + 95 unchanged ----------
test("(b) render seam: BUY + 95 stays Buy + 95", () => {
  const got = answerFor(v2Record({ verdictWord: "Buy", score: 95, verdict: "BUY" }));
  assert.equal(got.kind, "buy");
  assert.equal(got.score, 95);
  assert.equal(got.word, "Buy");
});

// ---------- (c) WAIT + 72 and SKIP + 30 unchanged ----------
test("(c) render seam: WAIT + 72 stays Wait + 72", () => {
  const got = answerFor(v2Record({ verdictWord: "Wait", score: 72, verdict: "WAIT" }));
  assert.equal(got.kind, "wait");
  assert.equal(got.score, 72);
  assert.equal(got.word, "Wait");
});

test("(c) render seam: SKIP + 30 stays Skip + 30", () => {
  const got = answerFor(v2Record({ verdictWord: "Skip", score: 30, verdict: "SKIP" }));
  assert.equal(got.kind, "skip");
  assert.equal(got.score, 30);
  assert.equal(got.word, "Skip");
});

// ---------- (d) no-score not-enough record: unchanged, no invented word ----------
test("(d) render seam: not-enough record with no score is untouched", () => {
  const got = answerFor({
    verdict: "REVIEW EVIDENCE NOT ENOUGH",
    buyScore: null,
    score: null,
    productScore: null,
    finalDecisionSource: "reviewEvidenceNotEnough",
    scanState: "INSUFFICIENT_EVIDENCE",
    product: { name: "Mystery Gadget", store: "Amazon" },
    buyingScoreV2: { version: "buying-score-v2", mode: "no_score" },
  });
  assert.equal(got.kind, "not_enough");
  assert.equal(got.score, null);
  // shopperVerdictWord returns null for not_enough by design (DecisionBrief
  // localizes it to "Low confidence") — the fence invents no word.
  assert.equal(got.word, null);
});

// ---------- (e) provisional clear-band record: unchanged ----------
test("(e) render seam: provisional clear-band Buy is untouched by the fence", () => {
  const got = answerFor({
    verdict: "BUY",
    buyScore: 88,
    score: 88,
    productScore: 88,
    finalDecisionSource: "buyingScoreV2",
    scanState: "COMPLETE",
    product: { name: "New Scale X1", store: "Amazon" },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "provisional_marketplace",
      score: 88,
      verdict: "Buy",
      audit: { Rbar: 4.6, N: 359503 },
    },
  });
  // Provisional facing keeps its own honest in-progress presentation.
  assert.equal(got.kind, "buy");
  assert.equal(got.score, 88);
  assert.equal(got.word, "Buy");
});

// ---------- (f) finalVerdictConsistency scale-aware ----------
test("(f) consistency: 0-100 BUY + 57 clamps the verdict to the band, score untouched", () => {
  const out = fvc.enforceFinalVerdictConsistency({
    verdict: "BUY",
    buyScore: 57,
    score: 57,
    finalDecisionSource: "buyingScoreV2",
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 57, verdict: "Buy" },
    buyerConfidence: 72,
  });
  assert.equal(out.verdict, "WAIT");
  assert.equal(out.recommendation, "WAIT");
  assert.equal(out.finalVerdict, "WAIT");
  assert.equal(out.stableVerdict, "WAIT");
  assert.equal(out.buyScore, 57);
  assert.equal(out.score, 57);
});

test("(f) consistency: 0-100 BUY + 95 is left alone", () => {
  const record = {
    verdict: "BUY",
    buyScore: 95,
    score: 95,
    finalDecisionSource: "buyingScoreV2",
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 95, verdict: "Buy" },
  };
  const out = fvc.enforceFinalVerdictConsistency(record);
  assert.equal(out, record); // byte-identical: no-op when the word matches its band
});

test("(f) consistency: genuine 0-10 legacy BUY record keeps prior behavior", () => {
  const out = fvc.enforceFinalVerdictConsistency({
    verdict: "BUY",
    buyScore: 8.8,
    buyerConfidence: 60,
    valueForMoney: "Unknown",
  });
  assert.equal(out.verdict, "BUY");
  assert.equal(out.buyScore, 8.8); // Math.max(8.8, 8) — prior floor preserved
  assert.equal(out.buyerConfidence, 75); // prior confidence floor preserved
  assert.equal(out.valueForMoney, "Strong"); // prior value rewrite preserved
});

// ---------- (h) legacy 0-10 record without a v2 card: fence must not fire ----------
test("(h) render seam: legacy 0-10 BUY record (no v2 card) keeps its word", () => {
  const got = answerFor({
    verdict: "BUY",
    customerVerdict: "BUY",
    buyScore: 7.2,
    score: 7.2,
    deterministicResult: { customerVerdict: "BUY", buyScore: 7.2 },
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: [
          { id: "r1", body: "Accurate measurements and easy to use with the phone app.", sourceUrl: "https://www.example-store.test/dp/EXAMPLE1" },
        ],
      },
    },
  });
  // The 7.2 is a 0-10 legacy score, not a 0-100 Buying Score: the fence stays out.
  assert.equal(got.kind, "buy");
  assert.equal(got.score, 7.2);
  assert.equal(got.word, "Buy");
});

// ---------- (g) persistence-guard band mapping (same mapping route.ts uses) ----------
test("(g) band mapping: verdictFromScore welds word to score on the 0-100 scale", () => {
  assert.equal(bs.verdictFromScore(57), "Wait");
  assert.equal(bs.verdictFromScore(95), "Buy");
  assert.equal(bs.verdictFromScore(72), "Wait");
  assert.equal(bs.verdictFromScore(30), "Skip");
  assert.equal(bs.verdictFromScore(75), "Buy");
  assert.equal(bs.verdictFromScore(50), "Wait");
});
