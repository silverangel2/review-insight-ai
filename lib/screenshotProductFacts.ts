// Free (zero OpenAI) product identification from a product-page screenshot via local OCR.
// Only text actually read with good confidence is used; unclear fields stay empty and a warning is added.
import type { ScreenshotOcrResult } from "./reviewScreenshotOcr";
import { isUnusableListingTitle } from "./listingAuthority";

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

// Amazon's top device menu, longest first so "Echo Dot Max" is not counted as only "Echo Dot".
const AMAZON_DEVICE_MENU = ["echo dot max", "echo dot", "echo spot", "echo studio", "echo show", "echo buds", "echo frames", "echo pop", "echo auto", "fire tv stick", "fire tv", "kindle paperwhite", "kindle"];
const AMAZON_HEADER_LINKS = ["today's deals", "todays deals", "best sellers", "amazon basics", "customer service", "new releases", "gift cards", "buy again", "prime video", "registry", "amazon haul", "keep shopping for"];

/** Amazon nav, menu, and header chrome. A product title must not be taken from these lines. */
export function isAmazonNavOrHeaderText(value: string): boolean {
  const line = String(value || "").replace(/\s+/g, " ").trim();
  if (!line) return false;
  if (CHROME.test(line) || NAV.test(line)) return true;
  const lower = line.toLowerCase();
  if (AMAZON_HEADER_LINKS.filter((label) => lower.includes(label)).length >= 2) return true;
  const families = new Set<string>();
  let rest = lower;
  for (const name of AMAZON_DEVICE_MENU) {
    if (!rest.includes(name)) continue;
    families.add(name);
    rest = rest.split(name).join(" ");
  }
  return families.size >= 3;
}

function cleanProductTitle(value: string | null | undefined): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || isAmazonNavOrHeaderText(text) || isUnusableListingTitle(text)) return "";
  return text;
}

/** Neutral label when the only identity we have is an ASIN. Never show the raw code as the product name. */
export const NEUTRAL_AMAZON_PRODUCT_LABEL = "Amazon product";

/**
 * Prefer the link's fetched title. If that page cannot be read, use the screenshot's
 * product-title line (not nav or menu text). A bare ASIN becomes a neutral label.
 */
export function authoritativeDisplayName(input: { listingTitle?: string | null; screenshotName?: string | null; asin?: string | null }): string {
  const listing = cleanProductTitle(input.listingTitle);
  if (listing) return listing;
  const screenshot = cleanProductTitle(input.screenshotName);
  if (screenshot) return screenshot;
  const asin = String(input.asin || "").trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(asin)) return NEUTRAL_AMAZON_PRODUCT_LABEL;
  return "";
}

const PRICE_RE = /(?:CDN\$|C\$|US\$|CA\$|\$|€|£)\s?\d{1,5}(?:[.,]\d{2})?/;
// Installment / financing amounts sit near the real price on most retailer pages and
// are never the product price ("4 biweekly payments of $44.75 with Klarna").
const INSTALLMENT = /biweekly|monthly payment|payments? of|per month|\/mo\b|klarna|afterpay|affirm|sezzle|financing/i;
// Retail site chrome beyond Amazon's: headers, department menus, account links, cookie
// and legal banners. Two or more distinct hits mark a line as chrome, not a title.
const CHROME_WORDS = ["departments", "services", "grocery", "flyer", "reorder", "my items", "myitems", "credit card",
  "sign in", "signin", "your account", "youraccount", "addtocart", "deliver to", "search everything", "searcheverything", "new&trending", "everyday low prices"];
const NON_TITLE = /cookies|cookie settings|privacy|marketing notice|we want your shopping|key item features|about this item/i;

function isBreadcrumbLine(text: string): boolean {
  if (!/[/›»|]/.test(text)) return false;
  const segments = text.split(/\s*(?:\/|›|»|\|)\s*/).map(s => s.trim()).filter(Boolean);
  if (segments.length < 3) return false;
  if (/\$\s?\d/.test(text)) return false;
  return segments.every(s => s.split(/\s+/).length <= 4);
}

function chromeWordHits(text: string): number {
  const lower = text.toLowerCase();
  return CHROME_WORDS.filter(w => lower.includes(w)).length;
}

function isNoiseToken(token: string): boolean {
  if (!token) return true;
  if (token.length === 1 && !/\d/.test(token)) return true; // lone letter/symbol debris at a title edge
  const alnum = (token.match(/[a-z0-9]/gi) ?? []).length;
  return alnum === 0 || alnum / token.length < 0.5;
}

function priceValue(raw: string): number {
  return Number(raw.replace(/[^0-9.,]/g, "").replace(",", "."));
}

function lineHasRealPrice(text: string): boolean {
  const m = text.match(PRICE_RE);
  return m !== null && priceValue(m[0]) > 0;
}

