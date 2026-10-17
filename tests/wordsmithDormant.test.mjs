// Wordsmith hotfix 2 2026-10-16 — SWITCHED OFF at the compose seam.
//
// Live failure that ended the enrichment (scan_41a15295, same Instant Pot,
// PR #60): the miner's raw n-gram fragments stitched ungrammatically into
// the new frames — verbatim: "anyone looking and build quality — that's
// what buyers keep naming." / "What buyers name, again and again: doesn't
// require a separate and interior unlike most electric." / "That buyer got
// specific: combining multiple cooking methods and pressure cooking
// drastically reduces." (cut off mid-clause). Fragments repeated across
// themes. Still alien — Dylan's decision: enrichment OFF, basis lines
// return to the plain, grammatical sentence-library composition that
// predates the Wordsmith (the style that passed Junel's checks on the
// Shark / Keurig / Sony live proofs). The miner cannot yet produce
// clause-complete paraphrase; until a future round proves that on multiple
// real corpora, it does not print.
//
// Frame strip 2026-10-16 (Junel: the sentence-library pattern metaphors are
// unintelligible to shoppers — "Fucking cement it"): the plain composition
// itself is now reduced to heading + tag only. No pattern sentences print in
// the regular theme path; an evidenced opposing signal still voices a
// standalone caveat, and one-off / red-flag factual lines are untouched.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ra = jiti(root + "lib/reviewAnalysis.ts");

// ---------- fixture: Instant-Pot-like weak corpus (hotfix #1 shape) ----------
const INSTANT_POT_TITLE =
  "Instant Pot Duo 7-in-1 Electric Pressure Cooker, Slow Cooker, Rice Cooker, Steamer, Saute, Yogurt Maker, Warmer & Sterilizer, Includes App With Over 800 Recipes, Stainless Steel, 6 Quart";

const bodies = [
  "This instant pot is great, the electric pressure cooker works so well for our family.",
  "Love my instant pot. Best electric pressure cooker I have ever owned.",
  "The instant pot cooks fast and the electric pressure cooker is easy to clean.",
  "Great instant pot, the electric pressure cooker makes dinner in minutes.",
  "My instant pot never disappoints, this electric pressure cooker is a workhorse.",
  "The electric pressure cooker is fantastic, my instant pot gets used daily.",
  "Solid instant pot, the electric pressure cooker seals perfectly every time.",
  "Excellent electric pressure cooker. This instant pot replaced my old one.",
];

function fixture() {
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `r${i + 1}`,
          stableEvidenceHash: `rh${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/DORMANTTEST",
        })),
      },
      commentsAnalyzed: 8,
      listingEvidence: { rating: 4.6, reviewCount: 148258 },
    },
    product: { title: INSTANT_POT_TITLE, store: "amazon.ca" },
    strengths: [
      {
        claim: "fast cooking",
        supportCount: 6,
        sourceIds: bodies.map((_, i) => `r${i + 1}`),
        sourceHashes: [],
      },
    ],
    complaints: [],
  };
}

// ---------- the regression asserts ----------
const WORDSMITH_FRAMES =
  /that's what buyers keep naming|in the reviewers' own specifics|the detail that keeps coming up|what buyers name, again and again|the recurring detail across reviews|that's what the one buyer named|described in that review as|that buyer got specific|the report named|described in the report as|the report called out/i;

const LIVE_FRAGMENTS = [
  "anyone looking and build quality",
  "doesn't require a separate and interior unlike most electric",
  "combining multiple cooking methods and pressure cooking drastically reduces",
];

test("composed basis carries no wordsmith frames and no mined fragments", () => {
  const a = ra.deriveReviewAnalysis(fixture());
  const factor = a.forFactors.find((f) => /fast cooking/i.test(f.title));
  assert(factor, "fast-cooking factor exists");
  assert(
    !WORDSMITH_FRAMES.test(factor.summary),
    `no wordsmith frame in summary: ${factor.summary}`
  );
  for (const frag of LIVE_FRAGMENTS) {
    assert(!factor.summary.includes(frag), `mined fragment present: ${frag}`);
  }
});

test("composed basis prints findings bullets, never pattern sentences (findings 2026-10-16)", () => {
  const a = ra.deriveReviewAnalysis(fixture());
  const factor = a.forFactors.find((f) => /fast cooking/i.test(f.title));
  assert(factor, "fast-cooking factor exists");
  // Findings bullet in RI's own frame — never a pattern sentence.
  assert.match(factor.summary, /^\d+ of \d+ buyers mention it\.$/);
  // The basis label is the plain tallied basis, never a mined clause.
  assert(
    ["Pattern across most reviews", "Repeated across reviews", "One buyer reported this"].includes(
      factor.basis
    ),
    `plain tallied basis: ${factor.basis}`
  );
  // No dead-frame fragment may print inside a bullet.
  const low = factor.summary.toLowerCase();
  for (const frag of ["circling back", "steady drumbeat", "get concrete", "keeps coming up", "buyer after buyer"]) {
    assert(!low.includes(frag), `dead-frame fragment in bullet: ${frag}`);
  }
});

test("dormancy is proven at the source: no production path calls wordsmithEnrich", () => {
  const src = fs.readFileSync(root + "lib/reviewAnalysis.ts", "utf-8");
  // Strip comments before checking: the code itself must have no reference,
  // while hotfix comments are allowed to document the switch-off.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  assert(!code.includes("wordsmithEnrich"), "no wordsmithEnrich call in reviewAnalysis.ts");
  assert(!/lib\/wordsmith/.test(code), "no wordsmith import in reviewAnalysis.ts");
  // The module itself stays in the repo, dormant, for the future rebuild.
  assert(fs.existsSync(root + "lib/wordsmith.ts"), "lib/wordsmith.ts retained");
  const ws = fs.readFileSync(root + "lib/wordsmith.ts", "utf-8");
  assert(/export function wordsmithEnrich/.test(ws), "wordsmithEnrich still exported (dormant, not deleted)");
});
