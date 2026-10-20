// Wording fix (2026-10-20): the How-we-checked fold's coverage sentence
// must name the stores whose reviews ACTUALLY fed the verdict — read from
// the adjudication's accepted records, never from the scanned listing.
// The pre-fix line filled the listing's store into a single-source frame:
// on a scan whose accepted reviews all came from a second store (the
// review-hunt shape), it printed that store's reviews were the listing
// store's — a false claim on a customer page. These tests pin the truth
// table: Amazon-only / second-store-only / mixed / Amazon multi-host /
// library-stamped / zero-read / unnameable-source.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const bn = jiti(root + "lib/briefNarration.ts");
const copy = jiti(root + "lib/analysisCopy.ts");

let seq = 0;
function rec(sourceUrl, extra = {}) {
  seq += 1;
  return {
    id: `r${seq}`,
    stableEvidenceHash: `h${seq}`,
    body: "Works exactly as described and I would buy it again.",
    sourceUrl,
    ...extra,
  };
}

function resultWith(records, productStore = "Amazon.ca") {
  return {
    product: { store: productStore, name: "Acme Widget 2000" },
    store: productStore,
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records },
    },
  };
}

function filledFrames(frames, slot, value) {
  return frames.map((f) => f.split(slot).join(value));
}

test("amazon-only scan keeps the single-source line, naming Amazon.ca", () => {
  const line = bn.foldLimitsLine(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://amazon.ca/gp/customer-reviews/R1"),
    ])
  );
  assert.ok(line, "expected a coverage line");
  assert.ok(
    filledFrames(copy.LIMITS_SINGLE_SOURCE_FRAMES, "{store}", "Amazon.ca").includes(line),
    `line must be a single-source frame naming Amazon.ca, got: ${line}`
  );
});

test("REGRESSION: accepted reviews all from a second store name THAT store, not the listing's", () => {
  // The hunt shape: scanned listing is Amazon.ca, first pass accepted zero,
  // every accepted record came from Walmart. The old code printed
  // "Amazon.ca" here. That claim was false.
  const line = bn.foldLimitsLine(
    resultWith(
      [
        rec("https://www.walmart.com/reviews/product/12345"),
        rec("https://www.walmart.com/reviews/product/12345"),
        rec("https://www.walmart.com/reviews/product/12345"),
      ],
      "Amazon.ca"
    )
  );
  assert.ok(line, "expected a coverage line");
  assert.ok(line.includes("walmart.com"), `line must name walmart.com, got: ${line}`);
  assert.ok(!line.includes("Amazon"), `line must NOT name Amazon, got: ${line}`);
  assert.ok(
    filledFrames(copy.LIMITS_SINGLE_SOURCE_FRAMES, "{store}", "walmart.com").includes(line),
    `line must be a single-source frame naming walmart.com, got: ${line}`
  );
});

test("mixed stores name every store and state the exact-product match", () => {
  const line = bn.foldLimitsLine(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://www.walmart.com/reviews/product/12345"),
    ])
  );
  assert.ok(line, "expected a coverage line");
  assert.ok(line.includes("Amazon.ca"), `must name Amazon.ca, got: ${line}`);
  assert.ok(line.includes("walmart.com"), `must name walmart.com, got: ${line}`);
  assert.ok(line.includes("exact product"), `must state the exact-product match, got: ${line}`);
  const stores = "Amazon.ca and walmart.com";
  assert.ok(
    filledFrames(copy.LIMITS_MULTI_SOURCE_FRAMES, "{stores}", stores).includes(line),
    `line must be a multi-source frame over "${stores}", got: ${line}`
  );
});

test("amazon.ca + amazon.com is one store family, named Amazon", () => {
  const line = bn.foldLimitsLine(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://www.amazon.com/product-reviews/B000000001"),
    ])
  );
  assert.ok(line, "expected a coverage line (the old code printed none here)");
  assert.ok(
    filledFrames(copy.LIMITS_SINGLE_SOURCE_FRAMES, "{store}", "Amazon").includes(line),
    `line must be a single-source frame naming Amazon, got: ${line}`
  );
});

test("library-stored records (provenance-stamped) name their true store", () => {
  // Stored library records carry their original sourceUrl plus a stamped
  // sourceMarketplace host. Pooled into a later Amazon scan and accepted,
  // the line must cover them — the library route must not be denied.
  const line = bn.foldLimitsLine(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001", { sourceMarketplace: "amazon.ca" }),
      rec("https://www.walmart.com/reviews/product/12345", { sourceMarketplace: "walmart.com" }),
      rec(null, { sourceMarketplace: "walmart.com" }),
    ])
  );
  assert.ok(line, "expected a coverage line");
  assert.ok(line.includes("Amazon.ca"), `must name Amazon.ca, got: ${line}`);
  assert.ok(line.includes("walmart.com"), `must name walmart.com, got: ${line}`);
  assert.ok(line.includes("exact product"), `must state the exact-product match, got: ${line}`);
});

test("zero accepted reviews: no coverage line (zero-read copy stands elsewhere)", () => {
  assert.equal(bn.foldLimitsLine(resultWith([])), null);
  assert.equal(bn.foldLimitsLine({ product: { store: "Amazon.ca" } }), null);
  assert.equal(bn.foldLimitsLine(null), null);
});

test("an accepted record whose store cannot be named silences the line (never guess)", () => {
  const line = bn.foldLimitsLine(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec(null),
    ])
  );
  assert.equal(line, null);
});

test("fold narration carries the truthful line into the How-we-checked fold", () => {
  const lines = bn.foldNarration(
    resultWith([
      rec("https://www.amazon.ca/product-reviews/B000000001"),
      rec("https://www.walmart.com/reviews/product/12345"),
    ])
  );
  const coverage = lines.find((l) => l.includes("exact product"));
  assert.ok(coverage, `fold must include the multi-source coverage line, got: ${JSON.stringify(lines)}`);
  assert.ok(coverage.includes("Amazon.ca") && coverage.includes("walmart.com"));
});
