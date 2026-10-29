// Free (zero OpenAI) product identification from a product-page screenshot via local OCR.
// Only text actually read with good confidence is used; unclear fields stay empty and a warning is added.
import type { ScreenshotOcrResult } from "./reviewScreenshotOcr";
import { isUnusableListingTitle } from "./listingAuthority";
import { chromeTitlePenalty, cleanScreenshotProductTitle, isStorePageChromeLine, isUnrelatedPageText, modelTokenFromTitle } from "./screenshotListingIdentity";

export type ScreenshotProductFacts = {
  name: string; brand: string; category: string; store: string; price: string; rating: string; reviewCount: string;
  priceBelongsToProduct: boolean; ratingBelongsToProduct: boolean; reviewCountBelongsToProduct: boolean;
  visibleFeatures: string[]; visibleBadges: string[]; identityWarnings: string[]; normalizedSearchQuery: string; imageConfidence: number;
};

const STORES: Array<[RegExp, string]> = [
  [/amazon\.ca/i, "Amazon.ca"], [/amazon\.com/i, "Amazon.com"], [/amazon\.co\.uk/i, "Amazon.co.uk"], [/\bamazon\b/i, "Amazon"],
  [/walmart\.ca/i, "Walmart.ca"], [/walmart\.com/i, "Walmart.com"], [/walmart/i, "Walmart"],
  [/bestbuy\.ca|best\s*buy\.ca/i, "Best Buy.ca"], [/bestbuy\.com|best\s*buy\.com/i, "Best Buy.com"], [/best ?buy/i, "Best Buy"],
  [/\btarget\b/i, "Target"],
  [/costco/i, "Costco"], [/canadian tire/i, "Canadian Tire"], [/ebay/i, "eBay"], [/home ?depot/i, "Home Depot"],
];
const CHROME = /^(sponsored|visit the|add to cart|buy now|in stock|ships from|sold by|deliver|free (delivery|shipping|returns)|returns?|see more|about this item|customers (also|who)|sign in|account|cart|hello|search|menu|all|today'?s deals|share|report|\$|cdn\$|c\$)/i;

/**
 * Page furniture that carries a price or a town name and kept outscoring the
 * real title (2026-10-21 backfill: 7 of 10 live screenshot scans were named
 * after a delivery banner, a seller-price line, or a protection plan). None
 * of these shapes can be a product title:
 * - delivery / pickup / shipping banners ("Free delivery over $35, arrives
 *   tomorrow to Mississauga L5V 2N6") — including any line carrying a
 *   Canadian postal code, which no product title contains;
 * - seller-option prompts ("Starting from $498.00 Compare all sellers");
 * - protection-plan upsells ("2-Year Plan", "Accident protection") — they
 *   inherit the product's price bonuses while naming no product;
 * - purchase-mode lines ("One-time purchase", "Subscribe & Save") and
 *   fulfillment stamps ("Fulfilled by Walmart").
 */
const POSTAL_CODE = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/;
const DELIVERY_BANNER =
  /(?:\b(?:free\s+)?(?:delivery|pickup|shipping)\b[^.]{0,60}?\b(?:over|arrives?|today|tomorrow|by|from store)\b)|\bexpress delivery\b|\barrives (?:today|tomorrow|by)\b/i;
/**
 * OCR-garbled delivery lines (2026-10-24: "Freedellvery over $35,
 * arrivestoday to Mississauga, LSV 2N6" crowned the product). The clean
 * DELIVERY_BANNER above needs the words "free delivery" intact; a garbled
 * merge ("Freedellvery", "arrivestoday") and a garbled postal code ("LSV"
 * for "L5V") defeat all three guards at once. Squash the line to letters
 * and match "delivery" with OCR tolerance (dropped/duplicated letters),
 * requiring a free/threshold/arrival cue in the same line so a real title
 * containing "Dove" or "Deluxe" can never trip it (neither matches the
 * tolerant shape).
 */
const DELIVERY_LIKE_SQUASHED = /d[ei]?l{1,2}[ei]?v[ei]r[yi]?/;
function isGarbledDeliveryLine(text: string): boolean {
  const squashed = text.toLowerCase().replace(/[^a-z]/g, "");
  if (!DELIVERY_LIKE_SQUASHED.test(squashed)) return false;
  return squashed.includes("free") || /\bover\b/i.test(text) || /\barrives?\b/i.test(text)
    || /\btomorrow\b/i.test(text) || /\btoday\b/i.test(text);
}
/**
 * Store-location bars (2026-10-24: "Halifax - Bayers Lak... Open - Closes
 * at 8:00 PM" crowned the product). Shapes: a hours clause ("Closes at",
 * "Open until", "Open today"), or a short line ending in "Open" (with an
 * optional truncation ellipsis). The trailing-Open shape cannot touch a
 * real title: "Open Box Dyson V8…" opens with Open but never ends with it.
 */
const STORE_HOURS = /\b(closes at|open until|open today|open now)\b/i;
function isStoreLocationBar(text: string): boolean {
  if (STORE_HOURS.test(text)) return true;
  const trimmed = text.trim().replace(/[….]+$/, "");
  if (/open$/i.test(trimmed) && trimmed.split(/\s+/).filter(Boolean).length <= 10) return true;
  return false;
}
/**
 * All-caps marketing-bullet leads (2026-10-24: "COMFORTABLE +
 * NON-INVASIVE: …" crowned the product). A feature bullet opens with a
 * shouted lead — capitals, digits and separators, at least 7 characters —
 * terminated by a colon or comma, then sentence copy. Real listing titles
 * essentially never open that way ("BLACK +DECKER 20-Volt MAX…" breaks
 * the run at the lowercase "olt" and carries no lead terminator). Applied
 * in the title loop only, with the title-zone escape hatch (see below).
 */
export function isAllCapsMarketingBullet(text: string): boolean {
  const stripped = text.replace(/^[\W_]+/, "").trim();
  return /^[A-Z][A-Z0-9 +&'’\-/]{6,}[:,]/.test(stripped);
}
/**
 * Navigation breadcrumb with a long segment (2026-10-24: the Canadian Tire
 * "Back | Home / Automotive / Car Detailing & Care Product... / … /
 * Chemical Guys Mr. Pir" line escaped isBreadcrumbLine because one segment
 * has 5 words). A line with 4+ separators that opens with a nav word is a
 * breadcrumb no matter how long its segments run; no product title opens
 * with "Back" or "Home" and carries 4+ path separators. Leading OCR glyph
 * debris ("¢ Back | …") is stripped before reading the first word.
 */
function isNavBreadcrumbLine(text: string): boolean {
  const seps = (text.match(/[/›»|]/g) || []).length;
  if (seps < 4) return false;
  const first = text.replace(/^[^a-zA-Z]+/, "").split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return ["back", "home", "shop", "departments", "categories"].includes(first);
}
const SELLER_OPTIONS_LINE = /\bstarting from\s*(?:\$|cad|usd)?\s*[\d]|\bcompare all sellers\b|\bmore seller options\b|\bsold (?:&|and) shipped by\b|\bfulfilled by\b/i;
const PROTECTION_PLAN_LINE = /\bprotection plan\b|\baccident protection\b|^\W*\d+\s*-\s*year plan\b|^\W*\d+\s*year plan\b/i;
const PURCHASE_MODE_LINE = /\bone-time purchase\b|\bsubscribe\s*(?:&|and|to)?\s*save\b|\bsubscribe now\b|\bauto delivery\b/i;

/**
 * OCR merges neighbouring carousel cards and modules into single monster
 * lines ("Combo Robot Vacuum u and Mop Combo with and Mop, 4000Pa Robot
 * Vacuumand …"). The fingerprint of a merge is repetition: content words
 * recur because several products' names were concatenated. Counting runs
 * over the line's letter stream so garbled joins ("2-in-1Robot",
 * "Vacuumand") still count their parts. A real title can repeat one or two
 * words ("Roomba … Roomba 694", "Flow … Flow") and stays under the mass
 * bar; a merged line repeats most of what it contains.
 */
function looksLikeMergedMultiProductLine(text: string): boolean {
  // Two or more truncation ellipses = several card texts merged into one
  // line. A SINGLE ellipsis is innocent: storefront apps truncate the real
  // title itself with one ("Amazon Echo Dot (newest model) - Vibrant...").
  if ((text.match(/\.\.\.|…/g) || []).length >= 2) return true;
  const stream = text.toLowerCase().replace(/[^a-z]+/g, "");
  const words = new Set(
    text.toLowerCase().replace(/[^a-z\s]+/g, " ").split(/\s+/).filter((w) => w.length >= 4)
  );
  // Repetition mass: total surplus occurrences of content words. A merged
  // carousel line repeats most of its words (mass 3+); a real title may
  // repeat one or two ("Roomba … Roomba 694", "Flow … Flow") and stays
  // under the bar — both shapes measured on the 2026-10-21 pages.
  let mass = 0;
  for (const word of words) {
    let count = 0;
    let at = stream.indexOf(word);
    while (at >= 0) {
      count += 1;
      at = stream.indexOf(word, at + word.length);
    }
    if (count >= 2) mass += count - 1;
  }
  return mass >= 3;
}

/** Function words: titles do not start with them and they are not brand evidence. */
const TITLE_FUNCTION_START = new Set([
  "with", "from", "this", "that", "your", "yours", "their", "these", "those",
  "when", "while", "each", "both", "only", "just", "also", "than", "then",
  "into", "over", "under", "about", "there", "here", "what", "which",
  "will", "would", "our", "its", "it", "in", "on", "at", "by", "as", "if",
  "but", "so", "no", "yes",
]);

export function isScreenshotDecoyLine(text: string): boolean {
  if (POSTAL_CODE.test(text)) return true;
  if (DELIVERY_BANNER.test(text)) return true;
  if (isGarbledDeliveryLine(text)) return true;
  if (isStoreLocationBar(text)) return true;
  if (SELLER_OPTIONS_LINE.test(text)) return true;
  if (PROTECTION_PLAN_LINE.test(text)) return true;
  if (PURCHASE_MODE_LINE.test(text)) return true;
  // Furniture rows set in large type beside the buy box ("Return policy",
  // a bare "Free Delivery" promise): short lines, never product titles.
  if (/\breturn policy\b/i.test(text)) return true;
  if (/\bnot\s?returnable\b/i.test(text)) return true;
  if (text.split(/\s+/).filter(Boolean).length <= 8 && /\bfree delivery\b/i.test(text)) return true;
  if (looksLikeMergedMultiProductLine(text)) return true;
  if (isStorePageChromeLine(text) || isUnrelatedPageText(text)) return true;
  // A size unit spilled onto its own line ("Quart Stainless Steel") is the
  // tail of the title above, not a second product.
  if (/^(?:qt|quart|quarts|ounce|ounces|oz|gb|tb)\b/i.test(text.trim()) && text.trim().split(/\s+/).length <= 6) return true;
  return false;
}

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
function compactIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * A fetched listing may replace the screenshot name only when it is the same
 * product. A screenshot model the listing does not carry (NC301C, V8, XM5)
 * stays. A different brand (Epson over MX Master, SHOKZ over Sony) stays out.
 */
function listingMatchesScreenshot(listing: string, screenshot: string): boolean {
  const shotModel = compactIdentity(modelTokenFromTitle(screenshot));
  if (shotModel && !compactIdentity(listing).includes(shotModel)) return false;
  const skip = new Set(["amazon", "walmart", "bestbuy", "the", "and", "with", "for", "pro"]);
  const brand = screenshot
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .find((word) => word.length >= 4 && !skip.has(word));
  if (brand && !compactIdentity(listing).includes(brand)) return false;
  return true;
}

export function authoritativeDisplayName(input: { listingTitle?: string | null; screenshotName?: string | null; asin?: string | null }): string {
  const listing = cleanScreenshotProductTitle(cleanProductTitle(input.listingTitle));
  const screenshot = cleanScreenshotProductTitle(cleanProductTitle(input.screenshotName));
  if (listing && screenshot) return listingMatchesScreenshot(listing, screenshot) ? listing : screenshot;
  if (listing) return listing;
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

function normalizeReviewCountToken(token: string): string {
  const raw = token.replace(/\s+/g, "");
  const thousands = raw.match(/^(\d+(?:\.\d+)?)[kK]\+?$/);
  if (thousands) {
    const count = Math.round(Number(thousands[1]) * 1000);
    return Number.isFinite(count) && count > 0 && count <= 50_000_000 ? String(count) : "";
  }
  const digits = raw.replace(/[^\d]/g, "");
  const count = Number(digits);
  if (!Number.isFinite(count) || count <= 0 || count > 50_000_000) return "";
  return String(Math.floor(count));
}

/**
 * Marketplace total printed beside the stars. Labeled counts ("1,234 reviews",
 * "2.3K ratings") win. A parenthetical or bare total sitting on the star line
 * ("4.6 out of 5 stars (12,431)") counts too. The star value itself never does.
 */
export function reviewCountFromOcrText(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const labeled = text.match(/\b(\d{1,3}(?:[, ]\d{3})+|\d{1,7}|\d+(?:\.\d+)?\s*[kK])\+?\s*(?:global\s+)?(?:customer\s+)?(?:ratings?|reviews?|avis|évaluations)\b/i);
  if (labeled) return normalizeReviewCountToken(labeled[1]);
  const beside = text.match(/\b[1-5](?:[.,]\d)?\s*(?:out of\s*5|\/\s*5)?\s*stars?\s*(?:[|(,/.-]\s*)?\(?\s*(\d{1,3}(?:,\d{3})+|\d{2,7}|\d+(?:\.\d+)?\s*[kK])\+?\s*\)?/i);
  if (beside) return normalizeReviewCountToken(beside[1]);
  return "";
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
  const reviewCount = reviewCountFromOcrText(all);

  // Title: scored over a wider confidence pool than the corroborating facts. On real
  // screenshots the title line often OCRs at 50-70 (bold text on brand-colored blocks),
  // below the old cutoff, which let high-confidence breadcrumbs win by default. Structural
  // rejection (nav, breadcrumbs, retail chrome, legal/feature headings) plus scoring
  // (a same-line price is the strongest product-block signal) picks the real title.
  const pool = ocr.lines
    .map((l, index) => ({ index, confidence: l.confidence, text: l.text.trim(), bbox: l.bbox }))
    .filter(l => l.confidence >= 50 && l.text)
    .slice(0, 40);
  // Everything from a recommendations/sponsored section heading down belongs to OTHER
  // products. Wide page OCR can merge a whole recommendation row into one long line,
  // whose length would otherwise out-score the real title (measured 2026-10-20: a
  // "Best sellers" row line — two rice-cooker titles merged — beat the Crock-Pot title).
  const sectionBreak = ocr.lines.findIndex(l => /best sellers|you might (?:also )?like|customers also|related products|more items to explore|sponsored products?\b|similar items|compare with similar|more to consider|recommended for you/i.test(l.text));
  // The buy box stars belong to the product being scanned. A title sits
  // just above them. Ads and other products sit further up or further down.
  const ratingLineIndex = ocr.lines.findIndex((l, index) =>
    (sectionBreak < 0 || index < sectionBreak) &&
    /\b[1-5](?:[.,]\d)?\s*(?:out of\s*5|\/\s*5)/i.test(l.text)
  );
  // Page geometry for the title scoring below: total height and the typical
  // (median) line height over the readable pool, in the merged lines' shared
  // coordinate space. Lines without a bbox simply get no geometry signal.
  const boxedPool = pool.filter((entry) => entry.bbox && entry.bbox.y1 > entry.bbox.y0);
  const pageHeight = boxedPool.reduce((max, entry) => Math.max(max, entry.bbox!.y1), 0);
  const poolHeights = boxedPool.map((entry) => entry.bbox!.y1 - entry.bbox!.y0).sort((a, b) => a - b);
  const medianLineHeight = poolHeights.length ? poolHeights[Math.floor(poolHeights.length / 2)] : 0;
  let bestTitle = "";
  let bestScore = -Infinity;
  let bestTitleLine = "";
  let bestTitleBrandCorroborated = false;
  for (const line of pool) {
    const raw = line.text;
    if (sectionBreak >= 0 && line.index >= sectionBreak) continue;
    if (raw.length < 12 || raw.length > 320) continue;
    if (isAmazonNavOrHeaderText(raw) || isBreadcrumbLine(raw) || isNavBreadcrumbLine(raw) || NON_TITLE.test(raw)) continue;
    // A financing line is never a product title. Without this, an installment line's
    // same-line price earns the +3 product-block signal below and can crown
    // "4 biweekly payments of $22.07 with Klarna" as the product name (measured
    // 2026-10-20 on the Walmart Crock-Pot page once OCR could read the whole page).
    if (INSTALLMENT.test(raw)) continue;
    // Delivery / seller-fulfilment lines are never titles either; at title length
    // their length bonus alone could beat the real title (same Crock-Pot page:
    // "Free seller delivery arrives by Fri, Oct 30 to Mississauga…").
    if (/arrives by|sold (?:and|&) shipped|shipped by|delivery arrives|get it (?:by|on)\b/i.test(raw)) continue;
    // The 2026-10-21 decoy families: delivery/pickup banners (incl. postal-code
    // lines), seller-option prompts, protection plans, purchase-mode lines, and
    // merged multi-product carousel lines. Measured: 7 of 10 live scans were
    // named after one of these shapes; each carries a price or great length,
    // so the bonuses below crowned them over the real title.
    if (isScreenshotDecoyLine(raw)) continue;
    // Shouted feature-bullet leads are never titles — unless the line sits
    // in the title zone (title-size type near the top), where it IS the
    // title. Body-size bullets ("COMFORTABLE + NON-INVASIVE: …" at ~10px
    // against a ~10px median) get no protection.
    if (isAllCapsMarketingBullet(raw)) {
      const lineHeight = line.bbox ? line.bbox.y1 - line.bbox.y0 : 0;
      const yCenter = line.bbox && pageHeight > 0 ? (line.bbox.y0 + line.bbox.y1) / 2 / pageHeight : 1;
      const inTitleZone = medianLineHeight > 0 && lineHeight >= 1.3 * medianLineHeight && yCenter <= 0.38;
      if (!inTitleZone) continue;
    }
    if (chromeWordHits(raw) >= 2) continue;
    if (/out of 5|ratings?|reviews?/i.test(raw)) continue;
    let candidate = cleanScreenshotProductTitle(cleanOcrTitle(raw));
    const nextText = String(ocr.lines[line.index + 1]?.text || "");
    if (candidate && /(?:,\s*)?\b\d+$/.test(candidate)) {
      const unit = nextText.trim().match(/^(qt|quart|quarts|ounce|ounces|oz|gb|tb)\b/i);
      if (unit) candidate = cleanScreenshotProductTitle(`${candidate} ${unit[1]}`);
    }
    const nextModel = modelTokenFromTitle(nextText);
    if (
      candidate &&
      nextModel &&
      !candidate.toLowerCase().includes(nextModel.toLowerCase()) &&
      nextText.trim().split(/\s+/).length <= 4
    ) {
      candidate = cleanScreenshotProductTitle(`${candidate} ${nextModel}`);
    }
    if (candidate.length < 8) continue;
    const letters = (candidate.match(/[a-z]/gi) ?? []).length;
    if (letters / candidate.length < 0.45) continue;
    let score = 0;
    if (lineHasRealPrice(raw)) score += 3;
    // Longer candidates are likelier to be the real title than short feature bullets
    // ("Feeds Large Groups"); a flat +1 left them within noise of each other.
    if (candidate.length >= 18 && candidate.length <= 200) score += Math.min(2, candidate.length / 40);
    // Geometry: the listing title is set in the page's largest type and lives
    // in the title zone. Merged OCR lines share one coordinate space (see
    // mergeOcrLines), so font height and vertical position are trustworthy
    // signals — the strongest separation between the H1 and body-size decoys.
    if (line.bbox && pageHeight > 0 && candidate.split(/\s+/).filter(Boolean).length >= 6) {
      // The token gate keeps big-type furniture rows ("Return policy",
      // "Specifications") from collecting the font bonus: they are short
      // lines set large, while a real listing title is a full phrase.
      const lineHeight = Math.max(0, line.bbox.y1 - line.bbox.y0);
      if (medianLineHeight > 0 && lineHeight >= medianLineHeight) {
        const ratio = lineHeight / medianLineHeight;
        if (ratio >= 1.6) score += 2;
        else if (ratio >= 1.3) score += 1.25;
        else if (ratio >= 1.15) score += 0.5;
      }
      const yCenter = (line.bbox.y0 + line.bbox.y1) / 2 / pageHeight;
      if (yCenter <= 0.38) score += 0.5;
      else if (yCenter >= 0.62) score -= 0.5;
    }
    // Sentence-fragment continuations start all-lowercase; a camelCase brand
    // ("iRobot", "eBay") merely STARTS lowercase and must not pay the penalty
    // (measured 2026-10-21: it cost the real Roomba title 2 points, enough to
    // hand the win to a merged carousel line).
    const firstWord = candidate.split(/\s+/)[0] ?? "";
    if (/^[a-z]+$/.test(firstWord)) score -= 2;
    // Titles do not open with a function word; feature sentences do ("With
    // only five calories per mini biscuit, …" outscored the Milk-Bone title
    // on length alone, measured 2026-10-21).
    if (TITLE_FUNCTION_START.has(firstWord.toLowerCase().replace(/[^a-z]/g, ""))) score -= 1;
    if (/\b(with|and|or|the|a|for|to|of)$/i.test(candidate)) score -= 2; // dangling fragment ending
    // A candidate that ends in a full stop reads as a sentence, not a name:
    // feature copy does ("…leaving a medium shine on surfaces." beat the
    // short Armor All title on length, measured 2026-10-21); listing titles
    // essentially never terminate with a period.
    if (/\.$/.test(candidate)) score -= 1;
    const firstToken = candidate.split(/\s+/)[0].toLowerCase();
    // Compare alphanumerics only: a leading OCR quote glyph on either side
    // ("‘Armor All …" vs the "Armor All" brand line) must not hide the match.
    const firstTokenKey = firstToken.replace(/[^a-z0-9]+/g, "");
    const brandLineNear = firstTokenKey.length >= 2 && pool.some(other => other.index !== line.index && Math.abs(other.index - line.index) <= 2
      // The brand caption usually arrives merged with rating junk ("Armor
      // All fr drdd (46) | 31" = 7 raw tokens, 4 alphabetic): count only
      // tokens that contain a letter.
      && other.text.split(/\s+/).filter((t) => /[a-z]/i.test(t)).length <= 5
      && other.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(firstTokenKey));
    if (brandLineNear) score += 1;
    // Brand corroboration anywhere on the page: a real title's brand word recurs
    // (logo caption, breadcrumbs, feature text), while a stray long sentence's first
    // word does not. This is what separates the title from other long lines once the
    // whole page is readable.
    const brandWord = firstToken.split(/[^a-z0-9]+/).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "";
    const brandRecur = brandWord.length >= 4 && !TITLE_FUNCTION_START.has(brandWord) && pool.some(other => other.index !== line.index && new RegExp(`\\b${brandWord}\\b`, "i").test(other.text.replace(/[^a-z0-9]+/gi, " ")));
    if (brandRecur) score += 1;
    score -= chromeTitlePenalty(raw);
    if (ratingLineIndex >= 0) {
      const distance = line.index - ratingLineIndex;
      if (distance <= -1 && distance >= -6) score += 4;
      else if (distance < -6) score -= 2.5;
      else if (distance > 1) score -= 3;
    }
    score -= line.index * 0.02; // titles sit above features and legal text
    if (score > bestScore) { bestScore = score; bestTitle = candidate; bestTitleLine = raw; bestTitleBrandCorroborated = brandLineNear || brandRecur; }
  }
  const title = bestTitle && !isUnusableListingTitle(bestTitle) ? bestTitle : "";

  // Price: the price on the title line wins; otherwise the largest non-installment price
  // in the readable pool (installment amounts and plan prices are smaller decoys).
  // The pool stops at the recommendations/sponsored section break: a price from another
  // product's card is a wrong fact, worse than no price (measured 2026-10-20: when the
  // main price glyph went unread, the pool returned a recommendation's $19.97).
  const pricePool = ocr.lines
    .filter((l, index) => l.confidence >= 40 && (sectionBreak < 0 || index < sectionBreak))
    // Decoy lines carry other amounts (delivery thresholds, plan prices):
    // their prices are not the product's price.
    .filter((l) => !isScreenshotDecoyLine(l.text))
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
  // A listing page can defeat every context read at once (store wordmark is
  // a graphic, the rating line garbles, prices sit in unread card text) while
  // its title is read perfectly and its brand is corroborated on the page —
  // the 2026-10-21 Roomba page: title won scoring outright, yet the scan
  // shipped nameless because this gate demanded a price/rating/store. A
  // decisive, brand-corroborated, full-length title corroborates itself.
  // The bare-photo case stays protected: control-dial fragments are short,
  // score low, and carry no brand recurrence.
  const titleSelfCorroborated = Boolean(bestTitleBrandCorroborated && bestScore >= 3 && title.length >= 30);
  const corroborated = Boolean(priceText || ratingM || reviewCount || store || titleSelfCorroborated);
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
    reviewCount,
    priceBelongsToProduct: tied && Boolean(priceText), ratingBelongsToProduct: Boolean(ratingM), reviewCountBelongsToProduct: Boolean(reviewCount),
    visibleFeatures: [], visibleBadges: lines.filter(l => /best seller|amazon'?s choice|overall pick|top rated/i.test(l)).slice(0, 5),
    identityWarnings: ["Read with free on-device OCR (no AI vision); please confirm the product name.", ...warnings],
    normalizedSearchQuery: trustedTitle, imageConfidence: conf,
  };
}
