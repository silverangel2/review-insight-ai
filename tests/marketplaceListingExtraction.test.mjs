// Captured written-review bodies are re-wrapped in marketplace markup (transport
// simulation). No review text is invented; product names are neutralised.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const { extractWrittenReviewsFromHtml } = jiti("./lib/reviewCollector.ts");
const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
const dev = require("./fixtures/reviewintel-benchmark/development.json");
const captured = dev.corpora[3].adjudicationArgs[0].map(r => r.body).filter(b => String(b || "").length > 40).slice(0, 6);
const expander = "Brief content visible, double tap to read full content. Full content visible, double tap to read brief content. ";
const block = (tag, body, i) => `<${tag} id="R${i}" data-hook="review" class="review aok-relative"><a data-hook="review-title"><span>Title ${i}</span></a><i data-hook="review-star-rating"><span class="a-icon-alt">4.0 out of 5 stars</span></i><span data-hook="review-date">Reviewed in Canada on May ${i + 1}, 2026</span><span data-hook="avp-badge">Verified Purchase</span><span data-hook="review-body" class="a-size-base review-text"><div data-hook="review-collapsed"><span>${expander}${body}</span></div></span></${tag}>`;
const page = (tag, title = "UnrelatedMaker Q7 Portable Station") => `<html><head><title>Amazon.ca: ${title}</title></head><body><span id="productTitle">${title}</span><ul id="cm-cr-dp-review-list">${captured.map((b, i) => block(tag, b, i)).join("")}</ul></body></html>`;

test("product-page <li> review containers are extracted like <div> containers", () => {
  assert.ok(captured.length >= 5);
  for (const tag of ["li", "div"]) {
    const out = extractWrittenReviewsFromHtml(page(tag), "https://www.amazon.ca/dp/B0TESTLIST");
    assert.equal(out.length, captured.length, tag);
    for (const r of out) {
      assert.ok(!/double tap to read/i.test(r.body), "accessibility prompt must be stripped");
      assert.ok(captured.some(b => b.replace(/\s+/g, " ").trim().includes(r.body.slice(0, 40))), "body must be original captured text");
      assert.equal(r.reviewStructureVerified, true);
    }
  }
});

async function withFetch(fake, action) {
  const original = globalThis.fetch; globalThis.fetch = fake;
  try { return await action(); } finally { globalThis.fetch = original; }
}

