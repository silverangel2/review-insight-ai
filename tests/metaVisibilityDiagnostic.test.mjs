import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Meta diagnostic is admin-only and GET-only", () => {
  const route = readFileSync("app/api/admin/meta-diagnostics/route.ts", "utf8");
  const helper = readFileSync("lib/metaVisibilityDiagnostic.ts", "utf8");
  const ui = readFileSync("components/MetaVisibilityDiagnostic.tsx", "utf8");
  assert.match(route, /adminSessionFromRequest/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /GET-only diagnostic/);
  assert.match(helper, /method: "GET"/);
  assert.doesNotMatch(helper, /method: "POST"|method: "PUT"|method: "PATCH"|method: "DELETE"/);
  assert.match(helper, /safeMessage/);
  assert.doesNotMatch(route, /access_token|Authorization|FACEBOOK_PAGE_ACCESS_TOKEN/);
  assert.doesNotMatch(ui, /access_token|Authorization|FACEBOOK_PAGE_ACCESS_TOKEN/);
  assert.match(helper, /video_reels|permalink_url|is_reel|media_type/);
  assert.match(helper, /path: `\$\{input\.pageId\}\/video_reels`/);
  assert.doesNotMatch(helper, /fields: "[^"]*status[^"]*"/);
});
