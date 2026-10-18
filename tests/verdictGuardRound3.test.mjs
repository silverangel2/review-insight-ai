import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const { deriveShopperAnswer, sanitizeVerdictWord, shopperVerdictWord } = jiti(root + "lib/shopperAnswer.ts");
const { foldBasisLine, briefFactRows } = jiti(root + "lib/briefNarration.ts");
const { deriveReviewAnalysis } = jiti(root + "lib/reviewAnalysis.ts");

function card(verdict, score = 72) {
  return {
    version: "buying-score-v2",
    mode: "written_only",
    score,
    verdict,
    confidence: "High",
    audit: { n: 12 },
    quotes: { negative: [] },
  };
}

function result(verdict, cardVerdict, extras = {}, score = 72) {
  return {
    verdict,
    buyingScoreV2: card(cardVerdict, score),
    reviewEvidence: { evidenceAdjudication: { acceptedRecords: [] } },
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// 1. Render-boundary guard: only Buy / Wait / Skip can ever display.
// ---------------------------------------------------------------------------

test("sanitizeVerdictWord maps every legacy word to Buy/Wait/Skip", () => {
  assert.equal(sanitizeVerdictWord("Buy"), "Buy");
  assert.equal(sanitizeVerdictWord("Wait"), "Wait");
  assert.equal(sanitizeVerdictWord("Skip"), "Skip");
  assert.equal(sanitizeVerdictWord("Review first"), "Wait");
  assert.equal(sanitizeVerdictWord("REVIEW FIRST"), "Wait");
  assert.equal(sanitizeVerdictWord("Avoid"), "Skip");
  assert.equal(sanitizeVerdictWord("AVOID"), "Skip");
  assert.equal(sanitizeVerdictWord("VERIFIED BUY"), "Buy");
  assert.equal(sanitizeVerdictWord("LEANING BUY"), "Buy");
  assert.equal(sanitizeVerdictWord("DO NOT BUY YET"), "Wait");
  assert.equal(sanitizeVerdictWord("Low confidence"), "Wait");
  assert.equal(sanitizeVerdictWord(""), "Wait");
  assert.equal(sanitizeVerdictWord(null), "Wait");
  assert.equal(sanitizeVerdictWord(undefined), "Wait");
  assert.equal(sanitizeVerdictWord("something unexpected"), "Wait");
});

test("shopperVerdictWord derives Buy/Wait/Skip from kind, null when no verdict", () => {
  // Fixtures below use band-consistent (verdict, score) pairs: a real v2 card
  // welds the word to the score (Buy >= 75, Wait 50-74, Skip < 50), so a
  // "buy" card never carries a 72. The Buy-57 fence re-bands the printed word
  // to the score's band on any mismatch.
  assert.equal(shopperVerdictWord(result("BUY", "buy", {}, 80)), "Buy");
  // Legacy stored "REVIEW FIRST" normalizes to Wait, never renders verbatim.
  assert.equal(shopperVerdictWord(result("REVIEW FIRST", "wait", {}, 72)), "Wait");
  assert.equal(shopperVerdictWord(result("WAIT", "wait", {}, 72)), "Wait");
  assert.equal(shopperVerdictWord(result("AVOID", "skip", {}, 30)), "Skip");
  assert.equal(shopperVerdictWord(result("SKIP", "skip", {}, 30)), "Skip");
  // Thin evidence -> not_enough -> null (surfaces render their empty state).
  const thin = result("WAIT", "wait", {
    buyingScoreV2: { version: "buying-score-v2", mode: "no_score", score: null, verdict: "wait", audit: { n: 0 }, quotes: { negative: [] } },
  });
  assert.equal(shopperVerdictWord(thin), null);
});

test("deriveShopperAnswer label uses only Buy/Wait/Skip for verdicts", () => {
  assert.equal(deriveShopperAnswer(result("BUY", "buy", {}, 80)).label, "Buy");
  assert.equal(deriveShopperAnswer(result("REVIEW FIRST", "wait", {}, 72)).label, "Wait");
  assert.equal(deriveShopperAnswer(result("AVOID", "skip", {}, 30)).label, "Skip");
  // The thin-evidence state is not a verdict — it keeps its own honest
  // "Low confidence" label (never a verdict word, never an internal enum).
  const thin = result("WAIT", "wait", {
    buyingScoreV2: { version: "buying-score-v2", mode: "no_score", score: null, verdict: "wait", audit: { n: 0 }, quotes: { negative: [] } },
  });
  assert.equal(deriveShopperAnswer(thin).label, "Low confidence");
});

// ---------------------------------------------------------------------------
// 2. Aggregate appears exactly once: on the answer card, never in the fold.
// ---------------------------------------------------------------------------

function aggregateResult() {
  const bodies = [
    "This vacuum has strong suction and is easy to empty after use.",
    "Battery life is decent and the attachments work well for stairs.",
    "It is a bit heavy but cleans carpets thoroughly every time.",
    "Good value for the price compared with other brands I tried.",
    "The cord is long enough to reach across my living room.",
  ];
  return {
    verdict: "WAIT",
    buyingScoreV2: card("wait"),
    product: { title: "Shark Navigator Lift-Away Vacuum" },
    reviewEvidence: {
      listingEvidence: { rating: 4.3, reviewCount: 53938 },
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/B00JH98GR4",
        })),
      },
    },
  };
}

