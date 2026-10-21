// Free (zero OpenAI) shopper comparison from two real scans' review evidence.
// A winner is only named when both sides have a real-review score and the gap is meaningful.
import { deriveShopperAnswer } from "./shopperAnswer";

/** Honest wording when one side has too few real reviews: Low confidence and a next step. */
export function lowConfidenceShopperCompare(countA?: number | null, countB?: number | null) {
  const a = typeof countA === "number" && Number.isFinite(countA) ? Math.max(0, Math.floor(countA)) : null;
  const b = typeof countB === "number" && Number.isFinite(countB) ? Math.max(0, Math.floor(countB)) : null;
  const summary =
    a === 0 && b === 0
      ? "Neither product has any written reviews we could read yet, so there is no honest winner."
      : a === 0
        ? "Product A has no written reviews we could read yet, so there is no honest winner."
        : b === 0
          ? "Product B has no written reviews we could read yet, so there is no honest winner."
          : "At least one product does not have enough written reviews yet to pick a winner honestly.";
  const reasons = ["Low confidence until both products have stronger written evidence."];
  if (a !== null && b !== null) {
    reasons.push(`Written reviews read: Product A ${a}; Product B ${b}.`);
  }
  return {
    winner: "INCOMPARABLE",
    // A reviews shortfall is NOT a product-type judgment. directSubstitutes
    // stays unknown (null) here so no surface can turn an evidence shortage
    // into a "different product types" claim (2026-10-20 compare audit, D1).
    directSubstitutes: null,
    reason: "insufficient_evidence",
    evidence: { commentsAnalyzedA: a, commentsAnalyzedB: b },
    confidence: null,
    verdictHeadline: "Low confidence",
    summary,
    reasons,
    nextSteps: ["Scan the Amazon link for each product to pull in more real reviews.", "Or add a review screenshot for the product with fewer reviews."],
  };
}

/** Real review count from a scan record, using the same reader as the shopper answer. */
export function realReviewCount(record: unknown) {
  return deriveShopperAnswer(record).reviewCount || 0;
}

export function freeShopperCompare(a: unknown, b: unknown) {
  const A = deriveShopperAnswer(a), B = deriveShopperAnswer(b);
  const rated = (x: typeof A) => x.kind !== "not_enough" && x.score !== null;
  if (!rated(A) || !rated(B)) {
    return lowConfidenceShopperCompare(A.reviewCount, B.reviewCount);
  }
  const sa = A.score as number, sb = B.score as number, gap = Math.abs(sa - sb);
  const winner = gap < 0.5 ? "TIE" : sa > sb ? "A" : "B";
  const conf = Math.min(A.confidencePercent ?? 50, B.confidencePercent ?? 50);
  const firstC = (x: typeof A) => x.complaints[0]?.claim, firstL = (x: typeof A) => x.loves[0]?.claim;
  const reasons = [
    `Real-review score: Product A ${sa.toFixed(1)} vs Product B ${sb.toFixed(1)}.`,
    firstL(A) || firstL(B) ? `Most praised: A "${firstL(A) ?? "nothing repeated"}", B "${firstL(B) ?? "nothing repeated"}".` : null,
    firstC(A) || firstC(B) ? `Most repeated complaint: A "${firstC(A) ?? "none repeated"}", B "${firstC(B) ?? "none repeated"}".` : null,
    `Value from reviews: A ${A.value}, B ${B.value}.`,
  ].filter((r): r is string => Boolean(r));
  const loser = winner === "A" ? B : A, w = winner === "A" ? A : B;
  return {
    // This engine compares review evidence only; it makes no product-type
    // judgment, so directSubstitutes is unknown (null), never hardcoded true.
    winner, directSubstitutes: null, confidence: conf,
    verdictHeadline: winner === "TIE" ? "Too close to call" : `Product ${winner} has the stronger reviews`,
    summary: winner === "TIE" ? "Both products score about the same from real buyer reviews; decide on price and the complaints below."
      : `Product ${winner} scores higher from what real buyers wrote (${(w.score as number).toFixed(1)} vs ${(loser.score as number).toFixed(1)}). We can't confirm both serve the exact same need.`,
    reasons: reasons.slice(0, 4),
    nextSteps: [firstC(w) ? `Before buying ${winner === "TIE" ? "either" : `Product ${winner}`}, check whether "${firstC(w)}" matters to you.` : "Check recent reviews for any new issues.", "Confirm the exact model, size and warranty on the listing."],
    analysisEngine: "deterministic-free", openAiCalls: 0,
  };
}

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function readStringField(record: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * The evidence-collection input for one compare side, built from the scan
 * record the shopper already produced. The listing URL / ASIN / store the
 * original scan carried are passed through, so re-collection anchors on the
 * shopper's exact listing instead of a name-only search whose failure could
 * not be told apart from a thin-review product (2026-10-20 compare audit, D3).
 */
export function compareEvidenceInput(product: unknown) {
  const record = asRecord(product);
  const productRecord = asRecord(record.product);
  const identity = asRecord(record.productIdentity);
  const verified = asRecord(record.verifiedProductMetadata);
  const reviewEvidence = asRecord(record.reviewEvidence);
  const listingEvidence = asRecord(reviewEvidence.listingEvidence);

  const productName =
    readStringField(record, [
      "productName",
      "product_name",
      "name",
      "title",
      "productTitle",
      "detectedProductName",
      "itemName",
      "item",
    ]) ||
    readStringField(productRecord, ["title", "name"]) ||
    JSON.stringify(product).slice(0, 220);

  const brand =
    readStringField(record, ["brand", "brandName", "manufacturer"]) ||
    readStringField(productRecord, ["brand", "brandName", "manufacturer"]) ||
    readStringField(identity, ["brand"]);
  const model =
    readStringField(record, ["model", "modelNumber", "sku"]) ||
    readStringField(productRecord, ["model", "modelNumber", "sku"]) ||
    readStringField(identity, ["model", "modelNumber"]);
  const store =
    readStringField(record, ["store"]) ||
    readStringField(productRecord, ["store"]) ||
    readStringField(identity, ["store"]) ||
    readStringField(listingEvidence, ["store"]) ||
    null;

  let listingUrl =
    readStringField(record, ["listingUrl", "productUrl", "sourceUrl", "url"]) ||
    readStringField(productRecord, ["url", "link", "listingUrl", "productUrl"]) ||
    readStringField(listingEvidence, ["exactListingUrl", "listingUrl", "url"]) ||
    readStringField(identity, ["exactListingUrl", "listingUrl"]) ||
    readStringField(verified, ["canonicalListingUrl", "listingUrl"]);

  if (!listingUrl) {
    const asin =
      readStringField(record, ["asin", "ASIN"]) ||
      readStringField(productRecord, ["asin", "ASIN"]) ||
      readStringField(identity, ["asin", "ASIN"]);
    if (/^[A-Z0-9]{10}$/i.test(asin)) {
      const host = /amazon\.ca/i.test(String(store || "")) ? "www.amazon.ca" : "www.amazon.com";
      listingUrl = `https://${host}/dp/${asin.toUpperCase()}`;
    }
  }

  return { productName, brand, model, store, listingUrl: listingUrl || null };
}
