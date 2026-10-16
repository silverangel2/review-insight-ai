// ReviewIntel fix round 5 — the decision brief must never print the same
// sentence twice for one factor.
// Live defect (2026-10-16 18:24 ADT, Sony scan_cbc41785, PR #57 build):
// under each "Why you'd buy it" theme, "One buyer reported this." rendered
// twice — once as the factor summary (dark) and once as its basis (lighter).
// Cause: round 4's echo-guard fallback composes the factor summary as the
// bare basis label while the basis field carries the identical text.
// Display layer only: no scoring, no verdict, no copy-library changes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const dedupe = jiti(root + "lib/textDedupe.ts");
const ra = jiti(root + "lib/reviewAnalysis.ts");

// ---------- the predicate ----------

test("R5: the fallback pair matches — summary has the period, basis does not", () => {
  assert.ok(
    dedupe.sameSentence("One buyer reported this.", "One buyer reported this"),
    "live defect pair"
  );
  assert.ok(
    dedupe.sameSentence("One buyer reported this", "One buyer reported this."),
    "period on either side"
  );
  assert.ok(
    dedupe.sameSentence("Repeated across reviews.", "Repeated across reviews"),
    "exact pair"
  );
});

test("R5: matching ignores case and surrounding whitespace", () => {
  assert.ok(dedupe.sameSentence("  ONE BUYER REPORTED THIS. ", "one buyer reported this"));
  assert.ok(dedupe.sameSentence("Pattern across  most reviews.", "Pattern Across Most Reviews"));
});

test("R5: genuinely different sentences do not match", () => {
  assert.ok(
    !dedupe.sameSentence("A short label about noise.", "Repeated across reviews"),
    "real summary vs basis"
  );
  assert.ok(
    !dedupe.sameSentence("Pattern across most reviews", "One buyer reported this"),
    "two basis labels"
  );
  assert.ok(!dedupe.sameSentence("", ""), "empty never matches");
  assert.ok(!dedupe.sameSentence("One buyer reported this.", ""), "empty basis never matches");
  assert.ok(!dedupe.sameSentence(null, "One buyer reported this"), "null-safe");
});

// ---------- composition: the duplicate pair the guard handles ----------

const bodies = [
  "Love these headphones! The sound is crystal clear and the battery lasts forever.",
  "Bought a second pair for my wife after trying mine for a week.",
];

function resultWithLongOneOffClaim() {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i + 1}`,
          stableEvidenceHash: `h${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/B09XS7JWHH",
        })),
      },
      commentsAnalyzed: 2,
      listingEvidence: { rating: 4.3, reviewCount: 19722 },
    },
    // A one-off claim longer than 10 words: oneOffThemeFill rejects it as a
    // theme label, so the echo-guard fallback composes the factor.
    strengths: [
      {
        claim:
          "this particular claim text is deliberately made far longer than ten words so that no short theme label fill is ever accepted by the guard",
        supportCount: 1,
        sourceIds: ["r1"],
        sourceHashes: [],
      },
    ],
    complaints: [],
    product: { title: "Sony WH-1000XM5 Premium Noise Cancelling Wireless Headphones, Black", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "written_only",
      score: 79,
      verdict: "buy",
      confidence: "Medium",
      audit: { n: 2, Rbar: 4.3, N: 19722 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
  };
}

test("R5: the echo-guard fallback composes summary = basis + period", () => {
  const a = ra.deriveReviewAnalysis(resultWithLongOneOffClaim());
  assert.ok(a.forFactors.length >= 1, "one-off factor composed");
  const dup = a.forFactors.find((f) => f.summary === `${f.basis}.`);
  assert.ok(dup, "a factor exists with summary identical to its basis modulo the period");
  assert.equal(dup.basis, "One buyer reported this");
  // The render decision: this pair renders the sentence once.
  assert.ok(dedupe.sameSentence(dup.summary, dup.basis), "guard suppresses the duplicate basis line");
});

test("R5: factors with a real summary keep both lines", () => {
  const a = ra.deriveReviewAnalysis(resultWithLongOneOffClaim());
  for (const f of a.forFactors) {
    if (f.summary === `${f.basis}.`) continue; // the guarded pair
    assert.ok(!dedupe.sameSentence(f.summary, f.basis), `basis line kept for "${f.title}"`);
  }
});
