// Fix batch 2026-10-17: zero-written-reviews honesty + composeSignal hardening.
// Local-only verification tests. Run: node --test tests/fixbatch-empty-state.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");

// ---------- Stanley-like fixture: aggregate present, zero written reviews ----------
function stanleyFixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: [] },
      commentsAnalyzed: 0,
      listingEvidence: { rating: 4.6, reviewCount: 11537 },
      reviewCollector: {
        attempted: true,
        sourceUrl: "https://www.amazon.ca/dp/B0BQZC9MPW",
        extractor: "amazon",
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        fetchStatus: "empty",
        coverageNote:
          "11537 public marketplace reviews were visible, but written review text was not accessible from the listing HTML or fetched public review pages.",
        fallbackUrlsTried: [],
      },
      reviewsCollected: 0,
      collectorHasWrittenReviews: false,
      reviewIntelligenceMode: "listing_metadata",
    },
    product: { title: "Stanley Quencher H2.0 FlowState Tumbler 40 oz", store: "amazon.ca" },
    strengths: [],
    complaints: [],
    reviewsCollected: 0,
    reviewFetchStatus: "empty",
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "written_only",
      score: 89,
      verdict: "buy",
      confidence: "Medium",
      audit: { n: 0, Rbar: 4.6, N: 11537 },
    },
    verdict: "BUY",
    finalDecisionSource: "buyingScoreV2",
    valueForMoney: "Good",
  };
}

test("zero written reviews: no factors, writtenReviewsRead is 0, verdict path untouched", () => {
  const a = ra.deriveReviewAnalysis(stanleyFixture());
  assert.equal(a.forFactors.length, 0);
  assert.equal(a.againstFactors.length, 0);
  assert.equal(a.writtenReviewsRead, 0);
  assert.equal(a.complaintsPattern, "none");
  assert.equal(a.hasNegatives, false);
});

test("normal fixture: writtenReviewsRead counts accepted written bodies", () => {
  const r = stanleyFixture();
  r.reviewEvidence.evidenceAdjudication.acceptedRecords = [
    { id: "r1", body: "Keeps my water ice cold all day at the office, love the handle." },
    { id: "r2", body: "Fits in my car cup holder and the straw lid is easy to clean." },
    { id: "r3", body: "5" }, // not a written review body: excluded
  ];
  const a = ra.deriveReviewAnalysis(r);
  assert.equal(a.writtenReviewsRead, 2);
});

// ---------- composeSignal: empty summary stays empty (heading + tag only) ----------
// Fix batch 2026-10-17, REVERTED tally fallback: Junel's codified HARD LIMIT
// (tests/wordsmithHotfix.test.mjs "no figure the corpus doesn't contain is
// ever printed") forbids tally figures in summaries, and DecisionBrief
// already omits empty summaries (frame strip: heading + tag only). The
// `?? ""` seam is therefore the correct behavior — a null audit must never
// be dressed up with a new sentence.
test("normal scan: factor summaries are strings; empty ones are allowed (render omits them)", () => {
  const bodies = [
    "Love this tumbler! Keeps water ice cold from morning to night and the handle is comfortable.",
    "The straw lid is easy to take off and clean, and it fits perfectly in my car cup holder.",
    "Bought a second one for my husband after trying mine for a week. Great colors.",
    "It can leak if you tip it over in your bag, so keep the straw opening closed.",
  ];
  const r = stanleyFixture();
  r.reviewEvidence.evidenceAdjudication.acceptedRecords = bodies.map((body, i) => ({
    id: `r${i + 1}`,
    stableEvidenceHash: `h${i + 1}`,
    body,
    sourceUrl: "https://www.amazon.ca/dp/B0BQZC9MPW",
  }));
  r.strengths = [
    { claim: "keeps drinks cold for hours", supportCount: 3, sourceIds: ["r1", "r2", "r3"], sourceHashes: [] },
  ];
  r.complaints = [
    { claim: "can leak if tipped over (one-off report)", supportCount: 1, sourceIds: ["r4"], sourceHashes: [] },
  ];
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(a.forFactors.length > 0, "strengths must render");
  for (const f of [...a.forFactors, ...a.againstFactors]) {
    assert.ok(typeof f.summary === "string", `summary not a string on: ${f.title}`);
    assert.ok(!/pipeline|provenance|factor/i.test(f.summary), `backstage term leaked: ${f.summary}`);
  }
});

// ---------- determinism ----------
test("same input = same words out", () => {
  const bodies = [
    "Love this tumbler! Keeps water ice cold from morning to night and the handle is comfortable.",
    "The straw lid is easy to take off and clean, and it fits perfectly in my car cup holder.",
  ];
  const mk = () => {
    const r = stanleyFixture();
    r.reviewEvidence.evidenceAdjudication.acceptedRecords = bodies.map((body, i) => ({
      id: `r${i + 1}`,
      stableEvidenceHash: `h${i + 1}`,
      body,
      sourceUrl: "https://www.amazon.ca/dp/B0BQZC9MPW",
    }));
    r.strengths = [
      { claim: "keeps drinks cold for hours", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: [] },
    ];
    return r;
  };
  const a1 = ra.deriveReviewAnalysis(mk());
  const a2 = ra.deriveReviewAnalysis(mk());
  assert.deepEqual(
    a1.forFactors.map((f) => [f.title, f.summary, f.basis]),
    a2.forFactors.map((f) => [f.title, f.summary, f.basis])
  );
});
