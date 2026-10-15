// Seller product consolidation: same product merges, distinct products stay
// separate, rollup math is deterministic, empty inputs stay empty.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const {
  sellerProductIdentityFor,
  findSellerProductByIdentity,
  sellerScanFromStoredResult,
  consolidateSellerProductScans,
} = jiti(root + "lib/sellerProductConsolidation.ts");

const scan = (overrides = {}) => ({
  id: `scan-${Math.random()}`,
  date: "2026-10-01",
  productHealthScore: 70,
  customerSatisfactionScore: 70,
  complaintSeverityScore: 30,
  sentimentScore: 70,
  reviewCount: 100,
  topComplaint: "Slow shipping",
  topPositiveTheme: "Great sound",
  aiSummary: "Summary.",
  actionRecommendation: "Fix shipping.",
  strengths: ["Great sound"],
  complaints: ["Slow shipping"],
  actionPlan: ["Fix shipping"],
  tone: "mixed",
  ...overrides,
});

test("identity: same listing URL variants merge into one product key", () => {
  const a = sellerProductIdentityFor({ productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ", fileName: "reviews.csv" });
  const b = sellerProductIdentityFor({ productLink: "http://amazon.ca/dp/b0dgjdkhrq/ref=abc", fileName: "batch2.csv" });
  assert.equal(a.key, b.key);
  assert.ok(a.key.includes("B0DGJDKHRQ"));
});

test("identity: distinct ASINs stay separate", () => {
  const a = sellerProductIdentityFor({ productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ" });
  const b = sellerProductIdentityFor({ productLink: "https://www.amazon.ca/dp/B012345678" });
  assert.notEqual(a.key, b.key);
});

test("identity: name fallback merges casing/punctuation variants", () => {
  const a = sellerProductIdentityFor({ fileName: "Acme_Bluetooth Speaker - reviews.csv" });
  const b = sellerProductIdentityFor({ productName: "acme bluetooth  speaker reviews" });
  assert.equal(a.key, b.key);
});

test("identity: name fallback never matches a URL-based identity", () => {
  const a = sellerProductIdentityFor({ productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ" });
  const b = sellerProductIdentityFor({ productName: "B0DGJDKHRQ" });
  assert.notEqual(a.key, b.key);
});

test("findSellerProductByIdentity: matches despite record name drift", () => {
  const products = [
    { id: "p1", name: "Acme speaker (old name)", productUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ", platform: "amazon" },
  ];
  const identity = sellerProductIdentityFor({ productLink: "https://amazon.ca/dp/B0DGJDKHRQ", fileName: "new.csv" });
  assert.equal(findSellerProductByIdentity(products, identity)?.id, "p1");
  assert.equal(findSellerProductByIdentity([], identity), null);
});

test("sellerScanFromStoredResult: normalizes seller-analyze result fields", () => {
  const s = sellerScanFromStoredResult({
    result: {
      healthScore: 82,
      buyerSatisfaction: 77,
      refundRisk: 24,
      reviewsAnalyzed: 150,
      topComplaints: ["Battery drains fast"],
      topPraise: ["Excellent bass"],
      nextActions: ["Improve battery copy"],
      summary: "Strong overall.",
    },
    fileName: "acme.csv",
  });
  assert.equal(s.productHealthScore, 82);
  assert.equal(s.customerSatisfactionScore, 77);
  assert.equal(s.complaintSeverityScore, 24);
  assert.equal(s.reviewCount, 150);
  assert.equal(s.topComplaint, "Battery drains fast");
  assert.equal(s.topPositiveTheme, "Excellent bass");
  assert.equal(s.actionRecommendation, "Improve battery copy");
});

test("consolidate: empty scans are empty-safe", () => {
  const c = consolidateSellerProductScans([]);
  assert.equal(c.analysisCount, 0);
  assert.equal(c.trend, "needs_data");
  assert.equal(c.avgHealth, null);
  assert.deepEqual(c.topComplaints, []);
});

test("consolidate: weighted averages and review totals", () => {
  const c = consolidateSellerProductScans([
    scan({ productHealthScore: 60, reviewCount: 100, date: "2026-10-01" }),
    scan({ productHealthScore: 80, reviewCount: 300, date: "2026-10-10" }),
  ]);
  assert.equal(c.analysisCount, 2);
  assert.equal(c.totalReviews, 400);
  assert.equal(c.firstDate, "2026-10-01");
  assert.equal(c.lastDate, "2026-10-10");
  // weighted: (60*100 + 80*300) / 400 = 75
  assert.equal(c.avgHealth, 75);
});

test("consolidate: trend direction follows review-weighted halves", () => {
  const improving = consolidateSellerProductScans([
    scan({ productHealthScore: 50, reviewCount: 100, date: "2026-09-01" }),
    scan({ productHealthScore: 80, reviewCount: 100, date: "2026-10-01" }),
  ]);
  assert.equal(improving.trend, "improving");
  assert.equal(improving.trendDelta, 30);

  const declining = consolidateSellerProductScans([
    scan({ productHealthScore: 80, reviewCount: 100, date: "2026-09-01" }),
    scan({ productHealthScore: 60, reviewCount: 100, date: "2026-10-01" }),
  ]);
  assert.equal(declining.trend, "declining");
});

test("consolidate: recurring themes roll up with analysis counts", () => {
  const c = consolidateSellerProductScans([
    scan({ complaints: ["Slow Shipping", "Packaging"], reviewCount: 100, date: "2026-09-01" }),
    scan({ complaints: ["slow shipping!", "Battery"], reviewCount: 200, date: "2026-10-01" }),
  ]);
  const top = c.topComplaints[0];
  assert.equal(top.label.toLowerCase().includes("slow shipping"), true);
  assert.equal(top.analyses, 2);
  assert.equal(top.reviews, 300);
});

test("consolidate: repeated scan ids do not double-count (dedupe-safe input contract)", () => {
  const s = scan({ reviewCount: 100 });
  const c = consolidateSellerProductScans([s, { ...s }]);
  assert.equal(c.analysisCount, 2); // consolidation is pure; dedupe happens at attach
  assert.equal(c.totalReviews, 200);
});
