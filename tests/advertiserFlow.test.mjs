import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const f = jiti("./lib/advertiserFlow.ts");
const read = p => readFileSync(root + p, "utf8");

test("signed campaign links: purpose-bound and tamper-proof", () => {
  const t = f.signCampaignToken("pay", "abc-123", "s");
  assert.equal(f.verifyCampaignToken(t, "pay", "s"), "abc-123");
  assert.equal(f.verifyCampaignToken(t, "report", "s"), null);
  assert.equal(f.verifyCampaignToken(t, "pay", "other"), null);
  assert.equal(f.verifyCampaignToken(t.slice(0, -2) + "xx", "pay", "s"), null);
});

test("inquiry: honeypot, validation, rate limit", () => {
  assert.equal(f.validateInquiry({ name: "A", email: "a@b.co", company: "C", company_website_confirm: "x" }).spam, true);
  assert.equal(f.validateInquiry({ name: "A", email: "bad", company: "C" }).ok, false);
  const ok = f.validateInquiry({ name: "A", email: "A@B.co", company: "C", budget: "weird" });
  assert.equal(ok.ok, true); assert.equal(ok.value.email, "a@b.co"); assert.equal(ok.value.budget, "Not sure yet");
  const k = "ip-test-" + Math.random();
  assert.deepEqual([1, 2, 3, 4].map(() => f.rateLimited(k, 3, 60000, 1000)), [false, false, false, true]);
});

test("stripe: test keys only; checkout carries campaign id; webhook signature verified", async () => {
  assert.equal(f.stripeTestKey({ STRIPE_SECRET_KEY: "sk_live_x" }).key, null);
  assert.equal(f.stripeTestKey({}).key, null);
  assert.equal(f.stripeTestKey({ STRIPE_SECRET_KEY: "sk_test_x" }).key, "sk_test_x");
  let sent;
  const out = await f.createCheckoutSession({ campaignId: "c1", packageId: "featured_monthly", packageName: "Featured", origin: "http://localhost:3010" }, { STRIPE_SECRET_KEY: "sk_test_x" },
    async (url, init) => { sent = { url, body: String(init.body) }; return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" }), { status: 200 }); });
  assert.equal(out.ok, true); assert.match(sent.url, /api\.stripe\.com\/v1\/checkout\/sessions/); assert.match(sent.body, /metadata%5Bcampaign_id%5D=c1/);
  assert.equal((await f.createCheckoutSession({ campaignId: "c1", packageId: "x", packageName: "x", origin: "o" }, { STRIPE_SECRET_KEY: "sk_live_1" }, () => { throw new Error("must not call"); })).ok, false);
  const payload = '{"type":"checkout.session.completed"}', t = 1000;
  const sig = createHmac("sha256", "whsec").update(`${t}.${payload}`).digest("hex");
  assert.equal(f.verifyStripeSignature(payload, `t=${t},v1=${sig}`, "whsec", 300, 1100), true);
  assert.equal(f.verifyStripeSignature(payload, `t=${t},v1=${sig}`, "whsec", 300, 5000), false);
  assert.equal(f.verifyStripeSignature(payload + " ", `t=${t},v1=${sig}`, "whsec", 300, 1100), false);
  assert.equal(f.ctr(0, 0), "–"); assert.equal(f.ctr(200, 3), "1.50%");
});

test("wiring: webhook refuses live, manual mark-paid kept, migration file not applied, no live keys committed", () => {
  const hook = read("app/api/advertising/stripe-webhook/route.ts");
  assert.match(hook, /livemode/); assert.match(hook, /verifyStripeSignature/);
  const admin = read("app/api/admin/advertising/route.ts");
  assert.match(admin, /mark_paid/); assert.match(admin, /signCampaignToken\("pay"/); assert.match(admin, /starts_at/);
  assert.match(read("supabase/migrations/20261011_advertiser_flow.sql"), /NOT APPLIED/);
  const page = read("app/advertise/page.tsx");
  assert.match(page, /filter\(\(\[, v\]\) => typeof v === "number" && v > 0\)/, "unavailable stats are hidden");
  assert.match(read("components/advertising/AdvertiseInquiry.tsx"), /company_website_confirm/);
  const src = ["lib/advertiserFlow.ts", "app/api/advertising/checkout/route.ts", "app/api/advertising/stripe-webhook/route.ts", "app/api/advertising/inquiry/route.ts"].map(read).join("\n");
  assert.doesNotMatch(src, /sk_live_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/);
});
