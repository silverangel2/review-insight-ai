// Rescue Prep tests: pack builds from a sample queue item with every
// section present; prep code runs without error when the migration's
// storage is absent (fail-soft path asserted).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js");

const prep = jiti(root + "lib/rescuePrep.ts");

test("parseProductLink: amazon dp URL", () => {
  const p = prep.parseProductLink("https://www.amazon.ca/dp/B07WXQ3GVS?th=1");
  assert.deepEqual(p, {
    marketplace: "amazon.ca",
    identifier: "B07WXQ3GVS",
    canonicalKey: "amazon.ca:B07WXQ3GVS",
  });
});

test("parseProductLink: amazon.com gp/product and asin param forms", () => {
  const p1 = prep.parseProductLink("https://www.amazon.com/gp/product/B0DGJDKHRQ/ref=abc");
  assert.equal(p1.canonicalKey, "amazon.com:B0DGJDKHRQ");
  // Canonical identity rule (lib/productIdentity.ts, the single parser):
  // a bare ?asin= on a non-product path is never parsed — no guess.
  assert.equal(prep.parseProductLink("https://www.amazon.ca/something?asin=B097RG67QB"), null);
});

test("parseProductLink: walmart, bestbuy, target, homedepot", () => {
  assert.equal(prep.parseProductLink("https://www.walmart.com/ip/12345678").canonicalKey, "walmart.com:12345678");
  // Canonical identity rule: the Best Buy J-prefix is part of the identifier.
  assert.equal(prep.parseProductLink("https://www.bestbuy.com/site/sony/sku/J6364821?skuId=6364821").canonicalKey, "bestbuy.com:J6364821");
  assert.equal(prep.parseProductLink("https://www.target.com/p/-/A-98765432").canonicalKey, "target.com:98765432");
  assert.ok(prep.parseProductLink("https://www.homedepot.com/p/1500W-Space-Heater-HD1500/310123456").canonicalKey.startsWith("homedepot.com:"));
});

test("parseProductLink: garbage and non-links return null", () => {
  assert.equal(prep.parseProductLink(""), null);
  assert.equal(prep.parseProductLink("not a url"), null);
  assert.equal(prep.parseProductLink("ftp://example.com/x"), null);
  assert.equal(prep.parseProductLink("https://example.com/product"), null);
  assert.equal(prep.parseProductLink(null), null);
});

const sampleItem = () => ({
  id: "queue-uuid-1",
  scan_ref: "scan_rescue_001",
  account_email: "shopper@example.com",
  product_key: null,
  product_name: "Weighted Idea Weighted Blanket",
  product_url: "https://www.amazon.ca/dp/B07WXQ3GVS",
  reason: "insufficient written reviews",
  created_at: "2026-10-16T10:00:00Z",
});

const sampleEvidence = () => ({
  libraryCorpusSize: 0,
  libraryScanCount: 0,
  priorScans: [],
  aggregate: { rating: 4.3, count: 9805 },
});

test("buildRescuePrep: all sections present, plain language", () => {
  const pack = prep.buildRescuePrep(sampleItem(), sampleEvidence());
  assert.equal(pack.queueId, "queue-uuid-1");
  assert.equal(pack.scanRef, "scan_rescue_001");
  assert.equal(pack.productName, "Weighted Idea Weighted Blanket");
  assert.equal(pack.productKey, "amazon.ca:B07WXQ3GVS");
  assert.equal(pack.customerWaiting, true);
  assert.equal(pack.accountEmail, "shopper@example.com");
  assert.ok(Array.isArray(pack.whatWeHold) && pack.whatWeHold.length >= 3, "whatWeHold present");
  assert.ok(Array.isArray(pack.whatsMissing) && pack.whatsMissing.length >= 1, "whatsMissing present");
  assert.ok(pack.suggestedFirstStep.length > 20, "suggestedFirstStep present");
  assert.ok(pack.whatWeHold.join(" ").includes("9,805"), "aggregate snapshot in the pack");
  assert.ok(pack.whatsMissing.join(" ").match(/review/i), "missing reviews named");
});

