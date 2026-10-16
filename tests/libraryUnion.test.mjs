// Library union-save fix tests.
// Runs the REAL modified lib/productReviewLibrary.ts against an in-memory
// PostgREST model. Covers: union persistence (the P0 data-loss fix),
// rejected-stored-kept, append-once idempotency, cap behavior, deterministic
// load under duplicate rows, duplicate healing on save, and the no-unique-
// constraint write semantics.
import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const lib = await import("../lib/productReviewLibrary.ts");
const stub = await import("./stubs/supabaseServer.stub.mjs");

const { loadLibraryCorpus, saveLibraryCorpus, unionLibraryCorpora, libraryRecordIdentity, LIBRARY_CORPUS_CAP } = lib;

const KEY = "amazon.ca:B097RG67QB";

function rec(i, extra = {}) {
  return {
    id: `r${i}`,
    body: `Review body number ${i}. This heater warms my bedroom quietly and safely.`,
    title: `Title ${i}`,
    rating: (i % 5) + 1,
    reviewerName: `Reviewer ${i}`,
    source: "Amazon written review",
    sourceUrl: "https://www.amazon.ca/dp/B097RG67QB",
    provenance: "scan",
    ...extra,
  };
}

function ownerRec(i) {
  return rec(i, { provenance: "owner_fed", source: "Amazon marketplace review (hand-fed by owner)" });
}

// Simulates the reviewEvidence.ts save site: union first, then save.
async function scanSave(stored, accepted, previousScanCount) {
  const corpus = unionLibraryCorpora(stored, accepted);
  const ok = await saveLibraryCorpus({
    productKey: KEY,
    canonicalUrl: "https://www.amazon.ca/dp/B097RG67QB",
    productName: "DREO Space Heater",
    corpus,
    previousScanCount,
  });
  return { ok, corpus };
}

test("union save preserves all 54 stored records when a scan accepts only 7", async () => {
  stub.__reset();
  const stored = Array.from({ length: 54 }, (_, i) =>
    i < 6 ? ownerRec(i) : rec(i)
  );
  await saveLibraryCorpus({ productKey: KEY, corpus: stored, previousScanCount: 0 });

  // The scan's adjudication accepts 7 of the pool (subset) plus 3 genuinely new.
  const accepted = [...stored.slice(0, 7).map((r) => ({ ...r })), rec(100), rec(101), rec(102)];
  const { ok, corpus } = await scanSave(stored, accepted, 2);
  assert.equal(ok, true);

  const loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 57);
  assert.equal(corpus.length, 57);
  // Every stored identity survives, including owner_fed provenance.
  const storedIds = new Set(stored.map(libraryRecordIdentity));
  const savedIds = new Set(loaded.reviews.map(libraryRecordIdentity));
  assert.equal(storedIds.size, 54);
  for (const id of storedIds) assert.ok(savedIds.has(id), `stored identity lost: ${id}`);
  assert.ok(loaded.reviews.filter((r) => r.provenance === "owner_fed").length >= 6);
  // Genuinely new records appended once.
  assert.equal(savedIds.size, 57);
});

test("stored records rejected by this run's adjudication stay stored", async () => {
  stub.__reset();
  const stored = Array.from({ length: 10 }, (_, i) => rec(i));
  await saveLibraryCorpus({ productKey: KEY, corpus: stored, previousScanCount: 1 });

  // This run accepts only 3 of the pool (the other 7 are "rejected").
  const { corpus } = await scanSave(stored, stored.slice(0, 3).map((r) => ({ ...r })), 2);
  assert.equal(corpus.length, 10);
  const loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 10);
});

test("genuinely new accepted records append once; re-run adds no duplicates", async () => {
  stub.__reset();
  const stored = Array.from({ length: 10 }, (_, i) => rec(i));
  await saveLibraryCorpus({ productKey: KEY, corpus: stored, previousScanCount: 1 });

  const accepted = [rec(50), rec(51)];
  await scanSave(stored, accepted, 2);
  let loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 12);

  // Second identical save (same stored+accepted inputs): no growth.
  await scanSave(loaded.reviews, accepted, 3);
  loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 12);
});

