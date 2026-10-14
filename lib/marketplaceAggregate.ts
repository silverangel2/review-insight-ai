/**
 * Extracts the REAL marketplace aggregate (average rating, rating count and
 * star histogram) from a product page. Never fills in missing values.
 */
export type ExtractedMarketplaceAggregate = {
  rating: number | null;
  count: number | null;
  histogram: Partial<Record<1 | 2 | 3 | 4 | 5, number>> | null; // percentages
  source: "amazon-html" | "json-ld" | "microdata" | null;
};

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/,/g, "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const okRating = (v: number | null) => (v !== null && v >= 1 && v <= 5 ? Math.round(v * 100) / 100 : null);
const okCount = (v: number | null) => (v !== null && v > 0 ? Math.floor(v) : null);

/** Page aggregate wins. A supplied count is only used when the main rating block has none. */
export function marketplaceCountForCollection(pageCount: number | null | undefined, suppliedCount: number | null | undefined) {
  if (typeof pageCount === "number" && Number.isFinite(pageCount) && pageCount > 0) return Math.floor(pageCount);
  if (typeof suppliedCount === "number" && Number.isFinite(suppliedCount) && suppliedCount > 0) return Math.floor(suppliedCount);
  return null;
}

function fromJsonLd(html: string) {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const body = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const stack: unknown[] = [JSON.parse(body)];
      while (stack.length) {
        const node = stack.pop();
        if (Array.isArray(node)) { stack.push(...node); continue; }
        if (!node || typeof node !== "object") continue;
        const rec = node as Record<string, unknown>;
        const agg = rec.aggregateRating as Record<string, unknown> | undefined;
        if (agg && typeof agg === "object") {
          const rating = okRating(num(agg.ratingValue));
          const count = okCount(num(agg.ratingCount ?? agg.reviewCount));
          if (rating !== null || count !== null) return { rating, count };
        }
        for (const v of Object.values(rec)) if (v && typeof v === "object") stack.push(v);
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  return null;
}

export function extractMarketplaceAggregateFromHtml(html: string): ExtractedMarketplaceAggregate {
  const text = String(html || "");
  let rating: number | null = null;
  let count: number | null = null;
  let source: ExtractedMarketplaceAggregate["source"] = null;

  // Main rating block only. Attribute order varies, and the count node sometimes
  // holds just the number while "ratings" sits on the aria-label.
  const popover = text.match(/<[a-z0-9]+\b[^>]*\bid=["']acrPopover["'][^>]*>/i)?.[0] || "";
  const countTag = text.match(/<([a-z0-9]+)\b[^>]*\bid=["']acrCustomerReviewText["'][^>]*>([\s\S]*?)<\/\1>/i);
  const ratingText = (
    popover.match(/title=["']([\d.]+)\s*out of 5 stars["']/i)
    || text.match(/id=["']acrPopover["'][^>]*title=["']([\d.]+) out of 5 stars/i)
    || text.match(/averageCustomerReviews[\s\S]{0,800}?([\d.]+) out of 5 stars/i)
    || text.match(/data-hook=["']rating-out-of-text["'][^>]*>\s*([\d.]+) out of 5/i)
  )?.[1] || null;
  const countText = countTag
    ? (countTag[0].match(/aria-label=["']([\d,]+)/i)?.[1]
      || countTag[2].replace(/<[^>]+>/g, " ").match(/[\d,]+/)?.[0]
      || null)
    : (text.match(/id=["']acrCustomerReviewText["'][^>]*>\s*\(?([\d,]+)\)?\s*(?:global )?ratings?/i)?.[1]
      || text.match(/data-hook=["']total-review-count["'][^>]*>[\s\S]{0,80}?([\d,]+)\s*(?:global )?ratings?/i)?.[1]
      || null);
  if (ratingText || countText) {
    rating = okRating(num(ratingText));
    count = okCount(num(countText));
    source = "amazon-html";
  }
  if (rating === null || count === null) {
    const ld = fromJsonLd(text);
    if (ld) { rating = rating ?? ld.rating; count = count ?? ld.count; source = source || "json-ld"; }
  }
  if (rating === null) {
    const md = text.match(/itemprop=["']ratingValue["'][^>]*content=["']([\d.]+)["']/i);
    if (md) { rating = okRating(num(md[1])); source = source || "microdata"; }
  }
  if (count === null) {
    const md = text.match(/itemprop=["'](?:ratingCount|reviewCount)["'][^>]*content=["']([\d,]+)["']/i);
    if (md) { count = okCount(num(md[1])); source = source || "microdata"; }
  }

  // Histogram: "72 percent of reviews have 5 stars" (Amazon aria-labels) or "5 star ... 72%".
  const histogram: Partial<Record<1 | 2 | 3 | 4 | 5, number>> = {};
  for (const m of text.matchAll(/(\d{1,3})\s*(?:percent|%) of reviews have (\d) stars?/gi)) {
    const star = Number(m[2]) as 1; const pct = Number(m[1]);
    if (star >= 1 && star <= 5 && pct <= 100 && histogram[star] === undefined) histogram[star] = pct;
  }
  if (Object.keys(histogram).length < 5) {
    for (const m of text.matchAll(/(\d)\s*star[^<%]{0,200}?(\d{1,3})%/gi)) {
      const star = Number(m[1]) as 1; const pct = Number(m[2]);
      if (star >= 1 && star <= 5 && pct <= 100 && histogram[star] === undefined) histogram[star] = pct;
    }
  }
  const complete = [1, 2, 3, 4, 5].every((k) => typeof histogram[k as 1] === "number");
  return { rating, count, histogram: complete ? histogram : null, source };
}
