// ReviewIntel decision-brief build: analysis layer tests.
// Group -> segregate -> summarize as a whole. Never a pasted buyer quote.
// Tests lib/reviewAnalysis.ts (+ lib/analysisCopy.ts, lib/shopperAnswer.ts).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");
const sa = jiti(root + "lib/shopperAnswer.ts");
const copy = jiti(root + "lib/analysisCopy.ts");

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

function openerOfSummary(summary) {
  return summary.split(/\s+/).slice(0, 5).join(" ").toLowerCase();
}

test("for factors: titles composed from theme + basis bands", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  assert.equal(a.forFactors.length, 3);
  assert.equal(a.forFactors[0].title, "Comfortable, lightweight fit");
  assert.equal(a.forFactors[0].basis, "Pattern across most reviews");
  assert.equal(a.forFactors[1].title, "Worth the price");
  assert.equal(a.forFactors[1].basis, "Repeated across reviews");
  assert.equal(a.forFactors[2].basis, "One buyer reported this");
});

test("against factors: RED FLAGS FIRST, then ordinary one-offs", () => {
  const a = ra.deriveReviewAnalysis(BASE);
  assert.equal(a.againstFactors.length, 2);
  // counterfeit is red-flag severity -> sorts first even at count 1
  assert.equal(a.againstFactors[0].title, "Watch the seller, not just the product");
  assert.equal(a.againstFactors[0].severity, "red");
  assert.match(a.againstFactors[0].summary, /red flag/i);
  assert.match(a.againstFactors[0].summary, /one buyer believed the unit received wasn't genuine/);
  assert.equal(a.againstFactors[1].title, "Fit isn't secure for everyone");
  assert.ok(a.againstFactors.every((f) => f.basis === "One buyer reported this"));
  assert.equal(a.complaintsPattern, "one_off");
  assert.equal(a.hasNegatives, true);
});

test("against ordering: red flags, then recurring, then ordinary one-offs", () => {
  const r = airpodsFixture({
    complaints: [
      { claim: "slow shipping", supportCount: 1, sourceIds: [], sourceHashes: [] },
      { claim: "battery life", supportCount: 4, sourceIds: [], sourceHashes: [] },
      { claim: "suspected counterfeit", supportCount: 1, sourceIds: [], sourceHashes: [] },
    ],
  });
  const a = ra.deriveReviewAnalysis(r);
  const titles = a.againstFactors.map((f) => f.title);
  assert.deepEqual(titles, [
    "Watch the seller, not just the product", // red flag first
    "Strong battery life",                    // then recurring
    "Slow shipping",                          // then ordinary one-off
  ]);
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
  // the losing negative is still SAID: caveat clause on the winner (hard rule)
  const forSummary = a.forFactors.find((f) => f.title === "Strong battery life").summary;
  assert.match(forSummary, /the battery drains faster for some/);
  assert.equal(a.hasNegatives, true);
  assert.deepEqual(a.suppressedThemes, ["Strong battery life"]);
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

test("empty complaints, zero negatives anywhere: honest empty state allowed", () => {
  const r = airpodsFixture({ complaints: [] });
  const a = ra.deriveReviewAnalysis(r);
  assert.deepEqual(a.againstFactors, []);
  assert.equal(a.complaintsPattern, "none");
  assert.equal(a.hasNegatives, false);
  assert.deepEqual(a.suppressedThemes, []);
});

test("factors capped at three per side, top counts first", () => {
  const r = airpodsFixture({
    strengths: [1, 2, 3, 4, 5].map((n) => ({ claim: `theme ${n}`, supportCount: n, sourceIds: [], sourceHashes: [] })),
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.forFactors.length, 3);
  assert.equal(a.forFactors[0].title, "Theme 5");
  assert.ok(a.forFactors.every((f) => f.title.length > 0 && f.summary.length > 0));
});

// ---------- PHASE 5: widen the analysis input ----------

test("Phase 5: one-off warning becomes an against-factor with honest framing", () => {
  const r = airpodsFixture({
    complaints: [],
    buyingScoreV2: {
      ...BASE.buyingScoreV2,
      warnings: [{ tier: "single_safety", text: "One customer reported overheating (single unverified report).", quotes: [] }],
      quotes: { safety: [], reliability: [], positive: [], negative: [] },
    },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.againstFactors.length, 1);
  assert.equal(a.againstFactors[0].title, "Overheating reports");
  assert.equal(a.againstFactors[0].summary, "One customer reported overheating (single unverified report).");
  assert.equal(a.againstFactors[0].basis, "One buyer reported this");
  assert.equal(a.hasNegatives, true);
});

test("Phase 5: repeated warning gets the repeated basis", () => {
  const r = airpodsFixture({
    complaints: [],
    buyingScoreV2: {
      ...BASE.buyingScoreV2,
      warnings: [{ tier: "repeated_safety", text: "Several customers independently report overheating.", quotes: [] }],
      quotes: { safety: [], reliability: [], positive: [], negative: [] },
    },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.againstFactors[0].title, "Overheating reports");
  assert.equal(a.againstFactors[0].basis, "Repeated across reviews");
});

test("Phase 5: negative excerpts are keyword-mined, never pasted", () => {
  const excerpt = "I am pretty sure this is a counterfeit, not genuine Apple at all, very disappointed.";
  const r = airpodsFixture({
    complaints: [],
    buyingScoreV2: {
      ...BASE.buyingScoreV2,
      warnings: [],
      quotes: { safety: [], reliability: [], positive: [], negative: [excerpt] },
    },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(a.againstFactors.length >= 1, "against side must not be empty");
  const flag = a.againstFactors.find((f) => f.title === "Watch the seller, not just the product");
  assert.ok(flag, "counterfeit excerpt maps to the counterfeit dimension");
  assert.equal(flag.severity, "red");
  assert.ok(!flag.summary.toLowerCase().includes("pretty sure"), "no verbatim excerpt leakage");
  assert.equal(a.hasNegatives, true);
});

test("Phase 5: unmatched excerpts become one honest generic factor", () => {
  const r = airpodsFixture({
    complaints: [],
    buyingScoreV2: {
      ...BASE.buyingScoreV2,
      warnings: [],
      quotes: { safety: [], reliability: [], positive: [], negative: ["The color is ugly and I hate the way it looks on my desk."] },
    },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.againstFactors.length, 1);
  assert.equal(a.againstFactors[0].title, "A concern raised by one buyer");
  assert.equal(a.againstFactors[0].basis, "One buyer reported this");
});

test("HARD RULE: empty grouped complaints + one-off counterfeit in the wider source -> against NOT empty", () => {
  const r = airpodsFixture({
    complaints: [],
    buyingScoreV2: {
      ...BASE.buyingScoreV2,
      warnings: [],
      quotes: {
        safety: [], reliability: [], positive: [],
        negative: ["This looks like a counterfeit to me, definitely not genuine."],
      },
    },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(a.againstFactors.length >= 1, "a negative signal exists -> against side cannot be empty");
  assert.equal(a.hasNegatives, true);
  assert.equal(a.complaintsPattern, "one_off");
});

// ---------- PHASE 9: depth ----------

const depthBodies = [
  "These are so lightweight I forget I'm wearing them, and the sound is clear with crisp vocals.",
  "Lightweight and comfortable for all-day wear, no ache even after hours of listening.",
  "The sound is clear with crisp vocals, and the bass has real punch.",
  "Calls are clear even on windy streets, the mic is excellent for phone calls.",
  "Sound is clear and balanced, great for music and podcasts.",
  "Battery lasts for days, I only charge the case once a week.",
  "Good value for the price, worth every penny compared to bigger brands.",
  "They stay in my ears during workouts and the sound stays clear.",
  "Comfortable fit overall, very happy with them.",
  "Solid build quality, feels premium in the hand.",
];

function depthFixture(overrides = {}) {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: depthBodies.map((body, i) => ({
          id: `d${i + 1}`, stableEvidenceHash: `dh${i + 1}`, body, sourceUrl: "https://www.amazon.ca/dp/X",
        })),
      },
      commentsAnalyzed: 10,
    },
    strengths: [
      { claim: "comfortable fit", supportCount: 8, sourceIds: ["d1", "d2", "d8", "d9"], sourceHashes: [] },
      { claim: "sound quality", supportCount: 5, sourceIds: ["d1", "d3", "d4", "d5", "d8"], sourceHashes: [] },
      { claim: "good value for the price", supportCount: 2, sourceIds: ["d7"], sourceHashes: [] },
    ],
    complaints: [],
    product: { title: "Test Buds", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2", mode: "written_only", score: 82, verdict: "buy",
      confidence: "Medium", audit: { n: 10, Rbar: 4.3, N: 900 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
    ...overrides,
  };
}

test("Phase 9: supported sub-aspects surface; unsupported ones do not exist in the copy", () => {
  const a = ra.deriveReviewAnalysis(depthFixture());
  const fit = a.forFactors[0];
  assert.equal(fit.title, "Comfortable, lightweight fit");
  // light (d1, d2) and no-ache (d1, d2) meet the >=2 threshold
  assert.ok(
    /feel light|barely-there light/.test(fit.summary),
    `expected a light phrase in: ${fit.summary}`
  );
  assert.ok(
    /don't ache over long listening|stay comfortable through all-day wear/.test(fit.summary),
    `expected a no-ache phrase in: ${fit.summary}`
  );
  // secure has only 1 hit (d8) -> must not appear
  assert.ok(!/stay secure during activity|stay put even during workouts/.test(fit.summary));
});

test("Phase 9: a single mention never surfaces as a sub-aspect", () => {
  const r = depthFixture({
    strengths: [
      { claim: "battery life", supportCount: 10, sourceIds: ["d6", "d9", "d10"], sourceHashes: [] },
    ],
  });
  const a = ra.deriveReviewAnalysis(r);
  const battery = a.forFactors.find((f) => f.title === "Strong battery life");
  assert.ok(battery);
  // only d6 hits "lasts" (1 hit < 2 required) -> no specifics sentence
  assert.ok(!/run for days on a charge|stretch for days between charges/.test(battery.summary));
});

test("Phase 9: co-occurrence pairs the lead theme with its partner", () => {
  const a = ra.deriveReviewAnalysis(depthFixture());
  const fit = a.forFactors[0];
  // d1 and d8 are linked to BOTH fit and sound -> co-occurrence fires
  assert.ok(/clear sound/.test(fit.summary), `expected co-pair clause in: ${fit.summary}`);
});

test("Phase 9: thin corpora get lead + strength only, never padded", () => {
  const thinBodies = depthBodies.slice(0, 5);
  const r = depthFixture({
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: thinBodies.map((body, i) => ({
          id: `t${i + 1}`, stableEvidenceHash: `th${i + 1}`, body, sourceUrl: "https://x",
        })),
      },
      commentsAnalyzed: 5,
    },
    strengths: [
      { claim: "comfortable fit", supportCount: 4, sourceIds: ["t1", "t2"], sourceHashes: [] },
    ],
    buyingScoreV2: { ...depthFixture().buyingScoreV2, audit: { n: 5, Rbar: 4.3, N: 900 } },
  });
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.reviewCount, 5);
  const fit = a.forFactors[0];
  // no "they ..." specifics clause on a thin corpus
  assert.ok(!/\bthey [a-z]/.test(fit.summary), `thin factor must not pad specifics: ${fit.summary}`);
  assert.ok(fit.summary.length > 20);
});

test("Phase 9: unanimity caveat names the opposing signal", () => {
  const r = airpodsFixture({
    strengths: [{ claim: "comfortable fit", supportCount: 8, sourceIds: [], sourceHashes: [] }],
    complaints: [{ claim: "comfortable fit", supportCount: 2, sourceIds: [], sourceHashes: [] }],
  });
  const a = ra.deriveReviewAnalysis(r);
  const fit = a.forFactors.find((f) => f.title === "Comfortable, lightweight fit");
  assert.ok(fit);
  assert.ok(
    fit.summary.includes("the fit feels less secure for some ears"),
    `expected caveat clause in: ${fit.summary}`
  );
});

// ---------- Amendment: huge library, determinism, no-repeat ----------

function thirdFixture() {
  const potBodies = [
    "This pressure cooker is fast, dinner ready in twenty minutes, so quick.",
    "Very fast cooking, consistently dependable week after week.",
    "Easy to use, the controls are simple and intuitive for beginners.",
    "Solid build quality, the steel pot feels premium in the hand.",
    "Great value for the price, worth it against pricier alternatives.",
    "Fast and dependable, I use it every single day.",
    "The quick pressure release is responsive with no lag at all.",
    "Simple straightforward controls, my teenager figured it out.",
    "Well made and sturdy, holds up over months of use.",
    "Good value, does everything I need for the price.",
    "Shipping was slow, took two weeks to arrive.",
    "Customer service never answered my emails about the missing seal.",
  ];
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: potBodies.map((body, i) => ({
          id: `p${i + 1}`, stableEvidenceHash: `ph${i + 1}`, body, sourceUrl: "https://www.amazon.ca/dp/Y",
        })),
      },
      commentsAnalyzed: 12,
    },
    strengths: [
      { claim: "fast or efficient performance", supportCount: 6, sourceIds: ["p1", "p2", "p6", "p7"], sourceHashes: [] },
      { claim: "easy to use", supportCount: 4, sourceIds: ["p3", "p8"], sourceHashes: [] },
      { claim: "build quality", supportCount: 3, sourceIds: ["p4", "p9"], sourceHashes: [] },
    ],
    complaints: [
      { claim: "shipping", supportCount: 2, sourceIds: ["p11"], sourceHashes: [] },
      { claim: "customer service", supportCount: 1, sourceIds: ["p12"], sourceHashes: [] },
    ],
    product: { title: "Test Cooker", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2", mode: "written_only", score: 74, verdict: "buy",
      confidence: "Medium", audit: { n: 12, Rbar: 4.2, N: 1500 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
  };
}

test("Amendment: three different corpora share no identical factor paragraph", () => {
  const corpora = [BASE, depthFixture(), thirdFixture()];
  const all = corpora.map((c) => {
    const a = ra.deriveReviewAnalysis(c);
    return [...a.forFactors, ...a.againstFactors].map((f) => f.summary);
  });
  const seen = new Map();
  all.forEach((summaries, ci) => {
    summaries.forEach((s) => {
      assert.ok(!seen.has(s), `identical paragraph in corpora ${seen.get(s)} and ${ci}: ${s.slice(0, 80)}…`);
      seen.set(s, ci);
    });
  });
});

test("Amendment: repeated render of the same corpus is byte-identical", () => {
  const first = JSON.stringify(ra.deriveReviewAnalysis(depthFixture()));
  const second = JSON.stringify(ra.deriveReviewAnalysis(depthFixture()));
  assert.equal(first, second);
  const third = JSON.stringify(ra.deriveReviewAnalysis(BASE));
  assert.equal(third, JSON.stringify(ra.deriveReviewAnalysis(BASE)));
});

test("Amendment: no two factors on one page start with the same frame", () => {
  for (const fixture of [BASE, depthFixture(), thirdFixture()]) {
    const a = ra.deriveReviewAnalysis(fixture);
    const openers = [...a.forFactors, ...a.againstFactors].map((f) => openerOfSummary(f.summary));
    assert.equal(new Set(openers).size, openers.length, `repeated opener in: ${openers.join(" | ")}`);
  }
});

test("copy deck: pickFrame is deterministic per seed", () => {
  const frames = copy.FOR_LEAD_STRONGEST;
  const a = copy.pickFrame(frames, "seed-1", new Set());
  const b = copy.pickFrame(frames, "seed-1", new Set());
  assert.equal(a, b);
  // de-dupe walk: a used opener is never picked again
  const used = new Set([copy.openerOf(a)]);
  const c = copy.pickFrame(frames, "seed-1", used);
  assert.notEqual(copy.openerOf(c), copy.openerOf(a));
});

// ---------- image + legacy ----------

test("briefImageUrl: real image only, never a placeholder (extended probes)", () => {
  assert.equal(ra.briefImageUrl(BASE, "https://shots.example/x.jpg"), "https://shots.example/x.jpg");
  assert.equal(ra.briefImageUrl(BASE, ""), null);
  assert.equal(
    ra.briefImageUrl({ product: { imageUrl: "https://img.example/p.jpg" } }, ""),
    "https://img.example/p.jpg"
  );
  assert.equal(
    ra.briefImageUrl({ product: { thumbnail: "https://img.example/t.jpg" } }, ""),
    "https://img.example/t.jpg"
  );
  assert.equal(
    ra.briefImageUrl({ reviewEvidence: { listingEvidence: { image: "https://img.example/l.jpg" } } }, ""),
    "https://img.example/l.jpg"
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
