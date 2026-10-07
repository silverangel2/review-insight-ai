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

test("RingConn keeps Gen 2 Air as named model and rejects specification identity", () => {
  const input = {
    brand: "RingConn",
    productName:
      "RingConn Gen 2 Air Smart Ring 10-Day Battery IP68 Ultra Thin Sleep Fitness",
    model: null,
  };

  const roles = extractProductIdentityTokenRoles(input);
  const stable = stableProductSearchTerms(input);

  assert.equal(roles.primaryBrand, "ringconn");

  assert.deepEqual(
    stable.models.map((value) => value.toLowerCase()),
    ["gen 2 air"],
  );

  assert.equal(
    stable.models.some((value) =>
      /10-day|ip68|ultra/i.test(value),
    ),
    false,
  );

  assert.equal(
    stable.family
      .toLowerCase()
      .includes("gen"),
    false,
  );
});

test("Roborock named model phrase remains stable", () => {
  const stable = stableProductSearchTerms({
    brand: "Roborock",
    productName:
      "Roborock Qrevo S Pro Robot Vacuum 2026 18500Pa",
    model: null,
  });

  assert.deepEqual(
    stable.models.map((value) => value.toLowerCase()),
    ["qrevo s pro"],
  );
});

test("Kenmore capacity and appliance descriptors do not become a model", () => {
  const stable = stableProductSearchTerms({
    brand: "Kenmore",
    productName:
      "Kenmore 7.0 cu. ft. Front Load Electric Dryer",
    model: null,
  });

  assert.equal(
    stable.models.some((value) =>
      /7\.0|cu|ft|front|load|electric/i.test(value),
    ),
    false,
  );
});

test("explicit Philips model remains authoritative", () => {
  const stable = stableProductSearchTerms({
    brand: "Philips",
    productName:
      "Philips 5000 Series Dual Basket Airfryer NA555/00",
    model: "NA555/00",
  });

  assert.ok(
    stable.models.some((value) =>
      /na555/i.test(value),
    ),
  );
});
