// Compare fix loop (2026-10-20, Junel: "Fix again and again until perfect").
// Per-defect proofs for the compare audit (ri-advisor-review/compare_audit_2026-10-20.md):
// D1 types banner from a reviews flag, D2 hardcoded 88 confidence, D3 evidence
// thrown away + counts voided, D4 "DO NOT BUY YET" verdict leak, D5 trust
// percentages from an absent measurement, D7 four winner engines, D10 OpenAI
// winner path. Fixtures are analyze-shaped records; rendering follows the
// resultCoherence harness (transpile + evalModule + renderToStaticMarkup).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const { freeShopperCompare, lowConfidenceShopperCompare, compareEvidenceInput } = jiti("./lib/shopperCompareFree.ts");

// ---------- shared fixtures ----------

function ratedRecord({ name, verdict, score, comments, signs = 5 }) {
  return {
    verdict,
    productScore: score,
    valueForMoney: "Fair",
    bottomLine: `${name} bottom line.`,
    product: { name, brand: "", category: "", store: "Amazon.ca", price: "", rating: "4.5", reviewCount: "1000" },
    reviewAuthenticity: { label: "", score: signs, reasons: [] },
    topStrengths: ["Works well"],
    topComplaints: ["A bit slow"],
    bestFor: ["Families"],
    notIdealFor: [],
    sourcesUsed: [],
    reviewEvidence: { commentsAnalyzed: comments, sourcesChecked: ["Amazon.ca"] },
  };
}

function zeroRecord(name) {
  return {
    verdict: "DO NOT BUY YET",
    productScore: 0,
    valueForMoney: "Unknown",
    bottomLine: "Written reviews were not available for a verdict.",
    product: { name, brand: "", category: "", store: "", price: "", rating: "", reviewCount: "" },
    reviewAuthenticity: { label: "", score: null, reasons: [] },
    topStrengths: [],
    topComplaints: [],
    bestFor: [],
    notIdealFor: [],
    sourcesUsed: [],
    reviewEvidence: { commentsAnalyzed: 0, sourcesChecked: [] },
  };
}

const CROCKPOT = "Crock-Pot 7-Quart Manual Slow Cooker";
const HAMILTON = "Hamilton Beach Programmable Slow Cooker, 7 Quart (33474)";
const PURIFIER = "LEVOIT Air Purifier for Home Allergies";
const slowA = () => ratedRecord({ name: CROCKPOT, verdict: "BUY", score: 91, comments: 12 });
const slowB = () => ratedRecord({ name: HAMILTON, verdict: "REVIEW FIRST", score: 56, comments: 9 });

// ---------- D1/D3: low-evidence outcome has its own semantics ----------

test("D1: low-confidence compare is an evidence outcome, never a types claim", () => {
  const r = lowConfidenceShopperCompare(12, 1);
  assert.equal(r.winner, "INCOMPARABLE");
  assert.equal(r.directSubstitutes, null);
  assert.equal(r.reason, "insufficient_evidence");
  assert.equal(r.confidence, null);
  assert.equal(r.verdictHeadline, "Low confidence");
});

test("D3: per-side written-review counts reach diagnostics and the reason line", () => {
  const r = lowConfidenceShopperCompare(12, 1);
  assert.deepEqual(r.evidence, { commentsAnalyzedA: 12, commentsAnalyzedB: 1 });
  assert.ok(r.reasons.some((line) => line.includes("Product A 12") && line.includes("Product B 1")));
  const zero = lowConfidenceShopperCompare(0, 0);
  assert.match(zero.summary, /Neither product has any written reviews/);
  assert.deepEqual(zero.evidence, { commentsAnalyzedA: 0, commentsAnalyzedB: 0 });
  const oneSided = lowConfidenceShopperCompare(0, 7);
  assert.match(oneSided.summary, /Product A has no written reviews/);
  // Pinned house rule (siteAnalyticsSeoAdmin): never the "<n> real review" phrasing.
  assert.doesNotMatch(`${r.summary} ${r.reasons.join(" ")}`, /\d+ real review/);
});

test("D8: the deterministic winner engine makes no substitutes claim", () => {
  const r = freeShopperCompare(slowA(), slowB());
  assert.equal(r.winner, "A");
  assert.equal(r.directSubstitutes, null);
  assert.equal(freeShopperCompare({}, {}).winner, "INCOMPARABLE");
  assert.equal(freeShopperCompare(zeroRecord("A"), zeroRecord("B")).winner, "INCOMPARABLE");
});

// ---------- D3/F5: the route's evidence input keeps the scan's own anchor ----------

