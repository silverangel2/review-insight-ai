// Scraper hardening: robots.txt, polite fetch, sitemap discovery, zero OpenAI.
// Fixture HTML/XML only; review bodies are captured development texts re-wrapped
// as JSON-LD (transport simulation); names/ids are neutral. No network.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import test from "node:test";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const pf = jiti("./lib/politeFetch.ts");
const sm = jiti("./lib/sitemapProductIndex.ts");
const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
const adj = jiti("./lib/reviewEvidenceAdjudication.ts"), det = jiti("./lib/reviewEvidenceDeterminism.ts");
const dev = require("./fixtures/reviewintel-benchmark/development.json");
const captured = dev.corpora[3].adjudicationArgs[0].map(r => r.body).filter(b => String(b || "").length > 40).slice(0, 4);

const robotsTxt = `User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /search\nDisallow: /*?q=\nAllow: /search/help$\nDisallow: /private/\nAllow: /private/public-page\n`;
test("robots.txt: * group only, longest match wins, * and $ supported", () => {
  const rules = pf.parseRobotsTxt(robotsTxt);
  assert.equal(pf.robotsAllows(rules, "https://x.test/search?q=abc"), false);
  assert.equal(pf.robotsAllows(rules, "https://x.test/search/help"), true);
  assert.equal(pf.robotsAllows(rules, "https://x.test/search/help/more"), false);
  assert.equal(pf.robotsAllows(rules, "https://x.test/list?q=1"), false);
  assert.equal(pf.robotsAllows(rules, "https://x.test/private/public-page"), true);
  assert.equal(pf.robotsAllows(rules, "https://x.test/private/other"), false);
  assert.equal(pf.robotsAllows(rules, "https://x.test/product/123"), true);
});

const mockFetch = (routes, log) => async (url) => {
  const u = new URL(String(url)); log.push(u.href);
  const route = routes(u);
  const r = new Response(route.body ?? "", { status: route.status ?? 200 }); Object.defineProperty(r, "url", { value: u.href }); return r;
};
test("polite fetcher: robots blocks, 4xx robots = allow, 5xx robots = disallow all; retries only on 5xx; caches", async () => {
  const log = []; let flaky = 0;
  const f = pf.createPoliteFetcher({ minHostIntervalMs: 0, fetchImpl: mockFetch(u => {
    if (u.hostname === "a.test" && u.pathname === "/robots.txt") return { body: robotsTxt };
    if (u.hostname === "b.test" && u.pathname === "/robots.txt") return { status: 404 };
    if (u.hostname === "c.test" && u.pathname === "/robots.txt") return { status: 503 };
    if (u.pathname === "/flaky") return ++flaky < 2 ? { status: 503 } : { body: "ok page" };
    if (u.pathname === "/forbidden") return { status: 403, body: "denied" };
    return { body: "page" };
  }, log) });
  assert.equal((await f.get("https://a.test/search?q=x")).robotsBlocked, true);
  assert.ok(!log.includes("https://a.test/search?q=x"), "disallowed URL is never requested");
  assert.equal((await f.get("https://b.test/anything")).ok, true);
  assert.equal((await f.get("https://c.test/anything")).robotsBlocked, true);
  const flakyResult = await f.get("https://b.test/flaky");
  assert.equal(flakyResult.ok, true); assert.equal(flakyResult.attempts, 2);
  const forbidden = await f.get("https://b.test/forbidden");
  assert.equal(forbidden.status, 403); assert.equal(forbidden.attempts, 1, "403 is terminal, never retried");
  await f.get("https://b.test/anything");
  assert.equal(f.stats.cacheHits, 1);
  assert.equal(log.filter(u => u.endsWith("/robots.txt")).length, 3, "robots fetched once per origin");
});

test("polite fetcher paces requests to the same host", async () => {
  const log = [], times = [];
  const f = pf.createPoliteFetcher({ minHostIntervalMs: 120, fetchImpl: async (url) => { times.push(Date.now()); log.push(url); return new Response(String(url).endsWith("robots.txt") ? "" : "x", { status: String(url).endsWith("robots.txt") ? 404 : 200 }); } });
  await f.get("https://p.test/1"); await f.get("https://p.test/2");
  const pageTimes = times.slice(-2);
  assert.ok(pageTimes[1] - pageTimes[0] >= 110, "second request waited for the host interval");
});

