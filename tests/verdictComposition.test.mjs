// Verdict-weighted evidence composition — iteration 4 (2026-10-17, Junel:
// "A buy signal should [say] why you must [more] than the NOT, a skip should
// explain more in why you must not. While must say why to wait, and what's
// the wait for.").
// COMPOSITION ONLY: scoring/verdict computation untouched; verdicts are only
// ever READ. Tests lib/verdictComposition.ts + the reviewAnalysis seam.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const vc = jiti(root + "lib/verdictComposition.ts");
const ra = jiti(root + "lib/reviewAnalysis.ts");

const T = (over = {}) => ({
  key: "theme-x",
  title: "Theme X",
  claim: "theme x",
  side: "for",
  count: 3,
  reviewCount: 30,
  texts: [],
  stars: [],
  severityRed: false,
  opposingCount: 0,
  opposingEvident: false,
  ...over,
});

// --- slot caps per verdict ----------------------------------------------------

test("BUY: up to 5 strengths, up to 2 complaints", () => {
  const forT = [1, 2, 3, 4, 5, 6].map((n) => T({ key: `f${n}`, count: 10 - n }));
  const agT = [1, 2, 3].map((n) => T({ key: `a${n}`, side: "against", count: 5 - n }));
  const { forThemes, againstThemes } = vc.applyVerdictSlots("buy", forT, agT);
  assert.equal(forThemes.length, 5);
  assert.equal(againstThemes.length, 2);
  // Order kept: highest counts first.
  assert.deepEqual(forThemes.map((t) => t.key), ["f1", "f2", "f3", "f4", "f5"]);
});

test("SKIP: up to 2 strengths, up to 5 complaints", () => {
  const forT = [1, 2, 3, 4].map((n) => T({ key: `f${n}`, count: 10 - n }));
  const agT = [1, 2, 3, 4, 5, 6].map((n) => T({ key: `a${n}`, side: "against", count: 10 - n }));
  const { forThemes, againstThemes } = vc.applyVerdictSlots("skip", forT, agT);
  assert.equal(forThemes.length, 2);
  assert.equal(againstThemes.length, 5);
});

test("WAIT: up to 3 per side", () => {
  const forT = [1, 2, 3, 4].map((n) => T({ key: `f${n}`, count: 10 - n }));
  const agT = [1, 2, 3, 4].map((n) => T({ key: `a${n}`, side: "against", count: 10 - n }));
  const { forThemes, againstThemes } = vc.applyVerdictSlots("wait", forT, agT);
  assert.equal(forThemes.length, 3);
  assert.equal(againstThemes.length, 3);
});

test("never pads: fewer earned themes than the cap renders fewer", () => {
  const { forThemes, againstThemes } = vc.applyVerdictSlots("buy", [T({ key: "f1" })], []);
  assert.equal(forThemes.length, 1);
  assert.equal(againstThemes.length, 0);
});

// --- never-hide safety overflow ------------------------------------------------

test("safety items overflow the against cap on BUY", () => {
  const agT = [
    T({ key: "annoyance-a", side: "against" }),
    T({ key: "annoyance-b", side: "against" }),
    T({ key: "cut-risk", side: "against" }), // severity 0 -> safety
    T({ key: "safety", side: "against" }), // severity 0 -> safety
  ];
  const { againstThemes } = vc.applyVerdictSlots("buy", [T({ key: "f1" })], agT);
  const keys = againstThemes.map((t) => t.key);
  assert.ok(keys.includes("cut-risk"), "safety theme must render despite the cap");
  assert.ok(keys.includes("safety"), "safety theme must render despite the cap");
  assert.equal(againstThemes.length, 4);
});

test("a non-safety third complaint does NOT overflow the cap", () => {
  const agT = [
    T({ key: "annoyance-a", side: "against" }),
    T({ key: "annoyance-b", side: "against" }),
    T({ key: "annoyance-c", side: "against" }),
  ];
  const { againstThemes } = vc.applyVerdictSlots("buy", [T({ key: "f1" })], agT);
  assert.equal(againstThemes.length, 2);
});

test("curated red-flag overflows the against cap", () => {
  const agT = [
    T({ key: "annoyance-a", side: "against" }),
    T({ key: "annoyance-b", side: "against" }),
    T({ key: "counterfeit", side: "against", severityRed: true }),
  ];
  const { againstThemes } = vc.applyVerdictSlots("buy", [T({ key: "f1" })], agT);
  assert.equal(againstThemes.length, 3);
  assert.ok(againstThemes.some((t) => t.severityRed));
});

// --- verdict reading (never computed) ------------------------------------------

