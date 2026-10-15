// Seller import lane + product review library wiring (Phase 3).
// No OpenAI anywhere in the lane; storage-unconfigured tests must leave
// everything failing soft, exactly as the scan path behaves.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const sellerLibrary = jiti(root + "lib/sellerLibrary.ts");
const productLibrary = jiti(root + "lib/productReviewLibrary.ts");

const {
  SELLER_LIBRARY_PROVENANCE,
  sellerAsinFromRows,
  sellerLibraryKeyFor,
  sellerRowsToLibraryRecords,
  mergeSellerReviewSets,
  buildSellerLibraryWrite,
  persistSellerImportToLibrary,
} = sellerLibrary;

const rowsFor = (overrides = {}) => [
  {
    "review text": "The sound quality is clear and they connect to my iPhone very quickly every time.",
    rating: "5",
    "review date": "October 1, 2026",
    asin: "B0DGJDKHRQ",
    ...overrides,
  },
  {
    "review text": "Battery life is not what they advertise, had to return mine after a week.",
    rating: "2",
    "review date": "October 3, 2026",
    ...overrides,
  },
];

test("provenance marker is seller_csv_import", () => {
  assert.equal(SELLER_LIBRARY_PROVENANCE, "seller_csv_import");
});

test("library key: amazon link alone (marketplace from hostname)", () => {
  assert.equal(
    sellerLibraryKeyFor({ productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ" }),
    "amazon.ca:B0DGJDKHRQ"
  );
});

test("library key: walmart link + asin column (hostname marketplace, not bare store name)", () => {
  assert.equal(
    sellerLibraryKeyFor({
      productLink: "https://www.walmart.ca/en/ip/trail-bottle/600020176",
      asin: sellerAsinFromRows([{ asin: "600020176" }]),
    }),
    "walmart.ca:600020176"
  );
  assert.equal(
    sellerLibraryKeyFor({
      productLink: "https://www.walmart.ca/en/ip/trail-bottle/600020176",
    }),
    null
  );
});

test("library key: no identity without a product link", () => {
  assert.equal(sellerLibraryKeyFor({ asin: "B0DGJDKHRQ" }), null);
  assert.equal(sellerLibraryKeyFor({}), null);
  assert.equal(sellerLibraryKeyFor({ productLink: "not a url" }), null);
  assert.equal(sellerLibraryKeyFor({ productLink: "https://www.amazon.ca/" }), null);
});

test("asin column is read case-insensitively, first non-empty wins", () => {
  assert.equal(sellerAsinFromRows([{ ASIN: "b0d1xd1zv3" }]), "B0D1XD1ZV3");
  assert.equal(sellerAsinFromRows([{ name: "x" }, { asin: "B0DGJDKHRQ" }]), "B0DGJDKHRQ");
  assert.equal(sellerAsinFromRows([{ name: "x" }]), null);
});

test("buildSellerLibraryWrite: no consent means no write", () => {
  assert.equal(
    buildSellerLibraryWrite({
      consent: false,
      productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ",
      rows: rowsFor(),
      productName: "Apple AirPods 4",
    }),
    null
  );
});

test("buildSellerLibraryWrite: consent + identity maps rows to corpus records", () => {
  const write = buildSellerLibraryWrite({
    consent: true,
    productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    rows: rowsFor(),
    productName: "Apple AirPods 4",
  });
  assert.ok(write);
  assert.equal(write.productKey, "amazon.ca:B0DGJDKHRQ");
  assert.equal(write.corpus.length, 2);
  const [first] = write.corpus;
  assert.equal(first.provenance, "seller_csv_import");
  assert.equal(first.source, "amazon.ca");
  assert.equal(first.sourceUrl, "https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(first.rating, 5);
  assert.ok(first.body.length >= 20);
  assert.ok(first.id.startsWith("seller-csv-"));
});

test("buildSellerLibraryWrite: unreadable rows are dropped; empty corpus refuses the write", () => {
  const write = buildSellerLibraryWrite({
    consent: true,
    productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    rows: [{ foo: "bar" }, { "review text": "too short" }],
    productName: null,
  });
  assert.equal(write, null);
});

test("buildSellerLibraryWrite never throws on junk input", () => {
  assert.equal(
    buildSellerLibraryWrite({ consent: true, productLink: null, rows: [], productName: null }),
    null
  );
  assert.equal(
    buildSellerLibraryWrite({ consent: true, productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ", rows: [null, undefined, "x"] }),
    null
  );
});

test("sellerRowsToLibraryRecords parses ratings and verified flags", () => {
  const [rec] = sellerRowsToLibraryRecords(
    [
      {
        comment: "Decent for the price, does what it says on the box every single day.",
        stars: "4 stars",
        "verified purchase": "yes",
      },
    ],
    { productLink: "https://www.bestbuy.ca/en-ca/product/x/6505432" }
  );
  assert.equal(rec.rating, 4);
  assert.equal(rec.verified, true);
  assert.equal(rec.provenance, "seller_csv_import");
});

test("mergeSellerReviewSets dedupes by body across lanes and respects the cap", () => {
  const stored = [
    { id: "scan-1", body: "The sound quality is clear and they connect fast.", provenance: "amazon-link-scan" },
    { id: "scan-2", body: "Another stored review body with plenty of real words.", provenance: "amazon-link-scan" },
  ];
  const fresh = [
    { id: "seller-csv-1", body: "THE SOUND QUALITY is clear   and they connect fast.", provenance: "seller_csv_import" },
    { id: "seller-csv-2", body: "A brand new seller row with plenty of real review words here.", provenance: "seller_csv_import" },
  ];
  const merged = mergeSellerReviewSets(fresh, stored);
  // fresh-first: seller-csv-1 deduped against scan-1 by normalized body
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, "seller-csv-1");
  assert.ok(!merged.some((r) => r.id === "scan-1"));
  const capped = mergeSellerReviewSets(
    fresh,
    Array.from({ length: 600 }, (_, i) => ({ id: `s-${i}`, body: `stored review body number ${i} with real words` }))
  );
  assert.equal(capped.length, productLibrary.LIBRARY_CORPUS_CAP);
});

test("persistSellerImportToLibrary fails soft (never throws) when storage is unavailable", async () => {
  const write = buildSellerLibraryWrite({
    consent: true,
    productLink: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    rows: rowsFor(),
    productName: "Apple AirPods 4",
  });
  assert.ok(write);
  const saved = await persistSellerImportToLibrary(write);
  assert.equal(saved, false);
});
