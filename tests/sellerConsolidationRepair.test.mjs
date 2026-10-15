// Seller consolidation repair (defect-batch-2): identity end-to-end, durable
// merge, retro-merge of filename-split records, and a single count source.
// Uses a minimal window/localStorage stub; no network, no invented data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

// --- storage stub -------------------------------------------------------
function makeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _dump: () => Object.fromEntries(store),
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
const sellerProducts = jiti(root + "lib/sellerProducts.ts");

const {
  sellerProductIdentityFor,
  sellerIdentityForStoredAnalysis,
  attachSellerAnalysisToProduct,
  dedupeSellerProducts,
  consolidateSellerProductScans,
  countSellerAnalyses,
} = consolidation;
const { readSellerProducts, writeSellerProducts } = sellerProducts;

const LINK = "https://www.amazon.ca/dp/B07P39MLKH";

function seedSellerAccount() {
  localStorage.clear();
  localStorage.setItem(
    "reviewintel:account",
    JSON.stringify({ email: "seller.pro@reviewintel.test", role: "seller", plan: "seller_pro" })
  );
}

function storedResult({ analysisId, fileName, productLink, reviewsAnalyzed, healthScore = 72 }) {
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
    createdAt: new Date().toISOString(),
  };
}

// (a) two saves, same link, different filenames -> one record, 2 analyses, totals summed
test("repair (a): two runs with the same link merge into one record", () => {
  seedSellerAccount();
  const first = attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-1", fileName: "anker-run1.csv", productLink: LINK, reviewsAnalyzed: 8 }),
    "seller_pro"
  );
  const second = attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-2", fileName: "anker-run2.csv", productLink: LINK, reviewsAnalyzed: 5 }),
    "seller_pro"
  );
  assert.ok(first && second, "both attaches succeed");
  const products = dedupeSellerProducts(readSellerProducts());
  assert.equal(products.length, 1, "exactly one product record");
  assert.equal(products[0].scans.length, 2, "analysis count 2");
  const rolled = consolidateSellerProductScans(products[0].scans);
  assert.equal(rolled.analysisCount, 2);
  assert.equal(rolled.totalReviews, 13, "totals summed (8 + 5)");
  assert.equal(first.product.id, second.product.id, "same product id both runs");
});

// (b) filename-like name + link -> display name is never a bare filename
test("repair (b): filename-like name with a link never becomes the display name", () => {
  const identity = sellerProductIdentityFor({ productLink: LINK, fileName: "anker-run1.csv" });
  assert.ok(!/\.csv$/i.test(identity.label), `label "${identity.label}" must not be a filename`);
  assert.ok(identity.label.includes("B07P39MLKH"), `label "${identity.label}" derives from the URL`);

  const nameOnly = sellerProductIdentityFor({ fileName: "anker-run1.csv" });
  assert.ok(!/\.csv$/i.test(nameOnly.label), `label "${nameOnly.label}" must not be a bare filename`);
  assert.ok(!/anker-run1\.csv/i.test(nameOnly.label));
});

// (c) retro-merge: two filename-split records sharing a link fold on read
test("repair (c): retro-merge folds filename-split records sharing a link", () => {
  seedSellerAccount();
  const now = new Date().toISOString();
  const mk = (id, name, scanId, scanUrl) => ({
    id,
    createdAt: now,
    updatedAt: now,
    name,
    imageUrl: "",
    platform: "other",
    productUrl: "",
    category: "",
    notes: "",
    scans: [
      {
        id: scanId,
        date: "2026-10-15",
        productUrl: scanUrl,
        productHealthScore: 70,
        customerSatisfactionScore: 70,
        complaintSeverityScore: 30,
        sentimentScore: 70,
        reviewCount: 8,
        topComplaint: "Slow shipping",
        topPositiveTheme: "Great sound",
        aiSummary: "Summary.",
        actionRecommendation: "Fix shipping.",
        strengths: ["Great sound"],
        complaints: ["Slow shipping"],
        actionPlan: ["Fix shipping"],
        tone: "mixed",
      },
    ],
  });
  writeSellerProducts([
    mk("rec-1", "anker-run1.csv", "seller-scan-a", LINK),
    mk("rec-2", "anker-run2.csv", "seller-scan-b", LINK),
  ]);
  const merged = dedupeSellerProducts(readSellerProducts());
  assert.equal(merged.length, 1, "two split records fold into one");
  assert.equal(merged[0].scans.length, 2, "scans merge deduped by id");
  assert.ok(!/\.csv$/i.test(merged[0].name), `merged name "${merged[0].name}" is not a filename`);
  assert.ok(merged[0].productUrl === LINK, "canonical URL kept on the merged record");
  assert.ok(merged[0].createdAt <= now, "earliest createdAt kept");
});

