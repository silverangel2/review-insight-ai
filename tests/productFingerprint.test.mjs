// Match-words fingerprint tests (owner design, 2026-10-20).
// Runs the REAL lib/productFingerprint.ts + the cross-store pooling added to
// lib/productReviewLibrary.ts. Product identities are the real captured /
// fixture products of this repo (Ninja AS101CDG, Kenmore dryer, Takki power
// station, Philips Airfryer XXL, CeraVe cream, Fire TV Stick) — candidate
// listings at other stores are the same products as those stores publish
// them (title wording variants), never invented review content.
// Both sides are asserted: matches AND the no-match/ambiguous refusals.
import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const fp = await import("../lib/productFingerprint.ts");
const lib = await import("../lib/productReviewLibrary.ts");

const { extractProductFingerprint, matchListingToFingerprint, listingsMatch } = fp;

// Real captured identities (tests/fixtures/reviewintel-captured/*.json).
const NINJA_AMAZON = {
  brand: "Ninja",
  productName: "Ninja Foodi 6 Qt 8-in-1 Digital Air Fryer Oven with Max Crisp Technology, Model AS101CDG",
  model: "AS101CDG",
};
const KENMORE_AMAZON = {
  brand: "Kenmore",
  productName: "Kenmore 7.0 cu. ft. Front Load Electric Dryer",
};
const TAKKI_AMAZON = {
  brand: "Takki",
  productName:
    "Takki 150W Peak Portable Power Station 88.8Wh Small Generator Power Bank with 100W/110V AC Outlet and Flashlight for Camping Home Use",
};
const PHILIPS_AMAZON = {
  brand: "Philips",
  productName: "Philips Premium Airfryer XXL Healthy Air Fryer, Digital Touchscreen, 2.75 lb Capacity, 4.4 QT, Black",
};
const CERAVE_AMAZON = {
  brand: "CeraVe",
  productName: "CeraVe Moisturizing Cream, Face & Body Moisturizer for Dry Skin, 19oz",
};

test("fingerprint extraction: model-backed identity anchors on brand + model", () => {
  const f = extractProductFingerprint(NINJA_AMAZON);
  assert.equal(f.brand, "ninja");
  assert.deepEqual(f.models, ["AS101CDG"]);
  assert.equal(f.identityBasis, "model");
  assert.equal(f.fingerprintKey, "fp:ninja:as101cdg");
  assert.ok(f.kindWords.includes("fryer"));
  assert.ok(f.variantWords.includes("cap-qt:6"));
});

test("fingerprint extraction: no model code falls back to the strict spec-set", () => {
  const f = extractProductFingerprint(TAKKI_AMAZON);
  assert.deepEqual(f.models, []);
  assert.equal(f.identityBasis, "spec-set");
  assert.ok(f.variantWords.includes("power-w:150"));
  assert.ok(f.variantWords.includes("energy-wh:88.8"));
  assert.ok(f.fingerprintKey.startsWith("fp:takki:spec:"));
});

test("same product at another store matches on the model word", () => {
  const m = listingsMatch(NINJA_AMAZON, {
    brand: "Ninja",
    productName: "Ninja Foodi 8-in-1 Air Fryer Oven, 6-Qt, AS101CDG",
  });
  assert.equal(m.verdict, "match");
  assert.ok(m.reasons.includes("model_match"));
  assert.deepEqual(m.sharedModels, ["AS101CDG"]);
});

test("same product matches when the other store states the model only in its spec table", () => {
  const m = matchListingToFingerprint(extractProductFingerprint(NINJA_AMAZON), {
    brand: "Ninja",
    productName: "Ninja Foodi Digital Air Fryer Oven",
    identifiers: { gtins: [], models: ["AS101CDG"] },
  });
  assert.equal(m.verdict, "match");
});

