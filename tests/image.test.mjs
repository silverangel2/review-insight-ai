// Fixture-driven tests for the product-image follow-up fix.
//
// Payload-verified defect (guest API scan 2026-10-16, amazon.ca/dp/B0DGJDKHRQ):
// productName returned the REAL title (good), score 79, 20 reviews — but NO
// image URL existed anywhere in the payload, so the brief rendered no
// thumbnail. Root cause: PR #46 extracted the main image from og:image /
// twitter:image meta tags, but real Amazon listing HTML carries neither
// (verified against a live amazon.ca dp page: 1.88MB, real title, ASIN present
// 298x, zero og:image/twitter:image tags). The canonical main image lives on
// the #landingImage element's data-old-hires attribute.
//
// The fix: extractProductEvidenceFromHtml falls back to the #landingImage
// data-old-hires (then src) when no og:/twitter: image exists. Everything
// downstream (primaryPageIdentity.image -> adoptPrimaryPageIdentity imageUrl
// -> result.reviewEvidence.listingEvidence.imageUrl -> briefImageUrl) already
// handles the field.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { extractProductEvidenceFromHtml } = await import("../lib/productUrlRetrieval.ts");
const { adoptPrimaryPageIdentity } = await import("../lib/adoptListingIdentity.ts");
const { briefImageUrl } = await import("../lib/reviewAnalysis.ts");

// The REAL #landingImage tag from a live amazon.ca dp page (B0DGJDKHRQ,
// fetched 2026-10-16): src before data-old-hires, id later in the tag.
const REAL_TAG = readFileSync("/tmp/landing_tag.txt", "utf8");

const page = (head, body) =>
  `<!DOCTYPE html><html><head><title>Apple AirPods 4 Wireless Earbuds</title>${head}</head><body>${body}</body></html>`;

const REAL_URL = "https://m.media-amazon.com/images/I/61iBtxCUabL._AC_SL1500_.jpg";

test("real amazon dp page shape: #landingImage data-old-hires is extracted (hi-res wins)", () => {
  const html = page("", `<div id="imgTagWrapperId">${REAL_TAG}</div>`);
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, REAL_URL);
});

test("attribute order reversed: data-old-hires before id still extracted", () => {
  const html = page(
    "",
    `<img data-old-hires="${REAL_URL}" id="landingImage" src="https://m.media-amazon.com/images/I/61iBtxCUabL._AC_SX342_.jpg" alt="x">`
  );
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, REAL_URL);
});

test("og:image still wins when present (existing behavior preserved)", () => {
  const html = page(
    `<meta property="og:image" content="https://example.com/og.jpg">`,
    `<img id="landingImage" data-old-hires="${REAL_URL}" src="${REAL_URL}" alt="x">`
  );
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, "https://example.com/og.jpg");
});

test("src used when data-old-hires missing but src is a real media-amazon image", () => {
  const src = "https://m.media-amazon.com/images/I/61iBtxCUabL._AC_SX342_.jpg";
  const html = page("", `<img id="landingImage" src="${src}" alt="x">`);
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, src);
});

test("no image anywhere: null (honest null kept, nothing invented)", () => {
  const html = page("", `<div id="reviews"><p>Great product.</p></div>`);
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, null);
});

test("landingImage with non-product src (sprite/data URI): null", () => {
  const html = page(
    "",
    `<img id="landingImage" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="x">`
  );
  const ev = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(ev.image, null);
});

test("end to end: extracted image flows into listing evidence and the brief model", () => {
  const html = page("", `<div id="imgTagWrapperId">${REAL_TAG}</div>`);
  const pageIdentity = extractProductEvidenceFromHtml(html, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  const adopted = adoptPrimaryPageIdentity(
    { exactListingTitle: null, rating: null, reviewCount: null },
    { title: "Apple AirPods 4", brand: null, model: null, rating: 4.4, reviewCount: 2345, image: pageIdentity.image, url: "https://www.amazon.ca/dp/B0DGJDKHRQ" }
  );
  assert.equal(adopted.imageUrl, REAL_URL);
  const result = { reviewEvidence: { listingEvidence: adopted }, product: {} };
  assert.equal(briefImageUrl(result, null), REAL_URL);
});

test("adopt never overwrites an existing imageUrl", () => {
  const adopted = adoptPrimaryPageIdentity(
    { exactListingTitle: "T", imageUrl: "https://example.com/keep.jpg" },
    { title: "T", brand: null, model: null, rating: null, reviewCount: null, image: REAL_URL, url: null }
  );
  assert.equal(adopted.imageUrl, "https://example.com/keep.jpg");
});

test("adopt with null image keeps evidence honest (no imageUrl invented)", () => {
  const adopted = adoptPrimaryPageIdentity(
    { exactListingTitle: "T" },
    { title: "T", brand: null, model: null, rating: null, reviewCount: null, image: null, url: null }
  );
  assert.equal(adopted.imageUrl ?? null, null);
});
