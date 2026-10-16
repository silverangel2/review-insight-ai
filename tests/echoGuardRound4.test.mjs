import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const { oneOffThemeFill, deriveReviewAnalysis } = jiti(root + "lib/reviewAnalysis.ts");

// ---------------------------------------------------------------------------
// 1. oneOffThemeFill: the unit contract.
// ---------------------------------------------------------------------------

test("rejects a fill that echoes the backing review body (Sony case)", () => {
  const body =
    "I love pink! and what can even be better than pink than a pink quality headphone!!";
  const fill = oneOffThemeFill(
    "i love pink! and what can even be better than pink than a pink quality headphone!!",
    [body]
  );
  assert.equal(fill, null);
});

test("echo detection is case-insensitive and partial (≥65% token overlap)", () => {
  const body = "The noise cancellation is superb and the battery lasts forever on flights";
  // label shares 8/10 significant body tokens (80%) -> echo, rejected
  assert.equal(
    oneOffThemeFill("the noise cancellation is superb and battery lasts forever", [body]),
    null
  );
  // genuine short label against a long body: only 2/~6 tokens overlap -> kept
  assert.equal(oneOffThemeFill("material safety warnings", [body]), "material safety warnings");
});

test("rejects quote-length fills even when no backing texts are available", () => {
  const long =
    "this came up once because the battery on this unit died after only two days of light use";
  assert.equal(oneOffThemeFill(long, []), null);
});

test("rejects empty fills", () => {
  assert.equal(oneOffThemeFill("   ", ["some review body here"]), null);
  assert.equal(oneOffThemeFill("", []), null);
});

test("keeps a genuine short theme label", () => {
  const body =
    "Overall a great product, easy to set up and the coffee tastes excellent every morning";
  assert.equal(oneOffThemeFill("great taste", [body]), "great taste");
  // ...even with no texts at all
  assert.equal(oneOffThemeFill("great taste", []), "great taste");
});

test("keeps short labels against short bodies when overlap is below the echo bar", () => {
  // body tokens: battery(1) drains(2) fast(3) long(4) flights(5) — label holds 2/5 = 40%
  const body = "Battery drains fast on long flights";
  assert.equal(oneOffThemeFill("battery drains fast", [body]), "battery drains fast");
});

// ---------------------------------------------------------------------------
// 2. Integration: quote-only factors never print an echo of the review.
// ---------------------------------------------------------------------------

function quoteOnlyResult(bodies) {
  return {
    verdict: "WAIT",
    buyingScoreV2: {
      version: "buying-score-v2",
      mode: "written_only",
      score: 72,
      verdict: "Wait",
      confidence: "High",
      audit: { n: bodies.length },
      quotes: { negative: [] },
    },
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/B09XS7JWHH",
        })),
      },
    },
  };
}

function significantTokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

test("quote-only for-factors render the bare basis label, never a lowercased echo", () => {
  const bodies = [
    "I love pink! and what can even be better than pink than a pink quality headphone!!",
    "Sound quality is incredible and the noise cancelling actually works on planes",
  ];
  const analysis = deriveReviewAnalysis(quoteOnlyResult(bodies));
  assert.ok(analysis.forFactors.length >= 1, "expected for factors from quote-only points");
  for (const factor of analysis.forFactors) {
    // The exact defect shape: summary must not be a frame filled with the quote.
    assert.equal(factor.summary, "One buyer reported this.", `unexpected summary: ${factor.summary}`);
    // Belt and braces: no 65%+ token echo of any body anywhere in the summary.
    const summaryTokens = significantTokens(factor.summary);
    for (const body of bodies) {
      const bodyTokens = significantTokens(body);
      if (bodyTokens.length < 3) continue;
      const hits = bodyTokens.filter((t) => summaryTokens.includes(t)).length;
      assert.ok(
        hits / bodyTokens.length < 0.65,
        `summary echoes a review body: ${factor.summary}`
      );
    }
  }
});

test("against-side one-off frames get the identical guard", () => {
  // Same shared ONE_OFF_LEADS family ("A single report describes {theme}",
  // "One buyer's experience included {theme}"): a raw quote fill is rejected.
  const body = "The ear cushions started peeling off after only three weeks of daily use";
  assert.equal(oneOffThemeFill(body.toLowerCase(), [body]), null);
});
