// Fixture-driven tests for the product-identity fix.
//
// Defect (payload-verified 2026-10-15): the native collector read an amazon.ca
// product page fine (20/20 reviews, aggregate 4.5*/1,379) yet the result named
// the product "Amazon product" — the fetched page title was parsed internally
// but never flowed back into listingEvidence, so the route's title chain fell
// through to authoritativeDisplayName()'s ASIN-only fallback.
//
// The fix: (1) extractProductEvidenceFromHtml also reads og:image,
// (2) runNativeReviewRetrieval exposes primaryPageIdentity (verified,
// same-ASIN listing page only), (3) adoptPrimaryPageIdentity merges it into
// the listing evidence when no usable title exists yet.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);

import test from "node:test";
import assert from "node:assert/strict";

const { extractProductEvidenceFromHtml } = await import("../lib/productUrlRetrieval.ts");
const { adoptPrimaryPageIdentity } = await import("../lib/adoptListingIdentity.ts");

const FULL_TITLE =
  "Apple AirPods 4 Wireless Earbuds, Bluetooth Headphones, Personalized Spatial Audio, Sweat and Water Resistant, USB-C Charging Case, H2 Chip, Up to 30 Hours of Battery Life";

function amazonCaProductPage({ titleMode = "productTitle" } = {}) {
  const head = `<!DOCTYPE html><html lang="en-CA"><head><meta charset="utf-8">
<title>${FULL_TITLE} : Amazon.ca: Electronics</title>
<meta property="og:title" content="${FULL_TITLE}">
<meta property="og:image" content="https://m.media-amazon.com/images/I/61SUj2aCfDL._AC_SL1500_.jpg">
<meta property="og:url" content="https://www.amazon.ca/dp/B0DGJDKHRQ">
</head><body>`;
  const titleNode =
    titleMode === "productTitle"
      ? `<span id="productTitle" class="a-size-large a-spacing-none">${FULL_TITLE}</span>`
      : "";
  return `${head}${titleNode}
<div id="averageCustomerReviews">
<span id="acrPopover" title="4.5 out of 5 stars"><i class="a-icon a-icon-star"></i></span>
<span id="acrCustomerReviewText" class="a-size-base" aria-label="1,379 global ratings">1,379</span>
</div>
<table><tr><th class="a-color-secondary a-size-base prodDetSectionEntry">Brand</th><td class="a-size-base prodDetAttrValue">Apple</td></tr></table>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Apple AirPods 4 Wireless Earbuds","brand":{"@type":"Brand","name":"Apple"}}</script>
</body></html>`;
}

test("extract: real amazon.ca product page yields title, aggregate, brand, image", () => {
  const e = extractProductEvidenceFromHtml(amazonCaProductPage(), "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(e.title, FULL_TITLE);
  assert.equal(e.rating, 4.5);
  assert.equal(e.reviewCount, 1379);
  assert.equal(e.brand, "Apple");
  assert.equal(e.image, "https://m.media-amazon.com/images/I/61SUj2aCfDL._AC_SL1500_.jpg");
});

test("extract: og:title fallback when #productTitle is absent", () => {
  const e = extractProductEvidenceFromHtml(amazonCaProductPage({ titleMode: "none" }), "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(e.title, FULL_TITLE);
});

test("extract: <title> fallback strips the Amazon.ca suffix", () => {
  const html = `<!DOCTYPE html><html><head><title>Sony WH-1000XM5 Wireless Headphones : Amazon.ca: Electronics</title></head><body></body></html>`;
  const e = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B09XS7JWHH");
  assert.equal(e.title, "Sony WH-1000XM5 Wireless Headphones");
});

test("extract: captcha/blocked page yields no identity (honest nulls)", () => {
  const html = `<!DOCTYPE html><html><head><title>Robot Check</title></head><body>Enter the characters you see below</body></html>`;
  const e = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(e.title, null);
  assert.equal(e.rating, null);
  assert.equal(e.reviewCount, null);
  assert.equal(e.image, null);
});

test("extract: page with no title nodes keeps the honest generic fallback (null)", () => {
  const html = `<!DOCTYPE html><html><head></head><body><div class="review">Great product, love it.</div></body></html>`;
  const e = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(e.title, null);
});

function emptyEvidence() {
  return {
    exactListingUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    exactListingTitle: "",
    store: "Amazon.ca",
    price: null,
    rating: null,
    reviewCount: null,
    asin: "B0DGJDKHRQ",
    confidence: "medium",
    sourcesChecked: [],
    notes: [],
  };
}

function primaryIdentity() {
  return {
    title: FULL_TITLE,
    brand: "Apple",
    model: null,
    rating: 4.5,
    reviewCount: 1379,
    image: "https://m.media-amazon.com/images/I/61SUj2aCfDL._AC_SL1500_.jpg",
    url: "https://www.amazon.ca/dp/B0DGJDKHRQ",
  };
}

test("adopt: empty listing evidence gains the verified page identity", () => {
  const out = adoptPrimaryPageIdentity(emptyEvidence(), primaryIdentity());
  assert.equal(out.exactListingTitle, FULL_TITLE);
  assert.equal(out.rating, 4.5);
  assert.equal(out.reviewCount, 1379);
  assert.equal(out.imageUrl, "https://m.media-amazon.com/images/I/61SUj2aCfDL._AC_SL1500_.jpg");
});

test("adopt: an existing usable title is never overwritten", () => {
  const ev = { ...emptyEvidence(), exactListingTitle: "Apple AirPods 4", rating: 4.4, reviewCount: 2000, imageUrl: "https://example.com/keep.jpg" };
  const out = adoptPrimaryPageIdentity(ev, primaryIdentity());
  assert.equal(out.exactListingTitle, "Apple AirPods 4");
  assert.equal(out.rating, 4.4);
  assert.equal(out.reviewCount, 2000);
  assert.equal(out.imageUrl, "https://example.com/keep.jpg");
});

test("adopt: placeholder title 'Amazon product' is replaced by the real one", () => {
  const ev = { ...emptyEvidence(), exactListingTitle: "Amazon product" };
  const out = adoptPrimaryPageIdentity(ev, primaryIdentity());
  assert.equal(out.exactListingTitle, FULL_TITLE);
});

test("adopt: null evidence and null identity are safe no-ops", () => {
  assert.equal(adoptPrimaryPageIdentity(null, primaryIdentity()), null);
  const ev = emptyEvidence();
  assert.deepEqual(adoptPrimaryPageIdentity(ev, null), ev);
});

test("integration: extracted page evidence flows into the listing evidence (the defect, end to end)", () => {
  // Mirrors the defective scan: collector read the page (20/20 reviews) but
  // the result carried no title. The extraction that always worked feeds the
  // adoption that was missing.
  const parsed = extractProductEvidenceFromHtml(
    amazonCaProductPage(),
    "https://www.amazon.ca/dp/B0DGJDKHRQ",
  );
  const out = adoptPrimaryPageIdentity(emptyEvidence(), {
    title: parsed.title,
    brand: parsed.brand,
    model: parsed.model,
    rating: parsed.rating,
    reviewCount: parsed.reviewCount,
    image: parsed.image,
    url: "https://www.amazon.ca/dp/B0DGJDKHRQ",
  });
  assert.equal(out.exactListingTitle, FULL_TITLE);
  assert.equal(out.rating, 4.5);
  assert.equal(out.reviewCount, 1379);
  assert.ok(out.imageUrl && out.imageUrl.startsWith("https://"));
});
