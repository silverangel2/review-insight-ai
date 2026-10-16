/**
 * Evidence-consistency guards for the shopper result page (defect batch 2).
 *
 * Display-layer only: no scoring math, no gates, no thresholds change.
 * Every helper here is deterministic and traceable to the scan's own
 * evidence — nothing is invented.
 */

/** Canonical short excerpt: first sentence(s) up to ~150 chars, cut at a word boundary. */
export function canonicalShortQuote(body: string, max = 150): string {
  const text = String(body ?? "")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/\*([^\*\n]+?)\*/g, "$1")
    .replace(/__([^_]+?)__/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^(?:rating|note)\s*:?\s*[\u2605\u2606]{1,5}\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const sentenceEnd = text.slice(0, max).search(/[.!?](?=\s)[^.!?]*$/);
  if (sentenceEnd >= 60) return text.slice(0, sentenceEnd + 1);
  const cut = text.lastIndexOf(" ", max);
  return `${text.slice(0, cut > 40 ? cut : max).trimEnd()}…`;
}

/** Canonical identity for a displayed quote: identical review = identical key. */
export function quoteIdentityKey(quote: string): string {
  return canonicalShortQuote(quote, 100000).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Two displayed quotes are the "same quote" when one is a truncation of the
 * other. Different parts of the page truncate the same review body at
 * different lengths; prefix matching catches that without fuzzy guesswork.
 */
export function sameDisplayedQuote(a: string, b: string): boolean {
  const x = quoteIdentityKey(a);
  const y = quoteIdentityKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  return shorter.length >= 40 && longer.startsWith(shorter);
}

/**
 * Page-level single assignment of quotes. Walk sections in priority order;
 * the first section keeps the quote, later sections lose it (they keep their
 * theme label, never a duplicate). Returns the filtered lists in order.
 */
export function assignQuotesOnce(lists: string[][]): string[][] {
  const seen: string[] = [];
  return lists.map((list) => {
    const out: string[] = [];
    for (const quote of list) {
      if (!quote) continue;
      if (seen.some((kept) => sameDisplayedQuote(kept, quote))) continue;
      seen.push(quote);
      out.push(quote);
    }
    return out;
  });
}

/** Product category inferred from the product name. Used only to gate which
 *  buyer-fit tropes may render — a size/performance trope must never render
 *  for a product where size is not a real dimension. */
export type ProductCategory =
  | "kitchen_appliance"
  | "speaker_audio"
  | "personal_care"
  | "smart_home"
  | "cleaning"
  | "unknown";

export function detectProductCategory(title: string): ProductCategory {
  const t = String(title || "").toLowerCase();
  if (/\b(cooker|pot|blender|mixer|air fryer|kettle|toaster|oven|microwave|espresso|coffee)\b/.test(t)) return "kitchen_appliance";
  if (/\b(speaker|earbud|headphone|soundbar|soundcore)\b/.test(t)) return "speaker_audio";
  if (/\b(cream|moisturizer|cleanser|shampoo|serum|lotion|skincare|makeup|perfume)\b/.test(t)) return "personal_care";
  if (/\b(echo|alexa|dot|thermostat|doorbell|camera|smart (plug|bulb|lock))\b/.test(t)) return "smart_home";
  if (/\b(vacuum|mop|robot|cleaner)\b/.test(t)) return "cleaning";
  return "unknown";
}

/** Strip a marketplace-aggregate restatement from a bottom-line sentence so
 *  the aggregate renders exactly once per page (on the headline card). */
export function stripAggregateRestatement(text: string): string {
  let out = String(text ?? "");
  out = out.replace(/\d(?:\.\d)?\s*★\s*from\s*[\d,]+\s*ratings?\.?/gi, "");
  out = out.replace(/\b\d(?:\.\d)?\/5\b(?:\s*(?:from|with)\s*[\d,]+\s*(?:total\s*)?(?:marketplace\s*)?ratings?)?\.?/gi, "");
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return out;
}

/** Plain-language pluralization for small counts. */
export function pluralize(count: number, singular: string, plural?: string): string {
  const n = Math.max(0, Math.round(count));
  return `${n} ${n === 1 ? singular : plural || `${singular}s`}`;
}

/**
 * Defect batch 2, rule 4: the rescue/no-score box renders ONLY when the scan
 * genuinely has no score/verdict. A stale verdict field saying "not enough"
 * while buyingScoreV2 holds a real score no longer triggers it.
 */
export type ScoredResultLike = {
  scanState?: unknown;
  verdict?: unknown;
  buyingScoreV2?: null | { score?: unknown; verdict?: unknown };
};

export function isNoVerdictResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const record = result as ScoredResultLike;
  const v2 = (record.buyingScoreV2 ?? null) as null | { score?: unknown; verdict?: unknown };
  const hasScoreVerdict =
    (typeof v2?.score === "number" && Number.isFinite(v2.score)) ||
    (typeof v2?.verdict === "string" && v2.verdict.length > 0);
  if (hasScoreVerdict) return false;
  if (record.scanState === "INSUFFICIENT_EVIDENCE") return true;
  const verdict = String(record.verdict ?? "").toUpperCase();
  return verdict === "REVIEW EVIDENCE NOT ENOUGH" || verdict === "NOT_ENOUGH";
}
