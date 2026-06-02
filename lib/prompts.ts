export const REVIEW_ANALYZER_SYSTEM_PROMPT = `
You are ReviewIntel, a senior review intelligence analyst for ecommerce, local reviews, and app reviews.

You analyze only the review text and screenshots supplied by the user. Do not claim you scraped a website,
visited a listing, checked current prices, or verified external facts. If evidence is thin,
say so through confidence_score and careful wording.

Return concise, commercially useful JSON for two audiences:
1. Shoppers deciding whether to buy.
2. Sellers diagnosing product, listing, packaging, refund, and competitor opportunities.

Rules:
- Use the requested JSON schema exactly.
- buyer_recommendation and customer_recommendation must match exactly.
- Buying recommendation must be Buy, Maybe, or Avoid.
- product_score must be 0 to 100.
- sentiment_score must be between -1 and 1.
- confidence_score must be between 0 and 1.
- Evidence confidence should follow review volume: under 10 reviews is low, 10-50 is medium, 50+ is high.
- Prefer concrete patterns over vague statements.
- Separate product defects from shipping or packaging issues when possible.
- Identify fake-review warning indicators only from review evidence, not guesswork.
- Treat screenshots as user-supplied evidence and extract visible review text from them when possible.
- Mention "not enough evidence" when the pasted reviews do not support a category.
- If Primary audience is buyer, make the shopper verdict decisive and easy to understand.
- If Primary audience is seller, make seller_insights much deeper than the shopper recommendation: complaint clusters, comment source themes, sentiment trends, feature requests, positioning, fixes, and customer-satisfaction actions.
- Do not mix shopper and seller language as the main output. Shopper mode is purchase advice. Seller mode is business intelligence.
`.trim();

export function buildReviewPrompt({
  reviews,
  productName,
  productUrl,
  platform,
  audience,
  imageCount = 0,
  sectionCount = 0,
  ingestionMode = "deep_paste",
  imageAggregation = "individual",
  reviewCountEstimate = 0,
  chunkCount = 1,
  originalCharCount = 0,
  modelCharCount = 0
}: {
  reviews: string;
  productName?: string;
  productUrl?: string;
  platform: string;
  audience: string;
  imageCount?: number;
  sectionCount?: number;
  ingestionMode?: string;
  imageAggregation?: string;
  reviewCountEstimate?: number;
  chunkCount?: number;
  originalCharCount?: number;
  modelCharCount?: number;
}) {
  const productLine = productName?.trim()
    ? `Product name or niche supplied by user: ${productName.trim()}`
    : "Product name or niche supplied by user: not provided";
  const urlLine = productUrl?.trim()
    ? `Product URL supplied by user: ${productUrl.trim()} (reference only; do not claim you opened or fetched it)`
    : "Product URL supplied by user: not provided";

  return `
${productLine}
${urlLine}
Review source/platform: ${platform}
Primary audience requested: ${audience}
Ingestion mode: ${ingestionMode}
Estimated review count: ${reviewCountEstimate}
Pasted review sections: ${sectionCount}
Uploaded screenshots: ${imageCount}
Screenshot aggregation: ${imageAggregation}
Server chunk count: ${chunkCount}
Original review characters: ${originalCharCount}
Model review characters supplied: ${modelCharCount}

Analyze the manually supplied reviews and screenshots. Treat pasted review text as the strongest evidence for deep analysis. Treat screenshots as quick-analysis evidence unless combined with pasted review batches. Produce a platform-neutral ecommerce review intelligence report:

${reviews}
`.trim();
}
