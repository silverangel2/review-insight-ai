// QA Inspector tests: one clean payload passes; one fixture per banned
// defect class fires exactly once with the right class + offending string.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js");

const qa = jiti(root + "lib/qaInspector.ts");
const lane = jiti(root + "lib/qaInspectorLane.ts");

const cleanPayload = () => ({
  scanId: "scan_clean_001",
  product: { title: "Weighted Idea Weighted Blanket" },
  shopperAnswer: {
    kind: "buy",
    label: "Buy",
    why: "Buyers say it keeps them warm through the night.",
    loves: [
      { claim: "Warm through the night", count: 12, quote: "It keeps me warm all night", sourceIds: ["h1"], sourceHashes: [] },
    ],
    complaints: [
      { claim: "Heavy to wash", count: 3, quote: "Washing it is a workout", sourceIds: ["h2"], sourceHashes: [] },
    ],
    reviewCount: 20,
    trustLine: "Built from 20 written buyer reviews.",
    confidenceWords: "Medium",
    value: "Good",
    score: 83,
  },
  factRows: [
    { term: "Marketplace rating", rating: 4.3 },
    { term: "Ratings counted", count: 9805 },
    { term: "How sure we are", text: "Medium" },
    { term: "Value for money", text: "Good" },
    { term: "Review authenticity", text: "Few AI-like signs" },
  ],
  basisLine: "Based on a solid set of written buyer reviews.",
});

test("clean stored result passes with zero findings", () => {
  const result = qa.inspectStoredResult(cleanPayload());
  assert.equal(result.scanId, "scan_clean_001");
  assert.equal(result.findings.length, 0, JSON.stringify(result.findings, null, 2));
});

test("defect (a): legacy verdict word in a verdict slot", () => {
  const payload = { ...cleanPayload(), decisionBrief: { verdict: "Review first" } };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "verdict_word");
  assert.match(result.findings[0].offendingString, /Review first/);
  assert.match(result.findings[0].field, /verdict/);
});

test("defect (a): uppercase AVOID leaking into customer copy", () => {
  const payload = { ...cleanPayload(), summary: "Our take: AVOID this unit." };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "verdict_word");
  assert.match(result.findings[0].offendingString, /AVOID/);
});

test("defect (b): __generic_concern placeholder in customer copy", () => {
  const payload = {
    ...cleanPayload(),
    decisionBrief: { against: [{ title: "Durability", summary: "One buyer hit __generic_concern with the zipper." }] },
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "placeholder");
  assert.match(result.findings[0].offendingString, /__generic_concern/);
});

test("defect (c): empty/dash fact row", () => {
  const payload = {
    ...cleanPayload(),
    factRows: [...cleanPayload().factRows, { term: "Value for money", text: "—" }].filter((r) => r.term !== "Value for money" || r.text === "—"),
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "empty_row");
  assert.match(result.findings[0].field, /factRows/);
});

test("defect (d): marketplace aggregate stated twice", () => {
  const payload = {
    scanId: "scan_agg_002",
    marketplaceAggregate: { rating: 4.5, ratingsCount: 5338 },
    answerCardLine: "Marketplace rating 4.5 from 5,338 ratings.",
    foldBasis: "This verdict rests on a 4.5 star rating across 5338 ratings.",
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "aggregate_twice");
});

test("defect (e): unbacked warning claim", () => {
  const payload = {
    ...cleanPayload(),
    analysis: { consistency_warnings: ["The unit may fail in cold weather"] },
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "unbacked_warning");
  assert.match(result.findings[0].offendingString, /fail in cold weather/);
});

test("defect (e): complaint claim with zero backing evidence", () => {
  const payload = {
    ...cleanPayload(),
    shopperAnswer: {
      ...cleanPayload().shopperAnswer,
      complaints: [{ claim: "Runs small", count: 1, quote: null, sourceIds: [], sourceHashes: [] }],
    },
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "unbacked_warning");
});

test("defect (f): authenticity label outside the approved trio", () => {
  const payload = {
    ...cleanPayload(),
    factRows: [
      { term: "Marketplace rating", rating: 4.3 },
      { term: "Review authenticity", text: "Looks mostly genuine" },
    ],
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "authenticity_label");
  assert.match(result.findings[0].offendingString, /Looks mostly genuine/);
});

