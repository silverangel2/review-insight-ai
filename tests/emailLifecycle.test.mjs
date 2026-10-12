import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.REVIEWINTEL_BLOCK_OUTBOUND_EMAIL = "1";
delete process.env.RESEND_API_KEY;

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const read = (path) => readFileSync(root + path, "utf8");

const template = jiti("./lib/emailTemplate.ts");
const links = jiti("./lib/emailLinks.ts");
const delivery = jiti("./lib/emailDelivery.ts");
const life = jiti("./lib/lifecycleEmail.ts");
const pricing = jiti("./lib/pricing.ts");
const upsell = jiti("./lib/upsell.ts");
const unsubscribe = jiti("./lib/emailUnsubscribe.ts");

const secret = "test-email-secret";
const site = "https://getreviewintel.com";

function profile(overrides = {}) {
  return {
    name: "Alex",
    role: "buyer",
    plan: "free_buyer",
    productUpdates: false,
    upgradeTips: true,
    welcomeSentAt: null,
    upgradeSentAt: null,
    ...overrides,
  };
}

function deps(overrides = {}) {
  return {
    siteUrl: site,
    secret,
    load: async () => profile(),
    claimWelcome: async () => true,
    claimUpgrade: async () => true,
    countScans: async () => 1,
    send: async () => ({ ok: true }),
    ...overrides,
  };
}

test("branded email escapes untrusted text and includes preference links", () => {
  const rendered = template.renderBrandedEmail({
    preheader: "Preview",
    eyebrow: "Note",
    title: "<script>alert(1)</script>",
    greetingName: "Ann & Jo",
    paragraphs: ["Line <b>one</b>"],
    bullets: ["Keep it honest"],
    cta: { label: "Look", href: "https://getreviewintel.com/pricing" },
    reason: "Because you asked.",
    preferencesUrl: "https://getreviewintel.com/email-preferences?token=abc",
    unsubscribeUrl: "https://getreviewintel.com/unsubscribe?token=abc",
  });
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(rendered.html, /Ann &amp; Jo/);
  assert.doesNotMatch(rendered.html, /<script>alert/);
  assert.match(rendered.html, /Email preferences/);
  assert.match(rendered.html, /Unsubscribe/);
  assert.match(rendered.text, /email-preferences\?token=abc/);
  assert.match(rendered.text, /unsubscribe\?token=abc/);
});

