// Wordsmith hotfix 2026-10-16 — the "alien copy" defect.
//
// Live failure (scan_5bb8e28b, Instant Pot Duo, PR #59): a theme's basis
// printed "The reviews keep circling back to this. Buyers get concrete about
// this — instant pot and electric pressure cooker. This is a steady drumbeat
// in the reviews." — three stacked filler frames; the "specifics" were just
// the product's category/title tokens. Junel saw it on the live page.
//
// The fix, three rules:
//   1. Mined specifics must carry at least one content word that is NOT a
//      product-title token ("instant pot" on an Instant Pot page is category
//      echo, not buyer vocabulary).
//   2. Enrichment requires the product title. No title -> no enrichment.
//      A corpus with no surviving specifics gets the plain basis sentence —
//      suppressed, never dressed up.
//   3. The concrete sentence REPLACES the generic review-pattern framing
//      (lead + strength); it never stacks on top of it.
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
    sourceUrl: "https://www.amazon.ca/dp/TESTHOTFIX",
  }));
const ids = (n, prefix = "r") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

const BUYER_WORDS_SENTENCE =
  /that's what buyers keep naming|in the reviewers' own specifics|the detail that keeps coming up|what buyers name, again and again|the recurring detail across reviews/i;
const ALIEN_SENTENCE =
  "The reviews keep circling back to this. Buyers get concrete about this — instant pot and electric pressure cooker. This is a steady drumbeat in the reviews.";

// ---------- (a) weak-specifics corpus: only category tokens mineable ----------
const INSTANT_POT_TITLE =
  "Instant Pot Duo 7-in-1 Electric Pressure Cooker, Slow Cooker, Rice Cooker, Steamer, Saute, Yogurt Maker, Warmer & Sterilizer, Includes App With Over 800 Recipes, Stainless Steel, 6 Quart";

const weakBodies = [
  "This instant pot is great, the electric pressure cooker works so well for our family.",
  "Love my instant pot. Best electric pressure cooker I have ever owned.",
  "The instant pot cooks fast and the electric pressure cooker is easy to clean.",
  "Great instant pot, the electric pressure cooker makes dinner in minutes.",
  "My instant pot never disappoints, this electric pressure cooker is a workhorse.",
  "The electric pressure cooker is fantastic, my instant pot gets used daily.",
  "Solid instant pot, the electric pressure cooker seals perfectly every time.",
  "Excellent electric pressure cooker. This instant pot replaced my old one.",
];

function weakFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(weakBodies) },
      commentsAnalyzed: 8,
      listingEvidence: { rating: 4.6, reviewCount: 148258 },
    },
    product: { title: INSTANT_POT_TITLE, store: "amazon.ca" },
    strengths: [{ claim: "fast cooking", supportCount: 6, sourceIds: ids(8), sourceHashes: [] }],
    complaints: [],
  };
}

test("weak corpus: no 'get concrete' sentence — heading + tag only, suppressed not dressed up", () => {
  const a = ra.deriveReviewAnalysis(weakFixture());
  const factor = a.forFactors.find((f) => /fast cooking/i.test(f.title));
  assert(factor, "fast-cooking factor exists");
  assert(!BUYER_WORDS_SENTENCE.test(factor.summary), `no buyer-words sentence on weak corpus: ${factor.summary}`);
  assert(
    !/instant pot and electric pressure cooker/i.test(factor.summary),
    `no category filler in summary: ${factor.summary}`
  );
  // Frame strip 2026-10-16: the honest composition is heading + tag only —
  // no pattern sentences print at all.
  assert.strictEqual(factor.summary, "", "no basis sentences: heading + tag only");
  assert(factor.basis.length > 0, "tally tag still renders");
});

test("the exact live alien sentence can never be produced", () => {
  const a = ra.deriveReviewAnalysis(weakFixture());
  for (const f of [...a.forFactors, ...a.againstFactors]) {
    assert(!f.summary.includes(ALIEN_SENTENCE), `alien sentence reproduced: ${f.summary}`);
    assert(
      !/buyers get concrete about this — instant pot/i.test(f.summary),
      `category filler as specifics: ${f.summary}`
    );
  }
});

