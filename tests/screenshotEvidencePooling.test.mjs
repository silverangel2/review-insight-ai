// Screenshot-evidence pooling tests (fix lane, 2026-10-20).
// Defect: a screenshot scan identifies the product but collects ZERO evidence —
// (1) the library was only consulted by canonical marketplace key, which needs
// a verified exact listing a screenshot scan does not have; (2) the fingerprint
// matcher rejected the correct product whenever identity came from a listing
// title (hyphenated brand "Crock-Pot" -> "crockpot" vs brand-field "crock pot";
// hyphenated capacity "7-Quart" extracted no variant, leaving the stored
// listing's fingerprint unanchored); (3) the collector gate zeroed adjudicated
// evidence whenever no exact listing was verified.
// These tests run the REAL lib/productFingerprint.ts, lib/productReviewLibrary.ts
// (against the in-memory supabase stub), lib/reviewEvidenceAdjudication.ts,
// lib/reviewHunt.ts (injected retrieval) and lib/reviewEvidence.ts (network
// stubbed shut) — zero live network.
import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const fp = await import("../lib/productFingerprint.ts");
const lib = await import("../lib/productReviewLibrary.ts");
const adj = await import("../lib/reviewEvidenceAdjudication.ts");
const hunt = await import("../lib/reviewHunt.ts");
const stub = await import("./stubs/supabaseServer.stub.mjs");

const { extractProductFingerprint, matchListingToFingerprint } = fp;
const { loadFingerprintMatchedLibraryCorpus } = lib;
const { adjudicateReviewEvidence } = adj;
const { runReviewHunt, shouldRunReviewHunt } = hunt;

// The screenshot door's identified facts (scan_aa93aee4, Walmart.ca screenshot)
// and the library's stored listing for the same product (Amazon link scan,
// Buy 91 record under amazon.com:B07B8P9JBQ).
const SS_IDENTITY = {
  brand: "Crock-Pot",
  productName: "Crock-Pot 7 qt Polished Silver Slow Cooker",
};
const AMAZON_TITLE =
  "Crock-Pot 7-Quart Manual Slow Cooker, Family Size Serves 8+ People & Fits 6-lb Roast, Removable Stoneware with Warming Setting, Dishwasher Safe for Easy Cleanup, Turquoise";
const AMAZON_KEY = "amazon.com:B07B8P9JBQ";

function amazonReview(i, body) {
  return {
    body,
    title: `Crock pot review ${i}`,
    rating: [5, 4, 5, 3, 5][i % 5],
    reviewerName: `Reviewer ${i}`,
    source: "Amazon written review",
    sourceUrl: "https://www.amazon.com/dp/B07B8P9JBQ",
    reviewedProductName: AMAZON_TITLE,
    reviewedBrand: "Crock-Pot",
    marketplaceProductId: "B07B8P9JBQ",
  };
}

const AMAZON_CORPUS = [
  amazonReview(0, "I bought this crock pot for Sunday family dinners and it has been flawless. The 7 quart size fits a whole chicken and everything cooks evenly on low."),
  amazonReview(1, "This slow cooker replaced my old one and I use the crock pot three times a week. Cleanup is easy because the stoneware goes in the dishwasher and it still works like new."),
  amazonReview(2, "We purchased the crock pot in January and the warm setting keeps food ready without drying it out. I love how simple the dial is and the cooker feels sturdy."),
  amazonReview(3, "My crock pot arrived with a small scratch on the lid, but customer service sorted it out. The slow cooker itself cooks stews beautifully and the size is generous for our family."),
  amazonReview(4, "I have used this crock pot for pot roasts and soups all winter. It works reliably, the stoneware is heavy in a good way, and I would recommend it to anyone feeding a crowd."),
];

