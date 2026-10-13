// Free (zero OpenAI) product identification from a product-page screenshot via local OCR.
// Only text actually read with good confidence is used; unclear fields stay empty and a warning is added.
import type { ScreenshotOcrResult } from "./reviewScreenshotOcr";

export type ScreenshotProductFacts = {
  name: string; brand: string; category: string; store: string; price: string; rating: string; reviewCount: string;
  priceBelongsToProduct: boolean; ratingBelongsToProduct: boolean; reviewCountBelongsToProduct: boolean;
  visibleFeatures: string[]; visibleBadges: string[]; identityWarnings: string[]; normalizedSearchQuery: string; imageConfidence: number;
};

const STORES: Array<[RegExp, string]> = [
  [/amazon\.ca/i, "Amazon.ca"], [/amazon\.com/i, "Amazon.com"], [/amazon\.co\.uk/i, "Amazon.co.uk"], [/\bamazon\b/i, "Amazon"],
  [/walmart\.ca/i, "Walmart.ca"], [/walmart/i, "Walmart"], [/best ?buy/i, "Best Buy"], [/\btarget\b/i, "Target"],
  [/costco/i, "Costco"], [/canadian tire/i, "Canadian Tire"], [/ebay/i, "eBay"], [/home ?depot/i, "Home Depot"],
];
const CHROME = /^(sponsored|visit the|add to cart|buy now|in stock|ships from|sold by|deliver|free (delivery|shipping|returns)|returns?|see more|about this item|customers (also|who)|sign in|account|cart|hello|search|menu|all|today'?s deals|share|report|\$|cdn\$|c\$)/i;

// Browser/site navigation anywhere in a line (address bar, greeting, account links).
const NAV = /\b(sign in|hello,|returns & orders|your account|cart|deliver to|https?:|www\.)|\b[a-z0-9-]+\.(ca|com|co\.uk)\b/i;

export function productFactsFromOcr(ocr: ScreenshotOcrResult, minConfidence = 70): ScreenshotProductFacts {
  const lines = ocr.lines.filter(l => l.confidence >= minConfidence).map(l => l.text.trim()).filter(Boolean);
  const all = lines.join("\n");
  const warnings: string[] = [];
  // Store names are low-risk and often sit in dark headers OCR reads with lower confidence.
  const anyText = ocr.lines.filter(l => l.confidence >= 40).map(l => l.text).join("\n");
  const store = STORES.find(([re]) => re.test(anyText))?.[1] ?? "";
  const ratingM = all.match(/\b([1-5](?:[.,]\d)?)\s*(?:out of\s*5|\/\s*5)(?:\s*stars?)?/i);
  const countM = all.match(/\b(\d{1,3}(?:[,.\s]\d{3})+|\d{1,6})\s*(?:global\s+)?(?:ratings?|reviews?|avis|évaluations)\b/i);
  const priceM = all.match(/(?:CDN\$|C\$|US\$|CA\$|\$|€|£)\s?\d{1,5}(?:[.,]\d{2})?/);
  // Title: the first long, mostly-letters line that isn't page chrome, near the top.
  const title = lines.slice(0, 25).find(l => l.length >= 18 && l.length <= 220 && /[a-z]{3,}/i.test(l) && !CHROME.test(l)
    && (l.match(/[a-z]/gi)?.length ?? 0) / l.length > 0.55 && !/out of 5|ratings?|reviews?/i.test(l) && !NAV.test(l)) ?? "";
  const brandM = all.match(/(?:visit the|brand:?)\s+([A-Z0-9][\w&'.-]{1,30})(?:\s+store)?/i);
  const brand = brandM?.[1] ?? (title ? title.split(/\s+/)[0].replace(/[^\w&'.-]/g, "") : "");
  if (!title) warnings.push("Could not read the product title clearly from the screenshot.");
  if (!priceM) warnings.push("No price was read with good confidence.");
  // Without layout understanding we can't prove the price/rating belong to the main product unless a title was read.
  const tied = Boolean(title);
  if (!tied && (priceM || ratingM)) warnings.push("Price/rating seen but not tied to a readable title, so they are ignored.");
  const conf = Math.round(Math.max(0, Math.min(100, ocr.ocrConfidence * (title ? 1 : 0.5))));
  return {
    name: title, brand: title ? brand : "", category: "", store,
    price: tied && priceM ? priceM[0].replace(/\s+/g, "") : "", rating: tied && ratingM ? ratingM[1].replace(",", ".") : "",
    reviewCount: tied && countM ? countM[1].replace(/[\s.,]/g, "") : "",
    priceBelongsToProduct: tied && Boolean(priceM), ratingBelongsToProduct: tied && Boolean(ratingM), reviewCountBelongsToProduct: tied && Boolean(countM),
    visibleFeatures: [], visibleBadges: lines.filter(l => /best seller|amazon'?s choice|overall pick|top rated/i.test(l)).slice(0, 5),
    identityWarnings: ["Read with free on-device OCR (no AI vision); please confirm the product name.", ...warnings],
    normalizedSearchQuery: title, imageConfidence: conf,
  };
}