test("compositionVerdict maps the known verdict fields", () => {
  assert.equal(vc.compositionVerdict({ verdict: "BUY" }), "buy");
  assert.equal(vc.compositionVerdict({ verdict: "SKIP" }), "skip");
  assert.equal(vc.compositionVerdict({ verdict: "AVOID" }), "skip");
  assert.equal(vc.compositionVerdict({ verdict: "WAIT" }), "wait");
  // "DO NOT BUY YET" contains BUY but is a wait state.
  assert.equal(vc.compositionVerdict({ verdict: "DO NOT BUY YET" }), "wait");
  // Unknown / provisional -> balanced wait.
  assert.equal(vc.compositionVerdict({}), "wait");
  assert.equal(vc.compositionVerdict({ verdict: "NOT SCORED" }), "wait");
  // Score-card fallback.
  assert.equal(vc.compositionVerdict({ buyingScoreV2: { verdict: "Buy" } }), "buy");
  assert.equal(vc.compositionVerdict({ buyingScoreV2: { verdict: "Skip" } }), "skip");
});

// --- wait line: only on WAIT ----------------------------------------------------

test("no wait line on BUY or SKIP, even with signals", () => {
  const ctx = {
    score: 73, reviewCount: 62, buyThreshold: 75, waitThreshold: 50,
    forThemes: [T({ key: "f1", title: "Strong battery life", count: 8 })],
    againstThemes: [T({ key: "a1", title: "Fit problems", side: "against", count: 6 })],
  };
  assert.equal(vc.buildWaitLine("buy", ctx), null);
  assert.equal(vc.buildWaitLine("skip", ctx), null);
});

// --- wait line signal derivation -------------------------------------------------

const W = (over = {}) => ({
  score: null, reviewCount: 30, buyThreshold: 75, waitThreshold: 50,
  forThemes: [], againstThemes: [], ...over,
});