function libraryRow(productKey, productName, corpus, extra = {}) {
  return {
    product_key: productKey,
    product_name: productName,
    brand: null,
    store: null,
    canonical_url: null,
    corpus,
    scan_count: 1,
    updated_at: "2026-10-20T00:00:00.000Z",
    ...extra,
  };
}

test("fingerprint: hyphenated brand and capacity normalize the same from a brand field and from a title", () => {
  const fromScreenshot = extractProductFingerprint(SS_IDENTITY);
  assert.equal(fromScreenshot.brand, "crock pot");
  assert.equal(fromScreenshot.identityBasis, "spec-set");
  assert.equal(fromScreenshot.fingerprintKey, "fp:crock-pot:spec:cap-qt:7");

  // The library listing's identity derives from its stored title alone
  // (its row carries no brand — it was saved from an ASIN link scan).
  const fromStoredTitle = extractProductFingerprint({ productName: AMAZON_TITLE });
  assert.equal(fromStoredTitle.brand, "crock pot", "title-derived brand must equal the brand-field form");
  assert.deepEqual(fromStoredTitle.variantWords, ["cap-qt:7"], "\"7-Quart\" must yield the capacity variant");
  assert.equal(fromStoredTitle.fingerprintKey, fromScreenshot.fingerprintKey);

  assert.equal(matchListingToFingerprint(fromScreenshot, { productName: AMAZON_TITLE }).verdict, "match");
  assert.equal(matchListingToFingerprint(fromStoredTitle, SS_IDENTITY).verdict, "match");
});

test("(i) an SS-identified product pools its library record, provenance stamped, and the shared adjudication accepts it without a verified listing", async () => {
  stub.__reset();
  stub.__seed("product_review_library", [libraryRow(AMAZON_KEY, AMAZON_TITLE, AMAZON_CORPUS)]);

  const pool = await loadFingerprintMatchedLibraryCorpus(SS_IDENTITY);
  assert.deepEqual(pool.matchedProductKeys, [AMAZON_KEY]);
  assert.equal(pool.reviews.length, AMAZON_CORPUS.length);
  assert.ok(
    pool.reviews.every((r) => r.sourceMarketplace === "amazon.com"),
    "every pooled review carries its source marketplace provenance"
  );

  const adjudication = adjudicateReviewEvidence(pool.reviews, {
    productName: SS_IDENTITY.productName,
    brand: SS_IDENTITY.brand,
    exactListingAccepted: false,
    exactListingUrl: "",
    exactListingTitle: SS_IDENTITY.productName,
  });
  assert.equal(adjudication.acceptedRecordCount, AMAZON_CORPUS.length);
});

test("(iii) wrong-model and wrong-brand library rows never pool, and ambiguous rows stay unmerged", async () => {
  stub.__reset();
  stub.__seed("product_review_library", [
    libraryRow(AMAZON_KEY, AMAZON_TITLE, AMAZON_CORPUS),
    libraryRow(
      "amazon.com:B0CLTKCK3D",
      "Crock-Pot 6-Qt Cook & Carry Programmable Slow Cooker with Digital Timer, Stainless Steel",
      [amazonReview(90, "I bought this programmable crock pot and the timer works well for weekday meals at our house.")]
    ),
    libraryRow(
      "amazon.ca:B01GVGXGT8",
      "Hamilton Beach 7-Quart Slow Cooker, Extra Large Capacity, Serves 10+",
      [amazonReview(91, "I bought this slow cooker for a church supper and it worked well for our group dinner last weekend.")]
    ),
    libraryRow(
      "walmart.ca:5551234",
      "Crock-Pot Slow Cooker with Removable Stoneware",
      [amazonReview(92, "I bought this crock pot last month and it cooks my stews evenly and cleans up fast every time.")]
    ),
  ]);

  const pool = await loadFingerprintMatchedLibraryCorpus(SS_IDENTITY);
  assert.deepEqual(pool.matchedProductKeys, [AMAZON_KEY]);
  assert.equal(pool.reviews.length, AMAZON_CORPUS.length);
  const pooledBodies = new Set(pool.reviews.map((r) => r.body));
  assert.ok(![...pooledBodies].some((b) => String(b).includes("programmable crock pot")), "wrong-model reviews must not pool");
  assert.ok(![...pooledBodies].some((b) => String(b).includes("church supper")), "wrong-brand reviews must not pool");

  const excluded = new Map(pool.exclusions.map((e) => [e.productKey, e]));
  assert.equal(excluded.get("amazon.com:B0CLTKCK3D")?.verdict, "no_match");
  assert.equal(excluded.get("amazon.ca:B01GVGXGT8")?.verdict, "no_match");
  assert.equal(excluded.get("walmart.ca:5551234")?.verdict, "ambiguous");

  // The matcher itself: a conflicting capacity is a different product, full stop.
  const ssFp = extractProductFingerprint(SS_IDENTITY);
  const wrong = matchListingToFingerprint(ssFp, {
    productName: "Crock-Pot 6-Qt Cook & Carry Programmable Slow Cooker with Digital Timer, Stainless Steel",
  });
  assert.equal(wrong.verdict, "no_match");
  assert.ok(wrong.variantConflicts.includes("cap-qt"));
});

