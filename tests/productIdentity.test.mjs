import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const { parseProductLink, canonicalKey, decideIdentity } = jiti(root + "lib/productIdentity.ts");
const { libraryProductKeyFor } = jiti(root + "lib/productReviewLibrary.ts");

const ok = (parsed) => {
  assert.equal(parsed.ok, true, `expected ok parse, got ${JSON.stringify(parsed)}`);
  return parsed;
};
const fail = (parsed) => {
  assert.equal(parsed.ok, false, `expected failed parse, got ${JSON.stringify(parsed)}`);
  return parsed;
};

test("canonicalKey matches the library key space exactly", () => {
  assert.equal(canonicalKey("www.amazon.ca", "b0dgjdkhrq"), "amazon.ca:B0DGJDKHRQ");
  assert.equal(canonicalKey("amazon.ca", "B0DGJDKHRQ"), "amazon.ca:B0DGJDKHRQ");
  // Cross-check against the real library key function for the same inputs.
  assert.equal(
    libraryProductKeyFor({
      asin: "B0DGJDKHRQ",
      store: "amazon.ca",
      listingUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    }),
    canonicalKey("amazon.ca", "B0DGJDKHRQ")
  );
});

test("same ASIN under different Amazon URL shapes collapses to one key", () => {
  const urls = [
    "https://www.amazon.ca/dp/B0DGJDKHRQ",
    "https://www.amazon.ca/Apple-AirPods-4/dp/B0DGJDKHRQ/ref=sr_1_1?keywords=airpods&th=1&psc=1",
    "https://amazon.ca/gp/product/B0DGJDKHRQ",
    "https://m.amazon.ca/dp/B0DGJDKHRQ?tag=aff-20&utm_source=newsletter",
    "https://www.amazon.com/dp/B0DGJDKHRQ?th=1",
  ];
  const keys = urls.map((u) => ok(parseProductLink(u)).canonicalKey);
  assert.ok(keys.slice(0, 4).every((k) => k === "amazon.ca:B0DGJDKHRQ"), keys.join(","));
  assert.equal(keys[4], "amazon.com:B0DGJDKHRQ"); // different TLD = different marketplace, by design
});

test("tracking params are stripped from cleanedUrl; variant params kept", () => {
  const parsed = ok(
    parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ/ref=sr_1_1?th=1&psc=1&utm_source=x&tag=a-20")
  );
  assert.ok(!parsed.cleanedUrl.includes("utm_source"), parsed.cleanedUrl);
  assert.ok(!parsed.cleanedUrl.includes("tag="), parsed.cleanedUrl);
  assert.ok(!parsed.cleanedUrl.includes("/ref="), parsed.cleanedUrl);
  assert.ok(parsed.cleanedUrl.includes("/dp/B0DGJDKHRQ"), parsed.cleanedUrl);
});

test("variant URLs share the canonical key but keep variant attributes separate", () => {
  const pink = ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ?color=pink"));
  const black = ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ?color=black&size=large"));
  assert.equal(pink.canonicalKey, "amazon.ca:B0DGJDKHRQ");
  assert.equal(black.canonicalKey, "amazon.ca:B0DGJDKHRQ");
  assert.equal(pink.variant.color, "pink");
  assert.equal(black.variant.color, "black");
  assert.equal(black.variant.size, "large");
  const d = decideIdentity(pink, black);
  assert.equal(d.verdict, "same_product_different_variant");
  assert.equal(d.reason, "variant_attribute_mismatch:color");
  // Same link twice: same product.
  const same = decideIdentity(pink, pink);
  assert.equal(same.verdict, "same_product");
  assert.equal(same.reason, "same_marketplace_identifier");
});

test("different identifiers are different products", () => {
  const a = ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ"));
  const b = ok(parseProductLink("https://www.amazon.ca/dp/B097RG67QB"));
  const d = decideIdentity(a, b);
  assert.equal(d.verdict, "different_product");
  assert.equal(d.reason, "different_identifier");
});

test("different marketplaces never match", () => {
  const a = ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ"));
  const b = ok(parseProductLink("https://www.amazon.com/dp/B0DGJDKHRQ"));
  const d = decideIdentity(a, b);
  assert.equal(d.verdict, "different_product");
  assert.equal(d.reason, "different_marketplace");
});

test("matching titles across variant ASINs read as variants of one product", () => {
  const a = { ...ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ")), titleHint: "Apple AirPods 4 Wireless Earbuds with Active Noise Cancellation" };
  const b = { ...ok(parseProductLink("https://www.amazon.ca/dp/B0DXYZ1234")), titleHint: "Apple AirPods 4 Wireless Earbuds with Active Noise Cancellation" };
  const d = decideIdentity(a, b);
  assert.equal(d.verdict, "same_product_different_variant");
  assert.equal(d.reason, "same_title_different_identifier");
  const c = { ...ok(parseProductLink("https://www.amazon.ca/dp/B0DXYZ1234")), titleHint: "DREO Space Heater 1500W" };
  const d2 = decideIdentity(a, c);
  assert.equal(d2.verdict, "different_product");
  assert.equal(d2.reason, "different_identifier");
});

test("Walmart / Best Buy / Target / Home Depot shapes parse", () => {
  const w = ok(parseProductLink("https://www.walmart.com/ip/Apple-AirPods-4-Wireless-Earbuds/123456789?athbdg=1"));
  assert.equal(w.marketplace, "walmart.com");
  assert.equal(w.identifier, "123456789");
  assert.equal(w.canonicalKey, "walmart.com:123456789");

  const wca = ok(parseProductLink("https://www.walmart.ca/en/ip/6000201234567"));
  assert.equal(wca.marketplace, "walmart.ca");

  const bb = ok(
    parseProductLink("https://www.bestbuy.com/site/apple-airpods-4/J79234567.p?skuId=79234567&intl=nosplash")
  );
  assert.equal(bb.marketplace, "bestbuy.com");
  assert.equal(bb.identifier, "J79234567");
  assert.ok(!bb.cleanedUrl.includes("skuId"), bb.cleanedUrl);

  const t = ok(parseProductLink("https://www.target.com/p/apple-airpods-4/-/A-98765432?tcref=abc"));
  assert.equal(t.marketplace, "target.com");
  assert.equal(t.identifier, "98765432");
  assert.equal(t.canonicalKey, "target.com:98765432");

  const hd = ok(parseProductLink("https://www.homedepot.com/p/DREO-Space-Heater-1500W/123456789"));
  assert.equal(hd.marketplace, "homedepot.com");
  assert.equal(hd.identifier, "123456789");
});

test("non-product links fail cleanly with named reasons", () => {
  assert.equal(fail(parseProductLink("https://www.amazon.ca/s?k=airpods")).reason, "no_identifier_in_url");
  assert.equal(fail(parseProductLink("https://example.com/some-product")).reason, "unsupported_marketplace");
  assert.equal(fail(parseProductLink("::::")).reason, "not_a_url");
  assert.equal(fail(parseProductLink("")).reason, "empty_link");
  assert.equal(fail(parseProductLink(null)).reason, "empty_link");
});

test("unparseable links in decideIdentity are different products, never a guess", () => {
  const a = ok(parseProductLink("https://www.amazon.ca/dp/B0DGJDKHRQ"));
  const bad = parseProductLink("https://example.com/nope");
  const d = decideIdentity(a, bad);
  assert.equal(d.verdict, "different_product");
  assert.equal(d.reason, "unparseable_link");
});
