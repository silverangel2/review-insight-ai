/**
 * Rescue rescore: recompute the verdict from the product library corpus
 * after the owner has pasted the reviews they researched.
 *
 * Uses the SAME written-only scoring path the page-capture lane uses
 * (lib/pageCapture.ts -> buyingScoreFromReviews + customerFacingDecision):
 * no OpenAI, no marketplace aggregate (the original scan failed to get one
 * — that is why it is in the rescue queue), deterministic on the corpus.
 */

import {
  buyingScoreFromReviews,
  customerFacingDecision,
  hasReadableText,
  type WrittenReview,
} from "@/lib/buyingScore";
import { libraryRecordToWrittenReview } from "@/lib/pageCapture";
import { loadLibraryCorpus } from "@/lib/productReviewLibrary";

type LibraryScoredReview = WrittenReview & { verified: boolean; provenance?: unknown };

export type RescueRescoreResult = {
  verdict: "BUY" | "REVIEW FIRST" | "AVOID";
  buyingScore: number | null;
  confidence: "High" | "Medium" | "Low";
  quotes: string[];
  reviewCount: number;
};

function marketplaceForKey(productKey: string): string | null {
  const idx = productKey.indexOf(":");
  if (idx <= 0) return null;
  return productKey.slice(0, idx) || null;
}

function shortQuote(body: string, max = 180): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return `${text.slice(0, cut > 0 ? cut : max).trim()}…`;
}

/**
 * Score the stored library corpus for a product. Returns null when the
 * corpus is empty (nothing to score) or on any failure — the caller keeps
 * the queue row pending instead of recording a false verdict.
 */
type RescoreDeps = {
  loadCorpus?: (productKey: string) => Promise<{ reviews: unknown[]; scanCount: number }>;
};

export async function rescoreFromLibrary(
  productKey: string,
  deps: RescoreDeps = {}
): Promise<RescueRescoreResult | null> {
  const key = String(productKey ?? "").trim();
  if (!key) return null;
  const loadCorpus = deps.loadCorpus ?? loadLibraryCorpus;
  try {
    const entry = await loadCorpus(key);
    const written: LibraryScoredReview[] = [];
    for (const record of entry.reviews) {
      const review = libraryRecordToWrittenReview(record);
      if (review && hasReadableText(review)) written.push(review);
    }
    if (!written.length) return null;

    const card = buyingScoreFromReviews({
      marketplace: { rating: null, count: null, matchesExactModel: true },
      reviews: written as WrittenReview[],
      variantResolved: true,
      primaryStore: marketplaceForKey(key),
      recall: null,
    });
    const faced = customerFacingDecision({ analyzedReviews: card.audit.n, buyingScore: card });

    const quotes: string[] = [];
    const positives: string[] = [];
    const negatives: string[] = [];
    for (const review of written) {
      const rating = typeof review.rating === "number" ? review.rating : null;
      const body = review.body;
      if (rating !== null && rating >= 4) positives.push(body);
      else if (rating !== null && rating <= 2) negatives.push(body);
    }
    const picked: string[] = [];
    for (const body of [...positives, ...negatives, ...written.map((r) => r.body)]) {
      if (picked.length >= 2) break;
      if (!picked.includes(body)) picked.push(body);
    }
    for (const body of picked) quotes.push(shortQuote(body));

    return {
      verdict: faced.verdict,
      buyingScore: typeof faced.buyScore === "number" ? faced.buyScore : null,
      confidence: card.confidence ?? "Low",
      quotes,
      reviewCount: card.audit.n,
    };
  } catch {
    return null;
  }
}
