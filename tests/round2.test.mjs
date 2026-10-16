// Round-2 shopper display fixes — fixture-driven tests.
// Defect 1: ONE verdict derivation (Buy / Review first / Avoid) everywhere.
// Defect 2: no garbled template sentences in "How we checked".
// Defect 3: warnings render only with accepted-corpus backing.
// Defect 4: theme evidence hygiene (exact-product, no echo quotes, corpus vocabulary).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const shopperAnswer = jiti(root + "lib/shopperAnswer.ts");
const reviewAnalysis = jiti(root + "lib/reviewAnalysis.ts");
const buyingScore = jiti(root + "lib/buyingScore.ts");

const { deriveShopperAnswer, shopperVerdictWord, realReviewQuotes } = shopperAnswer;
const { deriveReviewAnalysis, mineScoreComplaints } = reviewAnalysis;
const { computeBuyingScore } = buyingScore;

// ---------------------------------------------------------------- fixtures
function acceptedRecordsFixture(bodies, extra = {}) {
  return bodies.map((body, i) => ({
    id: `r${i + 1}`,
    stableEvidenceHash: `h${i + 1}`,
    body,
    sourceUrl: "https://www.amazon.com/dp/B00TEST",
    exactProductAccepted: true,
    ...extra,
  }));
}

function shopperResult({ verdictWord, records, strengths = [], complaints = [] }) {
  return {
    verdict: verdictWord,
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records, rejectedRecords: [] },
    },
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "full",
      score: 80,
      verdict: verdictWord,
      confidence: "High",
      audit: { n: records.length },
    },
    strengthProvenance: strengths,
    complaintProvenance: complaints,
  };
}

const MOUSE_BODIES = [
  "The mouse fits my hand well and the clicks feel crisp and responsive.",
  "Battery lasts for weeks of daily office work, really happy with it.",
  "The scroll wheel is smooth and the side buttons are handy for browsing.",
  "Comfortable fit for long work days, no wrist strain at all.",
  "Great value for the price, works well on any surface I tried.",
];

// ================================================================ Defect 1
test("defect 1: shopperVerdictWord maps kind -> the single verdict vocabulary", () => {
  const cases = [
    ["Buy", "Buy"],
    ["Skip", "Avoid"],
    ["Wait", "Review first"],
  ];
  for (const [cardVerdict, word] of cases) {
    const result = shopperResult({
      verdictWord: cardVerdict,
      records: acceptedRecordsFixture(MOUSE_BODIES),
    });
    assert.equal(shopperVerdictWord(result), word, `verdict ${cardVerdict}`);
    assert.equal(deriveShopperAnswer(result).label, word, `label ${cardVerdict}`);
  }
});

test("defect 1: not_enough evidence yields no verdict word", () => {
  const result = shopperResult({ verdictWord: "NOT_ENOUGH", records: [] });
  assert.equal(shopperVerdictWord(result), null);
});

test("defect 1: displayShopperVerdict (ResultsClient) uses the same three words", () => {
  const src = readFileSync("components/ResultsClient.tsx", "utf8");
  const m = src.match(/function displayShopperVerdict\(value: unknown\) \{[\s\S]*?\n\}/);
  assert.ok(m, "displayShopperVerdict found in ResultsClient.tsx");
  const displayShopperVerdict = new Function(`${m[0].replace("(value: unknown)", "(value)")}; return displayShopperVerdict;`)();
  const expected = {
    BUY: "Buy",
    "VERIFIED BUY": "Buy",
    "REVIEW FIRST": "Review first",
    WAIT: "Review first",
    CONSIDER: "Review first",
    MAYBE: "Review first",
    "DO NOT BUY YET": "Review first",
    AVOID: "Avoid",
    SKIP: "Avoid",
    "LEANING BUY": "Buy",
    "LEANING WAIT": "Review first",
    "LEANING SKIP": "Avoid",
    NOT_ENOUGH: "Low confidence",
    "": "Low confidence",
  };
  for (const [input, word] of Object.entries(expected)) {
    assert.equal(displayShopperVerdict(input), word, `input "${input}"`);
  }
  // No legacy parallel words survive.
  assert.ok(!src.includes('return "Wait"'), "no legacy Wait word");
  assert.ok(!src.includes('return "Skip"'), "no legacy Skip word");
  assert.ok(!src.includes("buyingScoreV2.verdict.toUpperCase()"), "no raw verdict render");
});

test("defect 1: DecisionBrief headline verdict comes from shopperVerdictWord", () => {
  const src = readFileSync("components/DecisionBrief.tsx", "utf8");
  assert.ok(src.includes("shopperVerdictWord(result)"), "brief uses the single derivation");
  assert.ok(!src.includes('answer.kind === "buy"'), "no parallel kind ternary");
});

