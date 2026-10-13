import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const jiti = require("jiti")(process.cwd(), {
  alias: { "@": process.cwd() },
});

const {
  isVerifiableManufacturerProductUrl,
} = jiti("./lib/exactProductSearch.ts");

test("manufacturer product pages may reach exact-product verification", () => {
  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://www.usa.philips.com/c-p/NA555_00/5000-series-dual-basket-airfryer",
    ),
    true,
  );

  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://example.com/products/model-alpha-500",
    ),
    true,
  );

  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://example.com/product/model-alpha-500",
    ),
    true,
  );
});

test("search, social, and generic pages do not become product candidates", () => {
  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://www.google.com/search?q=Philips+NA555",
    ),
    false,
  );

  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://www.reddit.com/r/airfryer/comments/example/product_review",
    ),
    false,
  );

  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://example.com/search/products?q=alpha",
    ),
    false,
  );

  assert.equal(
    isVerifiableManufacturerProductUrl(
      "https://example.com/",
    ),
    false,
  );
});
