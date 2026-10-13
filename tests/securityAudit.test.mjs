import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const read = p => readFileSync(root + p, "utf8");

test("admin API routes (bypassed by middleware) each check the admin session", () => {
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : n === "route.ts" ? [p] : []; });
  const exempt = /admin\/(access|logout)\/route\.ts$/;
  for (const f of walk(root + "app/api/admin")) {
    if (exempt.test(f)) continue;
    assert.match(readFileSync(f, "utf8"), /adminSessionFromRequest|verifyAdminSession|requireAdmin|hasOwnerAccess|isAdminRequest|adminSession/, f.replace(root, ""));
  }
});

test("public follow-up answers without OpenAI by default and only from result data", () => {
  const src = read("app/api/review-follow-up/route.ts");
  assert.match(src, /isOpenAiFeatureEnabled\("followup"\)/);
  const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
  const { freeFollowUpAnswer } = jiti("./lib/freeFollowUp.ts");
  assert.match(freeFollowUpAnswer("show_complaints", {}), /aren't enough real written reviews/);
});

test("public scraping endpoints are rate limited", () => {
  for (const p of ["app/api/review-evidence/route.ts", "app/api/review-evidence/refresh/route.ts"]) assert.match(read(p), /rateLimitRequest/);
});

test("sponsor events feed paid reports: server time, bot filter, dedupe, limits", () => {
  const s = read("app/api/sponsor-events/route.ts");
  assert.doesNotMatch(s, /body\?\.occurredAt/); assert.match(s, /BOT_UA/); assert.match(s, /DEDUPE_MS/); assert.match(s, /ipHits/);
  assert.match(read("app/api/site-reviews/route.ts"), /rateLimitRequest/);
});
