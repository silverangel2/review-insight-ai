// Frame strip 2026-10-16 (Junel: customers cannot understand the
// pattern-metaphor lines — "Fucking cement it").
//
// Live failure (scan_050e9024, Instant Pot Duo, PR #61 build): theme basis
// printed pure pattern metaphors carrying zero information —
// "The reviews keep circling back to this. This is a steady drumbeat in the
// reviews." A shopper reads that and learns NOTHING.
//
// The fix: the regular theme path in composeSignal prints NO pattern
// sentences at all. A theme renders heading + tag only. The ONLY basis line
// that can print there is an evidenced opposing-signal caveat (hard rule:
// never hide an EVIDENCED negative signal) — a standalone sentence carrying
// the real note. One-off and red-flag paths are untouched: their sentences
// carry real {theme}/{detail} content.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");
const ac = jiti(root + "lib/analysisCopy.ts");

// Every pattern-sentence family the deck offers for theme basis. NONE of
// these may print in a regular-path theme summary after the strip.
const PATTERN_FAMILIES = [
  ...ac.FOR_LEAD_STRONGEST,
  ...ac.FOR_LEAD_SECOND,
  ...ac.FOR_LEAD_REST,
  ...ac.VALUE_LEADS,
  ...ac.AGAINST_LEAD_TOP,
  ...ac.AGAINST_LEAD_OTHER,
  ...ac.STRENGTH_DOMINANT_FIRST,
  ...ac.STRENGTH_DOMINANT,
  ...ac.STRENGTH_HALF,
  ...ac.STRENGTH_REPEATED,
  ...ac.STRENGTH_FEW,
  ...ac.CLOSERS,
];

const BODIES = [
  "Wipes clean in seconds, nothing sticks to the surface at all.",
  "Heats up faster than my old unit, dinner is ready in minutes.",
  "The controls could not be simpler, one dial does everything.",
  "After three months the lid seal is already wearing out.",
  "The power cord is frustratingly short for my kitchen layout.",
  "Cleaning is painless, a quick rinse and it looks new.",
  "Gets hot fast and holds the temperature steady throughout.",
  "Simple enough that my teenager figured it out alone.",
  "Lid no longer seals properly, steam escapes around the edges.",
  "Cord barely reaches from the counter to the outlet.",
];
const records = (n, prefix = "r") =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    stableEvidenceHash: `${prefix}h${i + 1}`,
    body: BODIES[i % BODIES.length],
    sourceUrl: "https://www.amazon.ca/dp/TESTSTRIP",
  }));
const ids = (n, prefix = "r") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

// Corpus 1: themes that used to print generic pattern frames (multi-rank FOR
// themes, an AGAINST theme, and a FOR theme with an evidenced opposing
// complaint on the same key).
function genericFrameCorpus() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(20) },
      commentsAnalyzed: 20,
      listingEvidence: { rating: 4.6, reviewCount: 148258 },
    },
    product: { title: "Test Product", store: "amazon.ca" },
    strengths: [
      { claim: "easy to clean", supportCount: 12, sourceIds: ids(20), sourceHashes: [] },
      { claim: "heats up fast", supportCount: 8, sourceIds: ids(12), sourceHashes: [] },
      { claim: "simple controls", supportCount: 4, sourceIds: ids(6), sourceHashes: [] },
    ],
    complaints: [
      { claim: "lid seal wears out", supportCount: 5, sourceIds: ids(8), sourceHashes: [] },
      // Same key as a FOR theme: the 3 complaints lose on net direction but
      // are evidenced, so they must be voiced as a standalone caveat.
      { claim: "easy to clean", supportCount: 3, sourceIds: ["r13", "r14", "r15"], sourceHashes: [] },
    ],
  };
}

// Corpus 2: factual basis lines — a one-off (single-buyer) theme.
function factualCorpus() {
  return {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(20) },
      commentsAnalyzed: 20,
      listingEvidence: { rating: 4.6, reviewCount: 148258 },
    },
    product: { title: "Test Product", store: "amazon.ca" },
    strengths: [{ claim: "easy to clean", supportCount: 12, sourceIds: ids(20), sourceHashes: [] }],
    complaints: [{ claim: "short power cord", supportCount: 1, sourceIds: ["r1"], sourceHashes: [] }],
  };
}

const allFactors = (a) => [...a.forFactors, ...a.againstFactors];

test("corpus 1: no pattern sentence prints in any regular-path theme basis", () => {
  const a = ra.deriveReviewAnalysis(genericFrameCorpus());
  const factors = allFactors(a);
  assert(factors.length >= 4, `fixture yields >= 4 themes, got ${factors.length}`);
  for (const f of factors) {
    for (const s of PATTERN_FAMILIES) {
      assert(
        !f.summary.includes(s),
        `pattern sentence must not print [${f.title}]: found "${s}"`
      );
    }
  }
});

test("corpus 1: regular themes render heading + tag only (no empty-row artifacts)", () => {
  const a = ra.deriveReviewAnalysis(genericFrameCorpus());
  for (const f of allFactors(a)) {
    assert(f.title && f.title.length > 0, "theme heading present");
    assert(f.basis && f.basis.length > 0, `tally tag present [${f.title}]`);
    // summary is "" (heading + tag only) or a standalone caveat — never a
    // join artifact, never whitespace-only.
    assert(
      f.summary === "" || f.summary.trim().length > 0,
      `no whitespace-only basis [${f.title}]`
    );
    assert(!/  /.test(f.summary), `no double-space artifact [${f.title}]`);
  }
  // The plain repeated themes print NOTHING as basis: heading + tag only.
  const heatsUp = allFactors(a).find((f) => /heats up fast/i.test(f.title));
  assert(heatsUp, "heats-up theme exists");
  assert.strictEqual(heatsUp.summary, "", "generic-frame theme: heading + tag only");
});

test("corpus 1: an evidenced opposing complaint is voiced as a standalone caveat", () => {
  const a = ra.deriveReviewAnalysis(genericFrameCorpus());
  const easyClean = allFactors(a).find((f) => /easy to clean/i.test(f.title));
  assert(easyClean, "easy-to-clean theme exists");
  assert(easyClean.summary.length > 0, "evidenced opposing signal is voiced, never hidden");
  const note = ac.depthFor("easy to clean")?.againstNote ?? "some buyers had the opposite experience";
  assert(
    /^(A few buyers found|Not every buyer agrees|A small minority reported)/.test(easyClean.summary),
    `standalone caveat shape: ${easyClean.summary}`
  );
  assert(
    easyClean.summary.includes(note),
    `caveat carries the real note: ${easyClean.summary}`
  );
  for (const s of PATTERN_FAMILIES) {
    assert(!easyClean.summary.includes(s), `caveat has no pattern sentence: ${s}`);
  }
});

test("corpus 2: factual one-off basis lines stay intact", () => {
  const a = ra.deriveReviewAnalysis(factualCorpus());
  const oneOff = allFactors(a).find((f) => /short power cord/i.test(f.title));
  assert(oneOff, "one-off theme exists");
  assert(
    /short power cord/i.test(oneOff.summary),
    `one-off keeps its factual theme content: ${oneOff.summary}`
  );
  assert(oneOff.basis.length > 0, "one-off keeps its tally tag");
});

test("same corpus renders byte-identical output (determinism preserved)", () => {
  const a = ra.deriveReviewAnalysis(genericFrameCorpus());
  const b = ra.deriveReviewAnalysis(genericFrameCorpus());
  const sa = JSON.stringify(allFactors(a));
  const sb = JSON.stringify(allFactors(b));
  assert.strictEqual(sa, sb, "deterministic composition");
});
