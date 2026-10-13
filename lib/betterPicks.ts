// Free (no OpenAI) Better Picks for affiliate revenue. Three honest tiers:
//  1. "reviewed": products ReviewIntel already scanned in the same product type
//     with stronger REAL-review results (from stored results only).
//  2. "buy_scanned": affiliate-tagged Amazon link for the scanned product itself.
//  3. "search": affiliate-tagged Amazon search links, clearly labeled as
//     searches, never presented as reviewed picks or as "better".
import { attachAffiliateUrl, isAmazonUrl, type AffiliateProduct } from "./affiliate";

export type BetterPickKind = "buy_scanned" | "reviewed" | "search";
export type BetterPick = AffiliateProduct & {
  kind: BetterPickKind;
  /** Plain label shown to shoppers; "search" picks always say they are searches. */
  label: string;
  /** Real-review evidence backing a "reviewed" pick (null for others). */
  evidence: { verdict: string; acceptedReviews: number; score: number | null } | null;
};

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? v as Rec : {});
const str = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const STOP = new Set(["the", "and", "for", "with", "of", "a", "an", "in", "to", "by", "new", "pack", "set", "kit", "edition", "version", "gen", "generation", "canadian", "black", "white", "grey", "gray", "silver", "blue", "red", "green", "pink", "gold", "inch", "in", "cm", "mm", "pcs", "piece", "pieces", "count", "ct", "size", "large", "small", "medium", "pro", "plus", "max", "mini", "ultra", "air", "premium", "less", "more", "best", "w", "x"]);

export function productTypeTokens(title: string, brand = ""): string[] {
  const brandTokens = new Set(brand.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  return Array.from(new Set(title.toLowerCase().split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP.has(t) && !brandTokens.has(t) && !/\d/.test(t))));
}

export type ScannedProduct = { title: string; brand?: string | null; verdict?: string | null; buyScore?: number | null; acceptedReviews?: number | null; listingUrl?: string | null; marketplace?: "amazon.ca" | "amazon.com"; category?: string | null };

function amazonHost(marketplace?: string) { return marketplace === "amazon.com" ? "www.amazon.com" : "www.amazon.ca"; }
export function amazonSearchUrl(query: string, marketplace?: string) {
  return `https://${amazonHost(marketplace)}/s?k=${encodeURIComponent(query.replace(/\s+/g, " ").trim())}`;
}

/** Real-review summary from a stored result (analyses.analysis_json). Null unless SUFFICIENT review-evidence-v2. */
export function storedReviewSummary(row: Rec): { title: string; verdict: string; score: number | null; acceptedReviews: number; listingUrl: string | null; category: string | null } | null {
  const json = obj(row.analysis_json);
  const result = obj(json.result && typeof json.result === "object" ? json.result : json);
  if (str(result.analysisVersion) !== "review-evidence-v2") return null;
  const evidence = obj(result.reviewEvidence);
  const accepted = Array.isArray(obj(evidence.evidenceAdjudication).acceptedRecords) ? (obj(evidence.evidenceAdjudication).acceptedRecords as unknown[]).length : num(result.commentsAnalyzed) ?? num(evidence.commentsAnalyzed) ?? 0;
  const state = str(result.evidenceState || obj(result.deterministicResult).evidenceState).toUpperCase();
  const verdict = str(result.verdict || result.customerVerdict).toUpperCase();
  if (state !== "SUFFICIENT" || accepted < 3 || /NOT ENOUGH/.test(verdict)) return null;
  const product = obj(result.product);
  const title = str(product.title) || str(product.name) || str(result.productName) || str(row.product_name);
  if (!title) return null;
  const listingUrl = str(result.exactListingUrl) || str(obj(evidence.listingEvidence).exactListingUrl) || null;
  const category = str(result.category) || str(product.category) || null;
  return { title, verdict, score: num(result.buyScore) ?? num(result.score), acceptedReviews: accepted, listingUrl, category };
}

const RANK: Record<string, number> = { BUY: 3, "DO NOT BUY YET": 2, AVOID: 1 };