test("wait line: contested specific names the point and both poles", () => {
  const ctx = W({
    reviewCount: 21,
    forThemes: [T({ key: "cold-retention", title: "Keeps drinks cold", count: 13, reviewCount: 21 })],
    againstThemes: [
      T({ key: "cupholder", title: "Doesn't fit cup holders", side: "against", count: 5, reviewCount: 21, opposingCount: 1, opposingEvident: true }),
    ],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line, "a contested specific must produce a wait line");
  assert.match(line, /split/i);
  assert.match(line, /cup holders/i);
  assert.match(line, /5 of 21/);
  assert.match(line, /1 report the opposite/);
});

test("wait line: severe blocker names the hard stop", () => {
  const ctx = W({
    reviewCount: 30,
    forThemes: [T({ key: "f1", title: "Strong battery life", count: 8, reviewCount: 30 })],
    againstThemes: [T({ key: "cut-risk", title: "Blades too sharp — finger cuts", side: "against", count: 3, reviewCount: 30 })],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line);
  assert.match(line, /hard stop/i);
  assert.match(line, /blades too sharp/i);
});

test("wait line: near-buy threshold names the bar and the split", () => {
  const ctx = W({
    score: 73, reviewCount: 62,
    forThemes: [T({ key: "battery", title: "Strong battery life", count: 8, reviewCount: 62 })],
    againstThemes: [T({ key: "fit-problems", title: "Fit problems", side: "against", count: 6, reviewCount: 62 })],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line);
  assert.match(line, /just under our Buy bar \(75\)/);
  assert.match(line, /strong battery life/i);
  assert.match(line, /fit problems/i);
});

test("wait line: near-skip threshold is honest about thin positive evidence", () => {
  const ctx = W({
    score: 54, reviewCount: 44,
    forThemes: [T({ key: "temperature-control", title: "Temperature control", count: 25, reviewCount: 44 })],
    againstThemes: [],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line);
  assert.match(line, /just above our Skip line \(50\)/);
  assert.match(line, /temperature control/i);
});

test("wait line: thin corpus says so", () => {
  const ctx = W({
    reviewCount: 6,
    forThemes: [T({ key: "f1", title: "Good design", count: 2, reviewCount: 6 })],
    againstThemes: [],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line);
  assert.match(line, /Only 6 reviews read/);
});

test("wait line without a qualifying signal is only possible as the split-summary fallback — and it names real themes", () => {
  // 50 reviews, score unknown, one Takki-grade strength, no complaints,
  // no contested/severe/thin signals -> split-summary fallback.
  const ctx = W({
    reviewCount: 50,
    forThemes: [
      T({
        key: "__fallback_probe", title: "Mystery strength", count: 4, reviewCount: 50,
        texts: [
          "This product works well for my daily needs.",
          "I have used it every morning this week.",
        ],
      }),
    ],
    againstThemes: [],
  });
  const line = vc.buildWaitLine("wait", ctx);
  assert.ok(line, "the fallback must still produce a line");
  // The fallback is only honest because it names the scan's real themes.
  assert.match(line, /Mystery strength/);
  assert.match(line, /4 of 50 buyers/);
});

// --- wart fix: title/canonical stutter -------------------------------------------

test("wart fix: the bullet drops the title's opening word", () => {
  assert.equal(
    vc.dedupeTitleCollision("leak-proof — toss it in a bag without spills, say 4 of 21 buyers.", "Leak-proof"),
    "toss it in a bag without spills, say 4 of 21 buyers."
  );
});

test("wart fix: no-op when the bullet does not open with the title", () => {
  const s = "too wide for standard cup holders, say 5 of 21 buyers.";
  assert.equal(vc.dedupeTitleCollision(s, "Doesn't fit cup holders"), s);
});

test("wart fix: never strips partial-word matches", () => {
  const s = "leaks after a week in the bag, say 3 of 21 buyers.";
  assert.equal(vc.dedupeTitleCollision(s, "Leak-proof"), s);
});

test("wart fix: empty title is a no-op", () => {
  const s = "up to 30 hours with the charging case, say 8 of 62 buyers.";
  assert.equal(vc.dedupeTitleCollision(s, ""), s);
});

test("wart fix: no stutter across the proof4 renders", () => {
  // The invariant the fix guarantees: no rendered bullet still opens with
  // its title restated (the Owala "Leak-proof — leak-proof — …" wart).
  // Natural parallelism ("Heats quickly — heats a room up in minutes") is
  // a sentence elaborating the title, not a stutter, and is kept.
  const slugs = ["airpods4", "dreo1500w", "fullstar", "cerave", "owala"];
  for (const slug of slugs) {
    const path = `${root}proof4/${slug}.txt`;
    assert.ok(existsSync(path), `proof4/${slug}.txt must exist (run the v4 proof render first)`);
    const txt = readFileSync(path, "utf8");
    const lines = txt.split("\n").filter((l) => l.startsWith("• "));
    assert.ok(lines.length > 0, `${slug}: expected bullets`);
    for (const line of lines) {
      const [title, summary] = line.slice(2).split(" — ");
      assert.equal(
        vc.dedupeTitleCollision(summary, title), summary,
        `${slug}: title/canonical stutter still present in "${line.slice(0, 80)}…"`
      );
    }
  }
});

// --- proof4 composition shape: BUY argues for, WAIT stays balanced ---------------

function proofBullets(slug) {
  const path = `${root}proof4/${slug}.txt`;
  assert.ok(existsSync(path), `proof4/${slug}.txt must exist`);
  const txt = readFileSync(path, "utf8");
  const section = (name) => {
    const lines = txt.split("\n");
    const i = lines.indexOf(name);
    if (i < 0) return [];
    const out = [];
    for (const l of lines.slice(i + 1)) {
      if (l.startsWith("• ")) out.push(l);
      else if (l.trim() !== "") break; // next section header ends this one
    }
    return out;
  };
  return {
    forCount: section("WHY YOU'D BUY IT").length,
    againstCount: section("WHY YOU MIGHT NOT").length,
    hasWaitLine: txt.includes("WHY WAIT:"),
  };
}

test("BUY pages argue the verdict: more for than against", () => {
  for (const slug of ["cerave", "fullstar"]) {
    const b = proofBullets(slug);
    assert.ok(b.forCount >= b.againstCount, `${slug}: BUY must show at least as many strengths (${b.forCount} vs ${b.againstCount})`);
    assert.ok(b.againstCount <= 2, `${slug}: BUY complaints capped at 2`);
    assert.ok(b.forCount <= 5, `${slug}: BUY strengths capped at 5`);
    assert.equal(b.hasWaitLine, false, `${slug}: no wait line on BUY`);
  }
});

test("WAIT pages stay balanced and carry the wait line", () => {
  for (const slug of ["airpods4", "dreo1500w", "owala"]) {
    const b = proofBullets(slug);
    assert.ok(b.forCount <= 3 && b.againstCount <= 3, `${slug}: WAIT capped at 3 per side`);
    assert.equal(b.hasWaitLine, true, `${slug}: WAIT must carry the wait line`);
  }
});

// --- SYNTHETIC FIXTURES: composition weighting through deriveReviewAnalysis -----
// These fixtures are invented ONLY to exercise the composition rules; they
// are never renders, never the library, never evidence.

const SYN_BODIES = {
  skip: [
    "The battery died after two weeks and support never answered my emails about it.",
    "Battery died on day one, complete failure, would not charge at all.",
    "The screen cracked within a month of normal use, a very fragile build.",
    "It overheats dangerously, I worry it could catch fire. I am returning it.",
    "The plastic feels cheap and flimsy and creaks when you pick it up.",
    "It does look quite nice on the counter though, a sleek design.",
    "Setup was easy enough and it paired with my phone without trouble.",
  ],
  buy: [
    "The sound quality is clear and the bass is deep, great for music.",
    "Battery lasts me all day at the office with power to spare.",
    "Setup took two minutes and it paired instantly with my phone.",
    "It looks sleek and modern on my desk, I love the design.",
    "The earbuds keep slipping out during my morning runs though.",
    "Cleaning the charging case is fiddly, dust gets in the grooves.",
    "Shipping took three weeks to arrive, far too slow for the price.",
  ],
};

function syntheticFixture(kind) {
  const bodies = SYN_BODIES[kind];
  const recs = (ids) => ids;
  return {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({
          id: `x${i + 1}`,
          stableEvidenceHash: `xh${i + 1}`,
          body,
          sourceUrl: "https://www.amazon.ca/dp/SYNTHETIC",
        })),
      },
      commentsAnalyzed: bodies.length,
      listingEvidence: { rating: kind === "skip" ? 2.1 : 4.6, reviewCount: 340 },
    },
    strengths:
      kind === "skip"
        ? [
            { claim: "attractive design or appearance", supportCount: 2, sourceIds: ["x6"], sourceHashes: [] },
            { claim: "easy to use or set up", supportCount: 2, sourceIds: ["x7"], sourceHashes: [] },
          ]
        : [
            { claim: "sound quality", supportCount: 4, sourceIds: ["x1"], sourceHashes: [] },
            { claim: "battery life", supportCount: 3, sourceIds: ["x2"], sourceHashes: [] },
            { claim: "easy to use or set up", supportCount: 3, sourceIds: ["x3"], sourceHashes: [] },
            { claim: "attractive design or appearance", supportCount: 2, sourceIds: ["x4"], sourceHashes: [] },
          ],
    complaints:
      kind === "skip"
        ? [
            { claim: "reliability or failure problems", supportCount: 3, sourceIds: ["x1", "x2"], sourceHashes: [] },
            { claim: "cracking or material durability problems", supportCount: 2, sourceIds: ["x3", "x5"], sourceHashes: [] },
            { claim: "weak, slow, or overheating performance", supportCount: 1, sourceIds: ["x4"], sourceHashes: [] },
          ]
        : [
            { claim: "fit not secure", supportCount: 2, sourceIds: ["x5"], sourceHashes: [] },
            { claim: "difficult cleaning or maintenance", supportCount: 2, sourceIds: ["x6"], sourceHashes: [] },
            { claim: "shipping", supportCount: 1, sourceIds: ["x7"], sourceHashes: [] },
          ],
    product: { title: "SYNTHETIC composition probe", store: "amazon.ca" },
    buyingScoreV2: {
      version: "buying-score-v2", mode: "written_only",
      score: kind === "skip" ? 32 : 82,
      verdict: kind === "skip" ? "skip" : "buy",
      confidence: "High", audit: {},
    },
    verdict: kind === "skip" ? "SKIP" : "BUY",
    finalDecisionSource: "buyingScoreV2",
  };
}

test("SYNTHETIC: SKIP argues against — more complaints than strengths", () => {
  const a = ra.deriveReviewAnalysis(syntheticFixture("skip"));
  assert.ok(a.forFactors.length <= 2, `SKIP strengths capped at 2 (got ${a.forFactors.length})`);
  assert.ok(a.againstFactors.length >= 2, `SKIP must lead with complaints (got ${a.againstFactors.length})`);
  assert.ok(a.againstFactors.length > a.forFactors.length, "SKIP page argues the verdict's case");
  assert.equal(a.waitLine, null, "no wait line on SKIP");
});

test("SYNTHETIC: BUY argues for — more strengths than complaints", () => {
  const a = ra.deriveReviewAnalysis(syntheticFixture("buy"));
  // The claim layer supplies at most 3 claims per side (pre-existing), so
  // the BUY slot cap (5) binds at the 3 the engine honestly earns.
  assert.equal(a.forFactors.length, 3, `BUY shows all 3 earned strengths (got ${a.forFactors.length})`);
  assert.ok(a.againstFactors.length <= 2, `BUY complaints capped at 2 (got ${a.againstFactors.length})`);
  assert.ok(a.forFactors.length > a.againstFactors.length, "BUY page argues the verdict's case");
  assert.equal(a.waitLine, null, "no wait line on BUY");
});
