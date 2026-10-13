import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const route = fs.readFileSync(path.join(root, "app/api/analyze/route.ts"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261004_reviewintel_atomic_free_scan_claims.sql"),
  "utf8",
);

class ClaimStore {
  constructor() {
    this.claims = [];
  }

  claim(kind, identity, scanId, at) {
    const day = at.toISOString().slice(0, 10);
    const same = this.claims.filter((claim) => claim.kind === kind && claim.identity === identity && claim.day === day);
    if (same.some((claim) => claim.scanId === scanId)) {
      return { allowed: true, code: "idempotent", used: same.length };
    }
    if (same.length >= 3) return { allowed: false, code: "limit_reached", used: same.length };
    this.claims.push({ kind, identity, scanId, day });
    return { allowed: true, code: "claimed", used: same.length + 1 };
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.claims));
  }

  restore(snapshot) {
    this.claims = JSON.parse(JSON.stringify(snapshot));
  }
}

test("three daily claims are accepted and the fourth is rejected", () => {
  const store = new ClaimStore();
  const at = new Date("2026-10-04T12:00:00Z");
  assert.equal(store.claim("anonymous", "anon-a", "scan-1", at).allowed, true);
  assert.equal(store.claim("anonymous", "anon-a", "scan-2", at).allowed, true);
  assert.equal(store.claim("anonymous", "anon-a", "scan-3", at).allowed, true);
  assert.equal(store.claim("anonymous", "anon-a", "scan-4", at).code, "limit_reached");
});

test("same scan ID is idempotent and identities are isolated", () => {
  const store = new ClaimStore();
  const at = new Date("2026-10-04T12:00:00Z");
  assert.equal(store.claim("authenticated", "account-a", "scan-1", at).used, 1);
  assert.equal(store.claim("authenticated", "account-a", "scan-1", at).code, "idempotent");
  assert.equal(store.claim("authenticated", "account-b", "scan-1", at).used, 1);
  assert.equal(store.claim("anonymous", "account-a", "scan-1", at).used, 1);
});

test("restart preserves claims and UTC rollover starts a new allowance", () => {
  const store = new ClaimStore();
  const beforeMidnight = new Date("2026-10-04T23:59:59Z");
  store.claim("anonymous", "anon-a", "scan-1", beforeMidnight);
  store.claim("anonymous", "anon-a", "scan-2", beforeMidnight);
  store.claim("anonymous", "anon-a", "scan-3", beforeMidnight);

  const restarted = new ClaimStore();
  restarted.restore(store.snapshot());
  assert.equal(restarted.claim("anonymous", "anon-a", "scan-4", beforeMidnight).allowed, false);
  assert.equal(restarted.claim("anonymous", "anon-a", "scan-5", new Date("2026-10-05T00:00:00Z")).allowed, true);
});

test("concurrent claim attempts cannot exceed three", async () => {
  const store = new ClaimStore();
  const at = new Date("2026-10-04T12:00:00Z");
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, index) => Promise.resolve(store.claim("anonymous", "anon-a", `scan-${index}`, at))),
  );
  assert.equal(results.filter((result) => result.allowed).length, 3);
  assert.equal(results.filter((result) => result.code === "limit_reached").length, 9);
});

test("quota claim is before expensive vision and fail-closed paths are present", () => {
  // analyzePost owns the claim and the vision call. The exported POST wrapper
  // only delegates to it, so the order check has to see the whole route.
  const claimIndex = route.indexOf("const quotaClaim = await claimFreeScan");
  const visionIndex = route.indexOf("await extractScreenshotFacts");
  assert.ok(claimIndex >= 0);
  assert.ok(visionIndex > claimIndex);
  assert.match(route, /code === "unavailable"/);
  assert.doesNotMatch(route, /incrementAnonymousScanCount/);
  assert.match(route, /role !== "admin"/);
  assert.match(route, /!isBetaPlanForAnalyze/);
  assert.match(route, /normalizedPlanForAnalyze === "free_buyer"/);
  assert.match(route, /kind: "authenticated"/);
  assert.match(route, /kind: "anonymous"/);
  assert.match(route, /scan_id: scanId/);
  assert.match(route, /consumePersistentQuota/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /unique \(identity_kind, identity_key, utc_day, scan_id\)/i);
  assert.match(migration, /to_regclass\('public\.usage_events'\)/);
  assert.match(migration, /to_regclass\('public\.anonymous_scan_usage'\)/);
  assert.match(migration, /claim_number <= 3/);
  assert.match(migration, /revoke all on function/i);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
});

// Regression (2026-10-12): authenticated free-scan identity comes only from the signed session.
test("authenticated claim identity: user A cannot claim as user B", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const jiti = require("jiti")(root + "/x.js", { alias: { "@": root } });
  process.env.REVIEWINTEL_SESSION_SECRET = "test-session-secret";
  const sessions = jiti("./lib/accountSession.ts");
  const quota = jiti("./lib/freeScanQuota.ts");

  const tokenA = sessions.createAccountSession({ email: "a@example.com", role: "buyer", plan: "free_buyer" });
  // A edits the payload to B's email but cannot re-sign it.
  const [, sig] = tokenA.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ email: "b@example.com", role: "buyer", plan: "free_buyer", exp: Date.now() + 60000 })).toString("base64url");
  assert.equal(sessions.verifyAccountSessionToken(`${forgedPayload}.${sig}`), null);
  const req = (cookie, extra = {}) => new Request("http://localhost/api/analyze", { headers: { cookie, ...extra } });
  assert.equal(sessions.readAccountSession(req(`reviewintel_account_session=${forgedPayload}.${sig}`)), null);
  // Headers/body naming another user are ignored: identity is the signed cookie's email.
  const a = sessions.readAccountSession(req(`reviewintel_account_session=${encodeURIComponent(tokenA)}`, { "x-reviewintel-email": "b@example.com" }));
  assert.equal(a.email, "a@example.com");

  // Claims are keyed per identity, so A's usage never consumes or reads B's allowance.
  const store = new quota.InMemoryFreeScanClaims();
  const now = new Date("2026-10-12T12:00:00Z");
  for (let i = 0; i < 3; i++) assert.equal(store.claim({ kind: "authenticated", identity: a.email, scanId: `a${i}`, now }).allowed, true);
  assert.equal(store.claim({ kind: "authenticated", identity: a.email, scanId: "a4", now }).allowed, false);
  assert.equal(store.claim({ kind: "authenticated", identity: "b@example.com", scanId: "b1", now }).code, "claimed");
  // Anonymous and authenticated keys never collide.
  assert.notEqual(quota.hashFreeScanIdentity("anonymous", "a@example.com"), quota.hashFreeScanIdentity("authenticated", "a@example.com"));
});

test("analyze route derives the claim identity from the signed session, never from the request body", () => {
  assert.match(route, /const accountSession = readAccountSession\(request\);/);
  assert.match(route, /const email = accountSession\?\.email \|\| adminSession\?\.email \|\| "";/);
  assert.match(route, /claimFreeScan\(\{\s*kind: "authenticated",\s*identity: email,/);
  assert.match(migration, /revoke all on function public\.claim_reviewintel_free_scan\(text, text, text, timestamptz\)\s*from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.claim_reviewintel_free_scan\(text, text, text, timestamptz\)\s*to service_role;/);
});
