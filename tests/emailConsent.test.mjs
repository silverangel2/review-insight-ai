// Marketing email consent: fail closed, opt-outs are authoritative and survive rollback/re-upgrade.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.REVIEWINTEL_BLOCK_OUTBOUND_EMAIL = "1";
process.env.REVIEWINTEL_DISABLE_OPENAI = "1";
delete process.env.RESEND_API_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const store = jiti("./lib/emailPreferenceStore.ts");
const life = jiti("./lib/lifecycleEmail.ts");
const delivery = jiti("./lib/emailDelivery.ts");
const read = (p) => readFileSync(root + p, "utf8");
const perm = (row, ready = true) => store.marketingPermission(row, ready);

test("existing user opted out stays out (old schema and new schema)", () => {
  assert.deepEqual(perm({ marketing_consent: false }, false), { productUpdates: false, upgradeTips: false });
  assert.deepEqual(perm({ marketing_consent: false, email_product_updates: null, email_upgrade_tips: null }), { productUpdates: false, upgradeTips: false });
  assert.deepEqual(perm({ marketing_consent: null }), { productUpdates: false, upgradeTips: false });
});

test("existing user opted in keeps exactly the consent they gave at signup", () => {
  assert.deepEqual(perm({ marketing_consent: true }, false), { productUpdates: true, upgradeTips: true });
  assert.deepEqual(perm({ marketing_consent: true, email_product_updates: null, email_upgrade_tips: false }), { productUpdates: true, upgradeTips: false });
});

test("new user without the optional box ticked gets no marketing mail", () => {
  assert.deepEqual(perm({ marketing_consent: false, email_product_updates: null, email_upgrade_tips: null }), { productUpdates: false, upgradeTips: false });
});

test("rollback/re-upgrade: an opt-out written by either code version survives", () => {
  // New code unsubscribed (all false), old code later rewrote marketing_consent true from a stale form:
  assert.deepEqual(perm({ marketing_consent: true, email_product_updates: false, email_upgrade_tips: false }), { productUpdates: false, upgradeTips: false });
  // Old code unsubscribed (marketing_consent false) while new columns still say true:
  assert.deepEqual(perm({ marketing_consent: false, email_product_updates: true, email_upgrade_tips: true }), { productUpdates: false, upgradeTips: false });
});

test("migration never opts anyone in", () => {
  const sql = read("supabase/migrations/20261011_email_preferences.sql").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /\bupdate\s+public\.profiles\b/i, "no backfill");
  assert.doesNotMatch(sql, /default\s+true/i, "no opt-in default");
  assert.match(sql, /add column if not exists email_upgrade_tips boolean,/);
});

test("unsubscribe writes false everywhere and missing row / no DB means do not send", async () => {
  const unsub = read("app/api/unsubscribe/route.ts");
  assert.match(unsub, /saveEmailPrefs\(email, \{ productUpdates: false, upgradeTips: false \}\)/);
  assert.match(read("lib/emailPreferenceStore.ts"), /marketing_consent: anyMarketing/);
  assert.equal(await store.readStoredEmailPrefs("x@example.com"), null, "no DB configured -> null -> no send");
  const res = await store.saveEmailPrefs("x@example.com", { productUpdates: false, upgradeTips: false });
  assert.equal(res.ok, false); assert.equal(res.reason, "not-configured");
});

const baseDeps = (over = {}) => ({ siteUrl: "https://getreviewintel.com", secret: "s", load: async () => null,
  claimWelcome: async () => true, claimUpgrade: async () => true, countScans: async () => 1,
  send: async () => { throw new Error("must not send"); }, ...over });

test("first-scan upgrade tip: missing row, opted out and unknown all skip; explicit yes sends once", async () => {
  assert.equal((await life.deliverFirstScanUpgrade({ email: "a@example.com" }, baseDeps())).reason, "no-preferences");
  assert.equal((await life.deliverFirstScanUpgrade({ email: "a@example.com" }, baseDeps({ load: async () => ({ productUpdates: false, upgradeTips: false }) }))).reason, "opted-out");
  assert.equal((await life.deliverFirstScanUpgrade({ email: "a@example.com" }, baseDeps({ load: async () => ({ productUpdates: false }) }))).reason, "opted-out");
  let sends = 0;
  const ok = await life.deliverFirstScanUpgrade({ email: "a@example.com" }, baseDeps({ load: async () => ({ productUpdates: true, upgradeTips: true }), send: async () => { sends++; return { ok: true }; } }));
  assert.equal(ok.sent, true); assert.equal(sends, 1);
});

test("account/transactional mail is separate: welcome does not need marketing consent", async () => {
  let sends = 0;
  const r = await life.deliverWelcomeEmail({ email: "b@example.com", name: "B" }, baseDeps({
    load: async () => ({ productUpdates: false, upgradeTips: false }), send: async () => { sends++; return { ok: true }; } }));
  assert.equal(r.sent, true); assert.equal(sends, 1);
});

test("account save only changes consent on an explicit boolean", () => {
  const src = read("app/api/account/route.ts");
  assert.doesNotMatch(src, /marketing_consent: Boolean\(body\.marketingConsent/);
  assert.match(src, /typeof \(body\.marketingConsent \?\? body\.marketing_consent\) === "boolean"/);
});

test("preview blocking: REVIEWINTEL_BLOCK_OUTBOUND_EMAIL=1 sends nothing", async () => {
  const r = await delivery.sendReviewIntelEmail({ emailType: "t", to: "c@example.com", subject: "s", html: "h", text: "t" });
  assert.equal(r.ok, false); assert.equal(r.blocked, true); assert.equal(r.attempts, 0);
});