test("sibling model of the same line does NOT match", () => {
  const m = listingsMatch(NINJA_AMAZON, {
    brand: "Ninja",
    productName: "Ninja Air Fryer, 4-Qt, AF101",
    model: "AF101",
  });
  assert.equal(m.verdict, "no_match");
  assert.ok(m.reasons.includes("model_mismatch"));
});

test("same model in a different capacity is a sibling: unmerged, marked ambiguous", () => {
  const m = listingsMatch(NINJA_AMAZON, {
    brand: "Ninja",
    productName: "Ninja Foodi 8 Qt 8-in-1 Digital Air Fryer Oven, Model AS101CDG",
    model: "AS101CDG",
  });
  assert.equal(m.verdict, "ambiguous");
  assert.ok(m.reasons.includes("variant_conflict"));
  assert.ok(m.variantConflicts.includes("cap-qt"));
});

test("a candidate with no model evidence stays unmerged (ambiguous), never a match", () => {
  const m = listingsMatch(NINJA_AMAZON, {
    brand: "Ninja",
    productName: "Ninja Foodi 6 Qt 8-in-1 Digital Air Fryer Oven",
  });
  assert.equal(m.verdict, "ambiguous");
  assert.ok(m.reasons.includes("candidate_missing_model"));
});

test("spec-set identity: same specs at another store match; a different spec is a different product", () => {
  const same = listingsMatch(TAKKI_AMAZON, {
    brand: "Takki",
    productName: "Takki Portable Power Station 150W, 88.8Wh Generator Power Bank",
  });
  assert.equal(same.verdict, "match");
  assert.ok(same.reasons.includes("spec_set_match"));

  const bigger = listingsMatch(TAKKI_AMAZON, {
    brand: "Takki",
    productName: "Takki Portable Power Station 200W, 193Wh Generator Power Bank",
  });
  assert.equal(bigger.verdict, "no_match");
  assert.ok(bigger.reasons.includes("spec_conflict"));
});

test("Kenmore: same dryer elsewhere matches; top-load and washer siblings do not", () => {
  const same = listingsMatch(KENMORE_AMAZON, {
    brand: "Kenmore",
    productName: "Kenmore 7.0 cu ft Front Load Electric Dryer - White",
  });
  assert.equal(same.verdict, "match");

  const topLoad = listingsMatch(KENMORE_AMAZON, {
    brand: "Kenmore",
    productName: "Kenmore 7.0 cu. ft. Top Load Electric Dryer",
  });
  assert.equal(topLoad.verdict, "no_match");
  assert.ok(topLoad.reasons.includes("spec_conflict"));

  const washer = listingsMatch(KENMORE_AMAZON, {
    brand: "Kenmore",
    productName: "Kenmore 7.0 cu. ft. Front Load Electric Washer",
  });
  assert.equal(washer.verdict, "no_match");
  assert.ok(washer.reasons.includes("kind_mismatch"));
});

test("CeraVe: same size matches across stores; different size and different product do not", () => {
  const same = listingsMatch(CERAVE_AMAZON, {
    brand: "CeraVe",
    productName: "CeraVe Moisturizing Cream for Dry Skin, 19 oz",
  });
  assert.equal(same.verdict, "match");

  const otherSize = listingsMatch(CERAVE_AMAZON, {
    brand: "CeraVe",
    productName: "CeraVe Moisturizing Cream, Face & Body Moisturizer for Dry Skin, 12oz",
  });
  assert.equal(otherSize.verdict, "no_match");
  assert.ok(otherSize.reasons.includes("spec_conflict"));

  const cleanser = listingsMatch(CERAVE_AMAZON, {
    brand: "CeraVe",
    productName: "CeraVe Foaming Facial Cleanser, 16oz",
  });
  assert.equal(cleanser.verdict, "no_match");
});

test("shared word, different brands and products: no match", () => {
  const m = listingsMatch(PHILIPS_AMAZON, NINJA_AMAZON);
  assert.equal(m.verdict, "no_match");
  assert.ok(m.reasons.includes("brand_mismatch"));
});

