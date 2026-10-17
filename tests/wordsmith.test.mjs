// The Wordsmith: evidence-vocabulary mining for the decision brief.
// Junel 2026-10-16: the scan's sentences must be built from the buyers' REAL
// vocabulary — specific things buyers actually named — never generic filler,
// never invented detail, never a pasted buyer sentence.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");
const ws = jiti(root + "lib/wordsmith.ts");

const records = (bodies, prefix = "r") =>
  bodies.map((body, i) => ({
    id: `${prefix}${i + 1}`,
    stableEvidenceHash: `${prefix}h${i + 1}`,
    body,
    sourceUrl: "https://www.amazon.ca/dp/TESTWORDSMITH",
  }));
const ids = (n, prefix = "r") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

const BUYER_WORDS_SENTENCE =
  /that's what buyers keep naming|in the reviewers' own specifics|the detail that keeps coming up|what buyers name, again and again|the recurring detail across reviews/i;
const BUYER_WORDS_SINGLE_SENTENCE = /that's what the one buyer named|described in that review as|that buyer got specific/i;

// ---------- Rich corpus: repeated specifics must surface, nothing invented ----------
const richBodies = [
  "Battery life is fantastic, it lasts for days on a single charge and the quick pairing with my phone is instant.",
  "The quick pairing works every time and the battery lasts days, easily the best battery life I have had.",
  "Lasts for days between charges. The quick pairing with my phone took seconds.",
  "Great battery life, lasts days. The windy street calls come through clear which surprised me.",
  "Battery lasts for days on a charge, quick pairing every time I open the case.",
  "I get days of use between charges and the quick pairing never fails.",
  "Days of battery life here, plus the windy street calls are crystal clear on my commute.",
  "Charge lasts for days, quick pairing works flawlessly, windy street calls sound great.",
];

function richFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(richBodies) },
      commentsAnalyzed: 8,
      listingEvidence: { rating: 4.5, reviewCount: 1200 },
    },
    // Hotfix 2026-10-16: real inputs carry the listing title; the wordsmith
    // requires it (title-token filter). Fixtures must model that.
    product: { title: "Apple AirPods 4 Wireless Earbuds", store: "amazon.ca" },
    strengths: [{ claim: "battery life", supportCount: 6, sourceIds: ids(8), sourceHashes: [] }],
    complaints: [],
  };
}

// Hotfix 2 2026-10-16 (wordsmith OFF at the compose seam): flipped from the
// original model. Even a rich corpus gets the plain sentence-library basis.
test("rich corpus: no buyer-words sentence — the wordsmith is off, plain basis renders", () => {
  const a = ra.deriveReviewAnalysis(richFixture());
  const factor = a.forFactors.find((f) => /battery/i.test(f.title));
  assert(factor, "battery factor exists");
  assert(!BUYER_WORDS_SENTENCE.test(factor.summary), `no buyer-words sentence: ${factor.summary}`);
  assert(factor.summary.trim().endsWith("."), "complete grammatical sentence");
  // Nothing invented: no detail the corpus never named.
  assert(!/waterproof|wireless charging|solar|bluetooth 6|noise cancelling/i.test(factor.summary), "no invented detail");
  // No verbatim buyer sentence leaks.
  for (const body of richBodies) assert(!factor.summary.includes(body), "no pasted buyer sentence");
});

test("determinism: same corpus twice -> byte-identical copy", () => {
  const first = JSON.stringify(ra.deriveReviewAnalysis(richFixture()));
  const second = JSON.stringify(ra.deriveReviewAnalysis(richFixture()));
  assert.equal(first, second, "byte-identical");
});

// ---------- Thin corpus: honest tally-only forms, zero invented specifics ----------
const thinBodies = [
  "Battery life is great, the quick pairing with my phone is instant.",
  "The quick pairing works every time and the battery lasts days.",
  "Lasts for days between charges, really happy with it.",
  "Great battery life, lasts days on a single charge.",
  "Battery lasts for days, quick pairing never fails.",
];

test("thin corpus: tally-only honest forms, no mined specifics", () => {
  const fixture = {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(thinBodies) },
      commentsAnalyzed: 5,
      listingEvidence: { rating: 4.5, reviewCount: 1200 },
    },
    strengths: [{ claim: "battery life", supportCount: 4, sourceIds: ids(5), sourceHashes: [] }],
    complaints: [],
  };
  const a = ra.deriveReviewAnalysis(fixture);
  for (const factor of [...a.forFactors, ...a.againstFactors]) {
    assert(!BUYER_WORDS_SENTENCE.test(factor.summary), "no buyer-words sentence on thin corpus");
    assert(!BUYER_WORDS_SINGLE_SENTENCE.test(factor.summary), "no single buyer-words sentence on thin corpus");
  }
});

