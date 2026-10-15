// ReviewIntel audit-access tokens: no production database, fake env values only.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { describe } from "node:test";

process.env.REVIEWINTEL_AUDIT_ACCOUNTS = "Shopper.Premium@reviewintel.test, seller.starter@reviewintel.test ,seller.starter@reviewintel.test,  ";
process.env.REVIEWINTEL_SESSION_SECRET = "audit-access-test-secret";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const audit = jiti("./lib/auditAccess.ts");
const sessions = jiti("./lib/accountSession.ts");

describe("audit account allowlist", () => {
  test("parses comma-separated emails, case-insensitive, dedupes, trims", () => {
    assert.deepEqual(audit.parseAuditAccounts("A@x.io, b@X.io ,A@x.io,,  "), ["a@x.io", "b@x.io"]);
    assert.deepEqual(audit.parseAuditAccounts(null), []);
    assert.deepEqual(audit.parseAuditAccounts(""), []);
  });
  test("isAuditAccount is case-insensitive", () => {
    assert.equal(audit.isAuditAccount("SHOPPER.PREMIUM@REVIEWINTEL.TEST"), true);
    assert.equal(audit.isAuditAccount("someone@example.com"), false);
    assert.equal(audit.isAuditAccount(""), false);
  });
  test("90-day session constant", () => {
    assert.equal(audit.AUDIT_SESSION_DAYS, 90);
    assert.equal(audit.AUDIT_SESSION_SECONDS, 90 * 24 * 60 * 60);
  });
});

describe("account session lifetime", () => {
  test("default token still expires in ~7 days", () => {
    const before = Date.now();
    const token = sessions.createAccountSession({ email: "a@x.io", role: "buyer", plan: "buyer_pro" });
    const session = sessions.verifyAccountSessionToken(token);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    assert.ok(session && Math.abs(session.exp - (before + sevenDays)) < 60 * 1000);
  });
  test("audit lifetime param gives ~90 days and verifies through the real reader", () => {
    const before = Date.now();
    const token = sessions.createAccountSession({ email: "a@x.io", role: "seller", plan: "seller_premium" }, audit.AUDIT_SESSION_SECONDS);
    const session = sessions.verifyAccountSessionToken(token);
    assert.ok(session);
    assert.equal(session.email, "a@x.io");
    assert.equal(session.role, "seller");
    assert.ok(Math.abs(session.exp - (before + audit.AUDIT_SESSION_SECONDS * 1000)) < 60 * 1000);
  });
});

describe("POST /api/admin/audit-session auth gates", () => {
  const route = jiti("./app/api/admin/audit-session/route.ts");
  const { ADMIN_SESSION_COOKIE, createAdminSessionCookie } = jiti("./lib/adminAccess.ts");

  function req({ body, adminCookie } = {}) {
    const headers = {};
    if (adminCookie) headers.cookie = `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(adminCookie)}`;
    return new Request("https://getreviewintel.com/api/admin/audit-session", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body ?? {})
    });
  }

  test("no admin session -> 401", async () => {
    const res = await route.POST(req({ body: { email: "seller.starter@reviewintel.test" } }));
    assert.equal(res.status, 401);
  });
  test("admin session + non-allowlisted email -> 403", async () => {
    const adminCookie = createAdminSessionCookie("admin@example.com");
    const res = await route.POST(req({ body: { email: "real.customer@example.com" }, adminCookie }));
    assert.equal(res.status, 403);
  });
  test("admin session + non-test email -> 403", async () => {
    const adminCookie = createAdminSessionCookie("admin@example.com");
    const res = await route.POST(req({ body: { email: "admin@reviewintel.test" }, adminCookie }));
    // admin@reviewintel.test is not on the allowlist -> 403
    assert.equal(res.status, 403);
  });
  test("admin session + allowlisted email, no Supabase configured -> 404 (account lookup finds nothing)", async () => {
    const adminCookie = createAdminSessionCookie("admin@example.com");
    const res = await route.POST(req({ body: { email: "seller.starter@reviewintel.test" }, adminCookie }));
    assert.equal(res.status, 404);
  });
});