test("(ii) an SS scan with zero accepted reviews reaches the hunt trigger, and the hunt can now pool the same product from another store", async () => {
  const ssFp = extractProductFingerprint(SS_IDENTITY);
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 0, fingerprint: ssFp }),
    { fire: true, reason: "zero_accepted_reviews" }
  );
  // Strictness preserved: an unanchored screenshot identity still cannot hunt.
  const unanchored = extractProductFingerprint({ brand: "Crock-Pot", productName: "Crock-Pot slow cooker" });
  assert.equal(unanchored.fingerprintKey, null);
  assert.deepEqual(
    shouldRunReviewHunt({ enabled: true, acceptedRecordCount: 0, fingerprint: unanchored }),
    { fire: false, reason: "identity_not_anchored" }
  );

  // The other store's listing carries the Amazon-style title; its records have
  // no stamped brand, so the candidate brand derives from the title — the
  // exact shape the hyphen defects used to reject (brand_mismatch /
  // variant_evidence_missing).
  const walmartRecords = AMAZON_CORPUS.slice(0, 3).map((r, i) => ({
    body: r.body,
    source: "Public review page",
    rating: r.rating,
    sourceUrl: "https://www.walmart.ca/en/ip/5559876",
    reviewedProductName: "Crock-Pot 7-Quart Manual Slow Cooker, Stainless Steel",
    ...(i === 0 ? {} : {}),
  }));
  const { diagnostics, reviews } = await runReviewHunt({
    brand: SS_IDENTITY.brand,
    productName: SS_IDENTITY.productName,
    listingUrl: null,
    fingerprint: ssFp,
    retrieval: async () => ({
      attempted: true,
      queries: ["Crock-Pot 7 qt slow cooker reviews"],
      sourcesChecked: ["https://www.walmart.ca/en/ip/5559876"],
      sourceLinks: [],
      reviews: walmartRecords,
      reviewsCollected: walmartRecords.length,
      coverageNote: "fake",
      diagnostics: {},
    }),
  });
  assert.equal(diagnostics.reason, "ok");
  assert.equal(diagnostics.pooledCount, walmartRecords.length);
  assert.equal(reviews.length, walmartRecords.length);
  assert.ok(reviews.every((r) => r.sourceMarketplace === "walmart.ca"), "hunted reviews carry provenance");
});

