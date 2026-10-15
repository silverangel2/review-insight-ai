import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const {
  libraryProductKeyFor,
  loadLibraryCorpus,
  saveLibraryCorpus,
} = jiti(root + "lib/productReviewLibrary.ts");

// These tests run with fake/absent Supabase env values only (never the
// production database): storage must fail soft in every case.

test("library key uses the canonical marketplace identifier", () => {
  assert.equal(
    libraryProductKeyFor({
      asin: "B0DGJDKHRQ",
      canonicalMarketplace: "amazon.ca",
      listingUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    }),
    "amazon.ca:B0DGJDKHRQ"
  );
});

test("library key can be derived from the listing URL alone", () => {
  assert.equal(
    libraryProductKeyFor({ listingUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ" }),
    "amazon.ca:B0DGJDKHRQ"
  );
  assert.equal(
    libraryProductKeyFor({ listingUrl: "https://www.amazon.com/gp/product/B0DGJDKHRQ" }),
    "amazon.com:B0DGJDKHRQ"
  );
});

test("library key refuses fuzzy identities", () => {
  assert.equal(
    libraryProductKeyFor({ store: "Walmart.ca", listingUrl: "https://www.walmart.ca/en/ip/123" }),
    null
  );
  assert.equal(libraryProductKeyFor({}), null);
  assert.equal(libraryProductKeyFor({ asin: "B0DGJDKHRQ" }), null);
});

test("load fails soft to an empty entry when storage is unavailable", async () => {
  const entry = await loadLibraryCorpus("amazon.ca:B0DGJDKHRQ");
  assert.equal(entry.productKey, "amazon.ca:B0DGJDKHRQ");
  assert.deepEqual(entry.reviews, []);
  assert.equal(entry.scanCount, 0);
});

test("save reports false (never throws) when storage is unavailable", async () => {
  const saved = await saveLibraryCorpus({
    productKey: "amazon.ca:B0DGJDKHRQ",
    corpus: [{ body: "A real review body.", rating: 5 }],
    previousScanCount: 0,
  });
  assert.equal(saved, false);
});

test("save refuses an empty corpus", async () => {
  const saved = await saveLibraryCorpus({
    productKey: "amazon.ca:B0DGJDKHRQ",
    corpus: [],
    previousScanCount: 3,
  });
  assert.equal(saved, false);
});
