// ReviewIntel premium theme build: cross-cutting assertions.
// Single hero, theme utilities, reduced-motion guards, rescue gate,
// reveal-once semantics, scan-stage honesty, brief layout classes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const src = (p) => readFileSync(root + p, "utf8");

test("theme.css: the ri-* system exists", () => {
  const css = src("app/theme.css");
  for (const cls of [
    ".ri-gradient-text", ".ri-glass", ".ri-card", ".ri-hairline", ".ri-lift",
    ".ri-btn-gradient", ".ri-ask", ".ri-reveal", ".ri-glow",
    ".ri-unlock", ".ri-glimmer", ".ri-shimmer", ".ri-progress-fill",
    ".ri-stage-active", ".ri-stage-dot-done", ".ri-reveal-armed",
  ]) {
    assert.ok(css.includes(cls), `missing ${cls}`);
  }
  // palette rule: indigo only, no rainbow hues
  assert.ok(css.includes("#0a6cff") && css.includes("#5b3df0"), "brand gradient stops");
  assert.ok(!/#ff5b5b|#f59e0b|#10b981|hsl\(/.test(css), "no rainbow hues in the theme");
});

test("theme.css: reduced-motion kills every effect", () => {
  const css = src("app/theme.css");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "reduced-motion block");
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  for (const sel of [".ri-glow", ".ri-reveal", ".ri-unlock", ".ri-glimmer", ".ri-shimmer", ".ri-stage-active"]) {
    assert.ok(block.includes(sel), `reduced-motion must neutralize ${sel}`);
  }
});

test("ThemeEffects: pointer:fine + reduced-motion gating", () => {
  const tsx = src("components/ThemeEffects.tsx");
  assert.ok(tsx.includes("pointer: fine"), "cursor glow is pointer:fine only");
  assert.ok(tsx.includes("prefers-reduced-motion"), "reduced-motion gate");
  assert.ok(/requestAnimationFrame/.test(tsx), "rAF-throttled cursor tracking");
  assert.ok(tsx.includes("IntersectionObserver"), "scroll reveals via IO");
  assert.ok(!/setInterval|setTimeout/.test(tsx), "no timers driving motion");
});

test("layout mounts ThemeEffects with the smallest edit", () => {
  const layout = src("app/layout.tsx");
  assert.ok(layout.includes('import "./theme.css"'), "theme.css imported");
  assert.ok(layout.includes("ThemeEffects"), "ThemeEffects imported + mounted");
  assert.ok(layout.includes("<ThemeEffects />"), "mounted in the body");
});

test("SINGLE HERO: exactly one hero implementation, no fabricated variants", () => {
  const page = src("app/page.tsx");
  assert.ok(!/Smart ring/i.test(page), 'no fake "Smart ring" card');
  assert.ok(!/15M\+/.test(page), 'no fabricated "15M+" stats');
  assert.ok(!/92%/.test(page), 'no fabricated "92% scam detection"');
  assert.ok(!/HomePasteLink|VerdictSummaryCard|HeroVerdictCycle|homeSample/.test(page), "old hero stack fully unwired");
  assert.ok(page.includes("HeroScanBar"), "v4 glass paste-bar present");
  assert.ok(page.includes("HeroProofCard"), "real proof card present");
  const h1Count = (page.match(/<h1/g) || []).length;
  assert.equal(h1Count, 1, "exactly one h1/hero headline");
  assert.ok(page.includes("Should you buy it?"), "v4 headline");
});

test("homepage speaks analysis, never quotes", () => {
  const page = src("app/page.tsx");
  const layout = src("app/layout.tsx");
  for (const [name, text] of [["page", page], ["layout", layout]]) {
    assert.ok(!/real quotes|buyer quotes|their own words|with the quotes/i.test(text), `${name}: no quotes sales copy`);
  }
  assert.ok(/group what real buyers said/i.test(page), "analysis-language sub");
});

test("rescue gate: scored results never show the capture", () => {
  const gate = jiti(root + "lib/rescueCaptureGate.ts");
  const scored = (verdict) => ({
    verdict,
    buyingScoreV2: { version: "buying-score-v2", mode: "written_only", score: 87, verdict: "buy", audit: { n: 12 } },
    finalDecisionSource: "buyingScoreV2",
    reviewEvidence: { evidenceAdjudication: { acceptedRecords: [{ id: "r1", body: "Great product, works well." }] } },
  });
  assert.equal(gate.shouldShowRescueCapture(scored("BUY")), false, "Buy/87 must not show rescue");
  assert.equal(gate.shouldShowRescueCapture(scored("AVOID")), false, "Avoid must not show rescue");
  assert.equal(gate.shouldShowRescueCapture({ scanState: "INSUFFICIENT_EVIDENCE", verdict: "NOT_ENOUGH" }), true);
  assert.equal(gate.shouldShowRescueCapture({ verdict: "NOT_ENOUGH" }), true);
  assert.equal(gate.shouldShowRescueCapture(null), false);
  assert.equal(gate.shouldShowRescueCapture({}), false);
});

