import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../buying-score-v2-test.js", import.meta.url).pathname);
const bs = jiti("./lib/buyingScore.ts");
const { extractMarketplaceAggregateFromHtml } = jiti("./lib/marketplaceAggregate.ts");
const { computeBuyingScore, buyingScoreFromReviews, dedupeAcrossStores, reviewMatchesExactModel, recallStatement, classifyReview } = bs;

const base = { visibleMeanStars: null, rel: 0, relSameTheme: 0, saf: 0, safSameHazard: 0, min: 0, themes: 0, secondStoreReviewCount: 0, variantResolved: true };
const sig = (o) => ({ ...base, ...o });
const allText = (r) => JSON.stringify({ label: r.label, provisionalLabel: r.provisionalLabel, evidenceLine: r.evidenceLine, confidenceReason: r.confidenceReason, warnings: r.warnings, notes: r.notes, primaryAction: r.primaryAction });

test("constants are the documented neutral prior and bands", () => {
  assert.equal(bs.PRIOR_RATING_C, 4.0);
  assert.equal(bs.PRIOR_WEIGHT_M, 500);
  assert.equal(bs.verdictFromScore(75), "Buy");
  assert.equal(bs.verdictFromScore(74), "Wait");
  assert.equal(bs.verdictFromScore(50), "Wait");
  assert.equal(bs.verdictFromScore(49), "Skip");
});

test("Example 1: 4.8 from 10,000, 2 of 8 report failures -> 70 Wait, Low", () => {
  const r = computeBuyingScore(sig({ rating: 4.8, ratingCount: 10000, n: 8, meanSentiment: 0.1, visibleMeanStars: 3.4, rel: 2, relSameTheme: 2, relTheme: "the product stopping after about a month", themes: 1 }));
  assert.equal(r.audit.Rstar, 4.762);
  assert.equal(r.audit.B, 94.0);
  assert.equal(r.audit.discrepancyFlag, true);
  assert.equal(r.audit.Neg, 24);
  assert.equal(r.audit.A, -23.6);
  assert.equal(r.score, 70);
  assert.equal(r.verdict, "Wait");
  assert.deepEqual(r.audit.capsApplied, []); // the Rel>=2 cap (74) does not bind
  assert.equal(r.audit.marketConf, "High");
  assert.equal(r.audit.evidenceConf, "Medium");
  assert.equal(r.confidence, "Low");
  assert.ok(r.warnings.some((w) => w.tier === "repeated_reliability" && w.text.includes("Repeated reports of") && w.text.includes("2 of 8 reviews read")));
  assert.ok(r.warnings.some((w) => w.text === "The reviews we could read are noticeably worse than the 4.8★ overall rating."));
});

test("Example 2: 5.0 from 12, 6 positive -> too-new cap 74 Wait, Low", () => {
  const r = computeBuyingScore(sig({ rating: 5.0, ratingCount: 12, n: 6, meanSentiment: 0.6, visibleMeanStars: 5 }));
  assert.equal(r.audit.Rstar, 4.023);
  assert.equal(r.audit.B, 75.6);
  assert.equal(r.rawScore, 74);
  assert.deepEqual(r.audit.capsApplied, ["too_new"]);
  assert.equal(r.score, 74);
  assert.equal(r.verdict, "Wait");
  assert.equal(r.confidence, "Low");
  assert.ok(allText(r).includes("Early reviews are positive, but there are only 12 ratings so far."));
});

test("Example 3: 4.4 from 20,000, 9 reviews, 1 minor -> 83 Buy, Medium", () => {
  const r = computeBuyingScore(sig({ rating: 4.4, ratingCount: 20000, n: 9, meanSentiment: 0.3, min: 1 }));
  assert.equal(r.audit.Rstar, 4.39);
  assert.equal(r.audit.B, 84.8);
  assert.equal(r.audit.Pos, 1.4);
  assert.equal(r.audit.Neg, 3);
  assert.equal(r.score, 83);
  assert.equal(r.verdict, "Buy");
  assert.equal(r.confidence, "Medium");
  assert.equal(r.evidenceLine, "9 written reviews read · 4.4★ from 20,000 ratings");
});

