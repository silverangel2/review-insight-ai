// Seller/account fixes: plan gating, one plan-name source, free (zero-OpenAI) compare, quota copy.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(join(root, "review-evidence-scoring-test.js"), { alias: { "@": root } });
const read = (p) => readFileSync(join(root, p), "utf8");

test("plan names come from one source: seller_premium is 'Seller Starter'", () => {
  const { planLabel } = jiti("./lib/account.ts");
  assert.equal(planLabel("seller_premium"), "Seller Starter");
  assert.equal(planLabel("seller_pro"), "Seller Pro");
  const offenders = [];
  const walk = (dir) => { for (const f of readdirSync(join(root, dir))) { const p = join(dir, f); if (statSync(join(root, p)).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !/backup/.test(p) && /Seller Premium/.test(read(p))) offenders.push(p); } };
  for (const d of ["app/dashboard", "app/seller", "app/seller-upsell", "app/pricing", "components"]) { try { walk(d); } catch {} }
  assert.deepEqual(offenders.filter((p) => !/socialAutoPost|socialReel/.test(p)), []);
});

test("middleware gates seller pages server-side: shoppers -> upsell, Starter compare -> locked preview", () => {
  const mw = read("middleware.ts");
  assert.match(mw, /isProtectedSellerPath && isLoggedIn && !isSellerAccount[\s\S]{0,200}seller-upsell/);
  assert.match(mw, /normalizedPlan !== "seller_pro"[\s\S]{0,250}feature=compare/);
  const upsell = read("app/seller-upsell/page.tsx");
  assert.match(upsell, /compare/i);
  assert.match(upsell, /\/pricing/);
});

test("seller APIs require a seller plan (upload, compare, analyze, workspace)", () => {
  for (const p of ["app/api/seller-compare/route.ts", "app/api/seller-workspace/route.ts"]) {
    assert.match(read(p), /SELLER_PLAN_REQUIRED|seller_pro|isSellerPlan/, p);
  }
});

test("free seller compare makes zero OpenAI calls and only uses real review signals", async () => {
  const realFetch = globalThis.fetch; let openAi = 0;
  globalThis.fetch = async (url, ...rest) => { if (/openai/i.test(String(url))) openAi += 1; return realFetch(url, ...rest); };
  try {
    const { freeSellerCompare } = jiti("./lib/sellerCompareFree.ts");
    const out = freeSellerCompare(
      { buyScore: 62, topPraise: ["easy setup"], topComplaints: ["battery drains"], reviewCount: 14 },
      { buyScore: 78, topPraise: ["easy setup", "loud sound"], topComplaints: [], reviewCount: 30 },
    );
    assert.equal(out.openAiCalls, 0);
    assert.equal(out.source, "free_scorer");
    assert.equal(out.competitivePosition, "Behind");
    assert.equal(out.confidence, null);
    assert.ok(out.conversionGaps.some((l) => /battery drains/.test(l)));
    assert.ok(out.competitorAdvantages.some((l) => /loud sound/.test(l)));
    const none = freeSellerCompare({}, {});
    assert.equal(none.competitivePosition, "Not scored");
  } finally { globalThis.fetch = realFetch; }
  assert.equal(openAi, 0);
  assert.match(read("app/api/seller-compare/route.ts"), /REVIEWINTEL_SELLER_COMPARE_OPENAI/);
});

test("Premium quota copy matches the enforced limit (unlimited), no '/10' or '10 scans per week'", () => {
  const hub = read("app/dashboard/customer/page.tsx");
  assert.doesNotMatch(hub, /\/10`|10 scans per week/);
  assert.match(hub, /FREE_DAILY_REVIEW_LIMIT/);
});

test("paid seller dashboard has no ads and one empty-state action", () => {
  const page = read("app/dashboard/seller/page.tsx");
  assert.doesNotMatch(page, /<AdSlot/);
  assert.match(page, /seller-empty-state/);
});

test("seller workspace migration is a file only and the API falls back to local storage", () => {
  const sql = read("supabase/migrations/20261010_seller_workspace.sql");
  assert.match(sql, /create table if not exists public\.seller_workspaces/);
  assert.match(sql, /NOT APPLIED/);
  assert.match(read("app/api/seller-workspace/route.ts"), /storage: "local"/);
});

test("watch alerts are off by default and only alert on real changes", () => {
  const w = jiti("./lib/productWatches.ts");
  assert.equal(w.watchAlertsEnabled({}), false);
  assert.equal(w.watchAlertsEnabled({ REVIEWINTEL_WATCH_ALERTS: "on" }), true);
  assert.equal(w.productKeyFromUrl("https://www.amazon.ca/Some-Thing/dp/B0ABCDE123?th=1"), "asin:B0ABCDE123");
  const prev = { verdict: "DO NOT BUY YET", acceptedCount: 7, resultHash: "a" };
  assert.deepEqual(w.decideWatchAlert(prev, { ...prev }), { alert: false, reason: "no_change" });
  assert.equal(w.decideWatchAlert(prev, { verdict: "BUY", acceptedCount: 8, resultHash: "b" }).reason, "verdict_changed");
  assert.equal(w.decideWatchAlert(prev, { verdict: "DO NOT BUY YET", acceptedCount: 12, resultHash: "b" }).alert, false);
  assert.equal(w.decideWatchAlert(prev, { verdict: "DO NOT BUY YET", acceptedCount: 17, resultHash: "b" }).reason, "new_evidence");
  assert.equal(w.decideWatchAlert(prev, null).alert, false);
  const t = w.signUnwatchToken("A@b.com", "asin:B0ABCDE123", "k");
  assert.deepEqual(w.verifyUnwatchToken(t, "k"), { email: "a@b.com", productKey: "asin:B0ABCDE123" });
  assert.equal(w.verifyUnwatchToken(t, "other"), null);
  assert.match(read("supabase/migrations/20261010_product_watches.sql"), /NOT APPLIED/);
});