test("verified listing page with the same stable marketplace id is not discarded by fuzzy title re-verification", async () => {
  const listingUrl = "https://www.amazon.ca/dp/B0TESTLIST";
  const out = await withFetch(async url => {
    const u = new URL(url);
    if (u.pathname.startsWith("/dp/B0TESTLIST")) { const r = new Response(page("li", "Amazon.ca: Electronics")); Object.defineProperty(r, "url", { value: listingUrl }); return r; }
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station 2000W PRO-MAX Edition", brand: "UnrelatedMaker", model: "Q7 PRO-MAX", listingUrl, maxPages: 6, maxQueries: 1, politeDelayMs: 0 }));
  assert.equal(out.reviewsCollected, captured.length);
});

test("a redirect to a different stable id never inherits the verified listing", async () => {
  const listingUrl = "https://www.amazon.ca/dp/B0TESTLIST";
  const out = await withFetch(async url => {
    const u = new URL(url);
    if (u.pathname.startsWith("/dp/B0TESTLIST")) { const r = new Response(page("li", "Completely Different Kettle")); Object.defineProperty(r, "url", { value: "https://www.amazon.ca/dp/B0OTHERONE" }); return r; }
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", model: "Q7", listingUrl, maxPages: 6, maxQueries: 1, politeDelayMs: 0 }));
  assert.equal(out.reviewsCollected, 0);
});

test("schema.org microdata Review bodies are extracted; product description microdata is not", () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><span itemprop="description">Powerful portable station with fast charging and a durable case built to last.</span>${captured.slice(0, 3).map((b, i) => `<div itemprop="review" itemscope itemtype="https://schema.org/Review"><meta itemprop="datePublished" content="2026-05-0${i + 1}"><div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating"><meta itemprop="ratingValue" content="4"></div><p itemprop="reviewBody">${b}</p></div>`).join("")}</div>`;
  const out = extractWrittenReviewsFromHtml(html, "https://retailer.test/products/q7");
  assert.equal(out.length, 3);
  assert.ok(out.every(r => !/Powerful portable station/.test(r.body)));
});

const policy = jiti("./lib/reviewRetrievalPolicy.ts");
test("retailer adapters derive public review pages from the product's own id only", () => {
  assert.deepEqual(policy.buildRetailerReviewPageUrls("https://www.walmart.com/ip/some-item/123456789"), ["https://www.walmart.com/reviews/product/123456789", "https://www.walmart.com/reviews/product/123456789?page=2"]);
  assert.equal(policy.buildRetailerReviewPageUrls("https://www.bestbuy.com/site/some-item/6543210.p?skuId=6543210")[0], "https://www.bestbuy.com/site/reviews/some-item/6543210");
  assert.deepEqual(policy.buildRetailerReviewPageUrls("https://www.bestbuy.ca/en-ca/product/some-item/19438688"), ["https://www.bestbuy.ca/en-ca/product/some-item/19438688/review"]);
  assert.deepEqual(policy.buildRetailerReviewPageUrls("https://unknown.test/p/1"), []);
  assert.deepEqual(policy.buildLocaleListingVariants("https://www.amazon.ca/dp/B0TESTLIST?th=1"), ["https://www.amazon.com/dp/B0TESTLIST"]);
});

test("locale variant contributes reviews only when its fetched title verifies; sign-in stops it", async () => {
  const listingUrl = "https://www.amazon.ca/dp/B0TESTLIST";
  const run = (comHtml, comStatus = 200, comFinal) => withFetch(async url => {
    const u = new URL(url);
    if (u.hostname === "www.amazon.com" && u.pathname.startsWith("/dp/")) { const r = new Response(comHtml, { status: comStatus }); Object.defineProperty(r, "url", { value: comFinal || url }); return r; }
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({ productTitle: "UnrelatedMaker Q7 Portable Station", brand: "UnrelatedMaker", model: "Q7", listingUrl, maxPages: 12, maxQueries: 1, politeDelayMs: 0 }));
  assert.equal((await run(page("li", "UnrelatedMaker Q7 Portable Station"))).reviewsCollected, captured.length);
  assert.equal((await run(page("li", "Different Brand Z1 Blender"))).reviewsCollected, 0);
  assert.equal((await run("Sign in", 200, "https://www.amazon.com/ap/signin?x=1")).reviewsCollected, 0);
  assert.equal((await run("", 403)).reviewsCollected, 0);
});

test("nested review-body markup is read in full, not cut at the first </span>", () => {
  const body = captured[0];
  const half = Math.floor(body.length / 2);
  const html = `<li data-hook="review"><span data-hook="review-body" class="review-text"><div data-hook="review-collapsed"><span>${body.slice(0, half)}</span><br><span>${body.slice(half)}</span></div></span><span data-hook="helpful-vote-statement">3 people found this helpful</span></li>`;
  const [r] = extractWrittenReviewsFromHtml(html, "https://www.amazon.ca/dp/B0TESTLIST");
  assert.equal(r.body.replace(/\s+/g, ""), body.replace(/\s+/g, "").replace(/(?:brief|full)contentvisible,?doubletaptoread(?:full|brief)content\.?/gi, ""));
  assert.ok(!/helpful/.test(r.body));
});

const adjud = jiti("./lib/reviewEvidenceAdjudication.ts");
const live = require("./fixtures/reviewintel-benchmark/live-listing-capture-20261010.json");
test("live-captured listing reviews: incidental accessory mention does not discard a real product review", () => {
  const records = live.records.map(r => ({ ...r, reviewedProductName: live.adjudicationOptions.exactListingTitle, reviewedBrand: live.adjudicationOptions.brand }));
  const corpus = adjud.adjudicateReviewEvidence(records, live.adjudicationOptions);
  assert.equal(corpus.acceptedRecordCount, records.length);
  assert.ok(corpus.acceptedRecords.some(r => /ceiling mount/.test(r.body) && r.original.rating === 2), "critical review must survive");
  // A record whose subject is the accessory itself is still excluded.
  const kit = adjud.adjudicateReviewEvidence([{ ...records[0], reviewedProductName: "Universal ceiling mount accessory" }], live.adjudicationOptions);
  assert.equal(kit.acceptedRecordCount, 0);
});

const richHtml = require("node:fs").readFileSync(new URL("./fixtures/reviewintel-benchmark/live-rich-review-markup-20261010.html", import.meta.url), "utf8");
test("current rich review markup (reviewText/reviewRichContentContainer) is read across all paragraphs", () => {
  const out = extractWrittenReviewsFromHtml(richHtml, "https://www.amazon.ca/dp/B0TESTLIST");
  assert.ok(out.length >= 2);
  const plain = richHtml.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
  for (const r of out) {
    assert.ok(plain.includes(r.body.slice(0, 40)), "body must come from the saved markup");
    assert.ok(!/double tap to read/i.test(r.body));
  }
  assert.ok(out.some(r => r.body.length > 300), "multi-paragraph review must not be cut at the first paragraph");
});

const identity = jiti("./lib/productIdentityTokens.ts");
test("colour words in feature phrases are not variant colours", () => {
  const roles = identity.stableProductSearchTerms({ brand: "UnrelatedMaker", productName: "UnrelatedMaker Q9 Wireless Headphones with Crystal Clear Hands-Free Calling and Clear Sound, Black" }).roles;
  assert.deepEqual(roles.colors, ["black"]);
  assert.ok(identity.stableProductSearchTerms({ brand: "UnrelatedMaker", productName: "UnrelatedMaker Bottle 500 ml Clear" }).roles.colors.includes("clear"));
});

test("listing title repeated as a review body is rejected; page-inherited title is not a per-review model claim", () => {
  const opts = { productName: "UnrelatedMaker Q7 Portable Station 2000W", brand: "UnrelatedMaker", model: "QX-700", exactListingAccepted: true, exactListingUrl: "https://www.amazon.ca/dp/B0TESTLIST", exactListingTitle: "UnrelatedMaker Q7 Portable Station 2000W" };
  const base = { source: "Amazon written review", sourceUrl: "https://www.amazon.ca/dp/B0TESTLIST", reviewStructureVerified: true, reviewedProductName: "UnrelatedMaker Q7 Portable Station 2000W, Grey", reviewedProductNameSource: "page", reviewedBrand: "UnrelatedMaker" };
  assert.equal(adjud.adjudicateReviewEvidence([{ ...base, body: "UnrelatedMaker Q7 Portable Station 2000W" }], opts).acceptedRecordCount, 0);
  assert.equal(adjud.adjudicateReviewEvidence([{ ...base, body: captured[0] }], opts).acceptedRecordCount, 1);
  // A different listing (other id) carrying another model name is still rejected.
  assert.equal(adjud.adjudicateReviewEvidence([{ ...base, sourceUrl: "https://www.amazon.ca/dp/B0OTHERONE", body: captured[0] }], opts).acceptedRecordCount, 0);
  // A per-review structured name (not page-inherited) still must carry the model.
  assert.equal(adjud.adjudicateReviewEvidence([{ ...base, reviewedProductNameSource: undefined, body: captured[0] }], opts).acceptedRecordCount, 0);
});

const sem = jiti("./lib/reviewSemanticSignals.ts");
test("semantic v2: category nouns and common idioms are read correctly", () => {
  assert.doesNotMatch(sem.semanticText("Great as a slow cooker and pressure cooker"), /\bslow\b/);
  assert.match(sem.semanticText("I couldn't be happier with it"), /very happy/);
  assert.match(sem.semanticText("I haven't encountered any major issues"), /no problems/);
});

test("colour policy: colour/finish is cosmetic; size, capacity and model differences still reject", () => {
  const opts = { productName: "UnrelatedMaker QX-7000 Portable Station 6 Quart, Black", brand: "UnrelatedMaker", model: "QX-7000", exactListingAccepted: true, exactListingUrl: "https://www.amazon.ca/dp/B0TESTLIST", exactListingTitle: "UnrelatedMaker QX-7000 Portable Station 6 Quart, Black" };
  const rec = (extra) => ({ source: "Amazon written review", sourceUrl: "https://www.amazon.ca/dp/B0TESTLIST", reviewStructureVerified: true, reviewedProductName: opts.exactListingTitle, reviewedProductNameSource: "page", reviewedBrand: "UnrelatedMaker", body: captured[0], ...extra });
  const accepted = (r) => adjud.adjudicateReviewEvidence([r], opts).acceptedRecordCount;
  assert.equal(accepted(rec({ reviewedVariant: "Colour Name: Silver Size: 6 Quarts" })), 1, "other colour, same size: accepted");
  assert.equal(accepted(rec({ reviewedVariant: "Color: Midnight Blue" })), 1, "other colour: accepted");
  assert.equal(accepted(rec({ reviewedProductName: "UnrelatedMaker QX-7000 Portable Station 6 Quart, Silver", reviewedProductNameSource: undefined })), 1, "structured name in another colour: accepted");
  assert.equal(accepted(rec({ reviewedVariant: "Colour Name: Black Size: 8 Quarts" })), 0, "different capacity: rejected");
  assert.equal(accepted(rec({ reviewedModel: "QX-9000" })), 0, "different model: rejected");
  assert.equal(accepted(rec({ reviewedProductName: "UnrelatedMaker QX-9000 Portable Station 6 Quart, Black", reviewedProductNameSource: undefined })), 0, "different model in name: rejected");
});