// (c2) next attach persists the fold: storage converges to one record
test("repair (c2): attach persists the retro-merge to the durable store", () => {
  seedSellerAccount();
  const now = new Date().toISOString();
  const mk = (id, name, scanId) => ({
    id, createdAt: now, updatedAt: now, name, imageUrl: "", platform: "other",
    productUrl: "", category: "", notes: "",
    scans: [{
      id: scanId, date: "2026-10-15", productUrl: LINK,
      productHealthScore: 70, customerSatisfactionScore: 70, complaintSeverityScore: 30,
      sentimentScore: 70, reviewCount: 8, topComplaint: "Slow shipping",
      topPositiveTheme: "Great sound", aiSummary: "Summary.", actionRecommendation: "Fix shipping.",
      strengths: ["Great sound"], complaints: ["Slow shipping"], actionPlan: ["Fix shipping"], tone: "mixed",
    }],
  });
  writeSellerProducts([mk("rec-1", "anker-run1.csv", "seller-scan-a"), mk("rec-2", "anker-run2.csv", "seller-scan-b")]);
  const attached = attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-3", fileName: "anker-run3.csv", productLink: LINK, reviewsAnalyzed: 4 }),
    "seller_pro"
  );
  assert.ok(attached, "attach succeeds");
  const products = dedupeSellerProducts(readSellerProducts());
  assert.equal(products.length, 1, "store converged to one record");
  assert.equal(products[0].scans.length, 3, "3 scans (2 folded + 1 new)");
});

// (d) single count source: countSellerAnalyses is stable and matches the store
test("repair (d): countSellerAnalyses is the single stable count source", () => {
  seedSellerAccount();
  attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-1", fileName: "anker-run1.csv", productLink: LINK, reviewsAnalyzed: 8 }),
    "seller_pro"
  );
  attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-2", fileName: "anker-run2.csv", productLink: LINK, reviewsAnalyzed: 5 }),
    "seller_pro"
  );
  const direct = dedupeSellerProducts(readSellerProducts()).reduce(
    (sum, product) => sum + (Array.isArray(product.scans) ? product.scans.length : 0),
    0
  );
  assert.equal(countSellerAnalyses(), 2);
  assert.equal(countSellerAnalyses(), direct, "count matches the deduped store");
  // Re-attaching the SAME analysis (e.g. reopening a saved result) must not
  // inflate the count: scan ids are stable per analysisId.
  attachSellerAnalysisToProduct(
    storedResult({ analysisId: "run-2", fileName: "anker-run2.csv", productLink: LINK, reviewsAnalyzed: 5 }),
    "seller_pro"
  );
  assert.equal(countSellerAnalyses(), 2, "re-attach of the same analysis does not duplicate");
  assert.equal(countSellerAnalyses(), countSellerAnalyses(), "count is stable across calls");
});

// S1b: identity resolves the URL from the result payload when the stored
// productLink is missing (the proof's failure mode).
test("repair S1b: identity falls back through result URL fields before the filename", () => {
  const identity = sellerIdentityForStoredAnalysis({
    result: { productUrl: "https://www.amazon.ca/dp/B07P39MLKH", summary: "x" },
    fileName: "anker-run1.csv",
    productLink: "",
  });
  assert.ok(identity.key.startsWith("url:amazon.ca/B07P39MLKH"), `key was ${identity.key}`);

  const exact = sellerIdentityForStoredAnalysis({
    result: { exactListingUrl: "https://www.amazon.ca/dp/B07P39MLKH", summary: "x" },
    fileName: "anker-run1.csv",
  });
  assert.equal(exact.key, identity.key, "exactListingUrl resolves to the same key");

  const fileOnly = sellerIdentityForStoredAnalysis({
    result: { summary: "x" },
    fileName: "anker-run1.csv",
  });
  assert.ok(fileOnly.key.startsWith("name:"), `filename remains the last resort: ${fileOnly.key}`);
});