test("buildRescuePrep: prior scans and corpus surface in whatWeHold", () => {
  const pack = prep.buildRescuePrep(sampleItem(), {
    libraryCorpusSize: 54,
    libraryScanCount: 2,
    priorScans: [{ verdict: "Wait", score: 72, createdAt: "2026-10-15T10:00:00Z" }],
    aggregate: { rating: 4.3, count: 9805 },
  });
  const held = pack.whatWeHold.join(" ");
  assert.match(held, /54 written reviews/);
  assert.match(held, /1 previous scan/);
});

test("prepareRescuePack: fail-soft when the migration storage is absent", async () => {
  const fakeStore = {
    loadRescueQueueItem: async () => sampleItem(),
    loadLibraryCorpusSize: async () => ({ size: 0, scanCount: 0 }),
    loadPriorScans: async () => [],
    loadAggregateSnapshot: async () => ({ rating: 4.3, count: 9805 }),
    loadPrepPack: async () => null,
    savePrepPack: async () => false, // table absent → fail soft
  };
  const result = await prep.prepareRescuePack("scan_rescue_001", fakeStore);
  assert.equal(result.ok, true);
  assert.equal(result.stored, false);
  assert.equal(result.alreadyStored, false);
  assert.ok(result.pack, "pack still returned");
  assert.equal(result.pack.productKey, "amazon.ca:B07WXQ3GVS");
  assert.ok(result.notes.join(" ").match(/not provisioned/), "absence noted");
});

test("prepareRescuePack: idempotent — existing pack is reused, not rebuilt", async () => {
  let saves = 0;
  const existing = { queueId: "queue-uuid-1", scanRef: "scan_rescue_001", productKey: "amazon.ca:B07WXQ3GVS" };
  const fakeStore = {
    loadRescueQueueItem: async () => sampleItem(),
    loadLibraryCorpusSize: async () => ({ size: null, scanCount: null }),
    loadPriorScans: async () => [],
    loadAggregateSnapshot: async () => null,
    loadPrepPack: async () => existing,
    savePrepPack: async () => {
      saves += 1;
      return true;
    },
  };
  const result = await prep.prepareRescuePack("scan_rescue_001", fakeStore);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyStored, true);
  assert.equal(result.pack, existing);
  assert.equal(saves, 0);
});

test("prepareRescuePack: store failures degrade to unknowns, never throw", async () => {
  const fakeStore = {
    loadRescueQueueItem: async () => sampleItem(),
    loadLibraryCorpusSize: async () => {
      throw new Error("db down");
    },
    loadPriorScans: async () => {
      throw new Error("db down");
    },
    loadAggregateSnapshot: async () => {
      throw new Error("db down");
    },
    loadPrepPack: async () => null,
    savePrepPack: async () => {
      throw new Error("no such table");
    },
  };
  const result = await prep.prepareRescuePack("scan_rescue_001", fakeStore);
  assert.equal(result.ok, true);
  assert.ok(result.pack, "pack built despite every loader failing");
  assert.ok(result.pack.whatWeHold.join(" ").match(/couldn't check/), "unknowns stay honest");
  assert.ok(result.pack.whatsMissing.length >= 1);
  assert.equal(result.stored, false);
});

test("prepareRescuePack: missing queue item → not ok, no throw", async () => {
  const fakeStore = {
    loadRescueQueueItem: async () => null,
    loadLibraryCorpusSize: async () => ({ size: null, scanCount: null }),
    loadPriorScans: async () => [],
    loadAggregateSnapshot: async () => null,
    loadPrepPack: async () => null,
    savePrepPack: async () => false,
  };
  const result = await prep.prepareRescuePack("scan_nope", fakeStore);
  assert.equal(result.ok, false);
  assert.equal(result.pack, null);
});