// ================================================================ Defect 2
test("defect 2: garbled 'never reads' sentence is gone; plain-English fold remains", () => {
  const src = readFileSync("components/DecisionBrief.tsx", "utf8");
  assert.ok(!src.includes("never reads"), "garbled sentence removed");
  assert.ok(
    src.includes("Only real written reviews and the marketplace rating feed the score."),
    "plain-English sentence present"
  );
});

test("defect 2: old-stack fold has no 'never reads' template garbage", () => {
  const src = readFileSync("components/ResultsClient.tsx", "utf8");
  assert.ok(!src.includes("never reads"), "old stack clean");
});

// ================================================================ Defect 3
function scoreSignals(overrides = {}) {
  return {
    rating: 4.2,
    ratingCount: 1200,
    n: 10,
    meanSentiment: 0.4,
    visibleMeanStars: 4.2,
    rel: 0,
    relSameTheme: 0,
    saf: 0,
    safSameHazard: 0,
    min: 0,
    themes: 0,
    quotes: { safety: [], reliability: [], positive: [], negative: [] },
    ...overrides,
  };
}

test("defect 3: safety warning with zero backing quotes does not print (cap kept)", () => {
  const result = computeBuyingScore(
    scoreSignals({ saf: 1, safSameHazard: 2, safHazard: "overheating", quotes: { safety: [], reliability: [], positive: [], negative: [] } })
  );
  assert.equal(result.warnings.length, 0, "unbacked warning withheld");
  assert.ok(result.audit.capsApplied.includes("repeated_safety"), "score cap still reflects the signal");
});

test("defect 3: safety warning with backing quotes still prints", () => {
  const result = computeBuyingScore(
    scoreSignals({
      saf: 1,
      safSameHazard: 2,
      safHazard: "overheating",
      quotes: { safety: ["It got hot enough to smell plastic."], reliability: [], positive: [], negative: [] },
    })
  );
  const warning = result.warnings.find((w) => w.tier === "repeated_safety");
  assert.ok(warning, "backed warning present");
  assert.ok(warning.text.includes("overheating"));
  assert.equal(warning.quotes.length, 1);
});

test("defect 3: reliability warning with zero backing quotes does not print", () => {
  const result = computeBuyingScore(
    scoreSignals({ rel: 1, relSameTheme: 2, relTheme: "the battery dying", quotes: { safety: [], reliability: [], positive: [], negative: [] } })
  );
  assert.equal(
    result.warnings.filter((w) => w.tier === "repeated_reliability").length,
    0,
    "unbacked reliability warning withheld"
  );
  assert.ok(result.audit.capsApplied.includes("repeated_reliability"), "cap kept");
});

test("defect 3: mined warning without corpus backing is dropped at the source", () => {
  const result = shopperResult({ verdictWord: "Wait", records: acceptedRecordsFixture(MOUSE_BODIES) });
  result.buyingScoreV2.warnings = [
    { tier: "repeated_safety", text: "Several customers independently report overheating.", quotes: [] },
  ];
  const mined = mineScoreComplaints(result);
  assert.equal(mined.length, 0, "warning whose hazard no accepted review says is dropped");
  const analysis = deriveReviewAnalysis(result);
  const hasHazard = [...(analysis.against || []), ...(analysis.flags || [])].some((s) =>
    String(s.text || s.fixedSummary || "").toLowerCase().includes("overheat")
  );
  assert.equal(hasHazard, false, "nothing about overheating reaches the brief");
});

test("defect 3: paraphrased hazard language still counts as backing", () => {
  // The scorer labels "too hot to touch" as the "overheating" hazard; the mining
  // check must use the same pattern, not the literal label word.
  const bodies = [
    ...MOUSE_BODIES,
    "After an hour it got too hot to touch, I had to put it down.",
    "It was scorching near the battery after long use.",
  ];
  const result = shopperResult({ verdictWord: "Wait", records: acceptedRecordsFixture(bodies) });
  result.buyingScoreV2.warnings = [
    { tier: "repeated_safety", text: "Several customers independently report overheating.", quotes: [] },
  ];
  const mined = mineScoreComplaints(result);
  assert.equal(mined.length, 1, "paraphrased backing keeps the warning");
});

