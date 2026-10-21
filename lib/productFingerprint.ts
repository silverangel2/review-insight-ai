/**
 * Product fingerprint: the "match words" identity for a product.
 *
 * Owner design (2026-10-20): ReviewIntel hunts REVIEWS, not Amazon. Amazon
 * is first when its reviews are available; when Amazon is blocked or more
 * reviews are needed, the EXACT same product is found in other markets and
 * its reviews are pooled. Every store must publish a product's identifying
 * words to sell it at all — model number, brand, product kind, variant
 * words (size / capacity / generation / pack). Those words are the key
 * that works in every store.
 *
 * This module extracts that fingerprint from listing evidence and decides,
 * for a candidate listing from any store, whether it is the same product:
 *
 *   match      — core identity proven (see rules below); reviews may pool.
 *   no_match   — proven different (model conflict, brand conflict, kind
 *                conflict, or conflicting specifications).
 *   ambiguous  — cannot be proven either way; the listing stays UNMERGED
 *                and the reason is reported for a human/reviewer to see.
 *
 * Core rules (owner's, kept literal):
 *   - No model match = no merge. When neither side carries a model code,
 *     identity can still be proven the strict way: brand + kind + the FULL
 *     specification set (capacity/power/energy/…) must agree exactly —
 *     a differing spec value on a shared dimension is a different product.
 *   - Variant words decide same-product vs sibling: on a model-backed
 *     fingerprint, a conflicting variant value makes the pair a sibling
 *     (ambiguous, unmerged), never a silent merge.
 *   - A shared valid GTIN is conclusive for the exact sellable unit;
 *     conflicting GTINs with a shared model are packs/variants (ambiguous);
 *     conflicting GTINs with no shared model are a different product.
 *
 * Built on the existing identity stack, not beside it: token roles come
 * from lib/productIdentityTokens.ts and GTIN/model normalization from
 * lib/listingIdentifiers.ts (the same normalizers the retrieval lane uses
 * to verify cross-store pages). Deterministic, zero network, zero OpenAI.
 */
import { extractProductIdentityTokenRoles } from "./productIdentityTokens";
import {
  normalizeGtin,
  normalizeModelId,
  type ListingIdentifiers,
} from "./listingIdentifiers";

export type FingerprintInput = {
  brand?: string | null;
  /** Listing title / product name as the store publishes it. */
  productName?: string | null;
  title?: string | null;
  /** Explicit model field from the listing's spec table, when present. */
  model?: string | null;
  gtins?: Array<string | number | null | undefined>;
  models?: Array<string | null | undefined>;
  /** Identifiers already extracted from the listing page (listingIdentifiers). */
  identifiers?: ListingIdentifiers | null;
  categoryBreadcrumbs?: string[] | null;
};

export type ProductFingerprint = {
  /** Normalized brand (lowercase). Null when no brand evidence exists. */
  brand: string | null;
  /** Discriminative model ids, normalized (uppercase, separators stripped). */
  models: string[];
  /** GTIN-14 normalized barcodes. */
  gtins: string[];
  /** Product-kind words (lowercase), generic descriptors removed. */
  kindWords: string[];
  /** Variant dimension tokens, e.g. "cap:7cuft", "gen:5", "pack:2", "tier:xxl". */
  variantWords: string[];
  /** "model" when a model code anchors identity; "spec-set" when the full spec set must. */
  identityBasis: "model" | "spec-set" | "none";
  /**
   * Canonical cross-store identity string, or null when identity cannot be
   * anchored (no brand, or neither a model nor a provable spec set). The key
   * is an index hint — the matcher, not key equality, is the merge gate.
   */
  fingerprintKey: string | null;
};

export type MatchVerdict = "match" | "no_match" | "ambiguous";

export type FingerprintMatch = {
  verdict: MatchVerdict;
  /** Machine-readable reasons, strongest first. */
  reasons: string[];
  sharedModels: string[];
  sharedGtins: string[];
  /** Variant dimensions both sides state with different values. */
  variantConflicts: string[];
};

