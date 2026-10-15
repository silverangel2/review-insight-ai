// Result-page defects (weekly audit 2026-10-15): shopper-visible copy regressions.
// Display layer only — no scoring behavior is asserted here.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const display = jiti(root + "lib/displayQuote.ts");
const quotes = jiti(root + "lib/resultQuotes.ts");
const shopper = jiti(root + "lib/shopperAnswer.ts");
const scoring = jiti(root + "lib/buyingScore.ts");

// --- Defect 1: markdown leak -------------------------------------------------
test("sanitizeQuoteForDisplay strips markdown emphasis markers", () => {
  assert.equal(display.sanitizeQuoteForDisplay("**Rating: ★★★★★** Love these"), "Rating: ★★★★★ Love these");
  assert.equal(display.sanitizeQuoteForDisplay("__Great__ product, *would* buy"), "Great product, would buy");
  assert.equal(display.sanitizeQuoteForDisplay("plain text"), "plain text");
  assert.equal(display.sanitizeQuoteForDisplay(null), "");
});

test("shopper shortQuote never emits markdown markers", () => {
  const out = shopper.shortQuote("**Rating: ★★★★★** Love these AirPods, the sound is great.");
  assert.ok(!out.includes("**"), `markdown leaked: ${out}`);
  assert.ok(out.includes("Rating:"), `content lost: ${out}`);
});

