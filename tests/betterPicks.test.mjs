// Free Better Picks: zero OpenAI, affiliate tag attached, honest labels.
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
process.env.AMAZON_ASSOCIATE_TAG = "reviewintel-test-20";
const { buildBetterPicks, isBackedBetter, storedReviewSummary } = jiti("./lib/betterPicks.ts");

const stored = (title, verdict, accepted, score, extra = {}) => ({ product_name: title, analysis_json: { result: { analysisVersion: "review-evidence-v2", evidenceState: "SUFFICIENT", verdict, buyScore: score, product: { title }, exactListingUrl: extra.url || null, reviewEvidence: { evidenceAdjudication: { acceptedRecords: Array.from({ length: accepted }, () => ({})) } }, ...extra.result } } });
const scanned = { title: "Acme ZX100 Cordless Drill Driver Kit", brand: "Acme", verdict: "DO NOT BUY YET", buyScore: 6.2, acceptedReviews: 9, listingUrl: "https://www.amazon.ca/dp/B000TEST01" };

test("scanned product CTA is first, affiliate-tagged, and is the exact listing", () => {
  const picks = buildBetterPicks(scanned, []);
  assert.equal(picks[0].kind, "buy_scanned");
  assert.equal(picks[0].label, "Check price on Amazon");
  assert.equal(new URL(picks[0].affiliateUrl).searchParams.get("tag"), "reviewintel-test-20");
  assert.equal(new URL(picks[0].affiliateUrl).pathname, "/dp/B000TEST01");
  for (const pick of picks) assert.equal(new URL(pick.affiliateUrl).searchParams.get("tag"), "reviewintel-test-20");
});

test("search links are labeled as searches and never claim better/reviewed", () => {
  const picks = buildBetterPicks(scanned, []);
  const searches = picks.filter(p => p.kind === "search");
  assert.ok(searches.length >= 1);
  for (const s of searches) {
    assert.match(s.title, /on Amazon$/); assert.equal(s.badge, "Amazon search");
    assert.match(s.whyBetter, /not a reviewed pick/);
    assert.doesNotMatch(`${s.title} ${s.badge} ${s.whyBetter} ${s.label}`, /\bbetter\b|top pick|best pick|recommended/i);
    assert.equal(s.evidence, null);
    assert.match(new URL(s.url).pathname, /^\/s$/);
  }
  assert.ok(searches.some(s => /Compare top-rated cordless drill driver on Amazon/i.test(s.title)), searches.map(s => s.title).join(" | "));
});

test("'better' only when backed by our real-review data: same type, BUY verdict, sufficient evidence", () => {
  const rows = [
    stored("Bolt BX20 Cordless Drill Driver", "BUY", 24, 8.1, { url: "https://www.amazon.ca/dp/B000BOLT20" }),
    stored("Bolt BX30 Cordless Drill Driver", "DO NOT BUY YET", 30, 7.9),        // not BUY -> never "better"
    stored("Zen Robot Vacuum Cleaner", "BUY", 40, 9.0),                          // different type
    stored("Tiny Cordless Drill Driver", "BUY", 2, 9.5),                          // too little evidence
    { product_name: "Legacy Cordless Drill Driver", analysis_json: { result: { verdict: "BUY", buyScore: 9.9 } } }, // not review-evidence-v2
    stored("Acme ZX100 Cordless Drill Driver Kit", "BUY", 50, 9), // the same product
  ];
  const picks = buildBetterPicks(scanned, rows);
  const reviewed = picks.filter(p => p.kind === "reviewed");
  assert.deepEqual(reviewed.map(p => p.title), ["Bolt BX20 Cordless Drill Driver"]);
  assert.equal(reviewed[0].evidence.acceptedReviews, 24);
  assert.match(reviewed[0].whyBetter, /24 real buyer reviews/);
  assert.equal(new URL(reviewed[0].affiliateUrl).searchParams.get("tag"), "reviewintel-test-20");
  assert.equal(isBackedBetter({ verdict: "BUY", score: 6.3, acceptedReviews: 9 }, { ...scanned, verdict: "BUY" }), false, "tiny score gap is not 'better'");
  assert.equal(storedReviewSummary({ analysis_json: { result: { analysisVersion: "review-evidence-v2", evidenceState: "NOT_ENOUGH", verdict: "BUY", product: { title: "X" } } } }), null);
});

test("recommendations route makes ZERO OpenAI calls by default and returns tagged, honest picks", async () => {
  const oldFetch = globalThis.fetch; let openAiCalls = 0; const external = [];
  globalThis.fetch = async (url) => { const u = String(url); if (/openai/i.test(u)) openAiCalls += 1; external.push(u); throw new Error("network blocked in test"); };
  const oldFlag = process.env.REVIEWINTEL_RECOMMENDATIONS_OPENAI; delete process.env.REVIEWINTEL_RECOMMENDATIONS_OPENAI;
  try {
    const { POST } = jiti("./app/api/product-recommendations/route.ts");
    const req = new Request("http://localhost/api/product-recommendations", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ productName: scanned.title, result: { verdict: scanned.verdict, buyScore: 6.2, brand: "Acme", product: { title: scanned.title }, exactListingUrl: scanned.listingUrl, scanId: "scan_test_1" } }) });
    req.nextUrl = new URL(req.url);
    const res = await POST(req);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(openAiCalls, 0);
    if (data.affiliateDisabled) return; // local ad settings may disable Amazon placements; still zero OpenAI
    assert.equal(data.source, "free"); assert.equal(data.openAiCalls, 0);
    assert.ok(data.disclosure && /qualifying purchases|commission/i.test(data.disclosure));
    assert.equal(data.recommendations[0].kind, "buy_scanned");
    for (const pick of data.recommendations) assert.equal(new URL(pick.affiliateUrl).searchParams.get("tag"), "reviewintel-test-20");
  } finally { globalThis.fetch = oldFetch; if (oldFlag !== undefined) process.env.REVIEWINTEL_RECOMMENDATIONS_OPENAI = oldFlag; }
});