test("corpus cap: stored records first, overflow of new records dropped", async () => {
  stub.__reset();
  assert.ok(LIBRARY_CORPUS_CAP >= 500);
  const stored = Array.from({ length: 498 }, (_, i) => rec(i));
  const accepted = Array.from({ length: 5 }, (_, i) => rec(1000 + i));
  const corpus = unionLibraryCorpora(stored, accepted);
  assert.equal(corpus.length, 500);
  const savedIds = new Set(corpus.map(libraryRecordIdentity));
  // All 498 stored survive; the first 2 new fit; the last 3 are dropped.
  for (const r of stored) assert.ok(savedIds.has(libraryRecordIdentity(r)));
  assert.ok(savedIds.has(libraryRecordIdentity(accepted[0])));
  assert.ok(savedIds.has(libraryRecordIdentity(accepted[1])));
  assert.ok(!savedIds.has(libraryRecordIdentity(accepted[2])));
});

test("deterministic load: freshest duplicate row wins", async () => {
  stub.__reset();
  stub.__seed([
    { id: "row-old", product_key: KEY, corpus: Array.from({ length: 12 }, (_, i) => rec(i)), scan_count: 3, updated_at: "2026-10-16T08:00:00.000Z" },
    { id: "row-new", product_key: KEY, corpus: Array.from({ length: 7 }, (_, i) => rec(200 + i)), scan_count: 4, updated_at: "2026-10-16T08:30:00.000Z" },
  ]);
  let loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 7);
  assert.equal(loaded.scanCount, 4);

  // Flip the timestamps: the other row must win.
  stub.__seed([
    { id: "row-a", product_key: KEY, corpus: Array.from({ length: 12 }, (_, i) => rec(i)), scan_count: 3, updated_at: "2026-10-16T09:00:00.000Z" },
    { id: "row-b", product_key: KEY, corpus: Array.from({ length: 7 }, (_, i) => rec(200 + i)), scan_count: 4, updated_at: "2026-10-16T08:30:00.000Z" },
  ]);
  loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 12);
});

test("save heals pre-existing duplicates: canonical row keeps the union, loser deleted", async () => {
  stub.__reset();
  stub.__seed([
    { id: "row-old", product_key: KEY, corpus: Array.from({ length: 12 }, (_, i) => rec(i)), scan_count: 2, updated_at: "2026-10-16T08:00:00.000Z" },
    { id: "row-new", product_key: KEY, corpus: Array.from({ length: 7 }, (_, i) => rec(300 + i)), scan_count: 3, updated_at: "2026-10-16T08:30:00.000Z" },
  ]);
  // The analyze path loads (deterministic: row-new's 7), adjudicates, saves the union.
  const loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 7);
  const accepted = [rec(400), rec(401), rec(402)];
  const { ok } = await scanSave(loaded.reviews, accepted, loaded.scanCount);
  assert.equal(ok, true);

  const rows = stub.__rows().filter((r) => r.product_key === KEY);
  assert.equal(rows.length, 1, "duplicate rows must be healed to one canonical row");
  assert.equal(rows[0].corpus.length, 10);
  const savedIds = new Set(rows[0].corpus.map(libraryRecordIdentity));
  for (const r of loaded.reviews) assert.ok(savedIds.has(libraryRecordIdentity(r)));
  for (const r of accepted) assert.ok(savedIds.has(libraryRecordIdentity(r)));
});

test("without the unique constraint the upsert is a no-op (PostgREST 409)", async () => {
  stub.__reset();
  stub.__setConstraint(false);
  const stored = Array.from({ length: 5 }, (_, i) => rec(i));
  const ok = await saveLibraryCorpus({ productKey: KEY, corpus: stored, previousScanCount: 0 });
  assert.equal(ok, false);
  assert.equal(stub.__rows().length, 0);
  const loaded = await loadLibraryCorpus(KEY);
  assert.equal(loaded.reviews.length, 0);
});

test("libraryRecordIdentity: hash priority, body normalization, disambiguators", () => {
  const a = { body: "  Great HEATER.  ", rating: 5, reviewerName: "Ann" };
  const b = { body: "great heater.", rating: 5, reviewerName: "Ann" };
  assert.equal(libraryRecordIdentity(a), libraryRecordIdentity(b));
  // Same body, different rating -> different review.
  assert.notEqual(libraryRecordIdentity(a), libraryRecordIdentity({ body: "great heater.", rating: 4, reviewerName: "Ann" }));
  // stableEvidenceHash wins over body.
  const h1 = { stableEvidenceHash: "ABC123", body: "totally different" };
  const h2 = { stableEvidenceHash: "abc123", body: "something else" };
  assert.equal(libraryRecordIdentity(h1), libraryRecordIdentity(h2));
  // Empty body -> no identity (never stored as phantom).
  assert.equal(libraryRecordIdentity({ body: "   " }), "");
});