/** Is a stored product genuinely backed as better than the scanned one by our real-review data? */
export function isBackedBetter(peer: { verdict: string; score: number | null; acceptedReviews: number }, scanned: ScannedProduct) {
  const pr = RANK[peer.verdict] ?? 0, sr = RANK[String(scanned.verdict || "").toUpperCase()] ?? 0;
  if (peer.verdict !== "BUY") return false; // only recommend products our evidence says to buy
  if (pr > sr) return true;
  return pr === sr && peer.score !== null && scanned.buyScore !== null && scanned.buyScore !== undefined && peer.score >= scanned.buyScore + 0.5 && peer.acceptedReviews >= (scanned.acceptedReviews || 0);
}

export function buildBetterPicks(scanned: ScannedProduct, storedRows: Rec[] = [], options: { maxReviewed?: number; maxSearch?: number } = {}): BetterPick[] {
  const picks: BetterPick[] = [];
  const store = scanned.marketplace === "amazon.com" ? "Amazon.com" : "Amazon.ca";
  const brand = str(scanned.brand);
  const title = str(scanned.title);

  // 2 (shown first): the scanned product itself — buying option, not a recommendation.
  const scannedUrl = scanned.listingUrl && isAmazonUrl(scanned.listingUrl) ? scanned.listingUrl : amazonSearchUrl(title, scanned.marketplace);
  picks.push({ ...attachAffiliateUrl({ title, store, url: scannedUrl, imageUrl: null, rating: null, reviewCount: null, price: null, badge: "This product", whyBetter: scanned.listingUrl && isAmazonUrl(scanned.listingUrl) ? "The exact listing you scanned." : "Amazon search for the product you scanned.", aiLikeRisk: null }), kind: "buy_scanned", label: "Check price on Amazon", evidence: null });

  // 1: stored products of the same type with stronger real-review results.
  const typeTokens = productTypeTokens(title, brand);
  const scannedKey = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const seen = new Set([scannedKey]);
  const peers = storedRows.map(storedReviewSummary).filter((p): p is NonNullable<ReturnType<typeof storedReviewSummary>> => Boolean(p))
    .filter(peer => {
      const key = peer.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      const sameCategory = scanned.category && peer.category && scanned.category.toLowerCase() === peer.category.toLowerCase();
      const shared = productTypeTokens(peer.title).filter(t => typeTokens.includes(t)).length;
      if (!(sameCategory || shared >= 2)) return false;
      if (!isBackedBetter(peer, scanned)) return false;
      seen.add(key); return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.acceptedReviews - a.acceptedReviews)
    .slice(0, options.maxReviewed ?? 2);
  for (const peer of peers) {
    const url = peer.listingUrl && isAmazonUrl(peer.listingUrl) ? peer.listingUrl : amazonSearchUrl(peer.title, scanned.marketplace);
    picks.push({ ...attachAffiliateUrl({ title: peer.title, store, url, imageUrl: null, rating: null, reviewCount: null, price: null, badge: "Stronger in our scans", whyBetter: `ReviewIntel's verdict: Buy, from ${peer.acceptedReviews} real buyer reviews${peer.score !== null ? ` (score ${peer.score.toFixed(1)}/10)` : ""}.`, aiLikeRisk: null }), kind: "reviewed", label: "Better rated in ReviewIntel scans", evidence: { verdict: peer.verdict, acceptedReviews: peer.acceptedReviews, score: peer.score } });
  }

  // 3: honest search links (never "better", never "reviewed").
  const typePhrase = typeTokens.slice(0, 3).join(" ");
  const searches = [
    typePhrase ? { q: `${typePhrase}`, label: `Compare top-rated ${typePhrase} on Amazon` } : null,
    brand && typePhrase ? { q: `${brand} ${typePhrase}`, label: `See other ${brand} ${typePhrase} on Amazon` } : null,
  ].filter((s): s is { q: string; label: string } => Boolean(s)).slice(0, options.maxSearch ?? 2);
  for (const search of searches) {
    picks.push({ ...attachAffiliateUrl({ title: search.label, store, url: amazonSearchUrl(search.q, scanned.marketplace), imageUrl: null, rating: null, reviewCount: null, price: null, badge: "Amazon search", whyBetter: "A search link, not a reviewed pick. ReviewIntel hasn't checked these results.", aiLikeRisk: null }), kind: "search", label: "Search on Amazon", evidence: null });
  }
  return picks;
}
