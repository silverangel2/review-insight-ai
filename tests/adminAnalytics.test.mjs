import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const { summarizeAdminAnalytics } = jiti("./lib/adminAnalytics.ts");

test("admin analytics: counts only what exists", () => {
  const a = summarizeAdminAnalytics([
    { mode: "buyer", analysis_json: { verdict: "BUY", product: { title: "Item A" } } },
    { mode: "buyer", analysis_json: { result: { verdict: "DO NOT BUY YET", product: { title: "Item A" } } } },
    { mode: "seller", analysis_json: { verdict: "NOT ENOUGH REVIEWS" } },
  ], [
    { event_type: "affiliate_click", metadata: { source: "better_picks", kind: "buy_scanned" } },
    { event_type: "affiliate_click", metadata: { source: "affiliate_ad_slot" } },
    { event_type: "affiliate_impression", metadata: {} },
  ]);
  assert.equal(a.scans, 3); assert.equal(a.sellerScans, 1);
  assert.deepEqual(a.verdictMix.map(v => v.verdict).sort(), ["Buy", "Not enough reviews", "Wait"]);
  assert.equal(a.affiliateClicks, 2); assert.equal(a.affiliateImpressions, 1);
  assert.equal(a.topProducts[0].title, "Item A"); assert.equal(a.topProducts[0].scans, 2);
  assert.deepEqual(summarizeAdminAnalytics([], []).verdictMix, []);
});
test("admin analytics page lives under the admin-guarded layout", () => {
  assert.match(readFileSync(root + "app/admin/layout.tsx", "utf8"), /verifyAdminSessionCookie/);
  assert.match(readFileSync(root + "app/admin/analytics/page.tsx", "utf8"), /index: false/);
});
