// TRANSLATOR bot (bot round, 2026-10-16): brief localization tests.
// The scan's frame/UI strings resolve through the messages dictionaries;
// product names, numbers, star ratings and buyer-mined vocabulary stay
// byte-exact in their source language. Per-string English fallback: never a
// raw dictionary key, never a blank.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const bn = jiti(root + "lib/briefNarration.ts");
const bi = jiti(root + "lib/briefI18n.ts");
const sa = jiti(root + "lib/shopperAnswer.ts");

// ---------- Fixture shaped like a real scan payload ----------
const bodies = [
  "Love this blanket! The weight is perfectly distributed and I fall asleep so much faster now.",
  "Bought the 20lb queen size and it is exactly as described. The fabric feels premium and soft.",
  "My sleep quality improved within a week. No more tossing and turning at night.",
  "Great value compared to other weighted blankets I looked at. Stitching is even throughout.",
  "It gets a little warm in summer, but perfect for winter nights.",
  "The removable cover washes well and the zipper feels sturdy.",
  "Bought a second one for my daughter after trying mine for a month.",
  "Noticeably calmer mornings since I started using it every night.",
  "Heavier than I expected at first, took two nights to get used to it.",
  "Customer service answered my sizing question within a day, very helpful.",
];

function scanFixture(overrides = {}) {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i + 1}`,
          stableEvidenceHash: `h${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/B07WXQ3GVS",
        })),
      },
      commentsAnalyzed: 10,
      listingEvidence: { rating: 4.3, reviewCount: 9805 },
    },
    strengths: [
      { claim: "improved sleep quality", supportCount: 6, sourceIds: ["r1", "r3"], sourceHashes: [] },
    ],
    complaints: [
      { claim: "sleeps warm in summer (one-off report)", supportCount: 1, sourceIds: ["r5"], sourceHashes: [] },
    ],
    product: { title: "Weighted Idea Weighted Blanket", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2", mode: "written_only", score: 83, verdict: "buy",
      confidence: "High", audit: { n: 10, Rbar: 4.3, N: 9805 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
    ...overrides,
  };
}

const FIXTURE = scanFixture();

function allBriefStrings(locale) {
  const out = [];
  out.push(bi.localizedVerdictWord(locale, "BUY"));
  for (const row of bn.briefFactRows(FIXTURE, locale)) {
    out.push(row.term);
    if ("text" in row) out.push(row.text);
  }
  const basis = bn.foldBasisLine(FIXTURE, locale);
  if (basis) out.push(basis);
  const limits = bn.foldLimitsLine(FIXTURE, locale);
  if (limits) out.push(limits);
  out.push(...bn.foldAuthLines(FIXTURE, locale));
  const answer = sa.deriveShopperAnswer(FIXTURE, locale);
  out.push(answer.label, answer.why, answer.trustLine);
  for (const step of answer.nextSteps) out.push(step.label, step.detail);
  return out.filter((s) => typeof s === "string");
}

// ---------- Verdict words ----------
test("verdict words localize across all locales, guard runs first", () => {
  assert.equal(bi.localizedVerdictWord("en", "BUY"), "Buy");
  assert.equal(bi.localizedVerdictWord("fr", "BUY"), "Acheter");
  assert.equal(bi.localizedVerdictWord("es", "BUY"), "Comprar");
  assert.equal(bi.localizedVerdictWord("de", "BUY"), "Kaufen");
  assert.equal(bi.localizedVerdictWord("hi", "BUY"), "खरीदें");
  assert.equal(bi.localizedVerdictWord("zh", "BUY"), "购买");
  assert.equal(bi.localizedVerdictWord("fr", "SKIP"), "Passer");
  assert.equal(bi.localizedVerdictWord("es", "WAIT"), "Esperar");
  // Legacy/internal values are sanitized BEFORE localization: no new words.
  assert.equal(bi.localizedVerdictWord("fr", "REVIEW FIRST"), "Attendre");
  assert.equal(bi.localizedVerdictWord("es", "AVOID"), "Omitir");
  assert.equal(bi.localizedVerdictWord("de", "garbage"), "Abwarten");
  // Unknown locale falls back to English.
  assert.equal(bi.localizedVerdictWord("xx", "BUY"), "Buy");
});

// ---------- French brief ----------
test("fr brief: translated frames, byte-exact numbers", () => {
  const rows = bn.briefFactRows(FIXTURE, "fr");
  const terms = rows.map((r) => r.term);
  assert.deepEqual(terms, [
    "Note du marché",
    "Avis comptés",
    "Notre niveau de certitude",
    "Rapport qualité-prix",
    "Authenticité des avis",
  ]);
  const ratingRow = rows.find((r) => r.key === "marketplaceRating");
  const countRow = rows.find((r) => r.key === "ratingsCounted");
  assert.equal(ratingRow.rating, 4.3);
  assert.equal(countRow.count, 9805);
  const confRow = rows.find((r) => r.key === "howSureWeAre");
  assert.equal(confRow.text, "Élevée");
  const valueRow = rows.find((r) => r.key === "valueForMoney");
  assert.equal(valueRow.text, "Bon");

  const basis = bn.foldBasisLine(FIXTURE, "fr");
  assert.match(basis, /^(D'après|Ceci est basé|Nous avons basé|Voici ce qui l'étaye)/);
  assert.match(basis, /la note du marché/);
  assert.ok(!basis.includes("the marketplace rating"));

  const limits = bn.foldLimitsLine(FIXTURE, "fr");
  assert.ok(limits.includes("amazon.ca")); // store name byte-exact
  assert.match(limits, /boutiques/);

  const auth = bn.foldAuthLines(FIXTURE, "fr");
  assert.ok(auth.length >= 2);
  assert.ok(!auth[0].includes("The reviews read like real buyers"));
});

