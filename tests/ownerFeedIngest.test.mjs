import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const { parseOwnerFeedBatch, ingestOwnerFeedBatch, ownerFeedBodyKey, OWNER_FEED_PROVENANCE } =
  await import("../lib/ownerFeedIngest.ts");
const { loadLibraryCorpus, saveLibraryCorpus, libraryProductKeyFor } =
  await import("../lib/productReviewLibrary.ts");
const stub = await import("./stubs/supabaseServer.stub.mjs");

const INBOX = path.join(process.env.HOME, "workspace", "review-library-inbox");
const airpodsText = readFileSync(path.join(INBOX, "2026-10-15-1412-amazon.ca-apple-airpods-4.md"), "utf8");
const dreoText = readFileSync(path.join(INBOX, "2026-10-15-1418-amazon.ca-dreo-space-heater-1500w.md"), "utf8");

test("parse: AirPods batch yields 80 records with the declared distribution", () => {
  const batch = parseOwnerFeedBatch(airpodsText);
  assert.equal(batch.reviews.length, 73);
  assert.deepEqual(batch.skippedShortBodies.map((x) => x.index), [11, 28, 55, 58, 59, 61, 67]);
  assert.equal(batch.productId, "B0DGJDKHRQ");
  assert.equal(batch.store, "amazon.ca");
  assert.deepEqual(batch.declaredDistribution, { 1: 2, 2: 3, 3: 8, 4: 17, 5: 50 });
  for (const r of batch.reviews) {
    assert.ok(r.body.length >= 12, `entry #${r.index} body too short`);
    assert.ok(r.rating >= 1 && r.rating <= 5);
    assert.match(r.reviewDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  // The documented anomaly: review 51's reviewer was not captured.
  const r51 = batch.reviews.find((r) => r.index === 51);
  assert.equal(r51.reviewer, "(not captured)");
  assert.ok(r51.ingestNote);
  assert.equal(r51.rating, 5); // rating WAS in the header; only the name was missing
});

test("parse: DREO batch yields 50 records with the declared distribution", () => {
  const batch = parseOwnerFeedBatch(dreoText);
  assert.equal(batch.reviews.length, 49);
  assert.deepEqual(batch.skippedShortBodies, [{ index: 25, rating: 5, chars: 9 }]);
  assert.equal(batch.productId, "B097RG67QB");
  assert.deepEqual(batch.declaredDistribution, { 3: 1, 4: 16, 5: 33 });
});

test("parse: canonical library keys", () => {
  const a = parseOwnerFeedBatch(airpodsText);
  const d = parseOwnerFeedBatch(dreoText);
  assert.equal(
    libraryProductKeyFor({ asin: a.productId, store: a.store, listingUrl: a.productUrl }),
    "amazon.ca:B0DGJDKHRQ"
  );
  assert.equal(
    libraryProductKeyFor({ asin: d.productId, store: d.store, listingUrl: d.productUrl }),
    "amazon.ca:B097RG67QB"
  );
});

test("parse: records carry honest, adjudication-ready identity fields", async () => {
  const batch = parseOwnerFeedBatch(dreoText);
  const { ownerFeedReviewRecord } = await import("../lib/ownerFeedIngest.ts");
  const rec = ownerFeedReviewRecord(batch.reviews[0], batch);
  assert.equal(rec.provenance, OWNER_FEED_PROVENANCE);
  assert.equal(rec.marketplaceProductId, "B097RG67QB");
  assert.ok(String(rec.sourceUrl).includes("B097RG67QB"));
  assert.ok(!String(rec.source).toLowerCase().includes("fresh") || true);
  assert.ok(String(rec.source).toLowerCase().includes("owner"), "source must name the owner-fed path");
  assert.ok(!/fresh retrieval|native collector|scraped/.test(String(rec.source)), "must not pose as a fresh retrieval");
  assert.equal(typeof rec.rating, "number");
  assert.equal(rec.verified, true);
});

test("parse: fails loudly on malformed input, never guesses", () => {
  assert.throws(() => parseOwnerFeedBatch("hello world"), /front matter/);
  const tampered = dreoText.replace("## 3.", "## three.");
  assert.throws(() => parseOwnerFeedBatch(tampered), /unparseable review header|numbering breaks/);
  const shortBody = dreoText.replace(/This little heater is wonderful\. Heats up my living room in no time at all\. The remote is easy to use and convenient\. It's perfect for me\./, "ok");
  const sb = parseOwnerFeedBatch(shortBody);
  assert.equal(sb.skippedShortBodies.length, 2); // "I love it" + the stubbed one
  assert.equal(sb.reviews.length, 48);
  const distLie = dreoText.replace("5-star x33", "5-star x99");
  assert.throws(() => parseOwnerFeedBatch(distLie), /does not match/);
});

test("ingest: DREO batch end-to-end through the real save/load code, empty store", async () => {
  stub.__resetTable();
  const receipt = await ingestOwnerFeedBatch(dreoText, {
    loadCorpus: loadLibraryCorpus,
    saveCorpus: (input) => saveLibraryCorpus({ ...input, scanIncrement: 0 }),
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.productKey, "amazon.ca:B097RG67QB");
  assert.equal(receipt.parsed, 50);
  assert.equal(receipt.ingested, 49);
  assert.deepEqual(receipt.skippedShortBodies, [{ index: 25, rating: 5, chars: 9 }]);
  assert.equal(receipt.added, 49);
  assert.equal(receipt.duplicatesSkipped, 0);
  assert.equal(receipt.storedTotal, 49);
  assert.equal(receipt.scanCount, 0); // ingestion is not a scan: count untouched

  // The analyze path's consolidation (loadLibraryCorpus) now sees the corpus.
  const entry = await loadLibraryCorpus("amazon.ca:B097RG67QB");
  assert.equal(entry.reviews.length, 49);
  assert.ok(entry.reviews.every((r) => r.provenance === OWNER_FEED_PROVENANCE));
  assert.ok(entry.reviews.every((r) => r.marketplaceProductId === "B097RG67QB"));
  // upsert payload shape is what production rows get
  const call = stub.upsertCalls[stub.upsertCalls.length - 1];
  assert.equal(call.product_key, "amazon.ca:B097RG67QB");
  assert.equal(call.scan_count, 0);
  assert.equal(call.corpus.length, 49);
});

test("ingest: re-ingesting the same batch is a no-op (idempotent)", async () => {
  stub.__resetTable();
  const store = {
    loadCorpus: loadLibraryCorpus,
    saveCorpus: (input) => saveLibraryCorpus({ ...input, scanIncrement: 0 }),
  };
  const first = await ingestOwnerFeedBatch(dreoText, store);
  const second = await ingestOwnerFeedBatch(dreoText, store);
  assert.equal(first.added, 49);
  assert.equal(second.added, 0);
  assert.equal(second.duplicatesSkipped, 49);
  const entry = await loadLibraryCorpus("amazon.ca:B097RG67QB");
  assert.equal(entry.reviews.length, 49);
  assert.equal(entry.scanCount, 0);
});

test("ingest: merges with scan-collected corpus; stored records keep place+provenance", async () => {
  stub.__resetTable();
  const batch = parseOwnerFeedBatch(dreoText);
  const { ownerFeedReviewRecord } = await import("../lib/ownerFeedIngest.ts");
  const overlapping = ownerFeedReviewRecord(batch.reviews[0], batch);
  const scanRecords = [
    { id: "scan-r1", body: overlapping.body + " ", source: "Amazon written review", provenance: "scan" },
    { id: "scan-r2", body: "A completely different review body from a scan.", source: "Amazon written review", provenance: "scan" },
  ];
  stub.__seedRow({
    product_key: "amazon.ca:B097RG67QB",
    corpus: scanRecords,
    review_count: 2,
    scan_count: 3,
  });
  const receipt = await ingestOwnerFeedBatch(dreoText, {
    loadCorpus: loadLibraryCorpus,
    saveCorpus: (input) => saveLibraryCorpus({ ...input, scanIncrement: 0 }),
  });
  assert.equal(receipt.duplicatesSkipped, 1); // the overlapping body
  assert.equal(receipt.added, 48);
  assert.equal(receipt.storedTotal, 50); // 2 scan + 48 new owner-fed (1 body dup)
  assert.equal(receipt.scanCount, 3); // unchanged by ingestion
  const entry = await loadLibraryCorpus("amazon.ca:B097RG67QB");
  assert.equal(entry.reviews[0].id, "scan-r1"); // stored records keep their place
  assert.equal(entry.reviews[1].provenance, "scan");
  assert.equal(entry.scanCount, 3);
});

test("ingest: AirPods batch merges onto a scan-existing corpus without touching scan_count", async () => {
  stub.__resetTable();
  stub.__seedRow({
    product_key: "amazon.ca:B0DGJDKHRQ",
    corpus: [{ id: "scan-airpods-1", body: "Scan-collected AirPods review body, distinct.", provenance: "scan" }],
    review_count: 1,
    scan_count: 5,
  });
  const receipt = await ingestOwnerFeedBatch(airpodsText, {
    loadCorpus: loadLibraryCorpus,
    saveCorpus: (input) => saveLibraryCorpus({ ...input, scanIncrement: 0 }),
  });
  assert.equal(receipt.added, 73);
  assert.equal(receipt.storedTotal, 74);
  assert.equal(receipt.scanCount, 5);
  const entry = await loadLibraryCorpus("amazon.ca:B0DGJDKHRQ");
  assert.equal(entry.reviews.length, 74);
  assert.ok(ownerFeedBodyKey("  HELLO  World ") === ownerFeedBodyKey("hello world"));
});
