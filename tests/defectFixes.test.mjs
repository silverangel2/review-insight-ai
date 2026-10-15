// ReviewIntel weekly-audit defect fixes (2026-10-15 audit): display-layer only.
// Tests the exact observed defects against the real lib/shopperAnswer.ts.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const sa = jiti(root + "lib/shopperAnswer.ts");

// ---------- Defect 1: raw markdown leak in displayed quotes ----------
test("defect 1: the exact observed pattern is cleaned", () => {
  const raw = "**Rating: ★★★★★** I bought the Apple AirPods 4 Wireless Earbuds for my teenager.";
  const cleaned = sa.cleanQuoteText(raw);
  assert.ok(!cleaned.includes("**"), `markdown leaked: ${cleaned}`);
  assert.ok(!cleaned.includes("*"), `asterisk leaked: ${cleaned}`);
  assert.ok(cleaned.startsWith("I bought the Apple AirPods 4"), `unexpected: ${cleaned}`);
});

test("defect 1: bold/italic/link artifacts stripped, plain text untouched", () => {
  assert.equal(sa.cleanQuoteText("**bold** text"), "bold text");
  assert.equal(sa.cleanQuoteText("*italic* text"), "italic text");
  assert.equal(sa.cleanQuoteText("__bold__ text"), "bold text");
  assert.equal(sa.cleanQuoteText("[great](https://example.com/x) product"), "great product");
  assert.equal(sa.cleanQuoteText("plain text, no markup"), "plain text, no markup");
});

test("defect 1: shortQuote cleans before excerpting", () => {
  const quote = sa.shortQuote("**Rating: ★★★★★** The sound quality is excellent and clear.");
  assert.ok(!quote.includes("**"), `markdown leaked: ${quote}`);
  assert.ok(quote.startsWith("The sound quality"), `unexpected: ${quote}`);
});

test("defect 1: metadata-only bodies clean to nothing (and would be dropped)", () => {
  assert.equal(sa.cleanQuoteText("**Rating: ★★★★★**"), "");
});

// ---------- Defect 2: duplicated quotes across sections ----------
// The exclusion contract: the secondary section (BuyingScoreV2Card) drops
// any quote whose normalized key matches a primary-section quote key.
test("defect 2: normalized keys match across cleaning/casing/spacing variants", () => {
  const primary = "**Rating: ★★★★★** The sound is great.";
  const secondary = "the sound is great. ";
  assert.equal(sa.normalizeQuoteKey(primary), sa.normalizeQuoteKey(secondary));
  const exclude = new Set([sa.normalizeQuoteKey(primary)]);
  assert.ok(exclude.has(sa.normalizeQuoteKey(secondary)), "dedupe contract broken");
});

test("defect 2: distinct quotes are not collapsed", () => {
  assert.notEqual(sa.normalizeQuoteKey("The sound is great."), sa.normalizeQuoteKey("The fit is great."));
});

// ---------- Defect 4: one canonical attribution per quote ----------
function auditFixture() {
  return {
    verdict: "BUY",
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: [
          { id: "r1", body: "**Rating: ★★★★★** The sound is great.", sourceUrl: "https://www.amazon.ca/dp/B0X" },
          { id: "r2", body: "**Rating: ★★★★★** The sound is great.", sourceUrl: "https://www.apple.com/shop/buy" },
        ],
      },
    },
    strengthProvenance: [
      { claim: "Great sound", supportCount: 5, sourceIds: ["r1", "r2"], sourceHashes: [], sourceUrls: [] },
      { claim: "Good battery", supportCount: 3, sourceIds: ["r2"], sourceHashes: [], sourceUrls: [] },
    ],
  };
}

test("defect 4: same quote text gets one canonical attribution everywhere", () => {
  const attribution = sa.canonicalQuoteAttribution(auditFixture());
  const key = sa.normalizeQuoteKey("The sound is great.");
  assert.equal(attribution.get(key), "amazon.ca");
});

test("defect 4: deriveShopperAnswer labels identical quotes identically", () => {
  const answer = sa.deriveShopperAnswer(auditFixture());
  assert.equal(answer.loves.length, 2);
  const [love1, love2] = answer.loves;
  assert.ok(love1.quote && !love1.quote.includes("**"), "defect 1: markdown in primary quote");
  assert.equal(love1.quote, love2.quote, "same text must render identically");
  assert.equal(love1.sourceHost, "amazon.ca");
  assert.equal(love2.sourceHost, "amazon.ca", "defect 4: second label must match the canonical first");
});

// ---------- Defect 3: aggregate rating surfaced in the headline card ----------
test("defect 3: marketplace aggregate surfaces with listing-evidence precedence", () => {
  const agg = sa.marketplaceAggregateForDisplay({
    reviewEvidence: { listingEvidence: { rating: 4.4, reviewCount: 2341 } },
  });
  assert.equal(agg.rating, "4.4 / 5");
  assert.equal(agg.countLine, "from 2,341 ratings");
});

test("defect 3: product-level fallback and empty input", () => {
  const fallback = sa.marketplaceAggregateForDisplay({ product: { rating: 4, reviewCount: 100 } });
  assert.equal(fallback.rating, "4 / 5");
  assert.equal(fallback.countLine, "from 100 ratings");
  const empty = sa.marketplaceAggregateForDisplay({});
  assert.equal(empty.rating, null);
  assert.equal(empty.countLine, null);
});

// ---------- Defect 5: one coherent evidence-strength label ----------
test("defect 5: each evidence state maps to exactly one coherent label", () => {
  assert.equal(sa.evidenceStrengthLabel("not_enough"), "Low");
  assert.equal(sa.evidenceStrengthLabel("limited"), "Moderate");
  assert.equal(sa.evidenceStrengthLabel("usable"), "Strong");
  assert.equal(sa.evidenceStrengthLabel(null), "Low");
});

test("defect 5: no internal or contradictory strings in the label", () => {
  const forbidden = ["evidenceState", "NOT_ENOUGH", "Not scored", "Vercel", "not enough", "not scored", "limited high"];
  for (const state of ["not_enough", "limited", "usable", null]) {
    const label = sa.evidenceStrengthLabel(state);
    for (const bad of forbidden) {
      assert.ok(!label.toLowerCase().includes(bad.toLowerCase()), `label "${label}" contains "${bad}"`);
    }
  }
});

// ---------- Cross-cutting: shopper-visible strings carry no forbidden content ----------
test("shopper-visible helpers never leak forbidden strings", () => {
  const forbidden = ["evidenceState", "NOT_ENOUGH", "Not scored", "Vercel"];
  const samples = [
    sa.cleanQuoteText("**Rating: ★★★★★** I bought the Apple AirPods 4."),
    sa.marketplaceAggregateForDisplay({ reviewEvidence: { listingEvidence: { rating: 4.4, reviewCount: 2341 } } }).rating ?? "",
    sa.evidenceStrengthLabel("usable"),
  ];
  for (const text of samples) {
    for (const bad of forbidden) assert.ok(!text.includes(bad), `"${text}" contains "${bad}"`);
  }
});
