import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const u = jiti("./lib/upsell.ts");
const read = p => readFileSync(root + p, "utf8");

test("upsell: benefits match enforcement; price from plan config; watch alerts only when enabled", () => {
  const off = u.shopperBenefits({});
  assert.ok(off.some(b => /Unlimited scans \(free is 3 a day\)/.test(b)));
  assert.ok(!off.some(b => /Watch alerts/.test(b)));
  assert.ok(u.shopperBenefits({ NEXT_PUBLIC_REVIEWINTEL_WATCH_ALERTS: "on" }).some(b => /Watch alerts/.test(b)));
  const { pricingLabelForPlan } = jiti("./lib/pricing.ts");
  assert.equal(u.upsellOffer("shopper", "CAD", {}).plans[0].price, pricingLabelForPlan("buyer_pro", "CAD"));
  assert.deepEqual(u.upsellOffer("seller", "CAD", {}).plans.map(p => p.plan), ["seller_premium", "seller_pro"]);
  // share is free for everyone, so it is not sold as a Premium benefit
  assert.ok(!off.some(b => /share/i.test(b)));
});

test("upsell: 'Maybe later' snoozes for a few days", () => {
  const store = new Map(); const s = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(u.snoozed(0, s), false);
  u.snooze(0, s);
  assert.equal(u.snoozed(86400000 * 3, s), true);
  assert.equal(u.snoozed(86400000 * 5, s), false);
});

test("upsell: no dark patterns, inline not modal, tracked, reduced-motion via ri-fade-in", () => {
  const src = ["components/upsell/UpgradeMoment.tsx", "components/upsell/LimitReachedCard.tsx", "components/upsell/ShareFooterNudge.tsx"].map(read).join("\n");
  assert.doesNotMatch(src, /setInterval|countdown|only \d+ left|expires in|hurry|limited time/i);
  assert.doesNotMatch(read("components/upsell/UpgradeMoment.tsx"), /role="dialog"|fixed inset/);
  for (const e of ["upsell_view", "upsell_click"]) assert.match(src, new RegExp(e));
  assert.match(read("lib/clientCheckout.ts"), /checkout_start/); assert.match(read("lib/clientCheckout.ts"), /\/api\/stripe\/checkout/);
  assert.match(read("lib/trafficAnalytics.ts"), /"checkout_start"/);
  assert.match(read("app/globals.css"), /prefers-reduced-motion/);
  assert.match(read("components/ResultsClient.tsx"), /<UpgradeMoment/);
  assert.match(read("components/AnalyzerForm.tsx"), /<LimitReachedCard/);
  assert.match(read("app/v/[token]/page.tsx"), /<ShareFooterNudge/);
  assert.match(read("components/advertising/AdSlot.tsx"), /premiumHouseSlide/);
});
