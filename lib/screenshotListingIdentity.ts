/**
 * Screenshot listing identity (free, local, no network).
 *
 * Store pages crown chrome as the product: "Dyson Official Outlet Walmart…",
 * "Available at a lower…". This module strips that chrome, keeps the model
 * token (NC301C, V8, 9a, 8 qt), and tells a screenshot-only Walmart / Best Buy
 * scan to enrich from Amazon instead of locking reviews to the store page.
 *
 * A shopper-supplied product link is never overridden.
 */

const CHROME_PHRASE = [
  /\s*[-–—|,;/]*\s*\bofficial outlet\b\s*[-–—|,;/]*\s*/gi,
  /\s*[-–—|,;/]*\s*\bwalmart exclusive\b\s*[-–—|,;/]*\s*/gi,
  /\s*[-–—|,;/]*\s*\bbest buy exclusive\b\s*[-–—|,;/]*\s*/gi,
  /\s*[-–—|,;/]*\s*\bavailable at a lower(?:\s+price)?(?:\s+from\b[^.]*)?\s*/gi,
  /\s*[-–—|,;/]*\s*\bonly at walmart\b\s*[-–—|,;/]*\s*/gi,
  /\s*[-–—|,;/]*\s*\bonly at best buy\b\s*[-–—|,;/]*\s*/gi,
  /\s*[-–—|,;/]*\s*\b(?:sold|ships|fulfilled) by walmart\b\s*[-–—|,;/]*\s*/gi,
];

function tokensOf(value: string): string[] {
  return value.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function bare(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9.]/g, "");
}

/** A model or size token a shopper uses to tell this SKU from the brand line. */
export function modelTokenFromTitle(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const pixel = text.match(/\bpixel\s+\d+[a-z]?\b/i);
  if (pixel) return pixel[0].replace(/\s+/g, " ");
  const words = tokensOf(text);
  for (let i = 0; i < words.length; i++) {
    const word = bare(words[i]);
    const next = bare(words[i + 1] || "");
    if (/^(?:nc\d{2,}[a-z0-9]*|v\d{1,2}|\d+[a-z]{1,2})$/i.test(word) && word.length >= 2) return words[i].replace(/[^A-Za-z0-9]/g, "");
    if (/^\d+(?:qt|quart|quarts|oz|gb|tb)$/i.test(word)) return words[i];
    if (/^\d+$/i.test(word) && /^(?:qt|quart|quarts|oz|gb|tb)$/i.test(next)) return `${word} ${words[i + 1]}`;
  }
  return "";
}

export function hasProductModel(value: unknown): boolean {
  return Boolean(modelTokenFromTitle(value));
}

/**
 * A line that is store chrome and not a product title. A line that also
 * carries a model (the outlet listing's own H1) is kept and cleaned later.
 */
export function isStorePageChromeLine(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (/available at a lower/i.test(text)) return true;
  if (/\bofficial outlet\b/i.test(text) && !hasProductModel(text)) return true;
  if (/\b(?:walmart|best buy)\s+exclusive\b/i.test(text) && !hasProductModel(text)) return true;
  return false;
}

/** How hard a line should lose the title contest for wearing store chrome. */
export function chromeTitlePenalty(value: unknown): number {
  const text = String(value || "");
  let penalty = 0;
  if (/official outlet/i.test(text)) penalty += 2.5;
  if (/walmart exclusive/i.test(text)) penalty += 2;
  if (/best buy exclusive/i.test(text)) penalty += 2;
  if (/available at a lower/i.test(text)) penalty += 4;
  return penalty;
}

function stripRetailerTokens(text: string): string {
  const tokens = tokensOf(text);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const one = bare(tokens[i]);
    const pair = `${one} ${bare(tokens[i + 1] || "")}`.trim();
    const retailer =
      one === "walmart" || one === "walmart.ca" || one === "walmart.com" ||
      one === "bestbuy.ca" || one === "bestbuy.com" || pair === "best buy";
    if (retailer && out.length > 0) {
      if (pair === "best buy") i += 1;
      continue;
    }
    out.push(tokens[i]);
  }
  return out.join(" ");
}

