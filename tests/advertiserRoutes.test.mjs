// Advertiser routes against an in-memory fake Supabase. No network, no real DB, no Stripe, no email.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://fake-supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role";
process.env.REVIEWINTEL_BLOCK_OUTBOUND_EMAIL = "1";
process.env.REVIEWINTEL_DISABLE_OPENAI = "1";
process.env.REVIEWINTEL_ADMIN_SESSION_SECRET = "test-admin-secret";
process.env.REVIEWINTEL_ADVERTISER_SECRET = "test-adv-secret";
delete process.env.RESEND_API_KEY;
delete process.env.STRIPE_SECRET_KEY;

const db = { apps: [], ads: [], eventsTableExists: false, log: [], stripeCalls: 0, outside: [] };
const realFetch = globalThis.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function params(u) { const o = {}; for (const [k, v] of u.searchParams) o[k] = v; return o; }
function match(row, q) {
  return Object.entries(q).every(([k, v]) => {
    if (["select", "limit", "order", "on_conflict"].includes(k)) return true;
    if (v === "is.null") return row[k] == null;
    if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
    if (v.startsWith("neq.")) return String(row[k]) !== v.slice(4);
    return true;
  });
}
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(String(input));
  const method = (init.method || "GET").toUpperCase();
  if (u.hostname === "api.stripe.com") { db.stripeCalls++; return json({ error: { message: "stripe must not be called" } }, 500); }
  if (u.hostname !== "fake-supabase.invalid") { db.outside.push(String(input)); throw new Error("network blocked in test: " + input); }
  db.log.push(`${method} ${u.pathname}?${u.searchParams}`);
  const table = u.pathname.split("/").pop();
  const q = params(u);
  if (table === "sponsor_ad_events" && !db.eventsTableExists) return json({ code: "PGRST205", message: "Could not find the table 'public.sponsor_ad_events'" }, 404);
  const rows = table === "advertiser_applications" ? db.apps : table === "sponsor_ads" ? db.ads : table === "sponsor_ad_events" ? [] : null;
  if (!rows) return json([], 200);
  if (method === "GET") return json(rows.filter(r => match(r, q)));
  if (method === "PATCH") {
    const hit = rows.filter(r => match(r, q)); const body = JSON.parse(init.body || "{}");
    hit.forEach(r => Object.assign(r, body)); return json(hit);
  }
  if (method === "POST") {
    const body = JSON.parse(init.body || "{}");
    if (table === "sponsor_ads" && body.application_id && rows.some(r => r.application_id === body.application_id)) return json({ code: "23505" }, 409);
    const row = { id: `${table}-${rows.length + 1}`, ...body }; rows.push(row); return json([row], 201);
  }
  return json([]);
};
test.after(() => { globalThis.fetch = realFetch; });

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const admin = jiti("./app/api/admin/advertising/route.ts");
const inquiry = jiti("./app/api/advertising/inquiry/route.ts");
const checkout = jiti("./app/api/advertising/checkout/route.ts");
const webhook = jiti("./app/api/advertising/stripe-webhook/route.ts");
const events = jiti("./app/api/sponsor-events/route.ts");
const access = jiti("./lib/adminAccess.ts");
const flow = jiti("./lib/advertiserFlow.ts");

const cookie = () => `${access.ADMIN_SESSION_COOKIE}=${encodeURIComponent(access.createAdminSessionCookie("owner@test.invalid"))}`;
const adminPost = (body, withCookie = true) => admin.POST(new Request("http://localhost/api/admin/advertising", {
  method: "POST", headers: { "content-type": "application/json", ...(withCookie ? { cookie: cookie() } : {}) }, body: JSON.stringify(body) }));