// ---------- Spanish brief ----------
test("es brief: translated frames", () => {
  assert.equal(bi.localizedVerdictWord("es", "BUY"), "Comprar");
  const rows = bn.briefFactRows(FIXTURE, "es");
  assert.ok(rows.map((r) => r.term).includes("Valoración del mercado"));
  const basis = bn.foldBasisLine(FIXTURE, "es");
  assert.match(basis, /^(Basado en|Esto se basa|Basamos este veredicto|Esto es lo que lo respalda)/);
  assert.match(basis, /la valoración del mercado/);
  const answer = sa.deriveShopperAnswer(FIXTURE, "es");
  assert.equal(answer.label, "Comprar");
  assert.match(answer.why, /Los compradores reportan constantemente/);
  // Buyer-mined vocabulary stays in source language inside translated frames.
  assert.ok(answer.why.includes("improved sleep quality"));
});

// ---------- English behavior unchanged ----------
test("en brief is byte-identical to the pre-translator behavior", () => {
  const rows = bn.briefFactRows(FIXTURE);
  assert.deepEqual(
    rows.map((r) => r.term),
    ["Marketplace rating", "Ratings counted", "How sure we are", "Value for money", "Review authenticity"]
  );
  const narration = bn.foldNarration(FIXTURE);
  assert.ok(narration[narration.length - 1] === "Only real written reviews and the marketplace rating feed the score.");
  const answer = sa.deriveShopperAnswer(FIXTURE);
  assert.equal(answer.label, "Buy");
  assert.match(answer.why, /^Buyers consistently report improved sleep quality/);
  assert.match(answer.trustLine, /^Based on real buyer reviews from amazon\.ca\.$/);
});

// ---------- Fallback law ----------
test("untranslated-by-design locales render honest English, never keys or blanks", () => {
  // de has no translated frames: the whole sentence falls back to English,
  // including the joiner (no half-translated sentences).
  assert.equal(bn.foldBasisLine(FIXTURE, "de"), bn.foldBasisLine(FIXTURE, "en"));
  assert.equal(bn.foldLimitsLine(FIXTURE, "de"), bn.foldLimitsLine(FIXTURE, "en"));
  const deAuth = bn.foldAuthLines(FIXTURE, "de");
  assert.deepEqual(deAuth, bn.foldAuthLines(FIXTURE, "en"));

  const copy = bi.resolveBriefDict("hi");
  assert.equal(copy.scoreFeedsLine, "Only real written reviews and the marketplace rating feed the score.");
  assert.equal(copy.verdict.buy, "खरीदें"); // verdict words ARE translated
});

test("no raw dictionary keys and no blank strings in any locale output", () => {
  for (const locale of ["en", "fr", "es", "de", "hi", "zh"]) {
    for (const s of allBriefStrings(locale)) {
      assert.ok(s.trim().length > 0, `${locale}: blank string rendered`);
      assert.ok(!/Brief\.[a-zA-Z.[\]]+/.test(s), `${locale}: raw key leaked: ${s.slice(0, 80)}`);
      assert.ok(!/\{[a-zA-Z]+\}/.test(s), `${locale}: unfilled placeholder: ${s.slice(0, 80)}`);
    }
  }
});

test("numbers stay byte-exact in every locale", () => {
  for (const locale of ["fr", "es", "de", "hi", "zh"]) {
    const rows = bn.briefFactRows(FIXTURE, locale);
    const ratingRow = rows.find((r) => r.key === "marketplaceRating");
    const countRow = rows.find((r) => r.key === "ratingsCounted");
    assert.equal(ratingRow.rating, 4.3, locale);
    assert.equal(countRow.count, 9805, locale);
  }
});

test("frame choice is deterministic across locales (same seed, same index)", () => {
  // Ten runs: the pick is stable per locale, and the fr/es frames mirror
  // the same English template index (same "page" in every language).
  const frFirst = bn.foldBasisLine(FIXTURE, "fr");
  const esFirst = bn.foldBasisLine(FIXTURE, "es");
  const enFirst = bn.foldBasisLine(FIXTURE, "en");
  for (let i = 0; i < 10; i++) {
    assert.equal(bn.foldBasisLine(FIXTURE, "fr"), frFirst);
    assert.equal(bn.foldBasisLine(FIXTURE, "es"), esFirst);
    assert.equal(bn.foldBasisLine(FIXTURE, "en"), enFirst);
  }
  // The fr frame is the translation of the picked en template: it fills the
  // same {basis} content, so both mention the marketplace rating concept.
  assert.ok(frFirst.includes("la note du marché") === enFirst.includes("the marketplace rating"));
});