/** Product name with store-page chrome removed. Empty when nothing product-like remains. */
export function cleanScreenshotProductTitle(value: unknown): string {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  for (const pattern of CHROME_PHRASE) text = text.replace(pattern, " ");
  text = stripRetailerTokens(text);
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[-–—,;|/ ]+|[-–—,;|/ ]+$/g, "").trim();
  if (text.length < 3 || isStorePageChromeLine(text)) return "";
  return text;
}

/**
 * Headline for the scan. Keeps model and size tokens that a 4-word cut would
 * drop ("Ninja CREAMi, NC301C" must not become "Ninja CREAMi").
 */
export function shopperFacingProductTitle(value: unknown, fallback = "Product"): string {
  const cleaned = cleanScreenshotProductTitle(value);
  const raw = cleaned || String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (raw.length <= 90) return raw;
  const words = tokensOf(raw);
  let end = words.length;
  let acc = "";
  for (let i = 0; i < words.length; i++) {
    const next = acc ? `${acc} ${words[i]}` : words[i];
    if (next.length > 90 && i > 2) {
      end = i;
      break;
    }
    acc = next;
  }
  let title = words.slice(0, end).join(" ");
  const model = modelTokenFromTitle(raw);
  if (model && !title.toLowerCase().includes(model.toLowerCase())) title = `${title} ${model}`.trim();
  if (title.length < raw.length) title = `${title.replace(/…$/, "")}…`;
  return title || fallback;
}

/** Short complaint label taken from a real negative excerpt. Not a generic band title. */
export function excerptComplaintLabel(value: unknown): string {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length < 8) return "";
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  const words = sentence.split(/\s+/).filter(Boolean).slice(0, 16);
  const clipped = words.join(" ").replace(/[,:;]+$/g, "").trim();
  if (clipped.length < 8) return "";
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

export type ScreenshotCollectionPlan = {
  /** Cleaned name to search and collect against. */
  productName: string;
  /** Amazon store label when a retailer screenshot should enrich from Amazon. Null keeps the caller's store. */
  collectionStore: "Amazon.ca" | "Amazon.com" | null;
  /** True when reviews may come from Amazon even though the screenshot store is Walmart or Best Buy. */
  crossStoreAmazon: boolean;
  /** First model token, when the title has one. */
  model: string;
};

function looksLikeProductUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(value.trim());
}

/**
 * Screenshot-only Walmart / Best Buy scans search Amazon for the same product.
 * A pasted product link keeps its own store. United States hosts (.com, and
 * not Canada) use Amazon.com; everything else follows the app default, Amazon.ca.
 */
export function screenshotCollectionPlan(input: {
  store?: string | null;
  listingUrl?: string | null;
  productName?: string | null;
}): ScreenshotCollectionPlan {
  const cleaned = cleanScreenshotProductTitle(input.productName) || String(input.productName || "").replace(/\s+/g, " ").trim();
  const model = modelTokenFromTitle(cleaned);
  const listing = String(input.listingUrl || "").trim();
  if (looksLikeProductUrl(listing)) {
    return { productName: cleaned, collectionStore: null, crossStoreAmazon: false, model };
  }
  const store = String(input.store || "").toLowerCase();
  const retailer = /walmart|best ?buy|target/.test(store);
  const amazon = /amazon/.test(store);
  if (!retailer && !amazon) {
    return { productName: cleaned, collectionStore: null, crossStoreAmazon: false, model };
  }
  const unitedStates = /\.com\b|\bunited states\b|\busa\b/.test(store) && !/\.ca\b|canada/.test(store);
  return {
    productName: cleaned,
    collectionStore: unitedStates ? "Amazon.com" : "Amazon.ca",
    crossStoreAmazon: retailer,
    model,
  };
}

/**
 * Keep an Amazon listing when the shopper only uploaded a Walmart or Best Buy
 * screenshot. A pasted Walmart.ca link still rejects other hosts.
 */
export function shouldKeepCrossStoreAmazonListing(input: {
  store?: string | null;
  listingUrl?: string | null;
  crossStoreEnrichment?: boolean;
  returnedHost?: string | null;
}): boolean {
  if (input.crossStoreEnrichment) return true;
  const host = String(input.returnedHost || "").toLowerCase().replace(/^www\./, "");
  if (!host.includes("amazon.")) return false;
  if (String(input.listingUrl || "").trim()) return false;
  return /walmart|best ?buy/i.test(String(input.store || ""));
}
