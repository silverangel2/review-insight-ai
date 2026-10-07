import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../", import.meta.url).pathname);
const { uniqueAttemptedHttpSources } = jiti("./lib/retrievalSourceMetrics.ts");

test("discovered but unfetched URLs are excluded", () => {
  const fetched = uniqueAttemptedHttpSources([
    "https://example.test/review/one",
    "https://example.test/review/two",
  ]);
  assert.deepEqual(fetched, [
    "https://example.test/review/one",
    "https://example.test/review/two",
  ]);
});

test("duplicate fetch attempts count once", () => {
  assert.deepEqual(
    uniqueAttemptedHttpSources([
      "https://example.test/review/one",
      "https://example.test/review/one#fragment",
      "HTTPS://EXAMPLE.TEST/review/one",
    ]),
    ["https://example.test/review/one"]
  );
});

test("failed and successful HTTP retrieval attempts both count", () => {
  assert.deepEqual(
    uniqueAttemptedHttpSources([
      "https://example.test/failed",
      "https://example.test/success",
    ]),
    ["https://example.test/failed", "https://example.test/success"]
  );
});

test("queries labels metadata and candidate strings do not count", () => {
  assert.deepEqual(
    uniqueAttemptedHttpSources([
      "native-search:bing:TEST PRODUCT reviews",
      "TEST PRODUCT reviews",
      "Amazon.ca",
      "B0TEST1234",
      44,
      null,
    ]),
    []
  );
});