test("F5: compareEvidenceInput passes the exact listing through", () => {
  const fromListingEvidence = compareEvidenceInput({
    productName: "Hamilton Beach Slow Cooker",
    reviewEvidence: { listingEvidence: { exactListingUrl: "https://www.amazon.ca/dp/B01GVGXGT8" } },
  });
  assert.equal(fromListingEvidence.listingUrl, "https://www.amazon.ca/dp/B01GVGXGT8");

  const passthrough = compareEvidenceInput({ productName: "Crock-Pot", listingUrl: "https://www.amazon.com/dp/B07B8P9JBQ" });
  assert.equal(passthrough.listingUrl, "https://www.amazon.com/dp/B07B8P9JBQ");

  const fromProduct = compareEvidenceInput({ product: { name: CROCKPOT, url: "https://www.amazon.com/dp/B07B8P9JBQ", store: "Amazon.com" } });
  assert.equal(fromProduct.productName, CROCKPOT);
  assert.equal(fromProduct.listingUrl, "https://www.amazon.com/dp/B07B8P9JBQ");

  const fromAsin = compareEvidenceInput({ product: { name: HAMILTON, store: "Amazon.ca", asin: "B01GVGXGT8" } });
  assert.equal(fromAsin.listingUrl, "https://www.amazon.ca/dp/B01GVGXGT8");

  const bare = compareEvidenceInput({});
  assert.equal(bare.listingUrl, null);
});

// ---------- D10/F6: no OpenAI winner path remains in the shopper-compare route ----------

