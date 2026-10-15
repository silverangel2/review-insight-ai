// ReviewIntel decision-brief build (2026-10-15): the analysis layer.
// Group -> segregate -> summarize as a whole. Never a pasted buyer quote.
// Tests the real lib/reviewAnalysis.ts (+ the new shopperAnswer export).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");
const sa = jiti(root + "lib/shopperAnswer.ts");

// ---------- Fixture shaped like the REAL AirPods result ----------
const bodies = [
  "Love these AirPods! The sound quality is clear, they're lightweight and comfortable, and they connect to my iPhone very quickly.",
  "I bought the Apple AirPods 4 Wireless Earbuds for my teenager, and they absolutely love them!",
  "When ya gotta have em, you gotta have em. These pair well with Apple products as you'd expect.",
  "Great sound and easy setup. Using them every day for work calls.",
  "Battery lasts me all day at the office, no complaints at all.",
  "Comfortable enough to forget I'm wearing them during long walks.",
  "Bought a second pair for my wife after trying mine for a week.",
  "The case charges fast and the fit is much better than my old pair.",
  "Sound is crisp and calls are clear even on windy streets.",
  "Good value compared to the Pro model, does everything I need.",
  "They're great for everyday use, but I found them a little uncomfortable and not secure enough in my ears.",
  "Extremement decue de cet achat. Je croyais acheter de veritables AirPods Apple.",
];

function airpodsFixture(overrides = {}) {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i + 1}`,
          stableEvidenceHash: `h${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
        })),
      },
      commentsAnalyzed: 12,
      listingEvidence: { rating: 4.4, reviewCount: 2345 },
    },
    strengths: [
      { claim: "comfortable fit", supportCount: 8, sourceIds: [], sourceHashes: [] },
      { claim: "good value for the price", supportCount: 3, sourceIds: [], sourceHashes: [] },
      { claim: "fast or efficient performance (one-off report)", supportCount: 1, sourceIds: [], sourceHashes: [] },
      { claim: "works well or performs as expected (one-off report)", supportCount: 1, sourceIds: [], sourceHashes: [] },
    ],
    complaints: [
      { claim: "fit not secure (one-off report)", supportCount: 1, sourceIds: [], sourceHashes: [] },
      { claim: "suspected counterfeit (one-off report)", supportCount: 1, sourceIds: [], sourceHashes: [] },
    ],
    product: { title: "Apple AirPods 4 Wireless", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2", mode: "written_only", score: 87, verdict: "buy",
      confidence: "Medium", audit: { n: 12, Rbar: 4.4, N: 2345 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
    ...overrides,
  };
}

const BASE = airpodsFixture();

test("for factors: titles composed from theme + basis bands", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  assert.equal(a.forFactors.length, 3);
  assert.equal(a.forFactors[0].title, "Comfortable, lightweight fit");
  assert.equal(a.forFactors[0].basis, "Pattern across most reviews");
  assert.equal(a.forFactors[1].title, "Worth the price");
  assert.equal(a.forFactors[1].basis, "Repeated across reviews");
  assert.equal(a.forFactors[2].basis, "One buyer reported this");
});

test("against factors: one-off concerns with honest framing", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  assert.equal(a.againstFactors.length, 2);
  assert.equal(a.againstFactors[0].title, "Fit isn't secure for everyone");
  assert.equal(a.againstFactors[1].title, "Watch the seller, not just the product");
  assert.ok(a.againstFactors.every((f) => f.basis === "One buyer reported this"));
  assert.equal(a.complaintsPattern, "one_off");
});

test("one-off parentheticals never reach shoppers", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  for (const f of [...a.forFactors, ...a.againstFactors]) {
    assert.ok(!/one-off/i.test(f.title), `title leaked: ${f.title}`);
    assert.ok(!/one-off/i.test(f.summary), `summary leaked: ${f.summary}`);
  }
});

