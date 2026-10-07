import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { installOfflineGuard } from "../scripts/reviewintel-offline-guard.mjs";

installOfflineGuard();
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-test-key-not-a-credential";
process.env.REVIEWINTEL_SESSION_SECRET = "offline-signed-session-fixture";
process.env.REVIEWINTEL_ADMIN_SESSION_SECRET = "offline-admin-session-fixture";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() } });
const { GET } = jiti("./app/api/account/analyses/route.ts");
const { createAccountSession, ACCOUNT_SESSION_COOKIE } = jiti("./lib/accountSession.ts");
const { createAdminSessionCookie, ADMIN_SESSION_COOKIE } = jiti("./lib/adminAccess.ts");
const { beginDurableScanOperation, finishDurableScanOperation } = jiti("./lib/scanBudget.ts");
const { readPersistentQuota } = jiti("./lib/supabaseServer.ts");
let profile = { plan: "free_buyer", role: "buyer" };
let rows = [];
let calls = [];
const row = (email = "owner@example.test", scanId = "scan-exact", mode = "buyer") => ({ id: "result-1", profile_email: email, mode, created_at: "2026-10-07T12:00:00Z", analysis_json: { scanId, verdict: "BUY" } });
const response = (data) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
const mockRead = () => {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, "https://offline.invalid");
    assert.equal(init.method || "GET", "GET", "Reading a result must not mutate analyses or usage");
    calls.push(parsed);
    if (parsed.pathname.endsWith("/profiles")) return response([profile]);
    assert.ok(parsed.pathname.endsWith("/analyses"));
    assert.equal(parsed.searchParams.get("profile_email"), "eq.owner@example.test");
    assert.ok(["or", "id", "scan_id", "scanId"].some((key) => parsed.searchParams.has(key)), "Exact retrieval cannot query newest history");
    return response(rows);
  };
};
const request = (query, account = profile, admin = false) => new Request(`http://localhost/api/account/analyses?${query}`, { headers: { cookie: admin ? `${ADMIN_SESSION_COOKIE}=${createAdminSessionCookie("owner@example.test")}` : `${ACCOUNT_SESSION_COOKIE}=${createAccountSession({ ...account, email: "owner@example.test" })}` } });

test("free account retrieves exactly its persisted scan, without pruning or latest fallback", async () => {
  profile = { role: "buyer", plan: "free_buyer" }; rows = [row()]; mockRead();
  const result = await GET(request("scanId=scan-exact"));
  const payload = await result.json();
  assert.equal(result.status, 200);
  assert.equal(payload.analyses.length, 1);
  assert.equal(payload.analyses[0].scanId, "scan-exact");
  assert.ok(calls.find((url) => url.pathname.endsWith("/analyses")).searchParams.get("or").includes("scan-exact"));
  rows = [];
  assert.deepEqual((await (await GET(request("scanId=missing"))).json()).analyses, []);
});

test("foreign owner, wrong scan, and conflicting payload identities never enter a requested result", async () => {
  for (const candidate of [row("another@example.test"), row("owner@example.test", "different"), { ...row(), scan_id: "conflict" }]) {
    rows = [candidate]; mockRead();
    assert.deepEqual((await (await GET(request("scanId=scan-exact"))).json()).analyses, []);
  }
});

test("duplicate persisted scan identities are an ambiguity error, never a first/latest substitution", async () => {
  rows = [row(), { ...row(), id: "result-2", analysis_json: { scanId: "scan-exact", verdict: "AVOID" } }]; mockRead();
  const result = await GET(request("scanId=scan-exact"));
  assert.equal(result.status, 409);
  assert.deepEqual((await result.json()).analyses, []);
});

test("legacy row-level scan identity remains exact and owner-scoped", async () => {
  profile = { role: "buyer", plan: "free_buyer" };
  calls = [];
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url); calls.push(parsed);
    assert.equal(parsed.origin, "https://offline.invalid");
    assert.equal(init.method, "GET");
    if (parsed.pathname.endsWith("/profiles")) return response([profile]);
    assert.equal(parsed.searchParams.get("profile_email"), "eq.owner@example.test");
    if (parsed.searchParams.get("scan_id") === "eq.scan-exact") return response([{ ...row(), scan_id: "scan-exact", analysis_json: { verdict: "BUY" } }]);
    return response([]);
  };
  const result = await GET(request("scanId=scan-exact"));
  assert.equal((await result.json()).analyses[0].scanId, "scan-exact");
  assert.ok(calls.some((url) => url.searchParams.get("scan_id") === "eq.scan-exact"));
});

