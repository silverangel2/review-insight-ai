// RI result-page satisfaction pass (2026-10-16) tests.
// Defect 1: no fact row without a computable value (no dashes, no "Unknown").
// Defect 2: the fold tells one story - basis + limits + honesty; a verdict
// carried by a marketplace aggregate is never narrated as weak.
// Defect 3: forensics honesty - specificity cannot fire below MIN_CORPUS;
// the fold carries the plain honesty line.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const narr = jiti(root + "lib/briefNarration.ts");
const ai = jiti(root + "lib/aiPatternForensics.ts");

const realBodies = [
  "Sound is clear and they pair fast with my phone. Battery gets me through the workday.",
  "Comfortable enough to wear for hours, and calls sound fine on both ends.",
  "Bought these for the gym. They stay in and the case charges quickly.",
  "Not bad for the price. The mic picks up wind noise on calls outside.",
  "Fit is better than my old earbuds but the left one slips when I sweat.",
  "Great value compared to the big brands, does everything I need daily.",
  "Setup took two minutes. My laptop found them immediately.",
  "Case feels a bit light but charges both buds fully twice over.",
  "The bass is stronger than I expected at this price point.",
  "They work fine for video calls, though the range is short through walls.",
  "Second pair I have bought, the first went through the wash and still worked for months.",
  "Decent sound, comfortable, battery lasts about five hours on a charge.",
  "Pairing drops sometimes when I walk away from my desk with my phone in my pocket.",
  "Bought for my teenager who loses everything; cheap enough not to hurt when they do.",
  "The touch controls are too sensitive, I pause music adjusting the fit.",
  "Good for podcasts, voices are clear and they don't hurt my ears.",
  "Charged to full in about an hour from empty in the case.",
  "Sound quality is fine, nothing amazing, but reliable day to day.",
  "They connect to two devices which is handy for work and home.",
  "The case hinge feels loose after three months but still closes fine.",
];

function rec(body, i, url) {
  return { id: `r${i}`, stableEvidenceHash: `h${i}`, body, sourceUrl: url };
}

/** v2-style scored result, shaped like the real blanket scan. */
function v2Fixture(overrides = {}) {
  return {
    analysisVersion: "review-evidence-v2",
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: realBodies.map((b, i) => rec(b, i, "https://www.amazon.ca/dp/B07WXQ3GVS")),
      },
      listingEvidence: { rating: 4.3, reviewCount: 9805, exactListingUrl: "https://www.amazon.ca/dp/B07WXQ3GVS" },
      commentsAnalyzed: 20,
    },
    product: { title: "Weighted Idea Weighted Blanket", store: "Amazon.ca" },
    valueForMoney: "Good",
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "written_only",
      score: 83,
      verdict: "buy",
      confidence: "Medium",
      audit: { n: 20, Rbar: 4.3, N: 9805 },
    },
    ...overrides,
  };
}

// ---------- Defect 1: no-dash fact rows ----------

test("no-dash: missing value-for-money omits the row", () => {
  const rows = narr.briefFactRows(v2Fixture({ valueForMoney: undefined }));
  assert.ok(!rows.some((r) => r.term === "Value for money"), "row must be absent");
  for (const r of rows) {
    const v = "text" in r ? r.text : "rating" in r ? String(r.rating) : String(r.count);
    assert.ok(!v.includes("—") && v !== "Unknown", `no dash/unknown in ${r.term}: ${v}`);
  }
});

test("no-dash: missing aggregate omits rating + count rows", () => {
  const f = v2Fixture();
  f.reviewEvidence.listingEvidence = { rating: null, reviewCount: null };
  const rows = narr.briefFactRows(f);
  assert.ok(!rows.some((r) => r.term === "Marketplace rating"));
  assert.ok(!rows.some((r) => r.term === "Ratings counted"));
});

test("no-dash: tiny corpus omits authenticity row and keeps no dashes", () => {
  const f = v2Fixture();
  f.reviewEvidence.evidenceAdjudication.acceptedRecords = realBodies.slice(0, 2).map((b, i) => rec(b, i, "https://www.amazon.ca/dp/B07WXQ3GVS"));
  const rows = narr.briefFactRows(f);
  assert.ok(!rows.some((r) => r.term === "Review authenticity"), "row must be absent when corpus too small");
  for (const r of rows) {
    const v = "text" in r ? r.text : "rating" in r ? String(r.rating) : String(r.count);
    assert.ok(!v.includes("—") && v !== "Unknown", `no dash/unknown in ${r.term}`);
  }
});

test("full fixture renders all five rows in order", () => {
  const terms = narr.briefFactRows(v2Fixture()).map((r) => r.term);
  assert.deepEqual(terms, [
    "Marketplace rating",
    "Ratings counted",
    "How sure we are",
    "Value for money",
    "Review authenticity",
  ]);
});

// ---------- Defect 2: one-story confidence narration ----------

