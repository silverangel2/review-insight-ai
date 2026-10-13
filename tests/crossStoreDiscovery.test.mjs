// Cross-store discovery by the listing's own identifiers. Fixture HTML only;
// review bodies are captured development texts re-wrapped as JSON-LD (transport
// simulation). Product names/ids are neutral test values. No network.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const ids = jiti("./lib/listingIdentifiers.ts");
const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
const dev = require("./fixtures/reviewintel-benchmark/development.json");
const captured = dev.corpora[3].adjudicationArgs[0].map(r => r.body).filter(b => String(b || "").length > 40).slice(0, 4);

const GTIN = "012345678905";      // valid UPC-A check digit
const OTHER = "036000291452";     // valid, different product
test("GTIN normalisation validates the GS1 check digit; model ids must be discriminative", () => {
  assert.equal(ids.normalizeGtin(GTIN), "00012345678905");
  assert.equal(ids.normalizeGtin("012345678906"), null);
  assert.equal(ids.normalizeGtin("00000000"), null);
  assert.equal(ids.normalizeModelId("QX-7000"), "QX7000");
  assert.equal(ids.normalizeModelId("Black"), null);
  assert.equal(ids.normalizeModelId("12"), null);
});

test("identifiers are read from spec rows, JSON-LD and microdata; matching and conflicts", () => {
  const amazonLike = `<table><tr><th class="a-color-secondary"> UPC </th><td class="a-size-base">&lrm;${GTIN}</td></tr><tr><th>Item model number</th><td>&lrm;QX-7000</td></tr><tr><th>Colour</th><td>Black</td></tr></table>`;
  const listing = ids.extractListingIdentifiers(amazonLike);
  assert.deepEqual(listing, { gtins: ["00012345678905"], models: ["QX7000"] });
  const jsonLd = ids.extractListingIdentifiers(`<script type="application/ld+json">{"@type":"Product","gtin13":"0${GTIN}","mpn":"QX7000"}</script>`);
  assert.ok(ids.identifiersMatch(listing, jsonLd));
  const micro = ids.extractListingIdentifiers(`<span itemprop="gtin12" content="${OTHER}"></span><span itemprop="mpn">ZZ-1</span>`);
  assert.ok(ids.identifiersConflict(listing, micro));
  assert.ok(!ids.identifiersMatch(listing, micro));
  const qs = ids.identifierDiscoveryQueries("UnrelatedMaker", listing);
  assert.match(qs[0], /UnrelatedMaker "QX7000" reviews/);
  assert.ok(qs.some(q => /site:bestbuy\.ca/.test(q) && /QX7000/.test(q)));
  assert.ok(qs.includes(`UnrelatedMaker "${GTIN}"`));
  assert.ok(qs.every(q => q.startsWith("UnrelatedMaker ")), "brand anchors every identifier query");
});

const listingHtml = `<html><head><title>Amazon.ca: UnrelatedMaker Q7 Portable Station</title></head><body><span id="productTitle">UnrelatedMaker Q7 Portable Station</span><table><tr><th>UPC</th><td>${GTIN}</td></tr><tr><th>Item model number</th><td>QX-7000</td></tr></table></body></html>`;
const retailerHtml = (gtin, title) => `<html><head><title>${title}</title><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: title, brand: { "@type": "Brand", name: "UnrelatedMaker" }, gtin12: gtin, review: captured.map((body, i) => ({ "@type": "Review", reviewBody: body, author: { "@type": "Person", name: `Buyer ${i}` }, reviewRating: { "@type": "Rating", ratingValue: 4 }, datePublished: `2026-05-0${i + 1}` })) })}</script></head><body><h1>${title}</h1></body></html>`;
const bingHtml = `<ol><li class="b_algo"><h2><a href="https://www.bestbuy.ca/en-ca/product/unrelatedmaker-portable-station-qx-7000/18000001">UnrelatedMaker Portable Station QX-7000 | Best Buy Canada</a></h2></li><li class="b_algo"><h2><a href="https://www.walmart.ca/en/ip/unrelatedmaker-station-qx-7000/6000000000001">UnrelatedMaker Station QX-7000 Bundle | Walmart</a></h2></li></ol>`;

test("same product at another retailer is found by model id and verified by GTIN; conflicting GTIN and DDG throttle are handled", async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url)); if (!u.pathname.endsWith('/robots.txt')) calls.push(u.href);
    const reply = (body, status = 200) => { const r = new Response(body, { status, headers: { "content-type": "text/html" } }); Object.defineProperty(r, "url", { value: u.href }); return r; };
    if (u.hostname === "www.amazon.ca" && u.pathname === "/dp/B0TESTLIST") return reply(listingHtml);
    if (u.hostname === "www.bing.com") return reply(bingHtml);
    if (u.hostname === "duckduckgo.com") return reply("<html>anomaly-modal</html>", 202);
    if (u.hostname === "www.bestbuy.ca" && /18000001$/.test(u.pathname)) return reply(retailerHtml(GTIN, "UnrelatedMaker Portable Station QX-7000"));
    if (u.hostname === "www.walmart.ca" && /ip\//.test(u.pathname)) return reply(retailerHtml(OTHER, "UnrelatedMaker Q7 Portable Station"));
    return reply("", 404);
  };
  let result;
  try {
    result = await runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", listingUrl: "https://www.amazon.ca/dp/B0TESTLIST", maxPages: 16, maxQueries: 4, politeDelayMs: 0 });
  } finally { globalThis.fetch = original; }
  const bingQueries = calls.filter(c => c.includes("bing.com/search")).map(c => new URL(c).searchParams.get("q"));
  assert.match(bingQueries[0], /"QX7000"/, "identifier-led query first");
  assert.equal(calls.filter(c => c.includes("duckduckgo.com")).length, 1, "throttled provider is not retried");
  const fromBestBuy = result.reviews.filter(r => /bestbuy\.ca/.test(r.sourceUrl || r.url || ""));
  assert.equal(fromBestBuy.length, captured.length, "exact product at another store contributes its reviews");
  assert.equal(result.reviews.filter(r => /walmart\.ca/.test(r.sourceUrl || r.url || "")).length, 0, "conflicting GTIN (title looks identical) contributes nothing");
});