test("inquiry is saved (with blank website) and outbound email stays blocked", async () => {
  const res = await inquiry.POST(new Request("http://localhost/api/advertising/inquiry", { method: "POST", headers: { "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify({ name: "Ann", email: "ann@brand.test", company: "Brand" }) }));
  assert.equal(res.status, 200);
  assert.equal(db.apps.length, 1);
  assert.equal(db.apps[0].website_url, "", "never null: production column is NOT NULL until the migration runs");
  assert.equal(db.apps[0].status, "pending");
  assert.deepEqual(db.outside, [], "no request left the box (Resend blocked)");
});

test("admin routes reject unauthenticated and forged sessions", async () => {
  assert.equal((await adminPost({ action: "approve", applicationId: "x" }, false)).status, 403);
  const forged = await admin.POST(new Request("http://localhost/api/admin/advertising", { method: "POST",
    headers: { "content-type": "application/json", cookie: `${access.ADMIN_SESSION_COOKIE}=abc.def` }, body: "{}" }));
  assert.equal(forged.status, 403);
  assert.equal((await admin.GET(new Request("http://localhost/api/admin/advertising"))).status, 403);
});

test("approval is idempotent: one ad, one payment-link claim, no resend", async () => {
  const id = db.apps[0].id;
  db.log.length = 0;
  const first = await (await adminPost({ action: "approve", applicationId: id })).json();
  assert.equal(first.ok, true);
  assert.equal(db.ads.length, 1);
  // Email is blocked, so the claim was released for a later retry.
  assert.equal(db.apps[0].payment_link_sent_at, null);
  const claims1 = db.log.filter(l => l.includes("payment_link_sent_at=is.null")).length;
  assert.equal(claims1, 1);

  // Simulate a link that did go out earlier, then approve twice more.
  db.apps[0].payment_link_sent_at = "2026-10-12T00:00:00.000Z";
  db.log.length = 0;
  const again = await (await adminPost({ action: "approve", applicationId: id })).json();
  await adminPost({ action: "approve", applicationId: id });
  assert.equal(db.ads.length, 1, "no duplicate sponsor ad");
  assert.equal(db.log.filter(l => l.includes("payment_link_sent_at=is.null")).length, 0, "no second payment-link claim");
  assert.match(again.message, /nothing was resent/);
  assert.equal(db.ads[0].active, false, "unpaid ad never goes live");
  assert.equal(db.stripeCalls, 0);
});

test("concurrent approval: losing the payment-link claim sends nothing", () => {
  assert.equal(flow.shouldSendPaymentLink({ payment_status: "unpaid", payment_link_sent_at: null, contact_email: "a@b.co" }), true);
  assert.equal(flow.shouldSendPaymentLink({ payment_status: "paid", contact_email: "a@b.co" }), false);
  assert.equal(flow.shouldSendPaymentLink({ payment_status: "unpaid", payment_link_sent_at: "x", contact_email: "a@b.co" }), false);
  assert.equal(flow.shouldSendPaymentLink({ payment_status: "unpaid", contact_email: "" }), false);
});

test("missing sponsor_ad_events degrades gracefully", async () => {
  db.eventsTableExists = false;
  const list = await admin.GET(new Request("http://localhost/api/admin/advertising", { headers: { cookie: cookie() } }));
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.ads[0].impressions, 0);
  const ev = await events.POST(new Request("http://localhost/api/sponsor-events", { method: "POST",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh)", "x-forwarded-for": "10.0.0.9" }, body: JSON.stringify({ type: "impression", sponsorId: db.ads[0].id }) }));
  assert.equal(ev.status, 200);
});

test("Stripe is TEST-only end to end", async () => {
  // No key: checkout refuses without calling Stripe.
  const t = flow.signCampaignToken("pay", db.apps[0].id);
  db.apps[0].status = "approved";
  const noKey = await checkout.GET(new Request(`http://localhost/api/advertising/checkout?t=${encodeURIComponent(t)}`));
  assert.equal(noKey.status, 503);
  process.env.STRIPE_SECRET_KEY = "sk_live_should_be_refused";
  const live = await checkout.GET(new Request(`http://localhost/api/advertising/checkout?t=${encodeURIComponent(t)}`));
  assert.equal(live.status, 503);
  assert.equal(db.stripeCalls, 0);
  // Test key, but Stripe answers with a non-test session id: refused.
  const out = await flow.createCheckoutSession({ campaignId: "c1", packageId: "featured_monthly", packageName: "F", origin: "http://localhost" },
    { STRIPE_SECRET_KEY: "sk_test_x" }, async (_u, init) => { assert.ok(init.headers["Idempotency-Key"]); return new Response(JSON.stringify({ id: "cs_live_1", url: "https://x" }), { status: 200 }); });
  assert.equal(out.ok, false);
  assert.equal(flow.checkoutIdempotencyKey("c1", 100, "o", "2026-10-12"), flow.checkoutIdempotencyKey("c1", 100, "o", "2026-10-12"));
  // Webhook with a live key configured is refused even with a valid-looking body.
  const wh = await webhook.POST(new Request("http://localhost/api/advertising/stripe-webhook", { method: "POST", body: "{}" }));
  assert.equal(wh.status, 400);
  delete process.env.STRIPE_SECRET_KEY;
});