test("aggregate-backed verdict is narrated as backed, never weak", () => {
  const line = narr.foldBasisLine(v2Fixture());
  assert.ok(line, "basis line must exist");
  assert.match(line, /4\.3-star/, "names the aggregate rating");
  assert.match(line, /9,805 ratings/, "names the aggregate count (allowed)");
  assert.match(line, /written reviews we read/, "names the written corpus in words");
  assert.ok(!/\bLow\b|\bweak\b|not corroborated/i.test(line), "never weak language");
});

test("fold narration contains no weak/unbacked language anywhere", () => {
  const text = narr.foldNarration(v2Fixture()).join(" ");
  assert.ok(!/Evidence strength|Low\b|weak|not corroborated/i.test(text), `fold argues with nothing: ${text}`);
  assert.ok(/Only real written reviews and the marketplace rating feed the score/.test(text), "trust line kept");
});

test("single-store limit is plain information, not an argument", () => {
  const line = narr.foldLimitsLine(v2Fixture());
  assert.ok(line, "limits line must exist for single-source");
  assert.match(line, /Amazon\.ca/, "names the store plainly");
  assert.ok(!/corroborat|insufficient|weak/i.test(line), "no arguing vocabulary");
});

test("written depth is words only, never a count", () => {
  assert.equal(narr.writtenDepthWord(v2Fixture()), "a solid set of");
  const f = v2Fixture();
  f.reviewEvidence.evidenceAdjudication.acceptedRecords = realBodies.slice(0, 6).map((b, i) => rec(b, i, "https://www.amazon.ca/dp/B07WXQ3GVS"));
  assert.equal(narr.writtenDepthWord(f), "a few");
  const f2 = v2Fixture();
  f2.reviewEvidence.evidenceAdjudication.acceptedRecords = realBodies.slice(0, 2).map((b, i) => rec(b, i, "https://www.amazon.ca/dp/B07WXQ3GVS"));
  assert.equal(narr.writtenDepthWord(f2), null);
});

test("basis line is deterministic across renders", () => {
  const f = v2Fixture();
  assert.equal(narr.foldBasisLine(f), narr.foldBasisLine(v2Fixture()));
});

test("aggregate-only result still gets a basis line", () => {
  const f = v2Fixture();
  f.reviewEvidence.evidenceAdjudication.acceptedRecords = [];
  const line = narr.foldBasisLine(f);
  assert.ok(line && /4\.3-star/.test(line), "aggregate carries the story");
  assert.ok(!/written reviews we read/.test(line), "no written claim when none read");
});

// ---------- Defect 3: forensics honesty ----------

const fx = (bodies) => ({
  reviewEvidence: {
    evidenceAdjudication: {
      acceptedRecords: bodies.map((body, i) => ({ id: `r${i}`, stableEvidenceHash: `h${i}`, body })),
    },
  },
});

test("specificity cannot fire below the minimum corpus size", () => {
  const tinySpecific = [
    "Works great, love it so much.",
    "Does the job perfectly, very happy.",
    "Exactly what I needed, five stars.",
    "Good purchase, would buy again.",
    "No complaints at all, works fine.",
    "Really happy with this one.",
    "Solid product, arrived on time.",
  ];
  const p = ai.analyzeAiPatterns(fx(tinySpecific));
  const spec = p.features.find((f) => f.key === "specificity");
  assert.equal(spec.points, 0, "specificity must not fire at n=7");
  assert.equal(p.grade, "low");
});

test("templated corpus still flags", () => {
  const templated = Array.from({ length: 14 }, (_, i) => [
    "Great product! I am very happy with this purchase. The quality is amazing and it works perfectly. I recommend this product to everyone. Five stars!",
    "Excellent product! I am very happy with this purchase. The quality is amazing and it works perfectly. I recommend this product to everyone. Five stars!",
    "Amazing product! I am very happy with this purchase. The quality is amazing and it works perfectly. I recommend this product to everyone. Five stars!",
  ][i % 3]);
  const p = ai.analyzeAiPatterns(fx(templated));
  assert.equal(p.grade, "high");
  assert.ok(p.points >= 5);
});

test("auth honesty line is plain and only on judged corpora", () => {
  const judged = ai.analyzeAiPatterns(fx(realBodies));
  const line = ai.authHonestyLine(judged);
  assert.ok(line, "honesty line must exist");
  assert.match(line, /can't prove who wrote/, "plain honesty wording");
  const insufficient = ai.analyzeAiPatterns(fx(realBodies.slice(0, 2)));
  assert.equal(ai.authHonestyLine(insufficient), null, "no faked line when too small");
});

test("fold auth lines pair the sentence with the honesty note", () => {
  const lines = narr.foldAuthLines(v2Fixture());
  assert.equal(lines.length, 2);
  assert.match(lines[1], /can't prove who wrote/);
  const f = v2Fixture();
  f.reviewEvidence.evidenceAdjudication.acceptedRecords = [];
  assert.deepEqual(narr.foldAuthLines(f), [], "no auth lines without a judged corpus");
});
