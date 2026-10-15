/**
 * Display-layer assembly for the shopper result page's quote sections.
 *
 * - The shopper summary ("What buyers love" / "What buyers complain about")
 *   wins: any quote already shown there is removed from the score card's
 *   evidence block ("What buyers like" / "Complaints"), so no quote renders
 *   twice on the page.
 * - The store's published aggregate (rating + count) is surfaced for display
 *   when the evidence carries one but the score itself did not (e.g. the
 *   listing-verification gate excluded it from scoring). Display only — the
 *   scoring gate in lib/buyingScore.ts is untouched.
 *
 * Pure functions; safe to call on server or client.
 */

import { canonicalQuoteKey } from "@/lib/displayQuote";
import { deriveShopperAnswer } from "@/lib/shopperAnswer";
import { validCount, validRating } from "@/lib/buyingScore";

type QuoteBuckets = {
  safety?: string[];
  reliability?: string[];
  positive?: string[];
  negative?: string[];
};

type ScoreLike = {
  quotes?: QuoteBuckets | null;
  audit?: { Rbar?: number | null; N?: number | null } | null;
};

/** Remove evidence-block quotes already shown in the shopper summary. */
export function withDedupedDisplayQuotes<T extends ScoreLike>(score: T, result: unknown): T {
  const answer = deriveShopperAnswer(result);
  const used = new Set<string>();
  for (const point of [...answer.loves, ...answer.complaints]) {
    if (point.quote) {
      const key = canonicalQuoteKey(point.quote);
      if (key) used.add(key);
    }
  }
  const quotes = score.quotes;
  if (!quotes || used.size === 0) return score;
  const drop = (list: string[] | undefined) =>
    Array.isArray(list) ? list.filter((q) => !used.has(canonicalQuoteKey(q))) : list;
  return {
    ...score,
    quotes: { ...quotes, positive: drop(quotes.positive), negative: drop(quotes.negative) },
  };
}

export type PageAggregate = { rating: number; count: number | null };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * The marketplace's published aggregate for display on the headline card.
 * Returns null when the evidence carries no aggregate, or when the score's
 * own audit already surfaced one (audit.Rbar set) — so it never duplicates
 * the card's existing evidence line.
 */
export function pageAggregateForDisplay(result: unknown): PageAggregate | null {
  const evidence = asRecord(asRecord(result).reviewEvidence);
  const collector = asRecord(evidence.reviewCollector);
  const aggregate = asRecord(collector.marketplaceAggregate);
  const rating = validRating(aggregate.rating);
  if (rating === null) return null;
  const audit = asRecord(asRecord(result).buyingScoreV2).audit;
  const auditRating = asRecord(audit).Rbar;
  if (typeof auditRating === "number" && auditRating > 0) return null;
  return { rating, count: validCount(aggregate.count) };
}
