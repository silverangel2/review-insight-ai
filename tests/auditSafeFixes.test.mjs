import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const read = (path) => readFileSync(root + path, "utf8");
const paths = jiti("./lib/safeNextPath.ts");

test("only same-site paths are kept after profile save", () => {
  assert.equal(paths.safeInternalPath("/analyze"), "/analyze");
  assert.equal(paths.safeInternalPath("/pricing?plan=shopper_premium"), "/pricing?plan=shopper_premium");
  assert.equal(paths.safeInternalPath("https://evil.example/phish"), null);
  assert.equal(paths.safeInternalPath("//evil.example"), null);
  assert.equal(paths.safeInternalPath("/\\evil"), null);
  assert.match(read("components/AccountDashboard.tsx"), /safeInternalPath\(params\.get\("next"\)\)/);
});

test("search setup and private pages stay out of the public index", () => {
  const robots = read("app/robots.ts");
  const layout = read("app/layout.tsx");
  assert.match(robots, /seoBaseUrl\(\)/);
  for (const path of ["/account", "/dashboard", "/unsubscribe", "/email-preferences", "/admin"]) {
    assert.match(robots, new RegExp(path.replace("/", "\\/")));
  }
  assert.doesNotMatch(robots, /localhost:3000/);
  assert.match(read("app/sitemap.ts"), /seoBaseUrl\(\)/);
  assert.doesNotMatch(read("app/sitemap.ts"), /localhost:3000/);
  assert.match(layout, /name: "Shopper Free"/);
  assert.doesNotMatch(layout, /adsbygoogle/);
  assert.doesNotMatch(layout, /pagead2\.googlesyndication\.com/);
  assert.match(read("components/advertising/AdSlot.tsx"), /hasOptionalCookieConsent/);
});

test("customer mail and scan completion use the shared email path", () => {
  assert.match(read("app/api/auth/signup/route.ts"), /queueWelcomeEmail/);
  assert.match(read("app/api/auth/oauth-profile/route.ts"), /queueWelcomeEmail/);
  assert.match(read("app/api/analyze/route.ts"), /queueFirstScanUpgrade/);
  assert.match(read("app/api/seller-analyze/route.ts"), /queueFirstScanUpgrade/);
  assert.match(read("lib/notifications.ts"), /escapeHtml\(input\.title\)/);
  assert.match(read("lib/emailDelivery.ts"), /isRetryableEmailFailure/);
  assert.match(read("app/api/admin/marketing/send/route.ts"), /renderBrandedEmail/);
});
