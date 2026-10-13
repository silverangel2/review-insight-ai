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

test("releasing one couldn't-read scan restores that allowance and a second release does not", () => {
  const store = new ClaimStore();
  store.release = function release(kind, identity, scanId, at) {
    const day = at.toISOString().slice(0, 10);
    const index = this.claims.findIndex((claim) => claim.kind === kind && claim.identity === identity && claim.scanId === scanId);
    const removed = index >= 0;
    if (removed) this.claims.splice(index, 1);
    const same = this.claims.filter((claim) => claim.kind === kind && claim.identity === identity && claim.day === day);
    return { allowed: true, code: removed ? "released" : "idempotent", used: same.length, remaining: Math.max(0, 3 - same.length) };
  };
  const at = new Date("2026-10-13T12:00:00Z");
  assert.equal(store.claim("anonymous", "anon-a", "scan-1", at).used, 1);
  assert.equal(store.claim("anonymous", "anon-a", "scan-2", at).used, 2);
  assert.equal(store.claim("anonymous", "anon-a", "scan-3", at).code, "claimed");
  assert.equal(store.claim("anonymous", "anon-a", "scan-4", at).code, "limit_reached");
  const released = store.release("anonymous", "anon-a", "scan-3", at);
  assert.equal(released.code, "released");
  assert.equal(released.used, 2);
  assert.equal(released.remaining, 1);
  const again = store.release("anonymous", "anon-a", "scan-3", at);
  assert.equal(again.code, "idempotent");
  assert.equal(again.used, 2);
  assert.equal(store.release("anonymous", "anon-a", "never-claimed", at).code, "idempotent");
  assert.equal(store.claim("anonymous", "anon-a", "scan-4", at).allowed, true);
  assert.equal(store.claim("authenticated", "anon-a", "scan-3", at).used, 1);
  assert.equal(store.release("anonymous", "anon-a", "scan-1", at).used, 2);
});

test("claimFreeScan and releaseFreeScan restore a local allowance once", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const jiti = require("jiti")(root + "/x.js", { alias: { "@": root } });
  const quota = jiti("./lib/freeScanQuota.ts");
  const shopper = jiti("./lib/shopperAnswer.ts");
  const buying = jiti("./lib/buyingScore.ts");
  const previousMode = process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE;
  const previousNode = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE = "true";
  quota.resetLocalFreeScanClaimsForTests();
  const now = new Date("2026-10-13T15:00:00Z");
  try {
    for (const scanId of ["scan-unread-1", "scan-unread-2", "scan-unread-3"]) {
      assert.equal((await quota.claimFreeScan({ kind: "anonymous", identity: "9.9.9.9", scanId, now })).allowed, true);
    }
    assert.equal((await quota.claimFreeScan({ kind: "anonymous", identity: "9.9.9.9", scanId: "scan-unread-4", now })).code, "limit_reached");
    const released = await quota.releaseFreeScan({ kind: "anonymous", identity: "9.9.9.9", scanId: "scan-unread-1", now });
    assert.equal(released.code, "released");
    assert.equal(released.remaining, 1);
    const replay = await quota.releaseFreeScan({ kind: "anonymous", identity: "9.9.9.9", scanId: "scan-unread-1", now });
    assert.equal(replay.code, "idempotent");
    assert.equal(replay.remaining, 1);
    assert.equal((await quota.claimFreeScan({ kind: "anonymous", identity: "9.9.9.9", scanId: "scan-unread-4", now })).code, "claimed");
    const signedIn = await quota.claimFreeScan({ kind: "authenticated", identity: "shopper@example.com", scanId: "scan-unread-1", now });
    assert.equal(signedIn.code, "claimed");
    assert.equal(signedIn.used, 1);
    const signedInRelease = await quota.releaseFreeScan({ kind: "authenticated", identity: "shopper@example.com", scanId: "scan-unread-1", now });
    assert.equal(signedInRelease.code, "released");
    assert.equal(signedInRelease.remaining, 3);

    const blank = {
      product: { name: "Echo Dot (5th Gen)", url: "https://www.amazon.com/dp/B09B8V1LZ3" },
      reviewEvidence: { commentsAnalyzed: 0, listingEvidence: { exactListingUrl: "https://www.amazon.com/dp/B09B8V1LZ3", rating: null, reviewCount: null } },
    };
    assert.equal(shopper.isUnreadableAmazonPage(blank), true);
    const aggregate = buying.marketplaceAggregateForScore({
      exactListingAccepted: false,
      screenshotRating: "4.7",
      screenshotCount: "200,809",
    });
    const score = buying.buyingScoreFromReviews({
      marketplace: { rating: aggregate.rating, count: aggregate.count, matchesExactModel: true },
      reviews: [],
    });
    assert.equal(shopper.isUnreadableAmazonPage({ ...blank, product: { ...blank.product, rating: "4.7", reviewCount: "200,809" }, buyingScoreV2: score, buyScore: score.score }), false);
  } finally {
    quota.resetLocalFreeScanClaimsForTests();
    if (previousMode === undefined) delete process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE;
    else process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE = previousMode;
    if (previousNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNode;
  }
});

test("an unreadable page releases the claim and skips the persistent usage write", () => {
  const start = route.indexOf("const recordCompletedScan = async");
  const end = route.indexOf("const buffer = imageFile");
  const block = route.slice(start, end);
  const releaseAt = block.indexOf("releaseFreeScan(quotaSubject)");
  const consumeAt = block.indexOf("consumePersistentQuota");
  assert.ok(releaseAt >= 0 && consumeAt > releaseAt);
  assert.match(block, /isUnreadableAmazonPage\(scanResult\)/);
  assert.match(block, /unreadablePage\s*\?\s*Promise\.resolve\(\{ ok: true, quota: claimedQuota \}\)/);
  assert.match(route, /quotaSubject = \{ kind: "authenticated", identity: email, scanId \}/);
  assert.match(route, /quotaSubject = \{ kind: "anonymous", identity: anonymousIdentity, scanId \}/);
  const completed = route.slice(route.indexOf('operation.status === "COMPLETED"'));
  assert.match(completed, /isUnreadableAmazonPage\(operation\.result\)/);
  assert.match(completed, /releaseFreeScan\(quotaSubject\)/);
  const releaseMigration = fs.readFileSync(
    path.join(root, "supabase/migrations/20261013_release_unreadable_free_scan.sql"),
    "utf8",
  );
  assert.match(releaseMigration, /release_reviewintel_free_scan/);
  assert.match(releaseMigration, /security definer/i);
  assert.match(releaseMigration, /pg_advisory_xact_lock/);
  assert.match(releaseMigration, /revoke all on function public\.release_reviewintel_free_scan\(text, text, text, timestamptz\)\s*from public, anon, authenticated;/);
  assert.match(releaseMigration, /grant execute on function public\.release_reviewintel_free_scan\(text, text, text, timestamptz\)\s*to service_role;/);
});