const GENERIC_KIND_WORDS = new Set([
  "electric", "digital", "smart", "new", "with", "for", "and", "the",
  "featuring", "compatible", "technology", "crisp", "max",
]);

/** Category head nouns: when both sides name one, they must agree. */
const KIND_HEAD_WORDS = new Set([
  "dryer", "washer", "oven", "fryer", "airfryer", "cream", "moisturizer",
  "cleanser", "lotion", "serum", "shampoo", "station", "generator", "bank",
  "speaker", "stick", "tv", "television", "headphones", "headphone",
  "vacuum", "mop", "cooker", "ring", "camera", "monitor", "laptop",
  "tablet", "phone", "toaster", "blender", "mixer", "heater", "fan",
  "humidifier", "purifier", "trimmer", "shaver", "toothbrush", "scale",
]);

function normBrand(value: string | null | undefined): string | null {
  const b = String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return b || null;
}

function brandFromTitle(title: string): string | null {
  const first = title.trim().split(/\s+/)[0] || "";
  // Keep the brand's word boundaries: a hyphenated brand in a title
  // ("Crock-Pot") must normalize to the same brand as the same name in a
  // brand field ("Crock-Pot" -> "crock pot" via normBrand). Stripping the
  // punctuation joined the parts ("crockpot"), so a title-derived brand
  // could never equal the brand-field form and the matcher's brand gate
  // rejected the correct product (screenshot-evidence defect, 2026-10-20).
  const cleaned = first.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return cleaned.length >= 2 ? normBrand(cleaned) : null;
}

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Variant dimension tokens from raw title/spec text. Colors are NOT variant identity here. */
export function extractVariantWords(text: string): string[] {
  const source = ` ${String(text || "").toLowerCase()} `;
  const out = new Set<string>();
  const add = (dim: string, value: number) => out.add(`${dim}:${fmtNum(value)}`);
  // Capacity units are hyphenated in real listing titles ("7-Quart",
  // "6-Qt", "2-Gallon"): the number-unit separator may be a hyphen as well
  // as whitespace. Without it the capacity variant vanished and a spec-set
  // fingerprint built from such a title could not anchor at all.
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*(?:cu\.?\s*ft\.?|cubic\s+feet)/g)) add("cap-cuft", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)[\s-]*(?:quarts?|qts?)\b/g)) add("cap-qt", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*fl\.?\s*oz\b/g)) add("cap-floz", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*oz\b/g)) add("cap-oz", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*wh\b/g)) add("energy-wh", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*kwh\b/g)) add("energy-wh", Number(m[1]) * 1000);
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*mah\b/g)) add("energy-mah", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*w\b(?!h)/g)) add("power-w", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*(?:gb|tb)\b/g)) add("storage", Number(m[1]) * (m[0].toLowerCase().includes("tb") ? 1024 : 1));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*lbs?\b/g)) add("weight-lb", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*kg\b/g)) add("weight-kg", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)\s*ml\b/g)) add("cap-ml", Number(m[1]));
  for (const m of source.matchAll(/(\d+(?:\.\d+)?)[\s-]*gal(?:lons?)?\b/g)) add("cap-gal", Number(m[1]));
  for (const m of source.matchAll(/\bgen(?:eration)?\s*(\d{1,2})\b/g)) add("gen", Number(m[1]));
  for (const m of source.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\s*gen(?:eration)?\b/g)) add("gen", Number(m[1]));
  for (const m of source.matchAll(/\b(\d+)\s*[- ]?pack\b/g)) add("pack", Number(m[1]));
  for (const m of source.matchAll(/\bpack of\s+(\d+)\b/g)) add("pack", Number(m[1]));
  for (const m of source.matchAll(/\b(\d+)\s*count\b/g)) add("pack", Number(m[1]));
  for (const m of source.matchAll(/\b(front|top)[ -]?load(?:ing)?\b/g)) out.add(`config:${m[1]}-load`);
  for (const m of source.matchAll(/\b(xxl|xl)\b/g)) out.add(`tier:${m[1]}`);
  return [...out].sort();
}