test("wiring guard: a screenshot-shaped scan with NO fingerprint-matching library record keeps the honest zero-evidence state", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const root = new URL("../", import.meta.url).pathname;
  const stubPath = path.join(root, "tests", "stubs", "supabaseServer.stub.mjs");
  const jiti = require("jiti")(root + "x.js", {
    alias: { "@/lib/supabaseServer": stubPath, "@": root },
  });
  const jitiStub = jiti(stubPath);
  jitiStub.__reset();
  // Only a wrong-model row exists: it must not pool, and the gate stays shut.
  jitiStub.__seed("product_review_library", [
    libraryRow(
      "amazon.com:B0CLTKCK3D",
      "Crock-Pot 6-Qt Cook & Carry Programmable Slow Cooker with Digital Timer, Stainless Steel",
      [amazonReview(90, "I bought this programmable crock pot and the timer works well for weekday meals at our house.")]
    ),
  ]);

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  process.env.REVIEWINTEL_REVIEW_HUNT_ENABLED = "0";
  try {
    const { collectAndAnalyzeReviewEvidence } = jiti(root + "lib/reviewEvidence.ts");
    const result = await collectAndAnalyzeReviewEvidence({
      productName: SS_IDENTITY.productName,
      brand: SS_IDENTITY.brand,
      store: "Walmart.ca",
      listingUrl: null,
      categoryBreadcrumbs: ["Slow Cookers"],
      forceRefresh: true,
    });
    assert.equal(result.collectorSourceAccepted, false);
    assert.equal(result.commentsAnalyzed, 0);
    assert.equal(result.retrievalDiagnostics?.libraryFingerprintPool?.pooledReviews, 0);
    assert.deepEqual(result.retrievalDiagnostics?.libraryFingerprintPool?.matchedProductKeys, []);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.REVIEWINTEL_REVIEW_HUNT_ENABLED;
  }
});
test("wiring: collectAndAnalyzeReviewEvidence pools the library for a screenshot-shaped input and the accepted evidence surfaces (network stubbed shut)", async () => {
  // lib/reviewEvidence.ts's import graph contains TS parameter properties
  // Node's strip-only loader cannot parse, so — like the existing
  // retrievalCapability tests — it is loaded through jiti. The alias maps
  // the storage module onto the same in-memory stub the library tests use
  // (jiti keeps its own module instance, so seeding goes through the
  // jiti-loaded handle).
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const root = new URL("../", import.meta.url).pathname;
  const stubPath = path.join(root, "tests", "stubs", "supabaseServer.stub.mjs");
  const jiti = require("jiti")(root + "x.js", {
    alias: { "@/lib/supabaseServer": stubPath, "@": root },
  });
  const jitiStub = jiti(stubPath);
  jitiStub.__reset();
  jitiStub.__seed("product_review_library", [libraryRow(AMAZON_KEY, AMAZON_TITLE, AMAZON_CORPUS)]);

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  process.env.REVIEWINTEL_REVIEW_HUNT_ENABLED = "0";
  try {
    const { collectAndAnalyzeReviewEvidence } = jiti(root + "lib/reviewEvidence.ts");
    const result = await collectAndAnalyzeReviewEvidence({
      productName: SS_IDENTITY.productName,
      brand: SS_IDENTITY.brand,
      store: "Walmart.ca",
      listingUrl: null,
      categoryBreadcrumbs: ["Slow Cookers"],
      forceRefresh: true,
    });
    assert.equal(result.collectorSourceAccepted, true, "fingerprint-pooled accepted evidence must open the collector gate");
    assert.equal(result.commentsAnalyzed, AMAZON_CORPUS.length);
    assert.equal(result.evidenceAdjudication?.acceptedRecordCount, AMAZON_CORPUS.length);
    assert.deepEqual(result.retrievalDiagnostics?.libraryFingerprintPool?.matchedProductKeys, [AMAZON_KEY]);
    assert.equal(result.retrievalDiagnostics?.libraryFingerprintPool?.pooledReviews, AMAZON_CORPUS.length);
    assert.ok(result.reviewSnippets?.every((s) => String(s.source || "").length > 0));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.REVIEWINTEL_REVIEW_HUNT_ENABLED;
  }
});