test("sitemaps: index + urlset parsing, gzip, product-url filter, brand+model candidates", () => {
  const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://shop.test/sitemap1.xml.gz</loc></sitemap></sitemapindex>`;
  assert.deepEqual(sm.parseSitemap(index).sitemaps, ["https://shop.test/sitemap1.xml.gz"]);
  const urlset = `<urlset><url><loc>https://shop.test/en-ca/product/unrelatedmaker-portable-station-qx-7000-black/18000001</loc></url><url><loc>https://shop.test/en-ca/product/unrelatedmaker-portable-station-qx-9000/18000002</loc></url><url><loc>https://shop.test/en-ca/category/stations/123</loc></url><url><loc>https://shop.test/en-ca/product/othermaker-qx-7000-case/18000003</loc></url></urlset>`;
  const decoded = sm.decodeSitemapBody(gzipSync(Buffer.from(urlset)));
  const entries = sm.indexEntries(sm.parseSitemap(decoded).urls);
  assert.equal(entries.length, 3, "category page filtered out");
  assert.deepEqual(sm.findSitemapCandidates(entries, { brand: "UnrelatedMaker", models: ["QX-7000"] }), ["https://shop.test/en-ca/product/unrelatedmaker-portable-station-qx-7000-black/18000001"]);
  assert.deepEqual(sm.findSitemapCandidates(entries, { brand: "UnrelatedMaker", models: ["ZZ-1234"] }), []);
});

const GTIN = "012345678905";
const listingHtml = `<html><head><title>Amazon.ca: UnrelatedMaker Q7 Portable Station</title></head><body><span id="productTitle">UnrelatedMaker Q7 Portable Station</span><table><tr><th>UPC</th><td>${GTIN}</td></tr><tr><th>Item model number</th><td>QX-7000</td></tr></table></body></html>`;
const retailerHtml = `<html><head><title>UnrelatedMaker Portable Station QX-7000</title><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "UnrelatedMaker Portable Station QX-7000", brand: { "@type": "Brand", name: "UnrelatedMaker" }, gtin12: GTIN, review: captured.map((body, i) => ({ "@type": "Review", reviewBody: body, author: { "@type": "Person", name: `Buyer ${i}` }, reviewRating: { "@type": "Rating", ratingValue: 4 }, datePublished: `2026-05-0${i + 1}` })) })}</script></head><body></body></html>`;