function titleOf(input: FingerprintInput): string {
  return String(input.productName || input.title || "").replace(/\s+/g, " ").trim();
}

/** Unit/spec tokens that look like model codes but only state a rating. */
const SPEC_TOKEN = /^\d+(?:\.\d+)?(?:W|WH|V|A|MAH|AH|GB|TB|MB|OZ|LBS?|KG|G|ML|L|QT|GAL|K|P|HZ|KHZ|RPM|BTU|DB|CM|MM|IN)$/i;

/**
 * Direct scan for discriminative model codes in the title / model field.
 * The token-roles extractor is tuned for search terms and can substitute a
 * named-model phrase ("FOODI AIR") for the code a title actually carries;
 * the fingerprint cannot afford to lose the code, so it scans for it too.
 * Compatibility spans ("compatible with X") are cut first — an accessory's
 * model is not this product's model.
 */
export function scanModelCodes(text: string): string[] {
  const source = String(text || "").split(/compatible with|works with|for use with/i)[0];
  const found = new Set<string>();
  const pattern = /(?<![A-Za-z0-9])(?:[A-Za-z]+\d[A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)?|\d+[A-Za-z]+[A-Za-z0-9]*)(?![A-Za-z0-9])/g;
  for (const raw of source.match(pattern) || []) {
    if (SPEC_TOKEN.test(raw.replace(/[-_/]/g, ""))) continue;
    if (/^(?:19|20)\d{2}$/.test(raw)) continue;
    const normalized = normalizeModelId(raw);
    if (normalized) found.add(normalized);
  }
  return [...found].sort();
}

/**
 * Extract the match-words fingerprint from listing evidence. Never invents:
 * a field the listing does not support stays empty, and identity that cannot
 * be anchored yields fingerprintKey = null.
 */
export function extractProductFingerprint(input: FingerprintInput): ProductFingerprint {
  const title = titleOf(input);
  const explicitBrand = normBrand(input.brand);
  const brand = explicitBrand || (title ? brandFromTitle(title) : null);

  const roles = extractProductIdentityTokenRoles({
    brand: brand || undefined,
    productName: title || undefined,
    model: input.model || undefined,
    categoryBreadcrumbs: input.categoryBreadcrumbs || undefined,
  });

  const modelSet = new Set<string>();
  const addModel = (raw: string | null | undefined) => {
    const normalized = normalizeModelId(raw);
    if (normalized) modelSet.add(normalized);
  };
  for (const m of roles.primaryModels) addModel(m);
  if (input.model) {
    addModel(input.model);
    // An explicit model field may be a multi-word named model ("Foodi" style
    // codes normalize above; spaced phrases keep their compact form too).
    const compact = String(input.model).toUpperCase().replace(/[\s_./-]+/g, "");
    if (compact.length >= 5 && /[A-Z]/.test(compact) && /\d/.test(compact)) modelSet.add(compact);
  }
  for (const m of input.models || []) addModel(m);
  for (const m of input.identifiers?.models || []) addModel(m);
  for (const m of scanModelCodes([title, input.model || ""].join(" "))) modelSet.add(m);
  const models = [...modelSet].sort();

  const gtinSet = new Set<string>();
  for (const g of input.gtins || []) {
    const n = normalizeGtin(g);
    if (n) gtinSet.add(n);
  }
  for (const g of input.identifiers?.gtins || []) {
    const n = normalizeGtin(g);
    if (n) gtinSet.add(n);
  }
  const gtins = [...gtinSet].sort();

  const kindSet = new Set<string>();
  for (const w of roles.primaryProductFamily) {
    const word = w.toLowerCase();
    if (GENERIC_KIND_WORDS.has(word)) continue;
    // Kind words are words: model codes, pack counts and variant markers
    // that leak into the family extraction are not kind evidence.
    if (/\d/.test(word) || word.endsWith("pack")) continue;
    if (modelSet.has(word.toUpperCase().replace(/-/g, ""))) continue;
    if (roles.primaryVariants.some((v) => v.toLowerCase() === word)) continue;
    kindSet.add(word);
    if (word === "airfryer") kindSet.add("fryer");
  }
  const kindWords = [...kindSet];

  const variantWords = extractVariantWords([title, input.model || ""].join(" "));

  const identityBasis: ProductFingerprint["identityBasis"] = models.length
    ? "model"
    : variantWords.length && kindWords.length
      ? "spec-set"
      : "none";

  let fingerprintKey: string | null = null;
  if (brand && identityBasis === "model") {
    fingerprintKey = `fp:${brand.replace(/\s+/g, "-")}:${models[0].toLowerCase()}`;
  } else if (brand && identityBasis === "spec-set") {
    fingerprintKey = `fp:${brand.replace(/\s+/g, "-")}:spec:${variantWords.join("+")}`;
  }

  return { brand, models, gtins, kindWords, variantWords, identityBasis, fingerprintKey };
}