test("F6: shopper-compare route has no OpenAI path and keeps the zero-OpenAI proof wrapper", () => {
  const route = readFileSync(resolve(root, "app/api/shopper-compare/route.ts"), "utf8");
  assert.doesNotMatch(route, /callOpenAI|guardedOpenAiFetch|isOpenAiFeatureEnabled|api\.openai\.com|OPENAI_API_KEY|shopperCompareSchema/);
  assert.match(route, /freeShopperCompare\(/);
  assert.match(route, /compareEvidenceInput\(product\)/);
  assert.match(route, /runZeroOpenAi[\s\S]*x-reviewintel-openai-calls/);
});

// ---------- CompareForm: load the real component module with test exports ----------

function loadCompareForm() {
  const ts = require("typescript");
  const filename = resolve(root, "components/CompareForm.tsx");
  const source =
    readFileSync(filename, "utf8") +
    "\nexport { localComparison, areLikelyDirectSubstitutes, productComparisonCategory, fallbackWinner, sideVerdictWord, isCompareIdentified, ResultCard, ComparisonScorecard, ShopperCompareToolProof, compareCopy };\n";
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const uiJiti = require("jiti")(root, {
    alias: { "@": root },
    extensions: [".js", ".json", ".ts", ".tsx", ".mjs"],
    cache: false,
    requireCache: false,
    transform: ({ source }) => ({
      code: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText,
    }),
  });
  return uiJiti.evalModule(compiled, { filename, ext: ".js" });
}

const form = loadCompareForm();
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const render = (el) => renderToStaticMarkup(el);
const copy = form.compareCopy("en");

// ---------- D1: client kind rules ----------

test("D1: two slow cookers are the same kind; different kinds are not", () => {
  assert.equal(form.productComparisonCategory(slowA()), "kitchen");
  assert.equal(form.productComparisonCategory(slowB()), "kitchen");
  assert.equal(form.areLikelyDirectSubstitutes(slowA(), slowB()), true);
  const purifier = ratedRecord({ name: PURIFIER, verdict: "BUY", score: 88, comments: 20 });
  assert.equal(form.productComparisonCategory(purifier), "home_appliance");
  assert.equal(form.areLikelyDirectSubstitutes(slowA(), purifier), false);
});

test("D1: substring traps no longer decide the category", () => {
  const carCare = ratedRecord({ name: "White Shine Car Care Kit", verdict: "BUY", score: 80, comments: 8 });
  const powerStation = ratedRecord({ name: "Jackery Portable Power Station 1000Wh", verdict: "BUY", score: 85, comments: 8 });
  // "wh" inside "White" must not make car care a battery product.
  assert.equal(form.productComparisonCategory(carCare), "automotive");
  assert.equal(form.productComparisonCategory(powerStation), "battery_power");
  assert.equal(form.areLikelyDirectSubstitutes(carCare, powerStation), false);
});

test("D1: identity guard — placeholder names, ASIN names and file names are not identified", () => {
  assert.equal(form.isCompareIdentified({ product: { name: "Analyzed product" } }), false);
  assert.equal(form.isCompareIdentified({ product: { name: "Amazon product" } }), false);
  assert.equal(form.isCompareIdentified({ product: { name: "Amazon B07B8P9JBQ" } }), false);
  assert.equal(form.isCompareIdentified({ fileName: "walmart-capture.png" }), false);
  assert.equal(form.isCompareIdentified({}), false);
  assert.equal(form.isCompareIdentified(slowA()), true);
});

// ---------- D1/D2/D7: localComparison semantics ----------

test("D7: local fallback uses the server engine's winner semantics", () => {
  const win = form.localComparison(slowA(), slowB(), copy);
  assert.equal(win.winner, "A");
  assert.equal(win.directSubstitutes, true);
  assert.equal(win.confidence, null);
  const tieA = ratedRecord({ name: CROCKPOT, verdict: "BUY", score: 80, comments: 10 });
  const tieB = ratedRecord({ name: HAMILTON, verdict: "BUY", score: 80.3, comments: 10 });
  assert.equal(form.localComparison(tieA, tieB, copy).winner, "TIE");
  assert.equal(form.fallbackWinner(slowA(), slowB()), "A");
  assert.equal(form.fallbackWinner(zeroRecord("A"), zeroRecord("B")), "INCOMPARABLE");
  assert.equal(form.fallbackWinner(null, null), null);
});

test("D1/D2: local different-types outcome is a real type judgment with no invented confidence", () => {
  const purifier = ratedRecord({ name: PURIFIER, verdict: "BUY", score: 88, comments: 20 });
  const r = form.localComparison(slowA(), purifier, copy);
  assert.equal(r.winner, "INCOMPARABLE");
  assert.equal(r.directSubstitutes, false);
  assert.equal(r.reason, "different_types");
  assert.equal(r.confidence, null);
});

test("D1/D2: local zero-evidence outcome is the low-confidence response — no banner, no 88", () => {
  const r = form.localComparison(zeroRecord("Product A"), zeroRecord("Product B"), copy);
  assert.equal(r.winner, "INCOMPARABLE");
  assert.equal(r.directSubstitutes, null);
  assert.equal(r.reason, "insufficient_evidence");
  assert.equal(r.confidence, null);
  assert.equal(r.verdictHeadline, "Low confidence");
  assert.doesNotMatch(JSON.stringify(r), /88/);
});

// ---------- D4/F3 + D5/F4: rendered side cards and scorecard ----------

test("D4/D5: a zero-evidence side renders Low confidence and Not measured — never DO NOT BUY YET or 0% signs", () => {
  const html = render(React.createElement(form.ResultCard, { label: "A", result: zeroRecord("Analyzed product"), winner: false }));
  assert.doesNotMatch(html, /DO NOT BUY YET/);
  assert.doesNotMatch(html, /0% signs/);
  assert.match(html, /Low confidence/);
  assert.match(html, /Not measured/);
  assert.equal(form.sideVerdictWord(zeroRecord("X")), "Low confidence");
});

test("D4: verdict words on compare come only from the canonical vocabulary", () => {
  assert.equal(form.sideVerdictWord(slowA()), "Buy");
  assert.equal(form.sideVerdictWord(slowB()), "Wait");
  assert.equal(form.sideVerdictWord(ratedRecord({ name: "X", verdict: "AVOID", score: 30, comments: 9 })), "Skip");
  const html = render(React.createElement(form.ResultCard, { label: "A", result: ratedRecord({ name: CROCKPOT, verdict: "DO NOT BUY YET", score: 40, comments: 9 }), winner: false }));
  assert.doesNotMatch(html, /DO NOT BUY YET/);
  assert.match(html, />Wait</);
});

test("D5: scorecard trust row prints nothing when no authenticity score exists", () => {
  const comparison = { winner: "INCOMPARABLE", directSubstitutes: null, confidence: null, reason: "insufficient_evidence", verdictHeadline: "Low confidence", summary: "", reasons: [], nextSteps: [] };
  const html = render(React.createElement(form.ComparisonScorecard, { productA: zeroRecord("Product A"), productB: zeroRecord("Product B"), comparison, copy }));
  assert.doesNotMatch(html, /100%/);
  assert.doesNotMatch(html, /DO NOT BUY YET/);
  assert.doesNotMatch(html, /Buying confidence only/);
  assert.match(html, /Not measured/);
});

test("D5: scorecard trust complements a real score (12% signs ↔ 88% trust) and verdicts stay canonical", () => {
  const comparison = { winner: "A", directSubstitutes: null, confidence: 50, verdictHeadline: "", summary: "", reasons: [], nextSteps: [] };
  const a = ratedRecord({ name: CROCKPOT, verdict: "BUY", score: 91, comments: 12, signs: 12 });
  const b = ratedRecord({ name: HAMILTON, verdict: "REVIEW FIRST", score: 56, comments: 9, signs: 12 });
  const html = render(React.createElement(form.ComparisonScorecard, { productA: a, productB: b, comparison, copy }));
  assert.match(html, /88%/);
  assert.match(html, />Buy</);
  assert.match(html, />Wait</);
  const card = render(React.createElement(form.ResultCard, { label: "A", result: a, winner: true }));
  assert.match(card, /12% signs/);
});

test("D5: the similar-evidence line has a floor — two empty sets are not similar evidence", () => {
  const html = render(React.createElement(form.ShopperCompareToolProof, { productA: zeroRecord("Product A"), productB: zeroRecord("Product B") }));
  assert.match(html, /Neither product has enough review evidence yet\./);
  assert.doesNotMatch(html, /similar review evidence/);
  assert.doesNotMatch(html, /Compare uses product memory, exact listing search, and review evidence for both products before deciding\./);
  const rich = render(React.createElement(form.ShopperCompareToolProof, { productA: slowA(), productB: slowB() }));
  assert.match(rich, /stronger review evidence|similar review evidence/);
});