test("exact result retrieval keeps Buyer/Seller segregation and signed admin access", async () => {
  rows = [row("owner@example.test", "scan-exact", "seller")]; mockRead();
  assert.deepEqual((await (await GET(request("scanId=scan-exact"))).json()).analyses, []);
  profile = { role: "seller", plan: "seller_pro" }; mockRead();
  assert.equal((await (await GET(request("scanId=scan-exact"))).json()).analyses.length, 1);
  rows = [row()]; mockRead();
  assert.deepEqual((await (await GET(request("scanId=scan-exact"))).json()).analyses, []);
  mockRead();
  assert.equal((await (await GET(request("scanId=scan-exact", profile, true))).json()).analyses.length, 1);
});

test("forged email, malformed cookie, and invalid IDs fail safely", async () => {
  rows = [row()]; mockRead();
  assert.equal((await GET(request("email=other@example.test&scanId=scan-exact"))).status, 403);
  assert.equal((await GET(request("scanId=bad%2Cid"))).status, 400);
  const unsigned = await GET(new Request("http://localhost/api/account/analyses?email=owner@example.test&scanId=scan-exact", { headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=%E0%A4%A` } }));
  assert.equal(unsigned.status, 400);
});

test("RPC ok without durable COMPLETED readback cannot confirm completion", async () => {
  for (const durable of [[], [{ status: "RUNNING", scan_id: "scan-exact" }], [{ status: "COMPLETED", scan_id: "wrong", result_json: { analysisId: "result-1" } }], [{ status: "COMPLETED", scan_id: "scan-exact", result_json: { scanId: "wrong", analysisId: "result-1" } }]]) {
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(url).origin, "https://offline.invalid");
      return response(init.method === "POST" ? { ok: true } : durable);
    };
    assert.equal(await finishDurableScanOperation({ operationKey: "offline-operation", status: "COMPLETED", result: { scanId: "scan-exact", analysisId: "result-1" } }), null);
  }
  globalThis.fetch = async (url, init) => response(init.method === "POST" ? { ok: true } : [{ status: "COMPLETED", scan_id: "scan-exact", result_json: { scanId: "scan-exact", analysisId: "result-1" } }]);
  assert.deepEqual(await finishDurableScanOperation({ operationKey: "offline-operation", status: "COMPLETED", result: { scanId: "scan-exact", analysisId: "result-1" } }), { ok: true });
});

test("a failed quota read is unavailable, never a fresh zero-usage allowance", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).origin, "https://offline.invalid");
    assert.equal(init.method || "GET", "GET");
    return new Response("Temporary offline fixture failure", { status: 503 });
  };
  assert.equal(await readPersistentQuota({ email: "owner@example.test", plan: "free_buyer" }), null);
  assert.equal(await readPersistentQuota({ email: "", plan: "free_buyer" }), null);
  assert.equal((await readPersistentQuota({ email: "owner@example.test", plan: "buyer_pro" })).limit, null);
});

test("only retired cost blocks resume once; other blocks and concurrent retry stay blocked/running", async () => {
  for (const code of ["DAILY_BUDGET_EXHAUSTED", "IDEMPOTENCY_STORE_UNAVAILABLE", "AUTH_REQUIRED"]) {
    const mutations = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(new URL(url).origin, "https://offline.invalid");
      if (init.method === "GET") return response([{ status: "BLOCKED", error_code: code, scan_id: "scan-exact" }]);
      mutations.push(String(url));
      assert.ok(String(url).includes("error_code=eq.DAILY_BUDGET_EXHAUSTED"));
      return response([{ status: "RUNNING", scan_id: "scan-exact" }]);
    };
    const result = await beginDurableScanOperation({ operationKey: "offline-operation", accountKey: "offline-owner", scanId: "scan-exact" });
    assert.equal(result.status, code === "DAILY_BUDGET_EXHAUSTED" ? "RUNNING" : "BLOCKED");
    assert.equal(Boolean(result.created), code === "DAILY_BUDGET_EXHAUSTED");
    assert.equal(mutations.length, code === "DAILY_BUDGET_EXHAUSTED" ? 1 : 0);
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(init.method, "GET");
    return response([{ status: "RUNNING", scan_id: "scan-exact" }]);
  };
  assert.equal((await beginDurableScanOperation({ operationKey: "offline-operation", accountKey: "offline-owner", scanId: "scan-exact" })).created, false);
});