function variantDimension(token: string): string {
  return token.split(":")[0] || token;
}

function dimsOf(tokens: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of tokens) {
    const dim = variantDimension(t);
    if (!map.has(dim)) map.set(dim, new Set());
    map.get(dim)!.add(t);
  }
  return map;
}

/**
 * Dimension-wise variant comparison. A title often states several values
 * for one dimension (a power station's "150W peak" AND its "100W AC
 * outlet"): a dimension is satisfied when the two sides share ANY value,
 * in conflict when both state the dimension with no value in common.
 */
function compareVariants(a: string[], b: string[]): {
  conflicts: string[];
  missingDims: string[];
  extraDims: string[];
} {
  const da = dimsOf(a);
  const db = dimsOf(b);
  const conflicts: string[] = [];
  const missingDims: string[] = [];
  const extraDims: string[] = [];
  for (const [dim, values] of da) {
    const other = db.get(dim);
    if (!other) {
      missingDims.push(dim);
      continue;
    }
    if (![...values].some((v) => other.has(v))) conflicts.push(dim);
  }
  for (const dim of db.keys()) if (!da.has(dim)) extraDims.push(dim);
  return { conflicts, missingDims, extraDims };
}

/**
 * Decide whether a candidate listing is the fingerprint's product.
 * Asymmetric by design: the fingerprint is the canonical identity (from the
 * verified listing); the candidate is the listing found in another store.
 */