test("defect 3: mined warning WITH corpus backing is kept", () => {
  const bodies = [
    ...MOUSE_BODIES,
    "The mouse started overheating after an hour of use, it was uncomfortably hot.",
    "It gets worryingly hot near the battery compartment during long sessions.",
  ];
  const result = shopperResult({ verdictWord: "Wait", records: acceptedRecordsFixture(bodies) });
  result.buyingScoreV2.warnings = [
    { tier: "repeated_safety", text: "Several customers independently report overheating.", quotes: [] },
  ];
  const mined = mineScoreComplaints(result);
  assert.equal(mined.length, 1, "backed warning survives");
  assert.ok(mined[0].count >= 1);
});

// ================================================================ Defect 4
test("defect 4a: a quote that merely echoes the theme heading is not rendered", () => {
  const records = acceptedRecordsFixture([
    "Comfortable fit. Comfortable fit indeed, very comfortable fit for me.",
    "Comfortable fit for long work days, no wrist strain at all, and the battery lasts weeks.",
  ]);
  const result = shopperResult({
    verdictWord: "Buy",
    records,
    strengths: [{ claim: "comfortable fit", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: ["h1", "h2"], sourceUrls: [] }],
  });
  const answer = deriveShopperAnswer(result);
  const point = answer.loves.find((p) => p.claim === "comfortable fit");
  assert.ok(point, "theme claim present");
  if (point.quote) {
    const stop = new Set("a,an,the,and,for,with".split(","));
    const claimWords = new Set("comfortable fit".split(" ").filter((w) => !stop.has(w)));
    const quoteWords = point.quote.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !stop.has(w));
    const allEcho = quoteWords.length > 0 && quoteWords.every((w) => claimWords.has(w));
    assert.equal(allEcho, false, `quote must add words beyond the heading, got: "${point.quote}"`);
  }
});

test("defect 4b: a record that failed the exact-product match is never quoted", () => {
  const records = acceptedRecordsFixture([
    "This Genius 8000 toothbrush is amazing, best electric brush I ever owned.",
    "Great value for the price, works well on any surface I tried.",
  ]);
  records[0].exactProductAccepted = false; // different model slipped through adjudication
  const result = shopperResult({
    verdictWord: "Buy",
    records,
    strengths: [{ claim: "good value for the price", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: ["h1", "h2"], sourceUrls: [] }],
  });
  const answer = deriveShopperAnswer(result);
  for (const point of [...answer.loves, ...answer.complaints]) {
    assert.ok(!String(point.quote || "").toLowerCase().includes("genius"), "no cross-model quote");
  }
  assert.ok(!realReviewQuotes(result).some((q) => q.toLowerCase().includes("genius")), "realReviewQuotes excludes it too");
});

test("defect 4c: a body that supports nothing is never quoted as theme evidence", () => {
  // A ruled theme ("long battery life" has a claim rule) whose attributed bodies
  // mention nothing the rule recognizes: the claim still renders (red-flag rule:
  // never hide), but no body is misquoted as its evidence.
  const records = acceptedRecordsFixture([
    "I use it for long listening sessions every evening, very relaxing.",
    "Long listening on the couch is my favorite way to unwind.",
  ]);
  const result = shopperResult({
    verdictWord: "Buy",
    records,
    strengths: [
      { claim: "long battery life", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: ["h1", "h2"], sourceUrls: [] },
    ],
  });
  const answer = deriveShopperAnswer(result);
  const point = answer.loves.find((p) => p.claim === "long battery life");
  assert.ok(point, "theme claim still renders (never hidden)");
  assert.equal(point.quote, null, "no body misquoted as evidence for the theme");
});

test("defect 4c: rule-matched clauses still render as evidence", () => {
  const records = acceptedRecordsFixture([
    "The battery lasts for weeks of daily office work, really happy with it.",
  ]);
  const result = shopperResult({
    verdictWord: "Buy",
    records,
    strengths: [
      { claim: "long battery life", supportCount: 1, sourceIds: ["r1"], sourceHashes: ["h1"], sourceUrls: [] },
    ],
  });
  const answer = deriveShopperAnswer(result);
  const point = answer.loves.find((p) => p.claim === "long battery life");
  assert.ok(point && point.quote, "supporting clause renders");
  assert.ok(point.quote.toLowerCase().includes("battery"), "quote supports the theme");
});

test("defect 4: brief path renders zero buyer quotes anywhere", () => {
  const result = shopperResult({ verdictWord: "Buy", records: acceptedRecordsFixture(MOUSE_BODIES) });
  const analysis = deriveReviewAnalysis(result);
  const texts = [];
  for (const section of ["for", "against", "flags", "whyNot"]) {
    for (const s of analysis[section] || []) texts.push(String(s.text || ""), String(s.fixedSummary || ""));
  }
  for (const t of texts) {
    assert.ok(!t.includes('"'), `brief text never quotes buyers: ${t.slice(0, 80)}`);
  }
});
