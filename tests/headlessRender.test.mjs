// Fixture tests for the free local headless render fallback (mocked browser; no network, no Chromium).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const hr = jiti("./lib/headlessRender.ts");
const pf = jiti("./lib/politeFetch.ts");
const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");

const fakeBrowser = (pages, log = []) => async () => ({
  newPage: async () => {
    let current = "";
    return {
      goto: async url => { current = url; log.push(url); const p = pages[url] || { status: 404, html: "" }; return { status: () => p.status }; },
      evaluate: async () => undefined,
      waitForSelector: async () => { if (!/review/i.test((pages[current] || {}).html || "")) throw new Error("timeout"); },
      content: async () => (pages[current] || {}).html || "",
      url: () => current,
      close: async () => undefined,
    };
  },
  close: async () => undefined,
});
const gateFrom = (robots = "") => pf.createPoliteFetcher({ minHostIntervalMs: 0, fetchImpl: async url => String(url).endsWith("/robots.txt") ? new Response(robots, { status: robots ? 200 : 404 }) : new Response("x") });

test("headless render is ON locally, OFF on serverless/tests, explicit flag wins", () => {
  assert.equal(hr.headlessRenderEnabled({}), true);
  assert.equal(hr.headlessRenderEnabled({ VERCEL: "1" }), false);
  assert.equal(hr.headlessRenderEnabled({ AWS_LAMBDA_FUNCTION_NAME: "f" }), false);
  assert.equal(hr.headlessRenderEnabled({ NODE_TEST_CONTEXT: "child" }), false);
  assert.equal(hr.headlessRenderEnabled({ VERCEL: "1", REVIEWINTEL_HEADLESS_RENDER: "on" }), true);
  assert.equal(hr.headlessRenderEnabled({ REVIEWINTEL_HEADLESS_RENDER: "off" }), false);
});

test("robots-disallowed URLs are never opened in the browser", async () => {
  const log = [];
  const r = hr.createHeadlessRenderer({ gate: gateFrom("User-agent: *\nDisallow: /p/"), launch: fakeBrowser({}, log), minHostIntervalMs: 0 });
  const out = await r.render("https://shop.example/p/acme-zx100");
  assert.equal(out.ok, false); assert.equal(out.error, "robots_disallowed"); assert.equal(log.length, 0);
});

test("403 and CAPTCHA pages are terminal and stop the host; no further renders there", async () => {
  const log = [];
  const gate = gateFrom();
  const pages = { "https://a.example/p/1": { status: 403, html: "denied" }, "https://b.example/p/1": { status: 200, html: "<html>Please verify you are human (captcha)</html>" } };
  const r = hr.createHeadlessRenderer({ gate, launch: fakeBrowser(pages, log), minHostIntervalMs: 0 });
  assert.equal((await r.render("https://a.example/p/1")).blocked, true);
  assert.equal((await r.render("https://a.example/p/2")).error.includes("stopped"), true);
  assert.equal((await r.render("https://b.example/p/1")).blocked, true);
  assert.deepEqual(log, ["https://a.example/p/1", "https://b.example/p/1"]);
  assert.equal((await gate.get("https://a.example/other")).ok, false); // plain fetch also stopped
});

test("page budget bounds renders", async () => {
  const r = hr.createHeadlessRenderer({ gate: gateFrom(), launch: fakeBrowser({}), maxPages: 1, minHostIntervalMs: 0 });
  await r.render("https://c.example/1");
  assert.match((await r.render("https://c.example/2")).error, /budget/);
});

test("retrieval renders a verified page with client-side reviews and extracts them through the collector", async () => {
  const listing = "https://www.shop.example/p/acme-zx100-cordless-drill";
  const title = "Acme ZX100 Cordless Drill Kit";
  const shell = `<html><head><title>${title}</title><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: title, brand: { name: "Acme" }, mpn: "ZX100" })}</script></head><body><div id="reviews-root"></div></body></html>`;
  const reviewsHtml = Array.from({ length: 4 }, (_, i) => `<div itemprop="review" itemscope itemtype="https://schema.org/Review"><span itemprop="author">Buyer ${i}</span><span itemprop="reviewBody">Rendered review ${i}: I used the Acme ZX100 drill for a deck project and it was powerful, reliable and comfortable to hold all day.</span><span itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating"><meta itemprop="ratingValue" content="5"></span></div>`).join("");
  const rendered = shell.replace('<div id="reviews-root"></div>', `<div id="reviews-root">${reviewsHtml}</div>`);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => { const u = new URL(String(url)); if (u.pathname === "/robots.txt") return new Response("", { status: 404 }); if (u.toString() === listing) return new Response(shell); return new Response("", { status: 404 }); };
  const log = [];
  try {
    const result = await runNativeReviewRetrieval({ productTitle: title, brand: "Acme", model: "ZX100", listingUrl: listing, maxPages: 3, maxQueries: 0, maxSnippets: 20, politeDelayMs: 0, headlessLaunch: fakeBrowser({ [listing]: { status: 200, html: rendered } }, log) });
    assert.deepEqual(log, [listing]);
    assert.equal(result.headlessRender.ok, 1);
    assert.ok(result.reviewsCollected >= 4, `collected ${result.reviewsCollected}`);
  } finally { globalThis.fetch = oldFetch; }
});