/** Strip OCR noise tokens and a trailing price from a raw title line. Clean titles pass through unchanged. */
function cleanOcrTitle(raw: string): string {
  let tokens = raw.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && isNoiseToken(tokens[0])) tokens = tokens.slice(1);
  while (tokens.length > 1 && isNoiseToken(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  let text = tokens.join(" ");
  const priceTail = text.match(new RegExp(`\\s+${PRICE_RE.source}\\s*$`));
  if (priceTail) text = text.slice(0, text.length - priceTail[0].length).trim();
  tokens = text.split(/\s+/).filter(Boolean);
  // A lone trailing letter is OCR debris ("Apple AirPods 4 N"); real titles do not end that way.
  if (tokens.length > 2 && /^[a-z]$/i.test(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  while (tokens.length > 1 && isNoiseToken(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  return tokens.join(" ");
}

export function productFactsFromOcr(ocr: ScreenshotOcrResult, minConfidence = 70): ScreenshotProductFacts {
  const lines = ocr.lines.filter(l => l.confidence >= minConfidence).map(l => l.text.trim()).filter(Boolean);
  const all = lines.join("\n");
  const warnings: string[] = [];
  // Store names are low-risk and often sit in dark headers OCR reads with lower confidence.
  const anyText = ocr.lines.filter(l => l.confidence >= 40).map(l => l.text).join("\n");
  const store = STORES.find(([re]) => re.test(anyText))?.[1] ?? "";
  const ratingM = all.match(/\b([1-5](?:[.,]\d)?)\s*(?:out of\s*5|\/\s*5)(?:\s*stars?)?/i);
  const countM = all.match(/\b(\d{1,3}(?:[,.\s]\d{3})+|\d{1,6})\s*(?:global\s+)?(?:ratings?|reviews?|avis|évaluations)\b/i);

  // Title: scored over a wider confidence pool than the corroborating facts. On real
  // screenshots the title line often OCRs at 50-70 (bold text on brand-colored blocks),
  // below the old cutoff, which let high-confidence breadcrumbs win by default. Structural
  // rejection (nav, breadcrumbs, retail chrome, legal/feature headings) plus scoring
  // (a same-line price is the strongest product-block signal) picks the real title.
  const pool = ocr.lines
    .map((l, index) => ({ index, confidence: l.confidence, text: l.text.trim() }))
    .filter(l => l.confidence >= 50 && l.text)
    .slice(0, 40);
  // Everything from a recommendations/sponsored section heading down belongs to OTHER
  // products. Wide page OCR can merge a whole recommendation row into one long line,
  // whose length would otherwise out-score the real title (measured 2026-10-20: a
  // "Best sellers" row line — two rice-cooker titles merged — beat the Crock-Pot title).
  const sectionBreak = ocr.lines.findIndex(l => /best sellers|you might (?:also )?like|customers also|related products|more items to explore|sponsored products?\b/i.test(l.text));
  let bestTitle = "";
  let bestScore = -Infinity;
  let bestTitleLine = "";
  for (const line of pool) {
    const raw = line.text;
    if (sectionBreak >= 0 && line.index >= sectionBreak) continue;
    if (raw.length < 12 || raw.length > 320) continue;
    if (isAmazonNavOrHeaderText(raw) || isBreadcrumbLine(raw) || NON_TITLE.test(raw)) continue;
    // A financing line is never a product title. Without this, an installment line's
    // same-line price earns the +3 product-block signal below and can crown
    // "4 biweekly payments of $22.07 with Klarna" as the product name (measured
    // 2026-10-20 on the Walmart Crock-Pot page once OCR could read the whole page).
    if (INSTALLMENT.test(raw)) continue;
    // Delivery / seller-fulfilment lines are never titles either; at title length
    // their length bonus alone could beat the real title (same Crock-Pot page:
    // "Free seller delivery arrives by Fri, Oct 30 to Mississauga…").
    if (/arrives by|sold (?:and|&) shipped|shipped by|delivery arrives|get it (?:by|on)\b/i.test(raw)) continue;
    if (chromeWordHits(raw) >= 2) continue;
    if (/out of 5|ratings?|reviews?/i.test(raw)) continue;
    const candidate = cleanOcrTitle(raw);
    if (candidate.length < 8) continue;
    const letters = (candidate.match(/[a-z]/gi) ?? []).length;
    if (letters / candidate.length < 0.45) continue;
    let score = 0;
    if (lineHasRealPrice(raw)) score += 3;
    // Longer candidates are likelier to be the real title than short feature bullets
    // ("Feeds Large Groups"); a flat +1 left them within noise of each other.
    if (candidate.length >= 18 && candidate.length <= 200) score += Math.min(2, candidate.length / 40);
    if (/^[a-z]/.test(candidate)) score -= 2; // sentence-fragment continuation, not a title
    if (/\b(with|and|or|the|a|for|to|of)$/i.test(candidate)) score -= 2; // dangling fragment ending
    const firstToken = candidate.split(/\s+/)[0].toLowerCase();
    const brandLineNear = pool.some(other => other.index !== line.index && Math.abs(other.index - line.index) <= 2
      && other.text.split(/\s+/).filter(Boolean).length <= 4
      && other.text.toLowerCase().includes(firstToken));
    if (brandLineNear) score += 1;
    // Brand corroboration anywhere on the page: a real title's brand word recurs
    // (logo caption, breadcrumbs, feature text), while a stray long sentence's first
    // word does not. This is what separates the title from other long lines once the
    // whole page is readable.
    const brandWord = firstToken.split(/[^a-z0-9]+/).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "";
    if (brandWord.length >= 4 && pool.some(other => other.index !== line.index && new RegExp(`\\b${brandWord}\\b`, "i").test(other.text.replace(/[^a-z0-9]+/gi, " ")))) score += 1;
    score -= line.index * 0.02; // titles sit above features and legal text
    if (score > bestScore) { bestScore = score; bestTitle = candidate; bestTitleLine = raw; }
  }
  const title = bestTitle && !isUnusableListingTitle(bestTitle) ? bestTitle : "";

  // Price: the price on the title line wins; otherwise the largest non-installment price
  // in the readable pool (installment amounts and plan prices are smaller decoys).
  // The pool stops at the recommendations/sponsored section break: a price from another
  // product's card is a wrong fact, worse than no price (measured 2026-10-20: when the
  // main price glyph went unread, the pool returned a recommendation's $19.97).
  const pricePool = ocr.lines
    .filter((l, index) => l.confidence >= 40 && (sectionBreak < 0 || index < sectionBreak))
    .map(l => l.text);
  let priceText = "";
  const titleLinePrice = bestTitleLine && !INSTALLMENT.test(bestTitleLine) ? bestTitleLine.match(PRICE_RE) : null;
  if (titleLinePrice && priceValue(titleLinePrice[0]) > 0) priceText = titleLinePrice[0];
  else {
    const candidates: Array<{ raw: string; value: number }> = [];
    for (const text of pricePool) {
      if (INSTALLMENT.test(text)) continue;
      for (const m of text.matchAll(new RegExp(PRICE_RE.source, "g"))) {
        const value = Number(m[0].replace(/[^0-9.,]/g, "").replace(",", "."));
        if (Number.isFinite(value) && value > 0) candidates.push({ raw: m[0], value });
      }
    }
    candidates.sort((a, b) => b.value - a.value);
    if (candidates.length) priceText = candidates[0].raw;
  }
  const brandM = all.match(/(?:visit the|brand:?)\s+([A-Z0-9][\w&'.-]{1,30})(?:\s+store)?/i);
  const brand = brandM?.[1] ?? (title ? title.split(/\s+/)[0].replace(/[^\w&'.-]/g, "") : "");
  if (!title) warnings.push("Could not read the product title clearly from the screenshot.");
  if (!priceText) warnings.push("No price was read with good confidence.");
  // A title-like line with NO product-block context anywhere in the read (no price, no
  // rating, no review count, no store) is not trusted as identity: OCR of a bare product
  // photo can crown control-panel words (a slow cooker's "Low / High / Warm" dial) as a
  // title. Dropping it keeps the honest "could not identify" outcome — and the shopper
  // prompt for a listing screenshot or link — instead of inventing a product name.
  const corroborated = Boolean(priceText || ratingM || countM || store);
  const trustedTitle = title && corroborated ? title : "";
  if (title && !trustedTitle) warnings.push("A title-like line was read with no price, rating, or store context, so it is not trusted.");
  // Without layout understanding we can't prove the price/rating belong to the main product unless a title was read.
  const tied = Boolean(trustedTitle);
  // Price needs a real title. Ratings and review counts stay supplemental even when the
  // only long line was Amazon's menu (the product link names the product).
  if (!tied && priceText) warnings.push("Price seen but not tied to a readable title, so it is ignored.");
  const conf = Math.round(Math.max(0, Math.min(100, ocr.ocrConfidence * (trustedTitle ? 1 : 0.5))));
  return {
    name: trustedTitle, brand: trustedTitle ? brand : "", category: "", store,
    price: tied && priceText ? priceText.replace(/\s+/g, "") : "", rating: ratingM ? ratingM[1].replace(",", ".") : "",
    reviewCount: countM ? countM[1].replace(/[\s.,]/g, "") : "",
    priceBelongsToProduct: tied && Boolean(priceText), ratingBelongsToProduct: Boolean(ratingM), reviewCountBelongsToProduct: Boolean(countM),
    visibleFeatures: [], visibleBadges: lines.filter(l => /best seller|amazon'?s choice|overall pick|top rated/i.test(l)).slice(0, 5),
    identityWarnings: ["Read with free on-device OCR (no AI vision); please confirm the product name.", ...warnings],
    normalizedSearchQuery: trustedTitle, imageConfidence: conf,
  };
}