test("Example 4: 3.9 from 50,000, mixed, recurring noise -> 63 Wait, Medium", () => {
  const r = computeBuyingScore(sig({ rating: 3.9, ratingCount: 50000, n: 8, meanSentiment: 0, min: 2, themes: 1, topThemeLabel: "noise", topThemeCount: 2 }));
  assert.equal(r.audit.B, 72.5);
  assert.equal(r.audit.Neg, 10);
  assert.equal(r.score, 63);
  assert.equal(r.verdict, "Wait");
  assert.equal(r.confidence, "Medium");
  assert.ok(r.notes.includes("Buyers are split. The most common complaint is noise (2 of 8 reviews read)."));
});

test("Example 5: single safety report -> cap 74 Wait, High, no recall text", () => {
  const r = computeBuyingScore(sig({ rating: 4.6, ratingCount: 3000, n: 10, meanSentiment: 0.4, saf: 1, safSameHazard: 1, safHazard: "the charger overheating", quotes: { safety: ["charger overheated and melted"], reliability: [], positive: [], negative: [] } }));
  assert.equal(r.audit.Rstar, 4.514);
  assert.equal(r.audit.B, 87.9);
  assert.equal(r.audit.Pos, 2);
  assert.equal(r.audit.Neg, 10);
  assert.equal(r.rawScore, 74);
  assert.deepEqual(r.audit.capsApplied, ["single_safety"]);
  assert.equal(r.verdict, "Wait");
  assert.equal(r.confidence, "High");
  assert.ok(r.warnings.some((w) => w.tier === "single_safety" && w.text === "One customer reported the charger overheating (single unverified report)."));
  assert.equal(r.recallStatement, null);
  assert.doesNotMatch(allText(r), /recall/i);
  // Two independent reports -> 54; a verified recall -> 30.
  assert.equal(computeBuyingScore(sig({ rating: 4.6, ratingCount: 3000, n: 10, meanSentiment: 0.4, saf: 2, safSameHazard: 2, themes: 1 })).score <= 54, true);
  const recalled = computeBuyingScore(sig({ rating: 4.6, ratingCount: 3000, n: 10, meanSentiment: 0.4, saf: 1, safSameHazard: 1, recall: { queried: true, succeeded: true, recalled: true, sourceName: "Health Canada" } }));
  assert.equal(recalled.score, 30);
  assert.equal(recalled.verdict, "Skip");
});

test("Example 6: zero written reviews -> Provisional Marketplace Score 85, Leaning Buy, Low", () => {
  const r = computeBuyingScore(sig({ rating: 4.5, ratingCount: 2143, n: 0, meanSentiment: 0 }));
  assert.equal(r.audit.Rstar, 4.405);
  assert.equal(r.mode, "provisional_marketplace");
  assert.equal(r.label, "Provisional Marketplace Score");
  assert.equal(r.score, 85);
  assert.equal(r.verdict, null);
  assert.equal(r.leaning, "Buy");
  assert.equal(r.confidence, "Low");
  assert.equal(r.provisionalLabel, "Provisional · based on marketplace rating only · 0 written reviews read");
  assert.equal(r.primaryAction, "Paste the exact product link for a full Buying Score");
  assert.ok(r.notes[0].startsWith("Based on the marketplace rating only."));
});

test("edge: N = 0 / no rating with written reviews -> written-only Buying Score, Low", () => {
  const r = computeBuyingScore(sig({ rating: null, ratingCount: null, n: 4, meanSentiment: 0.5 }));
  assert.equal(r.mode, "written_only");
  // 50 + 40*0.5*(4/14) = 55.7, then too-new cap does not bind
  assert.equal(r.score, 56);
  assert.equal(r.confidence, "Low");
});

test("edge: n = 0 and no rating -> the only no-score case", () => {
  const r = computeBuyingScore(sig({ rating: null, ratingCount: null, n: 0, meanSentiment: 0 }));
  assert.equal(r.mode, "no_score");
  assert.equal(r.score, null);
  assert.match(r.primaryAction, /exact product link or add a review screenshot/);
});

test("edge: histogram missing -> discrepancy uses only the mean-stars rule", () => {
  const noHist = computeBuyingScore(sig({ rating: 4.5, ratingCount: 2000, n: 5, meanSentiment: 0, visibleMeanStars: 3.8, visibleLowShare: 0.6, marketplaceLowShare: null }));
  assert.equal(noHist.audit.discrepancyFlag, false);
  const withHist = computeBuyingScore(sig({ rating: 4.5, ratingCount: 2000, n: 5, meanSentiment: 0, visibleMeanStars: 3.8, visibleLowShare: 0.6, marketplaceLowShare: 0.1 }));
  assert.equal(withHist.audit.discrepancyFlag, true);
  assert.equal(computeBuyingScore(sig({ rating: 4.5, ratingCount: 2000, n: 2, meanSentiment: 0, visibleMeanStars: 1 })).audit.discrepancyFlag, false, "needs n >= 3");
});

