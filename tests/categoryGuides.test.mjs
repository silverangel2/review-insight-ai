import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const { buildRingConnShopperResult } = await import(root + "scripts/reviewintel-ringconn-shopper-fixture.mjs");
const { buildCategoryGuides, productTypeFor, GUIDE_MIN_PRODUCTS } = jiti("./lib/categoryGuides.ts");

const real = buildRingConnShopperResult(root.replace(/\/$/, ""));
const row = (title, extra = {}) => ({ analysis_json: { ...real, evidenceState: "SUFFICIENT", ...extra, product: { title } } });

test("guides: generic types only; thin below the threshold; quotes are real accepted reviews", () => {
  assert.equal(productTypeFor("Test smart ring (fixture)").slug, "smart-rings");
  assert.equal(productTypeFor("Unrelated widget"), null);
  const one = buildCategoryGuides([row("Test smart ring A")]);
  assert.equal(one[0].thin, true, "one product is thin");
  const many = buildCategoryGuides(Array.from({ length: GUIDE_MIN_PRODUCTS }, (_, i) => row(`Test smart ring ${i}`)));
  const g = many[0];
  assert.equal(g.products.length, GUIDE_MIN_PRODUCTS);
  const bodies = JSON.stringify(real);
  for (const t of [...g.loves, ...g.complaints]) if (t.quote) assert.ok(bodies.includes(t.quote.replace(/…$/, "").slice(0, 40)), t.quote);
  assert.equal(g.thin, g.totalReviews < 15);
  assert.equal(buildCategoryGuides([row("Test smart ring", { evidenceState: "INSUFFICIENT" })]).length, 0, "only SUFFICIENT results count");
});

test("guides page: noindex when thin, neutral 'buyers reported' wording, no defamation verbs", () => {
  const page = readFileSync(root + "app/guides/[slug]/page.tsx", "utf8");
  assert.match(page, /index: false|noindex: !g \|\| g\.thin/);
  assert.match(page, /Buyers reported/);
  assert.doesNotMatch(page, /\b(scam|fraud|dangerous|worst|terrible|garbage)\b/i);
  assert.doesNotMatch(readFileSync(root + "lib/categoryGuides.ts", "utf8") + readFileSync(root + "lib/guideData.ts", "utf8"), /api\.openai|callOpenAi/);
});
