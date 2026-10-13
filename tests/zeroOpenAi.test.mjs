import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const guard = jiti("./lib/openAiGuard.ts");
const FLAGS = Object.values(guard.OPENAI_FEATURE_FLAGS);
for (const f of FLAGS) delete process.env[f];

test("every OpenAI feature flag is OFF by default", () => {
  for (const f of Object.keys(guard.OPENAI_FEATURE_FLAGS)) assert.equal(guard.isOpenAiFeatureEnabled(f), false, f);
});

test("global guard: unguarded OpenAI fetch inside a zero-OpenAI run throws and counts 0 calls", async () => {
  const run = await guard.runZeroOpenAi(async () => {
    await assert.rejects(fetch("https://api.openai.com/v1/responses", { method: "POST" }), /OpenAI is disabled/);
    await assert.rejects(guard.guardedOpenAiFetch("review_evidence", "https://api.openai.com/v1/responses", {}), /OpenAI is disabled/);
    return 1;
  });
  assert.equal(run.openAiCalls, 0);
  assert.equal(run.openAiBlocked, 2);
  guard.assertOpenAiCallsZero(run);
});

test("REVIEWINTEL_DISABLE_OPENAI forces a flag off even when set on", () => {
  process.env.REVIEWINTEL_OPENAI_SHOPPER_COMPARE = "on"; process.env.REVIEWINTEL_DISABLE_OPENAI = "1";
  assert.equal(guard.isOpenAiFeatureEnabled("shopper_compare"), false);
  delete process.env.REVIEWINTEL_OPENAI_SHOPPER_COMPARE; delete process.env.REVIEWINTEL_DISABLE_OPENAI;
});

test("all OpenAI fetches in app/lib go through guardedOpenAiFetch (social excluded by rule)", () => {
  for (const p of ["app/api/analyze/route.ts", "app/api/seller-analyze/route.ts", "app/api/shopper-compare/route.ts", "app/api/seller-compare/route.ts", "app/api/review-follow-up/route.ts", "lib/openAiWebSearch.ts", "app/api/admin/troubleshooter/route.ts", "app/api/admin/daily-checks/route.ts"]) {
    const s = readFileSync(root + p, "utf8");
    assert.doesNotMatch(s, /await fetch\("https:\/\/api\.openai\.com/, p);
  }
  for (const p of ["app/api/analyze/route.ts", "app/api/seller-analyze/route.ts", "app/api/shopper-compare/route.ts", "app/api/review-evidence/route.ts"]) assert.match(readFileSync(root + p, "utf8"), /runZeroOpenAi[\s\S]*x-reviewintel-openai-calls/, p);
});

test("screenshot identification uses free OCR by default", () => {
  const s = readFileSync(root + "app/api/analyze/route.ts", "utf8");
  assert.match(s, /if \(!isOpenAiFeatureEnabled\("analyze_screenshot"\)\)[\s\S]{0,200}ocrReviewScreenshot[\s\S]{0,120}productFactsFromOcr/);
  const { productFactsFromOcr } = jiti("./lib/screenshotProductFacts.ts");
  const f = productFactsFromOcr({ fileSha256: "x", ocrConfidence: 88, engine: "t", lines: [
    { text: "amazon.ca Hello, sign in", confidence: 90 }, { text: "Sponsored", confidence: 92 },
    { text: "Ninja AF101C Air Fryer, 3.8 L, Black/Grey", confidence: 91 }, { text: "Visit the Ninja Store", confidence: 90 },
    { text: "4.7 out of 5 stars 12,345 ratings", confidence: 89 }, { text: "$129.99", confidence: 93 }] });
  assert.equal(f.store, "Amazon.ca"); assert.equal(f.name, "Ninja AF101C Air Fryer, 3.8 L, Black/Grey"); assert.equal(f.brand, "Ninja");
  assert.equal(f.rating, "4.7"); assert.equal(f.reviewCount, "12345"); assert.equal(f.price, "$129.99");
  const blank = productFactsFromOcr({ fileSha256: "x", ocrConfidence: 40, engine: "t", lines: [{ text: "$19.99", confidence: 95 }] });
  assert.equal(blank.name, ""); assert.equal(blank.price, ""); assert.ok(blank.identityWarnings.length >= 2);
});

test("free seller analysis reads only uploaded rows and is honest on thin data", () => {
  const { freeSellerAnalysis } = jiti("./lib/sellerAnalyzeFree.ts");
  const thin = freeSellerAnalysis([{ review: "Great quality, works well" }, { review: "Broke after a week, very disappointed" }]);
  assert.equal(thin.dataQuality, "Limited"); assert.equal(thin.openAiCalls, 0); assert.match(thin.summary, /isn't enough/);
  const rows = Array.from({ length: 14 }, (_, i) => ({ rating: i % 4 ? 5 : 2, review: i % 4 ? `Battery life is excellent and it is easy to use, review ${i}` : `The battery died quickly and support never answered, review ${i}` }));
  const r = freeSellerAnalysis(rows);
  assert.ok(r.healthScore > 0); assert.ok(r.topPraise.length + r.topComplaints.length > 0);
});

test("free shopper compare never names a winner without real-review scores", () => {
  const { freeShopperCompare } = jiti("./lib/shopperCompareFree.ts");
  const r = freeShopperCompare({}, {});
  assert.equal(r.winner, "INCOMPARABLE");
});