test("foldBasisLine never restates the aggregate numbers", () => {
  const line = foldBasisLine(aggregateResult());
  assert.ok(line, "basis line should exist");
  assert.match(line, /marketplace rating/i);
  assert.doesNotMatch(line, /\d/, "no digits allowed in the basis sentence");
  assert.doesNotMatch(line, /53,938|53938/, "rating count must not repeat");
});

test("aggregate numbers still appear exactly once (answer-card fact rows)", () => {
  const rows = briefFactRows(aggregateResult());
  const terms = rows.map((r) => r.term);
  assert.ok(terms.includes("Marketplace rating"), "rating row present");
  assert.ok(terms.includes("Ratings counted"), "count row present");
});

// ---------------------------------------------------------------------------
// 3. Unbacked concern rows are suppressed (named, never hidden).
// ---------------------------------------------------------------------------

function complaintResult(complaints, records) {
  return {
    verdict: "WAIT",
    buyingScoreV2: card("wait"),
    complaints,
    reviewEvidence: { evidenceAdjudication: { acceptedRecords: records } },
  };
}

const realRecord = {
  id: "real-1",
  body: "Great vacuum, powerful suction and easy to empty the dust cup.",
  sourceUrl: "https://www.amazon.ca/dp/B00JH98GR4",
};

test("grouped complaint with stale provenance is suppressed entirely", () => {
  const analysis = deriveReviewAnalysis(
    complaintResult(
      [{ claim: "material safety warnings", supportCount: 1, sourceIds: ["ghost-1"], sourceHashes: [], sourceUrls: [] }],
      [realRecord]
    )
  );
  // R3 (restored): unevidenced claims never print and never count — the
  // "no buyer complaints" empty state stays honest.
  assert.equal(analysis.againstFactors.length, 0, "unbacked row suppressed");
  assert.equal(analysis.hasNegatives, false, "unevidenced warnings do not count as negatives");
  assert.ok(
    !analysis.suppressedThemes.includes("Material safety warnings"),
    "unevidenced claim is not named either"
  );
});

test("grouped complaint with resolving provenance still renders", () => {
  const analysis = deriveReviewAnalysis(
    complaintResult(
      [{ claim: "material safety warnings", supportCount: 1, sourceIds: ["real-1"], sourceHashes: [], sourceUrls: [] }],
      [realRecord]
    )
  );
  const titles = analysis.againstFactors.map((f) => f.title);
  assert.ok(titles.includes("Material safety warnings"), "backed row renders");
});

test("vacuous __generic_concern rows never render", () => {
  const r = complaintResult([], [realRecord]);
  r.buyingScoreV2.quotes = { negative: ["the whirligig made a weird wobbling noise"] };
  const analysis = deriveReviewAnalysis(r);
  const titles = analysis.againstFactors.map((f) => f.title);
  assert.ok(!titles.includes("A complaint several buyers raise"), "generic row suppressed");
  assert.ok(!titles.includes("A concern raised by one buyer"), "generic row suppressed");
  // The real excerpt still counts as evidence that buyers raised concerns.
  assert.equal(analysis.hasNegatives, true, "evidenced complaints still register");
});