test("no markdown survives in factor text (defect discipline)", () => {
  const r = airpodsFixture({ strengths: [{ claim: "**comfortable fit**", supportCount: 6, sourceIds: [], sourceHashes: [] }] });
  const a = ra.deriveReviewAnalysis(r);
  for (const f of a.forFactors) {
    assert.ok(!/\*/.test(f.title), f.title);
    assert.ok(!/\*/.test(f.summary), f.summary);
  }
});

test("NO quote text leakage: no summary contains any review sentence", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  const summaries = [...a.forFactors, ...a.againstFactors].map((f) => f.summary.toLowerCase());
  for (const body of bodies) {
    const snippet = body.slice(0, 40).toLowerCase();
    for (const s of summaries) {
      assert.ok(!s.includes(snippet), `summary contains review text: ${snippet}`);
    }
  }
});

test("split theme: higher support count wins, theme appears once", () => {
  const r = airpodsFixture({
    strengths: [{ claim: "battery life", supportCount: 5, sourceIds: [], sourceHashes: [] }],
    complaints: [{ claim: "battery life", supportCount: 1, sourceIds: [], sourceHashes: [] }],
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(a.forFactors.some((f) => f.title === "Strong battery life"));
  assert.ok(!a.againstFactors.some((f) => f.title === "Strong battery life"));
});

test("split theme: complaints win when they dominate", () => {
  const r = airpodsFixture({
    strengths: [{ claim: "battery life", supportCount: 1, sourceIds: [], sourceHashes: [] }],
    complaints: [{ claim: "battery life", supportCount: 6, sourceIds: [], sourceHashes: [] }],
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(!a.forFactors.some((f) => f.title === "Strong battery life"));
  assert.ok(a.againstFactors.some((f) => f.title === "Strong battery life"));
  assert.equal(a.complaintsPattern, "recurring");
});

test("empty complaints: honest pattern, no factors", () => {
  const r = airpodsFixture({ complaints: [] });
  const a = ra.deriveReviewAnalysis(r);
  assert.deepEqual(a.againstFactors, []);
  assert.equal(a.complaintsPattern, "none");
});

test("factors capped at three per side, top counts first", () => {
  const r = airpodsFixture({
    strengths: [1, 2, 3, 4, 5].map((n) => ({ claim: `theme ${n}`, supportCount: n, sourceIds: [], sourceHashes: [] })),
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.forFactors.length, 3);
  assert.equal(a.forFactors[0].title, "Theme 5");
  // unmapped themes fall back to band templates, never empty text
  assert.ok(a.forFactors.every((f) => f.title.length > 0 && f.summary.length > 0));
});

test("briefImageUrl: real image only, never a placeholder", () => {
  assert.equal(ra.briefImageUrl(BASE, "https://shots.example/x.jpg"), "https://shots.example/x.jpg");
  assert.equal(ra.briefImageUrl(BASE, ""), null);
  assert.equal(
    ra.briefImageUrl({ product: { imageUrl: "https://img.example/p.jpg" } }, ""),
    "https://img.example/p.jpg"
  );
  assert.equal(ra.briefImageUrl({ product: {} }, ""), null);
});

test("aiLikeSignsFor: reads the score when present, null otherwise", () => {
  assert.equal(
    ra.aiLikeSignsFor({ reviewEvidence: { reviewAuthenticity: { score: 15 } } }),
    "15% signs · Low"
  );
  assert.equal(ra.aiLikeSignsFor(BASE), null);
});

test("marketplaceAggregateNumbers: same precedence as the display helper", () => {
  const agg = sa.marketplaceAggregateNumbers(BASE);
  assert.equal(agg.rating, 4.4);
  assert.equal(agg.count, 2345);
  const fallback = sa.marketplaceAggregateNumbers({ product: { rating: 3.5, reviewCount: 100 } });
  assert.equal(fallback.rating, 3.5);
  assert.equal(fallback.count, 100);
  assert.deepEqual(sa.marketplaceAggregateNumbers({}), { rating: null, count: null });
});
