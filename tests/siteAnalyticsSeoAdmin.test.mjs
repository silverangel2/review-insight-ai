import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const read = (p) => readFileSync(root + p, "utf8");

test("seo: pages get their own canonical, OG and Twitter tags; private pages are noindex", () => {
  const { withSeo, privatePage } = jiti("./lib/pageSeo.ts");
  const m = withSeo("/pricing", { title: "Pricing", description: "Plans" });
  assert.equal(m.alternates.canonical, "/pricing");
  assert.equal(m.openGraph.url, "/pricing");
  assert.equal(m.openGraph.title, "Pricing | ReviewIntel");
  assert.equal(m.twitter.card, "summary_large_image");
  assert.equal(m.robots, undefined);
  assert.equal(privatePage("/account", "Your account").robots.index, false);
  assert.doesNotMatch(read("app/layout.tsx"), /canonical: "\/"/, "root layout must not force every page's canonical to /");
});

test("seo: structured data is honest (no Review/AggregateRating) and has WebSite SearchAction", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /"@type": "Organization"/);
  assert.match(layout, /"@type": "SearchAction"/);
  for (const f of ["app/layout.tsx", "components/GuideArticle.tsx", "app/guides/[slug]/page.tsx"]) {
    assert.doesNotMatch(read(f), /AggregateRating|"@type": "Review"/);
  }
  assert.match(read("components/GuideArticle.tsx"), /"@type": "Article"/);
  assert.match(read("app/guides/[slug]/page.tsx"), /"@type": "FAQPage"/);
  assert.match(read("app/sitemap.ts"), /guides\/\$\{guide\.slug\}/);
});

test("admin: middleware rejects /api/admin without a valid admin session", () => {
  const mw = read("middleware.ts");
  assert.match(mw, /pathname\.startsWith\("\/api\/admin\/"\) && !ADMIN_API_OPEN\.has\(pathname\) && !\(await hasValidAdminSession\(request\)\)/);
  assert.match(mw, /status: 401/);
});

test("analytics: Do Not Track is respected and sign-ins can't be faked from the browser", async () => {
  const { recordTrafficEvent, requestOptsOut } = jiti("./lib/trafficAnalytics.ts");
  assert.equal(requestOptsOut(new Request("http://x/", { headers: { dnt: "1" } })), true);
  assert.equal(requestOptsOut(new Request("http://x/", { headers: { "sec-gpc": "1" } })), true);
  const forged = await recordTrafficEvent(new Request("http://x/"), { eventType: "sign_in" });
  assert.equal(forged.ok, false);
  const src = read("lib/trafficAnalytics.ts");
  assert.match(src, /user_agent: null/);
  assert.match(read("lib/clientTraffic.ts"), /globalPrivacyControl/);
  const mig = read("supabase/migrations/20261012_site_analytics.sql");
  assert.match(mig, /enable row level security/);
  assert.match(read("lib/trustContent.ts"), /Do Not Track/);
});

test("low-review compares say Low + real counts + a next step, never 'not scored'", () => {
  const { lowConfidenceShopperCompare } = jiti("./lib/shopperCompareFree.ts");
  const s = lowConfidenceShopperCompare(2, 0);
  assert.equal(s.verdictHeadline, "Low confidence · 2 vs 0 real reviews");
  assert.match(s.nextSteps.join(" "), /Scan the Amazon link/);
  const { lowConfidenceSellerCompare } = jiti("./lib/sellerCompareFree.ts");
  const p = lowConfidenceSellerCompare({ commentsAnalyzed: 3 }, {});
  assert.equal(p.competitivePosition, "Low confidence · 3 vs 0 real reviews");
  for (const f of ["app/api/shopper-compare/route.ts", "app/api/seller-compare/route.ts", "lib/shopperCompareFree.ts", "lib/sellerCompareFree.ts", "app/api/product-recommendations/route.ts", "lib/sellerReviewIntelligence.ts"]) {
    assert.doesNotMatch(read(f), /"(Comparison not scored|Not scored)"(?!,? *\/\/ internal)/, f);
  }
});
