// Piece A: ops worker checks against a fake probe (no network, no DB).
// Verifies the suite detects a healthy site AND a broken one, that the
// auto-deploy gate ships disabled, and that Level-3 jobs get
// preparation-only evidence (never execution).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RI_OPS_AUTODEPLOY",
  "NEXT_PUBLIC_SITE_URL",
]) {
  delete process.env[key];
}

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const worker = jiti(root + "lib/riOpsWorker.ts");

const GOOD_HTML =
  '<html><head><title>ReviewIntel</title><meta name="description" content="x"><meta property="og:title" content="y"></head>' +
  '<body><form><textarea name="x"></textarea></form></body></html>';

function fakeProbe(routes) {
  return async (url, init) => {
    const method = init?.method || "GET";
    const key = `${method} ${url}`;
    if (routes[key]) return routes[key];
    const path = new URL(url).pathname;
    const fallback = routes[`GET ${path}`] || routes[path];
    if (fallback) return fallback;
    return { status: 404, text: "not found" };
  };
}

const byId = (results) => Object.fromEntries(results.map((r) => [r.id, r]));

function healthyRoutes() {
  return {
    "GET https://getreviewintel.com/": { status: 200, text: GOOD_HTML },
    "GET https://getreviewintel.com/pricing": { status: 200, text: "<title>Pricing</title>" },
    "GET https://getreviewintel.com/faq": { status: 200, text: "<title>FAQ</title>" },
    "GET https://getreviewintel.com/analyze": { status: 200, text: GOOD_HTML },
    "POST https://getreviewintel.com/api/admin/daily-checks": { status: 401, text: "unauthorized" },
    "GET https://getreviewintel.com/api/cron/ri-ops-worker": { status: 401, text: "unauthorized" },
    "GET https://getreviewintel.com/api/cron/review-ask-email": { status: 401, text: "unauthorized" },
    "GET https://getreviewintel.com/sitemap.xml": { status: 200, text: "<urlset><url><loc>x</loc></url></urlset>" },
    "GET https://getreviewintel.com/robots.txt": { status: 200, text: "User-agent: *" },
  };
}

const ctx = (routes, libraryRowCount) => ({
  baseUrl: "https://getreviewintel.com",
  get: fakeProbe(routes),
  libraryRowCount: libraryRowCount || (async () => 12),
});

test("healthy site: every check passes", async () => {
  const results = await worker.runOpsChecks(ctx(healthyRoutes()));
  const failed = results.filter((r) => r.status === "fail");
  assert.deepEqual(failed.map((r) => r.id), []);
  assert.ok(results.length >= 10, `expected >= 10 checks, got ${results.length}`);
});

test("broken site: detects bad homepage, open admin door, open cron, missing sitemap", async () => {
  const routes = healthyRoutes();
  routes["GET https://getreviewintel.com/"] = { status: 500, text: "error" };
  routes["POST https://getreviewintel.com/api/admin/daily-checks"] = { status: 200, text: "ok" };
  routes["GET https://getreviewintel.com/api/cron/ri-ops-worker"] = { status: 200, text: "ok" };
  routes["GET https://getreviewintel.com/sitemap.xml"] = { status: 404, text: "missing" };
  const results = await worker.runOpsChecks(ctx(routes));
  const m = byId(results);
  assert.equal(m.home_get.status, "fail");
  assert.equal(m.admin_door_rejects_anonymous.status, "fail");
  assert.equal(m.cron_rejects_unsigned.status, "fail");
  assert.equal(m.sitemap.status, "fail");
  // Unaffected probes still pass.
  assert.equal(m.pricing_get.status, "pass");
  assert.equal(m.robots.status, "pass");
});

test("library check: rows>0 pass, empty warns, unreadable warns (never throws)", async () => {
  const full = byId(await worker.runOpsChecks(ctx(healthyRoutes(), async () => 5)));
  assert.equal(full.library_nonempty.status, "pass");
  const empty = byId(await worker.runOpsChecks(ctx(healthyRoutes(), async () => 0)));
  assert.equal(empty.library_nonempty.status, "warning");
  const broken = byId(await worker.runOpsChecks(ctx(healthyRoutes(), async () => { throw new Error("db down"); })));
  assert.equal(broken.library_nonempty.status, "warning");
});

test("auto-deploy gate ships DISABLED when RI_OPS_AUTODEPLOY is unset", () => {
  assert.equal(worker.riOpsAutoDeployEnabled({}), false);
  assert.equal(worker.riOpsAutoDeployEnabled({ RI_OPS_AUTODEPLOY: "" }), false);
  assert.equal(worker.riOpsAutoDeployEnabled({ RI_OPS_AUTODEPLOY: "on" }), true);
});

test("base URL falls back to getreviewintel.com", () => {
  assert.equal(worker.riOpsBaseUrl({}), "https://getreviewintel.com");
  assert.equal(worker.riOpsBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://example.com/" }), "https://example.com");
});

test("level-3 preparation evidence: info-only, never execution", () => {
  const job = { id: "j1", job_type: "repair_prep", level: 3, status: "QUEUED" };
  const rows = worker.level3PreparationEvidence({ job, autoDeployEnabled: false });
  assert.ok(rows.length >= 2);
  for (const r of rows) assert.equal(r.status, "info");
  const text = rows.map((r) => `${r.label} ${r.message}`).join(" ");
  assert.match(text, /NEVER executed/);
  assert.match(text, /DISABLED/);
  const armed = worker.level3PreparationEvidence({ job, autoDeployEnabled: true });
  assert.match(armed.map((r) => r.message).join(" "), /ARMED/);
});