test("buying-score quote buckets never emit markdown markers", () => {
  const { signals } = scoring.signalsFromReviews({
    marketplace: { rating: 4.4, count: 2341, histogram: null },
    reviews: [
      { body: "**Rating: ★★★★★** Love these AirPods! The sound is great and the battery lasts long.", title: "Love these", rating: 5, source: "amazon", sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" },
      { body: "Battery drains too fast for my taste, really disappointing and bad.", title: "Meh", rating: 2, source: "amazon", sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" },
    ],
  });
  for (const bucket of ["positive", "negative"]) {
    for (const q of signals.quotes[bucket]) {
      assert.ok(!q.includes("**") && !q.includes("__"), `markdown leaked in ${bucket}: ${q}`);
    }
  }
});

// --- Defect 2: duplicate quotes ----------------------------------------------
test("dedupeQuoteTexts drops case/punctuation variants, keeps order", () => {
  const out = display.dedupeQuoteTexts(["Love these AirPods!", "love these airpods", "Great sound.", "Great  sound"]);
  assert.deepEqual(out, ["Love these AirPods!", "Great sound."]);
});

test("deriveShopperAnswer dedupes the same quote across loves and complaints", () => {
  const answer = shopper.deriveShopperAnswer(quoteFixture());
  const keys = [...answer.loves, ...answer.complaints]
    .map((p) => (p.quote ? display.canonicalQuoteKey(p.quote) : null))
    .filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, `duplicate quote on page: ${JSON.stringify(keys)}`);
  // The duplicated claim appears once (in loves), not twice.
  assert.equal(keys.length, 2);
});

test("withDedupedDisplayQuotes removes summary quotes from the evidence block", () => {
  const result = quoteFixture();
  const answer = shopper.deriveShopperAnswer(result);
  const summaryQuote = answer.loves[0].quote;
  assert.ok(summaryQuote, "fixture should yield a summary quote");
  const score = {
    version: "buying-score-v2",
    quotes: { safety: [], reliability: [], positive: [summaryQuote, "Totally different praise here"], negative: [] },
  };
  const cleaned = quotes.withDedupedDisplayQuotes(score, result);
  assert.deepEqual(cleaned.quotes.positive, ["Totally different praise here"]);
  assert.equal(cleaned.version, "buying-score-v2", "score object shape preserved");
});

// --- Defect 3: buried aggregate -----------------------------------------------
test("pageAggregateForDisplay surfaces the store aggregate when the score did not", () => {
  const result = {
    reviewEvidence: { reviewCollector: { marketplaceAggregate: { rating: 4.4, count: 2341, source: "amazon-html" } } },
    buyingScoreV2: { version: "buying-score-v2", audit: { Rbar: null, N: null } },
  };
  assert.deepEqual(quotes.pageAggregateForDisplay(result), { rating: 4.4, count: 2341 });
});

test("pageAggregateForDisplay stays silent when the score already carried the aggregate", () => {
  const result = {
    reviewEvidence: { reviewCollector: { marketplaceAggregate: { rating: 4.4, count: 2341 } } },
    buyingScoreV2: { version: "buying-score-v2", audit: { Rbar: 4.4, N: 2341 } },
  };
  assert.equal(quotes.pageAggregateForDisplay(result), null);
});

test("pageAggregateForDisplay stays silent with no aggregate in evidence", () => {
  assert.equal(quotes.pageAggregateForDisplay({ reviewEvidence: {}, buyingScoreV2: { audit: {} } }), null);
});

// --- Defect 4: inconsistent attribution ---------------------------------------
test("canonicalAttributionForQuote prefers the scanned store for the same quote", () => {
  const records = [
    { body: "Love these AirPods, the sound is great.", sourceUrl: "https://www.apple.com/shop/buy-airpods" },
    { body: "Love these AirPods, the sound is great.", sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" },
  ];
  const key = display.canonicalQuoteKey("Love these AirPods, the sound is great.");
  const a = shopper.canonicalAttributionForQuote(records, key, "amazon.ca");
  assert.equal(a.sourceHost, "amazon.ca");
  const b = shopper.canonicalAttributionForQuote(records, key, null);
  assert.equal(b.sourceHost, "apple.com", "no primary host: first match wins");
});

test("deriveShopperAnswer attributes the same quote to the scanned store", () => {
  const answer = shopper.deriveShopperAnswer(quoteFixture());
  assert.equal(answer.loves[0].sourceHost, "amazon.ca");
  assert.ok(
    (answer.loves[0].sourceUrl || "").includes("amazon.ca"),
    `sourceUrl should follow the canonical host: ${answer.loves[0].sourceUrl}`
  );
});

// --- Defect 5: contradictory strength copy ------------------------------------
test("normalizeEvidenceStrength coerces to one coherent scale value", () => {
  assert.equal(display.normalizeEvidenceStrength("limited high"), "Limited");
  assert.equal(display.normalizeEvidenceStrength("strong"), "Strong");
  assert.equal(display.normalizeEvidenceStrength("WEAK"), "Weak");
  assert.equal(display.normalizeEvidenceStrength("usable"), "Usable");
  assert.equal(display.normalizeEvidenceStrength(""), "Low");
  assert.equal(display.normalizeEvidenceStrength("not enough evidence"), "Low");
  assert.equal(display.normalizeEvidenceStrength(null), "Low");
});

// --- fixture ------------------------------------------------------------------
function quoteFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: [
          {
            id: "r1",
            stableEvidenceHash: "h1",
            body: "Love these AirPods! The sound is amazing and they fit great.",
            sourceUrl: "https://www.apple.com/shop/product/airpods",
          },
          {
            id: "r2",
            stableEvidenceHash: "h2",
            body: "Love these AirPods! The sound is amazing and they fit great.",
            sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
          },
          {
            id: "r3",
            stableEvidenceHash: "h3",
            body: "Battery drains too fast for my taste, disappointing overall.",
            sourceUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
          },
        ],
      },
      listingEvidence: { exactListingUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" },
    },
    strengths: [
      { claim: "Great sound", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: ["h1", "h2"], sourceUrls: [] },
    ],
    complaints: [
      { claim: "Great sound", supportCount: 1, sourceIds: ["r1"], sourceHashes: ["h1"], sourceUrls: [] },
      { claim: "Battery life", supportCount: 1, sourceIds: ["r3"], sourceHashes: ["h3"], sourceUrls: [] },
    ],
    buyingScoreV2: { version: "buying-score-v2", verdict: "Buy" },
    product: { store: "amazon.ca" },
  };
}
