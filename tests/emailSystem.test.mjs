import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
process.env.SUPABASE_URL = ""; process.env.NEXT_PUBLIC_SUPABASE_URL = ""; process.env.SUPABASE_SERVICE_ROLE_KEY = "";
const T = jiti("./lib/emailTemplates.ts");
const P = jiti("./lib/emailPreferences.ts");
const D = jiti("./lib/emailDelivery.ts");
const read = p => readFileSync(root + p, "utf8");

test("every template renders branded HTML + plain text; optional mail has unsubscribe + preferences", () => {
  for (const name of Object.keys(T.emailTemplates)) {
    const m = T.previewEmail(name);
    assert.ok(m.subject && m.html.includes("ReviewIntel") && m.html.includes('name="viewport"'), name);
    assert.ok(m.text.length > 40 && !/<[a-z]/i.test(m.text), `${name} text has no HTML`);
    if (m.category !== "transactional") { assert.match(m.html, /Unsubscribe/); assert.match(m.text, /Unsubscribe: http/); assert.match(m.html, /Email preferences/); }
    else assert.doesNotMatch(m.html, /Unsubscribe/);
  }
  assert.match(T.previewEmail("welcome").text, /First-scan tip/);
  const esc = T.emailTemplates.owner_notification({ title: "<script>x</script>", message: "a & b" });
  assert.doesNotMatch(esc.html, /<script>x/);
});

test("preferences: signed tokens, one-click headers, normalization", () => {
  const t = P.signEmailToken("Sam@Example.com", "s");
  assert.equal(P.verifyEmailToken(t, "s"), "sam@example.com");
  assert.equal(P.verifyEmailToken(t + "x", "s"), null);
  const h = P.unsubscribeHeaders("sam@example.com", "watch_alerts");
  assert.match(h["List-Unsubscribe"], /\/api\/email\/unsubscribe\?t=.*&c=watch_alerts/);
  assert.equal(h["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.deepEqual(P.unsubscribeHeaders("sam@example.com", "transactional"), {});
  assert.equal(P.normalizePreferences({ unsubscribed_all: true }).tips, false);
  assert.equal(P.normalizePreferences(null).marketing, true);
});

test("delivery: dev sink only, opt-out respected, retries on retryable errors, rate limited; mocked transport", async () => {
  const sent = [];
  let failNext = 0;
  D.__setEmailTestHooks({ transport: async m => { sent.push(m); if (failNext > 0) { failNext -= 1; return { error: "rate_limit_exceeded", retryable: true }; } return { id: "mock" }; }, prefs: async (_e, c) => c !== "marketing" });
  const prevEnv = process.env.NODE_ENV;
  delete process.env.REVIEWINTEL_EMAIL_DEV_SINK;
  let r = await D.sendReviewIntelEmail({ emailType: "t1", to: "a@example.com", subject: "s", html: "<p>h</p>" });
  assert.equal(r.skipped, true); assert.equal(sent.length, 0, "no sink outside production -> nothing sent");
  process.env.REVIEWINTEL_EMAIL_DEV_SINK = "sink@example.dev";
  r = await D.sendReviewIntelEmail({ emailType: "t2", to: "a@example.com", subject: "Hi", html: "<p>h</p>", category: "tips" });
  assert.equal(r.ok, true); assert.equal(sent[0].to, "sink@example.dev"); assert.match(sent[0].subject, /^\[dev → a@example.com\] Hi/);
  assert.match(sent[0].headers["List-Unsubscribe"], /unsubscribe/); assert.equal(sent[0].from, D.EMAIL_FROM); assert.ok(sent[0].replyTo);
  r = await D.sendReviewIntelEmail({ emailType: "t3", to: "a@example.com", subject: "x", html: "x", category: "marketing" });
  assert.equal(r.skipped, true); assert.match(r.error, /opted out/);
  failNext = 2; sent.length = 0;
  r = await D.sendReviewIntelEmail({ emailType: "t4", to: "b@example.com", subject: "x", html: "x" });
  assert.equal(r.ok, true); assert.equal(r.attempts, 3);
  for (let i = 0; i < D.EMAIL_RATE_LIMIT.perHour; i += 1) await D.sendReviewIntelEmail({ emailType: "t5", to: "c@example.com", subject: "x", html: "x" });
  r = await D.sendReviewIntelEmail({ emailType: "t5", to: "c@example.com", subject: "x", html: "x" });
  assert.equal(r.skipped, true); assert.match(r.error, /Rate limited/);
  assert.equal(D.resolveRecipient("x@y.z", { NODE_ENV: "production" }).to, "x@y.z");
  D.__setEmailTestHooks({ transport: null, prefs: null });
  process.env.NODE_ENV = prevEnv; delete process.env.REVIEWINTEL_EMAIL_DEV_SINK;
});

test("wiring: senders use the template, lifecycle emails once-only, preview routes 404 in prod, migration not applied", () => {
  assert.match(read("app/api/cron/product-watches/route.ts"), /category: "watch_alerts"/);
  assert.match(read("app/api/admin/marketing/send/route.ts"), /category: "marketing"/);
  assert.match(read("lib/notifications.ts"), /emailTemplates\.owner_notification/);
  assert.match(read("app/api/advertising/inquiry/route.ts"), /emailTemplates\.advertiser_autoreply/);
  assert.match(read("app/api/auth/signup/route.ts"), /sendWelcomeOnce/);
  assert.match(read("app/api/account/analyses/route.ts"), /sendUpgradeAfterFirstScanOnce/);
  const life = read("lib/lifecycleEmails.ts");
  assert.match(life, /welcome_sent_at/); assert.match(life, /upgrade_email_sent_at/); assert.match(life, /free_buyer/);
  assert.match(read("app/api/dev/email-preview/route.ts"), /NODE_ENV === "production"/);
  assert.match(read("app/dev-preview/email/page.tsx"), /notFound\(\)/);
  assert.match(read("supabase/migrations/20261011_email_preferences.sql"), /NOT APPLIED/);
});