test("Philips XXL: model-bearing candidate without the spec evidence stays ambiguous", () => {
  // The captured Philips listing carries no model code; another store's
  // listing states one but omits the capacity words. Identity unproven
  // either way — it must stay unmerged, not guessed.
  const m = listingsMatch(PHILIPS_AMAZON, {
    brand: "Philips",
    productName: "Philips Premium Airfryer XXL, HD9860/90",
    model: "HD9860/90",
  });
  assert.equal(m.verdict, "ambiguous");
});

test("GTIN: a shared valid barcode is conclusive; conflicts behave per the rules", () => {
  // Valid GS1 barcodes (check digits verified by lib/listingIdentifiers).
  const UPC_A = "012345678905";
  const UPC_B = "036000291452";
  const base = extractProductFingerprint({ brand: "Ninja", productName: NINJA_AMAZON.productName, model: "AS101CDG", gtins: [UPC_A] });
  assert.equal(base.gtins.length, 1);

  const sameBarcode = matchListingToFingerprint(base, {
    brand: "Ninja",
    productName: "Ninja Foodi Air Fryer Oven AS101CDG",
    gtins: [UPC_A],
  });
  assert.equal(sameBarcode.verdict, "match");
  assert.ok(sameBarcode.reasons.includes("gtin_match"));

  const otherBarcodeSameModel = matchListingToFingerprint(base, {
    brand: "Ninja",
    productName: "Ninja Foodi Air Fryer Oven AS101CDG, 2-Pack",
    gtins: [UPC_B],
  });
  assert.equal(otherBarcodeSameModel.verdict, "ambiguous");
  assert.ok(otherBarcodeSameModel.reasons.includes("gtin_differs_model_matches"));

  const otherBarcodeNoModel = matchListingToFingerprint(base, {
    brand: "Ninja",
    productName: "Ninja Foodi Air Fryer Oven",
    gtins: [UPC_B],
  });
  assert.equal(otherBarcodeNoModel.verdict, "no_match");
});

test("real trap: two captured Ninja lines share the AS101CDG code — family words force human review", () => {
  // tests/fixtures/reviewintel-captured/ninja.json names a Foodi oven
  // AS101CDG; tests/fixtures/reviewintel/ninja-crispi-intelligence-v5.json
  // names a Crispi glass air fryer AS101CDG. A shared code with fully
  // disjoint family words must NOT pool — ambiguous, logged, unmerged.
  const m = listingsMatch(NINJA_AMAZON, {
    brand: "Ninja",
    productName: "Ninja Crispi Pro Glass Air Fryer, 6-in-1, Ash Grey, AS101CDG",
    model: "AS101CDG",
  });
  assert.equal(m.verdict, "ambiguous");
  assert.ok(m.reasons.includes("family_words_differ"));
});

test("unanchored fingerprint never matches anything", () => {
  const weak = extractProductFingerprint({ productName: "Amazon product" });
  assert.equal(weak.fingerprintKey, null);
  const m = matchListingToFingerprint(weak, NINJA_AMAZON);
  assert.equal(m.verdict, "no_match");
  assert.ok(m.reasons.includes("fingerprint_not_anchored"));
});

/* ------------------------- library pooling ------------------------------ */

function rec(body, extra = {}) {
  return {
    body,
    rating: 5,
    reviewerName: "Reviewer",
    source: "written review",
    ...extra,
  };
}

const NINJA_WALMART_LISTING = {
  brand: "Ninja",
  productName: "Ninja Foodi 8-in-1 Air Fryer Oven, 6-Qt, AS101CDG",
};