test("edge: volume never raises the score on its own", () => {
  const small = computeBuyingScore(sig({ rating: 4.0, ratingCount: 100, n: 5, meanSentiment: 0 })).score;
  const big = computeBuyingScore(sig({ rating: 4.0, ratingCount: 100000, n: 5, meanSentiment: 0 })).score;
  assert.equal(small, big);
});

test("edge: confidence bands and downgrades", () => {
  assert.equal(computeBuyingScore(sig({ rating: 4.4, ratingCount: 5000, n: 2, meanSentiment: 0.2 })).confidence, "Low");
  assert.equal(computeBuyingScore(sig({ rating: 4.4, ratingCount: 5000, n: 5, meanSentiment: 0.2, secondStoreReviewCount: 3 })).confidence, "High");
  assert.equal(computeBuyingScore(sig({ rating: 4.4, ratingCount: 5000, n: 12, meanSentiment: 0.2, variantResolved: false })).confidence, "Medium");
});

test("edge: duplicate review within one store counts once", () => {
  const body = "Stopped working after a month, very disappointed with this unit.";
  const out = dedupeAcrossStores([
    { body, rating: 1, sourceUrl: "https://www.amazon.test/dp/X" },
    { body: body + " ", rating: 1, sourceUrl: "https://www.amazon.test/dp/X" },
  ]);
  assert.equal(out.length, 1);
});

test("edge: the same syndicated review at two retailers counts once (no fake second report)", () => {
  const text = "The charger overheated and melted on the second day. Unsafe.";
  const res = buyingScoreFromReviews({
    marketplace: { rating: 4.6, count: 3000 },
    reviews: [
      { body: text, rating: 1, sourceUrl: "https://www.walmart.test/ip/1" },
      { body: "The charger overheated and melted on the 2nd day. Unsafe!", rating: 1, sourceUrl: "https://www.bestbuy.test/site/2" },
      { body: "Great value, works well.", rating: 5, sourceUrl: "https://www.walmart.test/ip/1" },
    ],
  });
  assert.equal(res.audit.n, 2);
  assert.equal(res.audit.Saf, 1);
  assert.ok(res.warnings.some((w) => w.tier === "single_safety"));
  assert.ok(!res.warnings.some((w) => w.tier === "repeated_safety"));
});

test("edge: same reviewer + date within 3 days + same stars is a duplicate", () => {
  const out = dedupeAcrossStores([
    { body: "Loud fan but works.", rating: 3, reviewer: "Pat K", date: "2026-05-01", sourceUrl: "https://a.test/x" },
    { body: "Works fine, the fan is loud though, a bit annoying at night.", rating: 3, reviewer: "pat k", date: "2026-05-03", sourceUrl: "https://b.test/y" },
  ]);
  assert.equal(out.length, 1);
});

test("edge: two independent safety reports of the same hazard -> cap 54", () => {
  const res = buyingScoreFromReviews({
    marketplace: { rating: 4.7, count: 5000 },
    reviews: [
      { body: "It overheated and the casing melted near the plug.", rating: 1, reviewer: "A", date: "2026-01-01" },
      { body: "Unit got so hot it overheated while charging, scary.", rating: 2, reviewer: "B", date: "2026-03-01" },
      { body: "Great and reliable.", rating: 5, reviewer: "C", date: "2026-03-02" },
    ],
  });
  assert.equal(res.audit.Saf, 2);
  assert.ok(res.score <= 54);
  assert.ok(res.warnings.some((w) => w.tier === "repeated_safety" && w.text.startsWith("Several customers independently report")));
});