test("welcome and first-scan emails stay honest and use one template", () => {
  const signed = links.emailActionLinks("alex@example.com", site, secret);
  const welcome = life.buildWelcomeEmail({ name: "Alex", role: "buyer", ...signed, siteUrl: site });
  const upgrade = life.buildFirstScanUpgradeEmail({
    name: "Alex",
    role: "buyer",
    productName: "Weekend travel kettle",
    verdict: "REVIEW FIRST",
    ...signed,
    siteUrl: site,
    env: {},
  });
  const price = pricing.pricingLabelForPlan("buyer_pro", "CAD");
  assert.equal(welcome.subject, "Welcome to ReviewIntel");
  assert.match(welcome.html, /We do not invent reviews/);
  assert.match(welcome.headers["List-Unsubscribe"], /api\/unsubscribe\?token=/);
  assert.equal(welcome.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(upgrade.text, /look closer before buying/);
  assert.match(upgrade.text, new RegExp(price.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const benefit of upsell.shopperBenefits({})) assert.match(upgrade.text, new RegExp(benefit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(`${welcome.html}\n${upgrade.html}`, /Nike|Apple|Samsung|Amazon|hurry|limited time|only \d+ left/i);
  assert.equal(links.readEmailToken(signed.preferencesUrl.split("token=")[1], secret), "alex@example.com");
  assert.equal(links.readEmailToken("tampered.token", secret), "");
  assert.equal(links.readEmailToken(links.signEmailToken("alex@example.com", secret), "other-secret"), "");
});

test("welcome sends once and first-scan mail respects plan, preference, and scan count", async () => {
  let welcomeSends = 0;
  const welcome = await life.deliverWelcomeEmail({ email: "alex@example.com", name: "Alex", role: "buyer" }, deps({
    send: async (message) => {
      welcomeSends += 1;
      assert.equal(message.emailType, "welcome");
      assert.match(message.headers["List-Unsubscribe"], /api\/unsubscribe/);
      return { ok: true };
    },
  }));
  assert.deepEqual(welcome, { sent: true, reason: "sent" });
  assert.equal(welcomeSends, 1);
  assert.deepEqual(await life.deliverWelcomeEmail({ email: "alex@example.com" }, deps({
    load: async () => profile({ welcomeSentAt: "2026-10-11T00:00:00.000Z" }),
    send: async () => { throw new Error("should not send"); },
  })), { sent: false, reason: "already-sent" });

  assert.deepEqual(await life.deliverFirstScanUpgrade({ email: "alex@example.com", plan: "buyer_pro" }, deps({
    countScans: async () => { throw new Error("should not count"); },
  })), { sent: false, reason: "paid-plan" });

  assert.deepEqual(await life.deliverFirstScanUpgrade({ email: "alex@example.com", plan: "free_buyer" }, deps({
    load: async () => profile({ upgradeTips: false }),
    claimUpgrade: async () => { throw new Error("should not claim"); },
  })), { sent: false, reason: "opted-out" });

  assert.deepEqual(await life.deliverFirstScanUpgrade({ email: "alex@example.com" }, deps({
    countScans: async () => 2,
    claimUpgrade: async () => { throw new Error("should not claim"); },
  })), { sent: false, reason: "not-first" });

  assert.deepEqual(await life.deliverFirstScanUpgrade({ email: "shopper.premium@reviewintel.test" }, deps()), { sent: false, reason: "test-account" });

  let upgradeSends = 0;
  const sent = await life.deliverFirstScanUpgrade({
    email: "alex@example.com",
    role: "seller",
    plan: "free_buyer",
    productName: "https://example.com/secret",
    verdict: "BUY",
  }, deps({
    load: async () => profile({ role: "seller" }),
    send: async (message) => {
      upgradeSends += 1;
      assert.equal(message.subject, "Your first seller scan is done");
      assert.doesNotMatch(message.text, /https:\/\/example.com/);
      assert.ok(message.text.includes(pricing.pricingLabelForPlan("seller_premium", "CAD")));
      return { ok: true };
    },
  }));
  assert.equal(sent.sent, true);
  assert.equal(upgradeSends, 1);

  assert.deepEqual(await life.deliverFirstScanUpgrade({ email: "alex@example.com" }, deps({
    send: async () => ({ ok: false, error: "down" }),
  })), { sent: false, reason: "send-failed" });
});

test("email sending retries temporary failures and does not call a real provider", async () => {
  assert.equal(process.env.RESEND_API_KEY, undefined);
  const blocked = await delivery.sendReviewIntelEmail({
    emailType: "admin_test",
    to: "alex@example.com",
    subject: "nope",
    html: "<p>nope</p>",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.attempts, 0);

  let calls = 0;
  const recovered = await delivery.sendReviewIntelEmail({
    emailType: "welcome",
    to: "alex@example.com",
    subject: "Welcome",
    html: "<p>Hi</p>",
    text: "Hi",
  }, {
    sleep: async () => {},
    transport: async () => {
      calls += 1;
      if (calls < 3) return { error: { message: "temporarily unavailable", statusCode: 503 } };
      return { id: "test-message" };
    },
  });
  assert.equal(calls, 3);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.attempts, 3);

  let badCalls = 0;
  const rejected = await delivery.sendReviewIntelEmail({
    emailType: "welcome",
    to: "not-an-address",
    subject: "Welcome",
    html: "<p>Hi</p>",
  }, {
    sleep: async () => {},
    transport: async () => {
      badCalls += 1;
      return { error: { message: "Invalid recipient", statusCode: 400 } };
    },
  });
  assert.equal(badCalls, 1);
  assert.equal(rejected.ok, false);
  assert.equal(delivery.isRetryableEmailFailure(null, "RESEND_API_KEY is missing."), false);
  assert.equal(delivery.isRetryableEmailFailure(429, "rate limit"), true);
});

test("unsubscribe links do not change settings on a plain visit", async () => {
  const token = links.signEmailToken("alex@example.com", secret);
  assert.equal(unsubscribe.unsubscribeTarget({ token, email: "other@example.com", oneClick: true, formPost: true }, secret), "alex@example.com");
  assert.equal(unsubscribe.unsubscribeTarget({ token: "", email: "alex@example.com", oneClick: true, formPost: true }, secret), "");
  assert.equal(unsubscribe.unsubscribeTarget({ token: "", email: "alex@example.com", oneClick: false, formPost: true }, secret), "alex@example.com");
  const parsed = await unsubscribe.readUnsubscribeInput(new Request("https://getreviewintel.com/api/unsubscribe?token=abc", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  }));
  assert.equal(parsed.oneClick, true);
  assert.equal(parsed.token, "abc");
  const route = read("app/api/unsubscribe/route.ts");
  assert.match(route, /NextResponse\.redirect/);
  assert.doesNotMatch(route, /export async function GET[\s\S]*marketing_consent/);
  assert.match(read("components/UnsubscribePanel.tsx"), /htmlFor="unsubscribe-email"/);
  assert.match(read("supabase/migrations/20261011_email_preferences.sql"), /email_upgrade_tips/);
  assert.match(read("docs/email-deliverability.md"), /_dmarc\.getreviewintel\.com/);
});