export function matchListingToFingerprint(
  fingerprint: ProductFingerprint,
  candidate: FingerprintInput
): FingerprintMatch {
  const cand = extractProductFingerprint(candidate);
  const reasons: string[] = [];
  const sharedModels = fingerprint.models.filter((m) => cand.models.includes(m));
  const sharedGtins = fingerprint.gtins.filter((g) => cand.gtins.includes(g));
  const variantComparison = compareVariants(fingerprint.variantWords, cand.variantWords);
  const variantConflicts = variantComparison.conflicts;
  const done = (verdict: MatchVerdict): FingerprintMatch => ({
    verdict, reasons, sharedModels, sharedGtins, variantConflicts,
  });

  // A conclusive barcode: same GTIN = same sellable unit, variant words and
  // all (title word extraction noise cannot outrank a GS1 identity).
  if (sharedGtins.length) {
    reasons.push("gtin_match");
    if (fingerprint.brand && cand.brand && fingerprint.brand !== cand.brand) {
      reasons.push("brand_mismatch_despite_gtin");
      return done("ambiguous");
    }
    return done("match");
  }
  const gtinConflict =
    fingerprint.gtins.length > 0 && cand.gtins.length > 0 && !sharedGtins.length;

  // An unanchored fingerprint (no model, no provable spec set) matches nothing.
  if (fingerprint.identityBasis === "none") {
    reasons.push("fingerprint_not_anchored");
    return done("no_match");
  }

  // Brand is a hard gate when both sides state one.
  if (fingerprint.brand && cand.brand && fingerprint.brand !== cand.brand) {
    reasons.push("brand_mismatch");
    return done("no_match");
  }
  if (!fingerprint.brand || !cand.brand) reasons.push("brand_unverified");

  // Model: the core word. No shared model = no merge.
  const modelFamilyOverlap =
    !sharedModels.length &&
    fingerprint.models.some((m) =>
      cand.models.some((c) => m.length >= 4 && c.length >= 4 && (m.startsWith(c) || c.startsWith(m)))
    );
  if (fingerprint.identityBasis === "model") {
    if (!cand.models.length) {
      reasons.push("candidate_missing_model");
      return done(gtinConflict ? "no_match" : "ambiguous");
    }
    if (!sharedModels.length) {
      if (gtinConflict) {
        reasons.push("gtin_conflict", "model_mismatch");
        return done("no_match");
      }
      reasons.push(modelFamilyOverlap ? "model_family_overlap" : "model_mismatch");
      return done(modelFamilyOverlap ? "ambiguous" : "no_match");
    }
    reasons.push("model_match");
  }

  // Kind: head nouns, when both sides name one, must agree; and at least one
  // non-generic kind word must be shared.
  const fpHeads = fingerprint.kindWords.filter((w) => KIND_HEAD_WORDS.has(w));
  const candHeads = cand.kindWords.filter((w) => KIND_HEAD_WORDS.has(w));
  if (fpHeads.length && candHeads.length && !fpHeads.some((w) => candHeads.includes(w))) {
    reasons.push("kind_mismatch");
    return done("no_match");
  }
  const sharedKind = fingerprint.kindWords.filter((w) => cand.kindWords.includes(w));
  if (fingerprint.kindWords.length && cand.kindWords.length && !sharedKind.length) {
    reasons.push("kind_mismatch");
    return done("no_match");
  }
  if (!sharedKind.length) reasons.push("kind_unverified");

  // Named-family guard (model-backed only): when both titles carry
  // distinctive family words (Foodi vs Crispi) and none are shared, a shared
  // model code is not proof — manufacturers reuse codes across lines, and
  // captured listings can mislabel them. Human review decides.
  if (fingerprint.identityBasis === "model") {
    const distinctive = (words: string[]) =>
      words.filter((w) => !KIND_HEAD_WORDS.has(w) && w !== "air");
    const fpDistinct = distinctive(fingerprint.kindWords);
    const candDistinct = distinctive(cand.kindWords);
    if (
      fpDistinct.length &&
      candDistinct.length &&
      !fpDistinct.some((w) => candDistinct.includes(w))
    ) {
      reasons.push("family_words_differ");
      return done("ambiguous");
    }
  }

  // Variants decide same-product vs sibling.
  if (fingerprint.identityBasis === "spec-set") {
    // No model code anywhere: the FULL spec set is the identity.
    if (variantConflicts.length) {
      reasons.push("spec_conflict");
      return done("no_match");
    }
    if (variantComparison.missingDims.length) {
      reasons.push("variant_evidence_missing");
      return done("ambiguous");
    }
    if (variantComparison.extraDims.length) {
      reasons.push("variant_extra_unresolved");
      return done("ambiguous");
    }
    reasons.push("spec_set_match");
    if (gtinConflict) {
      reasons.push("gtin_conflict");
      return done("ambiguous");
    }
    if (reasons.includes("brand_unverified")) return done("ambiguous");
    return done("match");
  }

  // Model-backed: a conflicting variant value = sibling variant, unmerged.
  if (variantConflicts.length) {
    reasons.push("variant_conflict");
    return done("ambiguous");
  }
  if (gtinConflict) {
    // Same model, different barcode: usually a pack-size or regional variant.
    reasons.push("gtin_differs_model_matches");
    return done("ambiguous");
  }
  if (reasons.includes("brand_unverified") || reasons.includes("kind_unverified")) {
    return done("ambiguous");
  }
  return done("match");
}

/** Convenience symmetric check: do two listings name the same product? */
export function listingsMatch(a: FingerprintInput, b: FingerprintInput): FingerprintMatch {
  return matchListingToFingerprint(extractProductFingerprint(a), b);
}
