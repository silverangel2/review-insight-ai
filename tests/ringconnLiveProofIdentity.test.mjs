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

test("RingConn live-proof title resolves Gen 2 Air without marketing pollution", () => {
  const input = {
    brand: "RingConn",
    productName:
      "RingConn Gen 2 Air Ultra-Thin AI Smart Ring 10-Day Battery Life Fitness Sleep Stress Women s Health Tracker IP68 Waterproof Compatible with Android iOS Size 10 Galaxy Silver",
    model: null,
  };

  const roles = extractProductIdentityTokenRoles(input);
  const stable = stableProductSearchTerms(input);

  assert.equal(
    roles.primaryBrand.toLowerCase(),
    "ringconn",
  );

  assert.deepEqual(
    stable.models.map((value) => value.toLowerCase()),
    ["gen 2 air"],
  );

  const modelTokens = stable.models
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const forbiddenToken of [
    "ai",
    "ultra",
    "thin",
    "battery",
    "fitness",
    "sleep",
    "stress",
    "ip68",
  ]) {
    assert.equal(
      modelTokens.includes(forbiddenToken),
      false,
      `${forbiddenToken} must not become model identity`,
    );
  }

  const modelText = stable.models.join(" ").toLowerCase();

  assert.equal(
    /\b10[- ]?day\b/i.test(modelText),
    false,
    "10-Day must not become model identity",
  );
});

test("candidate RingConn Gen 2 Air title resolves the same model when brand context is supplied", () => {
  const stable = stableProductSearchTerms({
    brand: "RingConn",
    productName:
      "RingConn Gen 2 Air, Ultra-Thin AI Smart Ring, 10-Day Battery Life, Fitness/Sleep/Stress/Women's Health Tracker, IP68 Waterproof Health Ring, Compatible with Android & iOS(Size 10, Dune Gold)",
    model: null,
  });

  assert.deepEqual(
    stable.models.map((value) => value.toLowerCase()),
    ["gen 2 air"],
  );
});

test("RingConn Gen 2 and Gen 3 remain distinct from Gen 2 Air", () => {
  const gen2 = stableProductSearchTerms({
    brand: "RingConn",
    productName:
      "RingConn Gen 2 Smart Ring No App Subscription",
    model: null,
  });

  const gen3 = stableProductSearchTerms({
    brand: "RingConn",
    productName:
      "RingConn Gen 3 Smart Ring 14-Day Battery Life",
    model: null,
  });

  assert.notDeepEqual(
    gen2.models.map((value) => value.toLowerCase()),
    ["gen 2 air"],
  );

  assert.notDeepEqual(
    gen3.models.map((value) => value.toLowerCase()),
    ["gen 2 air"],
  );
});