test("revealOnce: mount-once semantics", () => {
  const r = jiti(root + "lib/revealOnce.ts");
  const key = `test-${Date.now()}`;
  assert.equal(r.claimReveal(key), true, "first claim wins");
  assert.equal(r.claimReveal(key), false, "second claim loses");
  assert.equal(r.peekReveal(key), false, "peek sees the consumed claim");
  assert.equal(r.claimReveal(null), true, "null key always reveals");
  assert.equal(r.easeOutCubic(0), 0);
  assert.equal(r.easeOutCubic(1), 1);
  assert.ok(r.easeOutCubic(0.5) > 0.5, "ease-out curve");
});

test("scan overlay: honest stage-based progress", () => {
  const sp = jiti(root + "lib/scanStageModel.ts");
  const { progressFraction, SCAN_STEPS } = sp;
  const live = (stage) => ({ stage, productIdentified: false, productName: null, sourcesChecked: 0, sourceHosts: [], reviewsFound: null, reviewsAccepted: null, snippets: [] });
  assert.equal(progressFraction("done", 0, null), 1);
  assert.ok(progressFraction("uploading", 50, null) < 0.1, "uploading fraction is small and real");
  assert.equal(progressFraction("analyzing", 0, null), null, "no live event -> indeterminate, never faked");
  const f1 = progressFraction("analyzing", 0, live("identifying"));
  const f2 = progressFraction("analyzing", 0, live("reading"));
  const f3 = progressFraction("analyzing", 0, live("scoring"));
  assert.ok(f1 < f2 && f2 < f3, "fraction grows with real stage milestones");
  assert.ok(f3 <= 0.95, "never claims 100% before done");
  assert.deepEqual(
    SCAN_STEPS.map((s) => s.label),
    [
      "Identifying the product",
      "Checking review sources",
      "Reading buyer reviews",
      "Grouping what buyers said",
      "Weighing the good against the bad",
      "Your answer",
    ],
    "owner stage language"
  );
});

test("scan overlay: product pin wired, no review counts rendered", () => {
  const tsx = src("components/ReviewIntelScanOverlay.tsx");
  assert.ok(tsx.includes("SCAN_STEPS"), "stage list comes from the honest progress module");
  assert.ok(tsx.includes("productImage"), "product thumbnail prop exists");
  assert.ok(tsx.includes("Product identified"), "identification pin");
  // reviewsFound / reviewsAccepted must never be rendered as JSX (the type
  // keeps them for the API contract; the owner forbids showing them here).
  const renderUses = (tsx.match(/live\?\.(reviewsFound|reviewsAccepted)|live\.(reviewsFound|reviewsAccepted)/g) || []).length;
  assert.equal(renderUses, 0, "no rendered review counts");
});

test("DecisionBrief: desktop layout classes + mobile order untouched", () => {
  const tsx = src("components/DecisionBrief.tsx");
  assert.ok(tsx.includes("max-w-[1040px]"), "desktop container width");
  assert.ok(tsx.includes("lg:grid-cols-5"), "fact cells go horizontal on desktop");
  assert.ok(tsx.includes("lg:grid-cols-2"), "factor columns side by side on desktop");
  assert.ok(tsx.includes("Review authenticity"), "Phase 10 fact row");
  assert.ok(tsx.includes("BriefReveal"), "Phase 7 reveal wrapper");
  assert.ok(tsx.includes("ScoreCountUp"), "Phase 7 count-up");
  assert.ok(tsx.includes("ri-glimmer"), "verdict glimmer");
  // mobile order: answer -> for -> against -> fold
  const iAnswer = tsx.indexOf("Should you buy it?");
  const iFor = tsx.indexOf("Why you&apos;d buy it");
  const iAgainst = tsx.indexOf("Why you might not");
  const iFold = tsx.indexOf("How we checked");
  assert.ok(iAnswer < iFor && iFor < iAgainst && iAgainst < iFold, "mobile section order preserved");
  // hard rule: empty state gated on hasNegatives
  assert.ok(tsx.includes("hasNegatives"), "empty-against gated on hasNegatives");
});

test("forbidden shopper strings stay banned in ship files", () => {
  const files = [
    "app/page.tsx", "components/DecisionBrief.tsx", "components/HeroProofCard.tsx",
    "components/ReviewIntelScanOverlay.tsx", "lib/reviewAnalysis.ts", "lib/analysisCopy.ts",
  ];
  // Internal labels must never reach shoppers. `evidenceState` is a prop/type
  // identifier — every occurrence must be one of the known-safe code usages.
  const banned = [/openai/i, /\bNOT_ENOUGH\b/, /\bvercel\b/i];
  const safeEvidenceState = /type EvidenceState|evidenceState,|evidenceState: EvidenceState|evidenceStrengthLabel\(evidenceState\)/;
  for (const f of files) {
    const text = src(f);
    for (const re of banned) {
      assert.ok(!re.test(text), `${f} contains banned ${re}`);
    }
    for (const line of text.split("\n")) {
      if (/evidenceState/i.test(line)) {
        assert.ok(safeEvidenceState.test(line), `${f}: suspicious evidenceState usage: ${line.trim()}`);
      }
    }
  }
});