// ---------- Single counterfeit report: red flag at true size, with evidence detail ----------
const forBodies = [
  "Sound quality is excellent, crisp vocals and deep bass on every track.",
  "The fit is comfortable for long listening sessions, no ache at all.",
  "Pairs instantly with my phone, setup took under a minute.",
  "Call quality is clear even on windy streets, very impressed.",
  "Battery lasts all day at the office, no complaints at all.",
  "Lightweight and secure during my morning runs.",
  "Great value compared to the more expensive brands.",
  "They stay put during workouts and the case charges fast.",
];
const counterfeitBody =
  "The packaging was a plain brown box and the serial number sticker looked photocopied.";

// Hotfix 2 2026-10-16 (wordsmith OFF at the compose seam): flipped — the
// red-flag sentence is the curated sentence-library core at true size,
// with no mined-detail clause from the wordsmith.
test("one counterfeit report: red flag named at true size, plain core, no wordsmith detail", () => {
  const fixture = {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: [...records(forBodies), ...records([counterfeitBody], "rc")] },
      commentsAnalyzed: 9,
      listingEvidence: { rating: 4.2, reviewCount: 800 },
    },
    product: { title: "Apple AirPods 4 Wireless Earbuds", store: "amazon.ca" },
    strengths: [{ claim: "sound quality", supportCount: 3, sourceIds: ids(3), sourceHashes: [] }],
    complaints: [{ claim: "suspected counterfeit (one-off report)", supportCount: 1, sourceIds: ["rc1"], sourceHashes: [] }],
  };
  const a = ra.deriveReviewAnalysis(fixture);
  const red = a.againstFactors.find((f) => f.severity === "red");
  assert(red, "red flag factor exists");
  assert.match(red.summary, /red flag|serious concern/i, "red flag named");
  assert.match(red.summary, /one buyer/i, "sized as one buyer");
  assert(!/several buyers/i.test(red.summary), "not exaggerated");
  assert(
    !/serial number sticker|plain brown box/.test(red.summary),
    `no wordsmith-mined detail clause: ${red.summary}`
  );
  assert(!red.summary.includes(counterfeitBody), "no pasted buyer sentence");
  assert(red.summary.trim().endsWith("."), "complete grammatical sentence");
  assert.equal(red.basis, "One buyer reported this", "basis agrees with true size");
});

// ---------- Unit: negation-aware mining ----------
test("against-side mining keeps negated complaint vocabulary", () => {
  const words = ws.mineBuyerWords(
    [
      "The battery doesn't last the day at all, very disappointing.",
      "Battery drains fast, it doesn't last a full day for me.",
      "Terrible battery, it doesn't last more than a few hours.",
    ],
    "against"
  );
  assert(words.some((w) => w.includes("doesn't last")), `negated complaint mined, got: ${words.join("|")}`);
});

test("for-side mining keeps negated positives, drops negated junk", () => {
  const words = ws.mineBuyerWords(
    [
      "No pain at all, they don't ache after hours of wear.",
      "They don't ache even after long wear, so comfortable.",
      "The battery is not good and drains fast on these.",
    ],
    "for"
  );
  assert(words.some((w) => w.includes("don't ache")), `negated positive kept, got: ${words.join("|")}`);
  assert(!words.some((w) => w.includes("not good")), "negated junk dropped on for-side");
});

test("generic boilerplate is never mined as a specific", () => {
  const words = ws.mineBuyerWords(
    [
      "Highly recommend this product, five stars, the product arrived on time and does the job.",
      "Five stars, highly recommend, the item does the job and arrived on time.",
      "The product does the job, five stars from me, highly recommend to anyone.",
    ],
    "for"
  );
  assert.deepEqual(words, [], `boilerplate yields nothing, got: ${words.join("|")}`);
});

test("wordsmithEnrich is fail-soft on bad input", () => {
  const out = ws.wordsmithEnrich({ key: "", side: "for", texts: [], tallySig: "x", band: "repeated" }, new Set());
  assert.equal(out.specificLine, null);
  assert.equal(out.redClause, null);
  assert.deepEqual(out.buyerWords, []);
});