test("edge: variant mismatch dropped (AF100C quote cannot count for AF101C)", () => {
  assert.equal(reviewMatchesExactModel({ body: "My AF100C stopped working" }, "AF101C").ok, false);
  assert.equal(reviewMatchesExactModel({ body: "Upgraded from the AF100C to the AF101C, love it" }, "AF101C").ok, true);
  assert.equal(reviewMatchesExactModel({ body: "Works great" , reviewedModel: "AF100C" }, "AF101C").ok, false);
  const res = buyingScoreFromReviews({
    marketplace: { rating: 4.5, count: 1000 }, requestedModel: "AF101C",
    reviews: [{ body: "My AF100C stopped working after a week.", rating: 1 }, { body: "Works well, happy.", rating: 5 }],
  });
  assert.equal(res.audit.n, 1);
  assert.equal(res.droppedForModelMismatch, 1);
  assert.equal(res.audit.Rel, 0);
  const wrongAggregate = buyingScoreFromReviews({ marketplace: { rating: 4.9, count: 9000, matchesExactModel: false }, reviews: [] });
  assert.equal(wrongAggregate.mode, "no_score");
});

test("edge: no recall statement unless an authoritative source was queried that scan", () => {
  assert.equal(recallStatement(null), null);
  assert.equal(recallStatement({ queried: false, succeeded: false, recalled: false }), null);
  assert.equal(recallStatement({ queried: true, succeeded: false, recalled: false }), null);
  assert.equal(recallStatement({ queried: true, succeeded: true, recalled: false }), "No official recall found");
  const res = buyingScoreFromReviews({ marketplace: { rating: 4.6, count: 3000 }, reviews: [{ body: "The battery overheated badly.", rating: 2 }] });
  assert.equal(res.recallStatement, null);
  assert.doesNotMatch(allText(res), /recall/i);
});

test("rule-based classifier: severity, negation and sentiment", () => {
  assert.equal(classifyReview({ body: "It caught fire on the counter" }).safety, "fire");
  assert.equal(classifyReview({ body: "Never overheated, no problems" }).safety, null);
  assert.equal(classifyReview({ body: "Stopped working after two weeks" }).reliability, "stopped");
  assert.deepEqual(classifyReview({ body: "Too loud for an apartment" }).minor, ["noise"]);
  assert.ok(classifyReview({ body: "Love it, works great", rating: 5 }).sentiment > 0.5);
});

test("output never contains banned copy and logs OpenAI count 0", () => {
  const cases = [
    computeBuyingScore(sig({ rating: 4.5, ratingCount: 2143, n: 0, meanSentiment: 0 })),
    computeBuyingScore(sig({ rating: null, ratingCount: null, n: 0, meanSentiment: 0 })),
    computeBuyingScore(sig({ rating: 4.5, ratingCount: 2143, n: 1, meanSentiment: 0 })),
  ];
  for (const r of cases) {
    assert.doesNotMatch(allText(r), /Not enough evidence|Not scored/i);
    assert.equal(bs.buyingScoreLogFields(r).openAiCalls, 0);
  }
  const log = bs.buyingScoreLogFields(cases[2]);
  for (const k of ["N", "Rbar", "Rstar", "n", "sBar", "Rel", "Saf", "Min", "T", "discrepancyFlag", "capsApplied", "S", "confidence", "openAiCalls"]) assert.ok(k in log, k);
  assert.doesNotMatch(readFileSync(new URL("../lib/buyingScore.ts", import.meta.url), "utf8"), /import[^\n]*openai|\bfetch\(/i);
});

test("marketplace aggregate extraction from a product page (no fill-ins)", () => {
  const html = `<span id="acrPopover" title="4.5 out of 5 stars"></span><span id="acrCustomerReviewText">2,143 ratings</span>
    <a aria-label="72 percent of reviews have 5 stars"></a><a aria-label="14 percent of reviews have 4 stars"></a>
    <a aria-label="6 percent of reviews have 3 stars"></a><a aria-label="3 percent of reviews have 2 stars"></a><a aria-label="5 percent of reviews have 1 stars"></a>`;
  const agg = extractMarketplaceAggregateFromHtml(html);
  assert.equal(agg.rating, 4.5);
  assert.equal(agg.count, 2143);
  assert.deepEqual(agg.histogram, { 5: 72, 4: 14, 3: 6, 2: 3, 1: 5 });
  const ld = extractMarketplaceAggregateFromHtml(`<script type="application/ld+json">{"@type":"Product","aggregateRating":{"ratingValue":"4.2","reviewCount":"318"}}</script>`);
  assert.equal(ld.rating, 4.2); assert.equal(ld.count, 318); assert.equal(ld.histogram, null);
  const none = extractMarketplaceAggregateFromHtml("<html>nothing</html>");
  assert.deepEqual(none, { rating: null, count: null, histogram: null, source: null });
});