test("payload with 3 defects reports 3 findings", () => {
  const base = cleanPayload();
  const payload = {
    ...base,
    decisionBrief: { verdict: "Review first", against: [{ summary: "One buyer hit __generic_concern." }] },
    factRows: [
      { term: "Marketplace rating", rating: 4.3 },
      { term: "Review authenticity", text: "Seems fine" },
    ],
  };
  const result = qa.inspectStoredResult(payload);
  const classes = result.findings.map((f) => f.defectClass).sort();
  assert.equal(result.findings.length, 3, JSON.stringify(result.findings, null, 2));
  assert.deepEqual(classes, ["authenticity_label", "placeholder", "verdict_word"]);
});

test("batch API groups findings by scan and stays fail-soft", () => {
  const bad = { ...cleanPayload(), scanId: "scan_bad", decisionBrief: { verdict: "Review first" } };
  const report = qa.inspectStoredResults([cleanPayload(), bad, null]);
  assert.equal(report.inspected, 2);
  assert.equal(report.findingsByScan.scan_clean_001.length, 0);
  assert.equal(report.findingsByScan.scan_bad.length, 1);
  assert.equal(report.recordErrors.length, 1); // the null record, recorded not thrown
});

test("lane runner: healthy when nothing found, escalates findings when present", async () => {
  const cleanStore = { loadRecentStoredResults: async () => [cleanPayload()] };
  const cleanLedger = { writeDefectEscalation: async () => true };
  const cleanReport = await lane.runQaInspectorLane(cleanStore, cleanLedger);
  assert.equal(cleanReport.status, "healthy");
  assert.equal(cleanReport.findings.length, 0);
  assert.equal(cleanReport.escalationsWritten, 0);

  const badPayload = { ...cleanPayload(), decisionBrief: { verdict: "Avoid" } };
  const written = [];
  const badLedger = {
    writeDefectEscalation: async (f) => {
      written.push(f);
      return true;
    },
  };
  const badStore = { loadRecentStoredResults: async () => [badPayload] };
  const badReport = await lane.runQaInspectorLane(badStore, badLedger);
  assert.equal(badReport.status, "degraded");
  assert.equal(badReport.findings.length, 1);
  assert.equal(badReport.escalationsWritten, 1);
  assert.equal(written[0].defectClass, "verdict_word");
  assert.equal(lane.qaDefectCheckId("verdict_word"), "qa_inspector.defect.verdict_word");
});

test("lane runner: unknown status when no store is available", async () => {
  const report = await lane.runQaInspectorLane(null, null);
  assert.equal(report.status, "unknown");
  assert.equal(report.scanned, 0);
});

// ── Audit fix 4 (1E): verdict slots are locale-aware ─────────────────────

const LOCALIZED_VERDICTS = [
  // [locale, buy, wait, skip]
  ["fr", "Acheter", "Attendre", "Passer"],
  ["es", "Comprar", "Esperar", "Omitir"],
  ["de", "Kaufen", "Abwarten", "Überspringen"],
  ["hi", "खरीदें", "रुकें", "छोड़ें"],
  ["zh", "购买", "等等", "跳过"],
  ["en", "Buy", "Wait", "Skip"]
];

for (const [locale, buy, wait, skip] of LOCALIZED_VERDICTS) {
  test(`no verdict_word false positive: ${locale} localized verdicts in verdict slots`, () => {
    const payload = {
      ...cleanPayload(),
      scanId: `scan_loc_${locale}`,
      shopperAnswer: { kind: "wait", label: wait, why: "Tout va bien." },
      decisionBrief: { verdict: buy, headline: "Un bon achat." }
    };
    const result = qa.inspectStoredResult(payload);
    const verdictFindings = result.findings.filter((f) => f.defectClass === "verdict_word");
    assert.deepEqual(verdictFindings, [], `${locale} verdict words must not fire verdict_word`);
  });
}

test("no verdict_word false positive: localized thin-evidence state in verdict slot", () => {
  const payload = {
    ...cleanPayload(),
    scanId: "scan_loc_lowconf",
    shopperAnswer: { kind: "wait", label: "Confiance faible", why: "Peu d'avis lus." }
  };
  const result = qa.inspectStoredResult(payload);
  assert.deepEqual(
    result.findings.filter((f) => f.defectClass === "verdict_word"),
    []
  );
});

test("legacy banned words STILL fire in copy even when verdict slots are localized", () => {
  const payload = {
    ...cleanPayload(),
    scanId: "scan_loc_legacy",
    shopperAnswer: { kind: "wait", label: "Attendre", why: "Fine." },
    summary: "Our take: AVOID this unit."
  };
  const result = qa.inspectStoredResult(payload);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].defectClass, "verdict_word");
  assert.match(result.findings[0].offendingString, /AVOID/);
});
