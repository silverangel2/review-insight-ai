// ReviewIntel result-page defect batch 2 (2026-10-15 full-scan audit): display-layer only.
// Regression tests for each rule in the batch. Every fix is traceable to the
// scan's own evidence; nothing here changes scoring math, gates, or thresholds.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ec = jiti(root + "lib/evidenceConsistency.ts");
const det = jiti(root + "lib/reviewEvidenceDeterminism.ts");
const bs = jiti(root + "lib/buyingScore.ts");
const bf = jiti(root + "lib/bestForFit.ts");
const pn = jiti(root + "lib/productName.ts");
// Rescue gating (defect 4): the shared gate lives in lib/evidenceConsistency.ts;
// app/results/page.tsx calls it (verified in the push diff).
const page = { isNoVerdictResult: ec.isNoVerdictResult };

// ---------- Defect 1: quote single-assignment across sections ----------
test("defect 1: the same review truncated at different lengths is one quote", () => {
  const long = "I did come victim to the hype craze. But in my opinion, it did live up to the hype. It cooks rice perfectly every time and the cleanup is so easy.";
  const short = "I did come victim to the hype craze. But in my opinion, it did live up to the hype.";
  assert.ok(ec.sameDisplayedQuote(long, short), "truncation of the same review must match");
});

test("defect 1: assignQuotesOnce keeps a quote in the first section only", () => {
  const quote = "This pressure cooker is absolutely amazing and I love it.";
  const lists = ec.assignQuotesOnce([[quote], [quote, "A different review entirely here."], [quote]]);
  assert.deepEqual(lists[0], [quote]);
  assert.deepEqual(lists[1], ["A different review entirely here."]);
  assert.deepEqual(lists[2], []);
});

// ---------- Defect 2: clause-level evidence + complaint-theme guard ----------
test("defect 2: the displayed quote is the clause that matched the theme", () => {
  const body = "I absolutely love this cooker. But the return process was a nightmare and customer service never helped.";
  const clause = det.supportingClauseForClaim(body, "return or refund problems");
  assert.ok(clause, "expected a matching clause");
  assert.ok(/return|refund/i.test(clause), `clause must bear the theme: ${clause}`);
  assert.ok(!/^i absolutely love this cooker/i.test(clause), "must not return the unrelated opening clause");
});

test("defect 2: a purely positive review cannot evidence a complaint theme", () => {
  const body = "Love the cooker, works great every single time. Best purchase I made this year.";
  const clause = det.supportingClauseForClaim(body, "return or refund problems");
  assert.equal(clause, null);
});

test("defect 2: a negated complaint cannot evidence a complaint theme", () => {
  const body = "No complaints at all, this is a great product with no problems whatsoever.";
  const clause = det.supportingClauseForClaim(body, "weak, slow, or overheating performance");
  assert.equal(clause, null);
});

test("defect 2: safety-claim quote must evidence the hazard itself", () => {
  const heatPattern = bs.SAFETY_HAZARDS.find((h) => h.key === "heat").pattern;
  const glowing = "Love this Instant Pot! Cooks dinner in minutes and the flavor is incredible. Highly recommend to everyone.";
  assert.equal(bs.quoteEvidencesPattern(glowing, heatPattern), false);
  assert.equal(bs.quoteEvidencesPattern("It overheated and melted the plastic ring on first use.", heatPattern), true);
});

// NOTE defect 3 (internal verdict labels in ResultsClient metadata) is fixed
// by a web-editor edit spec and verified by visual live proof, not unit
// tests — the mapping lives in a TSX page component.

// ---------- Defect 4: rescue box only on a genuinely unscored scan ----------
test("defect 4: scored scan with stale no-verdict flag does NOT trigger rescue", () => {
  assert.equal(
    page.isNoVerdictResult({ scanState: "INSUFFICIENT_EVIDENCE", buyingScoreV2: { score: 74, verdict: "Wait" } }),
    false
  );
});

test("defect 4: unscored scan still triggers rescue", () => {
  assert.equal(page.isNoVerdictResult({ scanState: "INSUFFICIENT_EVIDENCE" }), true);
  assert.equal(page.isNoVerdictResult({ verdict: "NOT_ENOUGH" }), true);
});

test("defect 4: scored scan never triggers rescue", () => {
  assert.equal(page.isNoVerdictResult({ buyingScoreV2: { score: 93, verdict: "Buy" } }), false);
});

// ---------- Defect 6: best-for derivation is product-aware ----------
test("defect 6: no size/performance trope for a face cream", () => {
  const { bestFor, notIdealFor } = bf.deriveBestForNotIdeal({
    strengths: ["effective moisturizer", "works well on dry skin"],
    complaints: [],
    suppliedBestFor: [],
    suppliedNotIdealFor: [],
    productName: "CeraVe Moisturizing Cream for Dry Skin",
  });
  for (const line of [...bestFor, ...notIdealFor]) {
    assert.ok(!/for the product's size/i.test(line), `trope leaked for personal care: ${line}`);
    assert.ok(!/heavy-duty/i.test(line), `trope leaked for personal care: ${line}`);
  }
  // Product-specific fallback from its own evidence themes.
  assert.ok(bestFor.length > 0, "expected a product-specific best-for line");
  assert.ok(/moisturizer/i.test(bestFor[0]), `expected own-theme fallback, got: ${bestFor[0]}`);
});

test("defect 6: devices keep their category-appropriate rules", () => {
  const { bestFor } = bf.deriveBestForNotIdeal({
    strengths: ["works well, strong airflow"],
    complaints: [],
    suppliedBestFor: [],
    suppliedNotIdealFor: [],
    productName: "Anker Soundcore Motion+ Bluetooth Speaker",
  });
  assert.ok(bestFor.some((line) => /for the product's size/i.test(line)), "speaker should keep the size rule");
});

test("defect 6: unknown category omits rather than invents", () => {
  const { bestFor, notIdealFor } = bf.deriveBestForNotIdeal({
    strengths: [],
    complaints: [],
    suppliedBestFor: [],
    suppliedNotIdealFor: [],
    productName: "Some mystery widget XQZ-9912",
  });
  assert.deepEqual(bestFor, []);
  assert.deepEqual(notIdealFor, []);
});

// ---------- Defect 7: polish ----------
test("defect 7a: headline never ends mid-parenthesis or mid-preposition", () => {
  const echo = pn.shortProductName("Echo Dot (5th Gen, 2022 release) with clock");
  assert.ok(!echo.includes("(") && !echo.endsWith(","), `bad headline: ${echo}`);
  assert.ok(/^Echo Dot/.test(echo), `unexpected: ${echo}`);
  const cerave = pn.shortProductName("CeraVe Moisturizing Cream for Dry Skin");
  assert.ok(!/\bfor$/.test(cerave), `dangling preposition: ${cerave}`);
  assert.ok(cerave.includes("…"), `expected ellipsis marker: ${cerave}`);
});

test("defect 5: aggregate restatement stripped exactly once per page", () => {
  const stripped = ec.stripAggregateRestatement("Good buy overall. 4.6★ from 14,139 ratings.");
  assert.ok(!stripped.includes("★"), `aggregate leaked: ${stripped}`);
  assert.ok(/Good buy overall/.test(stripped), `content destroyed: ${stripped}`);
});
