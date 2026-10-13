import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const jiti = require("jiti")(process.cwd(), {
  alias: { "@": process.cwd() },
});

const {
  extractProductIdentityTokenRoles,
  stableProductSearchTerms,
} = jiti("./lib/productIdentityTokens.ts");

test("explicit RingConn brand cannot be replaced by Gen from the title", () => {
  const input = {
    brand: "RingConn",
    productName:
      "RingConn Gen 2 Air Smart Ring 10-Day Battery IP68 Ultra Thin Sleep Fitness",
    model: null,
  };

  const roles = extractProductIdentityTokenRoles(input);
  const stable = stableProductSearchTerms(input);

  assert.equal(
    roles.primaryBrand.toLowerCase(),
    "ringconn",
  );

  assert.ok(
    stable.brands.some(
      (brand) => brand.toLowerCase() === "ringconn",
    ),
  );

  assert.equal(
    stable.brands.some(
      (brand) => brand.toLowerCase() === "gen",
    ),
    false,
  );

  assert.equal(
    roles.primaryBrand.toLowerCase() === "gen",
    false,
  );
});

test("ordinary second title token does not displace an explicit brand", () => {
  const roles = extractProductIdentityTokenRoles({
    brand: "Philips",
    productName:
      "Philips 5000 Series Dual Basket Airfryer NA555/00",
    model: "NA555/00",
  });

  assert.equal(
    roles.primaryBrand.toLowerCase(),
    "philips",
  );
});