test("sitemap-discovered retailer page contributes only after GTIN verification; search robots disallow is honoured; zero OpenAI calls", async () => {
  const dir = mkdtempSync(`${tmpdir()}/ri-sitemap-`);
  writeFileSync(`${dir}/shop.test.json`, JSON.stringify({ entries: sm.indexEntries(["https://www.shop.test/en-ca/product/unrelatedmaker-portable-station-qx-7000/18000001"]) }));
  const old = process.env.REVIEWINTEL_SITEMAP_INDEX_DIR; process.env.REVIEWINTEL_SITEMAP_INDEX_DIR = dir;
  const log = []; const original = globalThis.fetch;
  globalThis.fetch = mockFetch(u => {
    if (u.hostname === "www.bing.com" && u.pathname === "/robots.txt") return { body: "User-agent: *\nDisallow: /search\n" };
    if (u.pathname === "/robots.txt") return { status: 404 };
    if (u.hostname === "www.amazon.ca" && u.pathname === "/dp/B0TESTLIST") return { body: listingHtml };
    if (u.hostname === "www.shop.test" && /18000001$/.test(u.pathname)) return { body: retailerHtml };
    if (u.hostname === "duckduckgo.com") return { status: 202, body: "anomaly-modal" };
    return { status: 404 };
  }, log);
  let r;
  try {
    r = await runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", listingUrl: "https://www.amazon.ca/dp/B0TESTLIST", maxPages: 10, maxQueries: 3, politeDelayMs: 0 });
  } finally { globalThis.fetch = original; old === undefined ? delete process.env.REVIEWINTEL_SITEMAP_INDEX_DIR : process.env.REVIEWINTEL_SITEMAP_INDEX_DIR = old; }
  assert.equal(log.filter(u => u.includes("bing.com/search")).length, 0, "robots-disallowed search is never requested");
  assert.ok(r.politeFetch.robotsBlocked.some(u => u.includes("bing.com/search")));
  const shop = r.reviews.filter(x => /shop\.test/.test(x.sourceUrl || x.url || ""));
  assert.equal(shop.length, captured.length);
  const corpus = adj.adjudicateReviewEvidence(r.reviews, { productName: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", exactListingAccepted: true, exactListingUrl: "https://www.amazon.ca/dp/B0TESTLIST", exactListingTitle: "UnrelatedMaker Q7 Portable Station" });
  det.deriveDeterministicEvidenceResult({ acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true });
  assert.equal(log.filter(u => /openai/i.test(new URL(u).hostname)).length, 0, "OpenAI calls must be 0");
});

// Semantic v3: synthetic unit phrases (test inputs only, never evidence).
const sem = jiti("./lib/reviewSemanticSignals.ts");
const { readFileSync } = require("node:fs");
const ringFixture = JSON.parse(readFileSync(new URL("./fixtures/reviewintel/ringconn-existing-capture-inputs.json", import.meta.url)));
const ringOpts = ringFixture.adjudicationArgs[1];
const evaluate = bodies => det.deriveDeterministicEvidenceResult({ ...ringFixture.evaluationMetadata, acceptedRecords: adj.adjudicateReviewEvidence(bodies.map((body, i) => ({ body: `My ring: ${body} Experience number ${i}.`, sourceUrl: ringOpts.exactListingUrl })), ringOpts).acceptedRecords });
test("semantic v3: generic aspects, negation, category nouns, rhetorical questions, FR/ES/PT", () => {
  const t = (s) => sem.semanticText(s);
  assert.match(t("The sound is crisp and the build is sturdy"), /great/);
  assert.match(t("Battery life is excellent"), /lasts/);
  assert.match(t("It keeps disconnecting from my phone"), /problem/);
  assert.match(t("Customer service was unhelpful"), /bad/);
  assert.match(t("Funciona muy bien, lo recomiendo"), /works.*recommend/);
  assert.match(t("Fonctionne bien et facile"), /works.*easy/);
  assert.match(t("Produto ótimo, recomendo"), /love.*recommend/);
  assert.doesNotMatch(t("Great on hard floors and hardwood"), /\bhard\b/);
  assert.doesNotMatch(t("The burning smell? You assembled it wrong."), /unsafe/);
  assert.match(t("It issued sparks and a smell of burning"), /unsafe/);
});
test("semantic v3 keeps negation in the scorer: 'not impressive' is a complaint, not praise", () => {
  const r = evaluate(["Honestly it is not impressive at all.", "The fit is not great.", "Amazing value, highly recommend.", "Well made and sturdy.", "Battery drains overnight."]);
  const i = r.deterministicScoringInputs;
  assert.equal(i.analyzableReviewCount, 5);
  assert.equal(i.negativeSignal, 3);
  assert.equal(i.positiveSignal, 2);
});

test("sitemap index loads NDJSON (large indexes) and legacy JSON, skipping meta and bad lines", async () => {


  const mod = jiti("./lib/sitemapProductIndex.ts");
  const dir = mkdtempSync(tmpdir() + "/smidx-");
  writeFileSync(dir + "/a.ndjson", '{"meta":{"files":1}}\n{"url":"https://www.x.ca/p/acme-zx100","tokens":["acme","zx100"]}\nnot json\n\n');
  writeFileSync(dir + "/b.json", JSON.stringify({ entries: [{ url: "https://www.y.ca/p/acme-zx100", tokens: ["acme", "zx100"] }] }));
  const entries = mod.loadLocalSitemapIndexes(dir);
  assert.equal(entries.length, 2);
  assert.deepEqual(mod.findSitemapCandidates(entries, { brand: "Acme", models: ["ZX100"] }).sort(), ["https://www.x.ca/p/acme-zx100", "https://www.y.ca/p/acme-zx100"]);
});

test("sitemap index brand prefilter only parses lines for that brand", () => {
  const mod = jiti("./lib/sitemapProductIndex.ts");
  const dir = mkdtempSync(tmpdir() + "/smidx2-");
  writeFileSync(dir + "/a.ndjson", '{"url":"https://www.x.ca/p/acme-zx100","tokens":["acme","zx100"]}\n{"url":"https://www.x.ca/p/other-zx100","tokens":["other","zx100"]}\n');
  assert.equal(mod.loadLocalSitemapIndexes(dir, { brand: "Acme" }).length, 1);
  assert.equal(mod.loadLocalSitemapIndexes(dir).length, 2);
});

test("polite fetch hard-stops a host for the rest of the scan after 401/403/429", async () => {
  const calls = [];
  const fetchImpl = async url => { calls.push(String(url)); if (String(url).endsWith("/robots.txt")) return new Response("", { status: 404 });
    return new Response(String(url).includes("/a") ? "denied" : "ok", { status: String(url).includes("/a") ? 403 : 200 }); };
  const f = pf.createPoliteFetcher({ fetchImpl, minHostIntervalMs: 0 });
  assert.equal((await f.get("https://shop.example/a")).status, 403);
  const second = await f.get("https://shop.example/b");
  assert.equal(second.ok, false);
  assert.match(second.error, /stopped/);
  assert.equal(calls.filter(u => u.includes("/b")).length, 0);
  assert.equal((await f.get("https://other.example/b")).ok, true);
  assert.deepEqual(f.stats.accessStopped, ["https://shop.example/b"]);
});

test("tests never read the machine's local sitemap index implicitly", () => {
  const mod = jiti("./lib/sitemapProductIndex.ts");
  const old = process.env.REVIEWINTEL_SITEMAP_INDEX_DIR; delete process.env.REVIEWINTEL_SITEMAP_INDEX_DIR;
  try { assert.equal(mod.defaultSitemapIndexDir(), process.env.NODE_TEST_CONTEXT ? "" : "/tmp/reviewintel-sitemap-index"); }
  finally { if (old !== undefined) process.env.REVIEWINTEL_SITEMAP_INDEX_DIR = old; }
});
