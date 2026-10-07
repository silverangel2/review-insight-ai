import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const jiti = require("jiti")(process.cwd(), {
  alias: { "@": process.cwd() },
});

const {
  isProductUrl,
  normalizeProductUrl,
} = jiti("./lib/productUrlRetrieval.ts");

test("manufacturer product pages survive retrieval candidate filtering", () => {
  assert.equal(
    isProductUrl(
      "https://ringconn.com/products/ringconn-gen-2-air",
    ),
    true,
  );

  assert.equal(
    isProductUrl(
      "https://www.usa.philips.com/c-p/NA555_00/5000-series-dual-basket-airfryer",
    ),
    true,
  );

  assert.equal(
    isProductUrl(
      "https://example.com/product/model-alpha-500",
    ),
    true,
  );
});

test("known retailer product pages remain accepted", () => {
  assert.equal(
    isProductUrl(
      "https://www.amazon.ca/dp/B07Y5V5Y5Y",
    ),
    true,
  );

  assert.equal(
    isProductUrl(
      "https://www.walmart.ca/en/ip/example-product/6000200000000",
    ),
    true,
  );
});

test("search, social, category, and generic pages remain rejected", () => {
  assert.equal(
    isProductUrl(
      "https://www.google.com/search?q=RingConn+Gen+2",
    ),
    false,
  );

  assert.equal(
    isProductUrl(
      "https://www.reddit.com/r/RingConn/comments/example/product_review",
    ),
    false,
  );

  assert.equal(
    isProductUrl(
      "https://ringconn.com/collections/smart-rings",
    ),
    false,
  );

  assert.equal(
    isProductUrl(
      "https://ringconn.com/",
    ),
    false,
  );
});

test("Bing redirect normalization still exposes the underlying product URL", () => {
  const target =
    "https://ringconn.com/products/ringconn-gen-2-air";

  const wrapped =
    "https://www.bing.com/ck/a?url=" +
    encodeURIComponent(target);

  assert.equal(normalizeProductUrl(wrapped), target);
  assert.equal(
    isProductUrl(normalizeProductUrl(wrapped)),
    true,
  );
});
