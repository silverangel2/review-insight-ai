// Seller consolidation repair — round 2 (live-proof failures, 2026-10-15):
// 1. filename-keyed product records (identity must come from the link),
// 2. counts never merge across runs (canonical identity + single count),
// 3. calendar "0 reviews scanned" on scanned days (UTC-vs-local date bug),
// 4. gauge/exec-summary template garbage + invented scores.
// Uses the same window/localStorage stub pattern as sellerConsolidationRepair.test.mjs.
process.env.TZ = "America/Moncton"; // Junel's timezone: the calendar bug only shows across the UTC/local line

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

function makeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const localStorage = makeStorage();
globalThis.window = {
  localStorage,
  sessionStorage: makeStorage(),
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

const consolidation = jiti(root + "lib/sellerProductConsolidation.ts");
const journal = jiti(root + "lib/sellerJournal.ts");

const {
  sellerProductIdentityFor,
  sellerAnalysisIdentityFor,
  attachSellerAnalysisToProduct,
  dedupeSellerProducts,
  dedupeSellerAnalyses,
  countSellerAnalyses,
} = consolidation;
const { readSellerProducts } = jiti(root + "lib/sellerProducts.ts");
const { saveStoredSellerResultToJournal, readSellerJournal } = journal;

const LINK = "https://www.amazon.ca/dp/B07P39MLKH";

function seedSellerAccount() {
  localStorage.clear();
  localStorage.setItem(
    "reviewintel:account",
    JSON.stringify({ email: "seller.pro@reviewintel.test", role: "seller", plan: "seller_pro" })
  );
}

function storedResult({ analysisId, fileName, productLink, reviewsAnalyzed, healthScore = 72, createdAt }) {
  return {
    result: {
      analysisId,
      summary: "Scored seller summary.",
      reviewsAnalyzed,
      healthScore,
      buyerSatisfaction: 70,
      refundRisk: 25,
      topComplaints: ["Slow shipping"],
      topPraise: ["Great sound"],
      nextActions: ["Fix shipping"],
    },
    fileName,
    productLink,
    createdAt: createdAt || new Date().toISOString(),
  };
}

// --- failure 1+2: two CSV runs of the same link merge into ONE record --------
test("round2: two runs, same link, different filenames -> one product, merged counts", () => {
  seedSellerAccount();
  attachSellerAnalysisToProduct(
    storedResult({ analysisId: "a1", fileName: "anker-run1.csv", productLink: LINK, reviewsAnalyzed: 8 }),
    "seller_pro"
  );
  attachSellerAnalysisToProduct(
    storedResult({ analysisId: "a2", fileName: "anker-run2.csv", productLink: LINK, reviewsAnalyzed: 5 }),
    "seller_pro"
  );

  const products = dedupeSellerProducts(readSellerProducts());
  assert.equal(products.length, 1, `expected 1 product record, got ${products.length}`);
  const product = products[0];
  assert.equal(product.scans.length, 2, "analyses must merge across runs");
  const totalReviews = product.scans.reduce((sum, scan) => sum + (scan.reviewCount || 0), 0);
  assert.equal(totalReviews, 13, "review counts must sum across runs");
  assert.ok(!String(product.name || "").toLowerCase().includes("anker-run1"),
    "filename must not survive as the product identity");
  assert.equal(countSellerAnalyses(), 2, "single count source sees both runs");
});

// --- failure 1+2: DB/history-shaped records merge by URL ----------------------
test("round2: filename-keyed DB records with the same productUrl merge into one card", () => {
  const rows = [
    {
      id: "PRD-85E2", profile_email: "seller.pro@reviewintel.test", mode: "seller",
      product_name: "anker-run1", product_score: 80,
      created_at: "2026-10-15T20:00:00Z",
      analysis_json: { productUrl: LINK, reviewsAnalyzed: 8, healthScore: 80, summary: "Run one." },
    },
    {
      id: "PRD-078A", profile_email: "seller.pro@reviewintel.test", mode: "seller",
      product_name: "anker-run2", product_score: 76,
      created_at: "2026-10-15T21:00:00Z",
      analysis_json: { productUrl: LINK, reviewsAnalyzed: 5, healthScore: 76, summary: "Run two." },
    },
  ];

  const merged = dedupeSellerAnalyses(rows);
  assert.equal(merged.length, 1, `expected 1 product card, got ${merged.length}`);
  const card = merged[0];
  assert.equal(card.mergedRecordCount, 2, "both runs fold in");
  assert.equal(card.mergedReviewCount, 13, "review counts sum");
  assert.ok(!/anker-run[12]/i.test(String(card.product_name || "")),
    `filename must not be the card name (got ${card.product_name})`);
  assert.equal(card.id, "PRD-078A", "newest run wins for display fields");
  assert.equal(card.canonicalKey, sellerAnalysisIdentityFor(rows[0]).key);
});

// --- failure 1: records without a URL still fall back to name identity -------
test("round2: URL-less records fall back to name identity (no false merges)", () => {
  const rows = [
    { id: "1", product_name: "anker-run1", created_at: "2026-10-15T20:00:00Z", analysis_json: {} },
    { id: "2", product_name: "logi-run1", created_at: "2026-10-15T21:00:00Z", analysis_json: {} },
  ];
  const merged = dedupeSellerAnalyses(rows);
  assert.equal(merged.length, 2, "different products must not merge");
  assert.ok(sellerAnalysisIdentityFor(rows[0]).key.startsWith("name:"), "no URL -> name identity");
});

// --- failure 3: journal date uses the local calendar basis -------------------
test("round2: evening scan lands on the scanned day, not the UTC day", () => {
  seedSellerAccount();
  // Proof ran ~21:33 ADT == 00:33 UTC next day. UTC slice => wrong day.
  const createdAt = "2026-10-16T01:33:00.000Z"; // Oct 15, 22:33 in Moncton
  saveStoredSellerResultToJournal(
    storedResult({ analysisId: "c1", fileName: "ninja-run1.csv", productLink: LINK, reviewsAnalyzed: 12, createdAt })
  );
  const scans = readSellerJournal();
  assert.equal(scans.length, 1);
  assert.equal(scans[0].date, "2026-10-15",
    `scan must be stamped on the local scanned day (got ${scans[0].date})`);
  assert.equal(scans[0].reviewCount, 12, "review count rides on the journal scan");
  assert.equal(scans[0].productUrl, LINK, "product URL rides on the journal scan");
});

// --- failure 3: calendar groups by the same local date -----------------------
test("round2: journal date matches the calendar's local dateKey basis", () => {
  // Mirrors SellerImprovementCalendar's dateKey (local basis).
  const dateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  seedSellerAccount();
  const createdAt = "2026-10-16T01:33:00.000Z";
  saveStoredSellerResultToJournal(
    storedResult({ analysisId: "c2", fileName: "ninja-run2.csv", productLink: LINK, reviewsAnalyzed: 12, createdAt })
  );
  const scans = readSellerJournal();
  const expected = dateKey(new Date(createdAt));
  assert.equal(scans[0].date, expected,
    `journal date (${scans[0].date}) must equal the calendar day key (${expected})`);
});

// --- failure 4: no fallback fragments interpolated into template sentences ---
test("round2: gauge card guards cover every interpolated theme", () => {
  const src = readFileSync(root + "components/SellerBusinessKpiDashboard.tsx", "utf8");
  for (const [name, guard] of [["complaint", "complaintIsFallback"], ["praise", "praiseIsFallback"], ["request", "requestIsFallback"], ["support", "supportIsFallback"]]) {
    assert.ok(
      new RegExp(`const ${guard} = isFallbackTheme\\(top${name[0].toUpperCase()}${name.slice(1)}`).test(src),
      `${name} theme must have a fallback guard`
    );
  }
  assert.ok(!/Customer care signal: \$\{topSupport\}\./.test(src) ||
    /supportIsFallback/.test(src),
    "Support Risk card must not interpolate a raw fallback fragment");
  // No invented percentages from theme counts; no invented 74 fallback score.
  assert.ok(!src.includes("metric: complaintShare"), "invented 'About X%' share must not be rendered");
  assert.ok(!src.includes("metric: praisePeople"), "invented 'N of 10 signals' must not be rendered");
  assert.ok(!/cleanScore\([\s\S]{0,120}?,\s*7[24]\)/.test(src),
    "missing product score must not invent a 72/74 fallback");
  assert.ok(/cleanScore\([\s\S]{0,120}?,\s*-1\)/.test(src),
    "missing product score must not invent a 74 fallback");
});

// --- failure 2: product-record identity prefers the URL ----------------------
test("round2: canonical identity is url-first and filename-proof", () => {
  const withLink = sellerProductIdentityFor({ productUrl: LINK, productName: "anker-run1" });
  const withoutLink = sellerProductIdentityFor({ productName: "anker-run1" });
  assert.ok(withLink.key.startsWith("url:"), "URL present -> url identity");
  assert.ok(withoutLink.key.startsWith("name:"), "no URL -> name identity");
  assert.notEqual(withLink.key, withoutLink.key, "URL identity differs from name identity");
});