test("pooling: two stores' corpora for the same product pool with provenance + dedupe", () => {
  const sharedBody = "Crisps evenly and the oven preheats fast.";
  const { groups, exclusions } = lib.poolLinkedLibraryCorpora([
    {
      productKey: "amazon.ca:B0NINJA001",
      listing: NINJA_AMAZON,
      reviews: [
        rec(sharedBody, { sourceUrl: "https://www.amazon.ca/dp/B0NINJA001" }),
        rec("Amazon-only review body.", { sourceUrl: "https://www.amazon.ca/dp/B0NINJA001" }),
      ],
    },
    {
      productKey: "walmart.ca:6000123456",
      listing: NINJA_WALMART_LISTING,
      reviews: [
        rec(sharedBody, { sourceUrl: "https://www.walmart.ca/ip/6000123456" }),
        rec("Walmart-only review body.", {
          sourceUrl: "https://www.walmart.ca/ip/6000123456",
          sourceMarketplace: "walmart.ca",
        }),
      ],
    },
    {
      productKey: "amazon.ca:B0TAKKI001",
      listing: TAKKI_AMAZON,
      reviews: [rec("Runs my CPAP all night.", { sourceUrl: "https://www.amazon.ca/dp/B0TAKKI001" })],
    },
  ]);

  assert.equal(groups.length, 2);
  const ninja = groups.find((g) => g.fingerprintKey === "fp:ninja:as101cdg");
  assert.ok(ninja, "ninja group exists under its fingerprint key");
  assert.deepEqual(ninja.productKeys, ["amazon.ca:B0NINJA001", "walmart.ca:6000123456"]);
  // 4 records in, 1 duplicate body across stores -> 3 pooled.
  assert.equal(ninja.reviews.length, 3);
  const byBody = new Map(ninja.reviews.map((r) => [r.body, r]));
  assert.equal(byBody.get("Amazon-only review body.").sourceMarketplace, "amazon.ca");
  assert.equal(byBody.get("Walmart-only review body.").sourceMarketplace, "walmart.ca");
  // First-stored copy of the shared review keeps its original provenance.
  assert.equal(byBody.get(sharedBody).sourceMarketplace, "amazon.ca");

  // The unrelated product never pools, and the refusal is logged.
  assert.ok(
    exclusions.some(
      (e) => e.productKey === "amazon.ca:B0TAKKI001" && e.verdict === "no_match"
    ),
    "takki exclusion is logged"
  );
});

test("pooling: an ambiguous pair stays unmerged and the exclusion says why", () => {
  const { groups, exclusions } = lib.poolLinkedLibraryCorpora([
    { productKey: "amazon.ca:B0NINJA001", listing: NINJA_AMAZON, reviews: [rec("A body.")] },
    {
      productKey: "bestbuy.ca:18000001",
      listing: { brand: "Ninja", productName: "Ninja Foodi 6 Qt 8-in-1 Digital Air Fryer Oven" },
      reviews: [rec("B body.")],
    },
  ]);
  assert.equal(groups.length, 2, "no-model-evidence listing must not pool");
  assert.ok(exclusions.some((e) => e.verdict === "ambiguous" && e.reason === "candidate_missing_model"));
});

test("pooling: loadPooledLibraryCorpus pools only proven matches (injectable loader)", async () => {
  const store = new Map([
    ["amazon.ca:B0NINJA001", { productKey: "amazon.ca:B0NINJA001", reviews: [rec("Stored A.")], scanCount: 1 }],
    ["walmart.ca:6000123456", { productKey: "walmart.ca:6000123456", reviews: [rec("Stored B.")], scanCount: 1 }],
  ]);
  const loader = async (key) => store.get(key) || { productKey: key, reviews: [], scanCount: 0 };
  const { groups } = await lib.loadPooledLibraryCorpus(
    [
      { productKey: "amazon.ca:B0NINJA001", listing: NINJA_AMAZON },
      { productKey: "walmart.ca:6000123456", listing: NINJA_WALMART_LISTING },
    ],
    loader
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].reviews.length, 2);
  assert.ok(groups[0].reviews.every((r) => typeof r.sourceMarketplace === "string"));
});
