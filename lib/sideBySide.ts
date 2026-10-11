// Side-by-side comparison built ONLY from two real stored scans (no OpenAI, no invented data).
// "Higher" is stated only when both sides have a real-review verdict and a score.
import { deriveShopperAnswer, type ShopperAnswer } from "./shopperAnswer";
import { buildAmazonAffiliateUrl, isAmazonUrl } from "./affiliate";

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export type SideColumn = {
  scanId: string; title: string; answer: ShopperAnswer;
  listingUrl: string | null; buyUrl: string | null; buyLabel: string | null; isAffiliate: boolean;
};

export function sideColumn(result: Rec, scanId: string): SideColumn {
  const answer = deriveShopperAnswer(result);
  const product = obj(result.product);
  const title = str(product.title) || str(product.name) || str(result.productName) || "Scanned product";
  const listingUrl = str(result.exactListingUrl) || str(obj(obj(result.reviewEvidence).listingEvidence).exactListingUrl) || str(result.productUrl) || null;
  const amazon = Boolean(listingUrl && isAmazonUrl(listingUrl));
  const buyUrl = amazon ? buildAmazonAffiliateUrl(listingUrl!) : null;
  return { scanId, title, answer, listingUrl, buyUrl, buyLabel: buyUrl ? "Check price on Amazon" : null, isAffiliate: Boolean(buyUrl && /[?&]tag=/.test(buyUrl)) };
}

export function compareSummary(a: SideColumn, b: SideColumn): string {
  const rated = (c: SideColumn) => c.answer.kind !== "not_enough" && c.answer.score !== null;
  if (!rated(a) || !rated(b)) return "At least one product doesn't have enough real reviews yet, so we don't pick a side.";
  if (a.answer.score === b.answer.score) return "Both score the same based on real buyer reviews.";
  const hi = (a.answer.score as number) > (b.answer.score as number) ? a : b;
  return `${hi.title} scores higher based on what real buyers wrote (${hi.answer.score!.toFixed(1)} vs ${(hi === a ? b : a).answer.score!.toFixed(1)}).`;
}