// ---------- (b) strong corpus: the feature survives with real specifics ----------
const SONY_TITLE = "Sony WH-1000XM5 Wireless Noise Cancelling Headphones";

const strongBodies = [
  "The multipoint connection switches between my laptop and phone without a hitch.",
  "Multipoint connection works flawlessly, jumps from phone to laptop instantly.",
  "Windy street calls come through clear, the mic handles wind surprisingly well.",
  "Calls on windy streets are crystal clear, best call quality I have had.",
  "The multipoint connection is the killer feature, two devices at once.",
  "Windy street calls sound great on the other end, no complaints.",
  "Battery easily lasts the week, multipoint connection never drops.",
  "Love the multipoint connection and windy street calls are clear.",
];

function strongFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(strongBodies, "s") },
      commentsAnalyzed: 8,
      listingEvidence: { rating: 4.7, reviewCount: 32000 },
    },
    product: { title: SONY_TITLE, store: "amazon.ca" },
    strengths: [{ claim: "call quality", supportCount: 6, sourceIds: ids(8, "s"), sourceHashes: [] }],
    complaints: [],
  };
}

// Hotfix 2 2026-10-16 (wordsmith OFF at the compose seam): these assertions
// were flipped from the hotfix-1 model. The enrichment is disconnected —
// even a strong corpus gets the plain sentence-library basis, never a
// buyer-words sentence.
test("strong corpus: no buyer-words sentence — the wordsmith is off, heading + tag only", () => {
  const a = ra.deriveReviewAnalysis(strongFixture());
  const factor = a.forFactors.find((f) => /call quality/i.test(f.title));
  assert(factor, "call-quality factor exists");
  assert(
    !BUYER_WORDS_SENTENCE.test(factor.summary),
    `no buyer-words sentence on strong corpus: ${factor.summary}`
  );
  // Frame strip 2026-10-16: no pattern sentences print — heading + tag only.
  assert.strictEqual(factor.summary, "", "no basis sentences: heading + tag only");
  assert(factor.basis.length > 0, "tally tag still renders");
});

test("dormancy: the wordsmith path leaves no trace in composed output", () => {
  const a = ra.deriveReviewAnalysis(strongFixture());
  const factor = a.forFactors.find((f) => /call quality/i.test(f.title));
  assert(factor, "call-quality factor exists");
  assert(
    !/keep circling back|steady drumbeat|buyers get concrete|get specific|got specific|own specifics|detail that keeps coming up|again and again|keep naming/i.test(factor.summary),
    `no wordsmith frames or fragments: ${factor.summary}`
  );
});

// ---------- unit: title gate ----------
test("unit: enrichment requires a product title", () => {
  const input = {
    key: "call quality",
    side: "for",
    texts: strongBodies,
    tallySig: "t",
    band: "dominant",
  };
  const out = ws.wordsmithEnrich(input, new Set());
  assert.equal(out.specificLine, null, "no title -> no enrichment");
  assert.deepEqual(out.buyerWords, []);
  const withTitle = ws.wordsmithEnrich({ ...input, productTitle: SONY_TITLE }, new Set());
  assert(withTitle.specificLine, "with title -> enrichment fires");
  assert(withTitle.buyerWords.some((w) => w.includes("multipoint connection")));
});

test("unit: title-only phrases are dropped before the top-N cut", () => {
  const words = ws.mineBuyerWords(weakBodies, "for", "fast cooking", ws.titleTokensOf(INSTANT_POT_TITLE));
  assert.deepEqual(words, [], `category echo yields nothing, got: ${words.join("|")}`);
});

test("unit: titleTokensOf ignores stopwords, short tokens, and numbers", () => {
  const toks = ws.titleTokensOf(INSTANT_POT_TITLE);
  assert(toks.has("instant"), "keeps content words");
  assert(toks.has("cooker"), "keeps content words");
  assert(!toks.has("the"), "drops stopwords");
  assert(!toks.has("7"), "drops pure numbers");
  assert(!toks.has("in"), "drops short tokens");
});