test("a search provider returning the same organic results for unrelated queries is treated as degraded and stops", async () => {
  const calls = [];
  const sameResults = `<ol>${["https://www.example-brand.test/", "https://www.example-store.test/brand/x", "https://en.wikipedia.org/wiki/Example", "https://www.example-store.test/c/brand"].map((u, i) => `<li class="b_algo"><h2><a href="${u}">Result ${i}</a></h2></li>`).join("")}</ol>`;
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url)); if (!u.pathname.endsWith('/robots.txt')) calls.push(u.href);
    const reply = (body, status = 200) => { const r = new Response(body, { status }); Object.defineProperty(r, "url", { value: u.href }); return r; };
    if (u.hostname === "www.bing.com") return reply(sameResults);
    if (u.hostname === "duckduckgo.com") return reply("anomaly-modal", 202);
    return reply("", 404);
  };
  try {
    await runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", model: "QX-7000", listingUrl: "https://www.amazon.ca/dp/B0TESTLIST", maxPages: 8, maxQueries: 10, politeDelayMs: 0 });
  } finally { globalThis.fetch = original; }
  assert.equal(calls.filter(c => c.includes("bing.com/search")).length, 3, "first + two repeats, then stop");
});

test("verified Best Buy CA page: its public review JSON inherits identity, is paged and de-duplicated; unverified store gets nothing", async () => {
  const policy = jiti("./lib/reviewRetrievalPolicy.ts");
  const page = "https://www.bestbuy.ca/en-ca/product/unrelatedmaker-portable-station-qx-7000/18000001";
  const api = policy.buildRetailerReviewPageUrls(page).filter(u => u.includes("/api/reviews/v2/"));
  assert.equal(api.length, 3);
  assert.equal(policy.retailerStableProductId(page), policy.retailerStableProductId(api[0]));
  assert.notEqual(policy.retailerStableProductId(page), policy.retailerStableProductId("https://www.bestbuy.ca/en-ca/product/x/18000002"));

  const productOnly = (gtin, title) => `<html><head><title>${title}</title><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: title, brand: { "@type": "Brand", name: "UnrelatedMaker" }, gtin12: gtin })}</script></head><body><h1>${title}</h1></body></html>`;
  const apiJson = (bodies) => JSON.stringify({ reviews: bodies.map((comment, i) => ({ id: `r${comment.length}-${i}`, title: "Review", comment, rating: 4, reviewerName: `Buyer ${i}`, submissionTime: "2026-05-01T00:00:00Z", isVerifiedPurchaser: true })), totalPages: 2 });
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url)); if (!u.pathname.endsWith("/robots.txt")) calls.push(u.href);
    const reply = (body, status = 200, type = "text/html") => { const r = new Response(body, { status, headers: { "content-type": type } }); Object.defineProperty(r, "url", { value: u.href }); return r; };
    if (u.hostname === "www.amazon.ca" && u.pathname === "/dp/B0TESTLIST") return reply(listingHtml);
    if (u.hostname === "www.bing.com") return reply(bingHtml);
    if (u.hostname === "duckduckgo.com") return reply("<html>anomaly-modal</html>", 202);
    if (u.hostname === "www.bestbuy.ca" && /\/api\/reviews\/v2\/products\/18000001\/reviews$/.test(u.pathname)) {
      const p = u.searchParams.get("page");
      return reply(p === "1" ? apiJson(captured.slice(0, 2)) : p === "2" ? apiJson(captured.slice(1, 4)) : apiJson([]), 200, "application/json");
    }
    if (u.hostname === "www.bestbuy.ca" && /18000001$/.test(u.pathname)) return reply(productOnly(GTIN, "UnrelatedMaker Portable Station QX-7000"));
    if (u.hostname === "www.walmart.ca" && /ip\//.test(u.pathname)) return reply(productOnly(OTHER, "UnrelatedMaker Q7 Portable Station"));
    if (u.hostname === "www.walmart.ca" && /reviews\/product/.test(u.pathname)) return reply(apiJson(captured), 200, "application/json");
    return reply("", 404);
  };
  let result;
  try {
    result = await runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", listingUrl: "https://www.amazon.ca/dp/B0TESTLIST", maxPages: 20, maxQueries: 4, politeDelayMs: 0 });
  } finally { globalThis.fetch = original; }
  const fromBestBuy = result.reviews.filter(r => /bestbuy\.ca/.test(r.sourceUrl || r.url || ""));
  assert.equal(fromBestBuy.length, captured.length, "pages 1+2 merged, the overlapping review counted once");
  assert.ok(calls.some(c => c.includes("/api/reviews/v2/products/18000001/reviews")), "public review JSON was requested");
  assert.equal(result.reviews.filter(r => /walmart\.ca/.test(r.sourceUrl || r.url || "")).length, 0, "GTIN-conflicting store's review JSON never inherits identity");
});