// ---------- Takki register (Junel's acceptance bar, 2026-10-16) ----------
// Junel's standard, from a competitor-style result he screenshotted: every
// strengths/complaints line is a CONCRETE PARAPHRASE carrying a fact —
// "Compact and lightweight design (around 2.2-2.3 lbs) ideal for camping,
// hiking, and emergency kits"; "Solar charging requires separate MC4 cable
// purchase". Plain human summary, zero filler frames, specifics first.
// This fixture models that product and proves a theme line carries
// review-supported specifics in plain words — with the HARD LIMIT that RI
// prints only specifics its evidence supports (figures buyers state are
// fine; a number the corpus doesn't contain is never invented).
const TAKKI_TITLE = "Takki 150W Portable Power Station";

const takkiBodies = [
  "Weighs just over 2 pounds, I toss it in my camping kit without thinking.",
  "At barely 2 pounds it lives in my emergency kit in the truck.",
  "So light for a power station, took it camping last weekend and it ran the lantern all night.",
  "Perfect for the camping kit, light enough to carry one-handed to the tent.",
  "Keep it in the emergency kit, light and always ready.",
  "The emergency kit essential now, powers the lantern and charges phones.",
  "Solar charging works but you need a separate MC4 cable, not in the box.",
  "No MC4 cable included, had to buy a separate MC4 cable for solar charging.",
  "AC wall charging is slow, takes about five hours for a full charge.",
  "Wall charging is slow, nearly five hours from empty to full.",
];

function takkiFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: takkiBodies.map((body, i) => ({
          id: `t${i + 1}`, stableEvidenceHash: `th${i + 1}`, body, sourceUrl: "https://www.amazon.ca/dp/TAKKI",
        })),
      },
      commentsAnalyzed: 10,
      listingEvidence: { rating: 4.3, reviewCount: 2100 },
    },
    product: { title: TAKKI_TITLE, store: "amazon.ca" },
    strengths: [
      { claim: "lightweight and portable", supportCount: 6, sourceIds: ["t1", "t2", "t3", "t4", "t5", "t6"], sourceHashes: [] },
    ],
    complaints: [
      { claim: "slow charging, cable not included", supportCount: 4, sourceIds: ["t7", "t8", "t9", "t10"], sourceHashes: [] },
    ],
  };
}

// Hotfix 2 2026-10-16 (wordsmith OFF at the compose seam): this assertion
// was flipped from the hotfix-1 model. The Takki register stays Junel's
// acceptance bar for a future rebuild; tonight's bar is a plain,
// grammatical sentence-library basis with no wordsmith trace.
test("Takki register: heading + tag only, no wordsmith trace anywhere", () => {
  const a = ra.deriveReviewAnalysis(takkiFixture());
  const portable = a.forFactors.find((f) => /lightweight|portable/i.test(f.title));
  assert(portable, "portability factor exists");
  assert(!BUYER_WORDS_SENTENCE.test(portable.summary), `no buyer-words sentence: ${portable.summary}`);
  // Frame strip 2026-10-16: no pattern sentences print — heading + tag only.
  assert.strictEqual(portable.summary, "", "no basis sentences");
  assert(portable.basis.length > 0, "tally tag still renders");

  const charging = a.againstFactors.find((f) => /charg|cable/i.test(f.title));
  assert(charging, "charging factor exists");
  assert(!BUYER_WORDS_SENTENCE.test(charging.summary), `no buyer-words sentence: ${charging.summary}`);
  assert.strictEqual(charging.summary, "", "no basis sentences");
  assert(charging.basis.length > 0, "tally tag still renders");
});

test("Takki register: zero filler frames anywhere on the page", () => {
  const a = ra.deriveReviewAnalysis(takkiFixture());
  const filler = /keep circling back|steady drumbeat|buyers get concrete|the specifics buyers cite|buyers name the particulars|named specifically, again and again/i;
  for (const f of [...a.forFactors, ...a.againstFactors]) {
    assert(!filler.test(f.summary), `filler frame in: ${f.summary}`);
  }
});

test("HARD LIMIT: no figure the corpus doesn't contain is ever printed", () => {
  const a = ra.deriveReviewAnalysis(takkiFixture());
  const corpus = takkiBodies.join(" ");
  for (const f of [...a.forFactors, ...a.againstFactors]) {
    for (const m of f.summary.match(/\d[\d.,]*/g) || []) {
      assert(corpus.includes(m), `invented figure "${m}" in: ${f.summary}`);
    }
  }
});
