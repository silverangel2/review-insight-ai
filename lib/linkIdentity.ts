// Identity read from a shopper's product link when the store page itself
// cannot be fetched. Used for search, matching, and which store ladder runs.
// Never invents a title, and never treats a placeholder as a product name.

import { amazonStoreLabel, isUnusableListingTitle } from "./listingAuthority";
import {
  amazonStableId,
  bestBuyIdentity,
  collectorForUrl,
  homeDepotIdentity,
  targetTcin,
  walmartItemId,
  type StoreId,
} from "./storeCollectors";

const PLACEHOLDER_WORD = /^(?:unknown|product|products|item|items|na|none|null|undefined)$/i;

export type LinkIdentity = {
  storeId: StoreId;
  storeLabel: string;
  productId: string;
  slug: string | null;
  displayName: string;
  modelTokens: string[];
  url: string;
};

export function isPlaceholderProductName(value: unknown): boolean {
  const text = String(value || "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return true;
  return text.split(" ").every((word) => PLACEHOLDER_WORD.test(word) || word.toLowerCase() === "amazon");
}

/**
 * A label with no product in it ("Amazon product", a captcha title).
 * A missing name is not this case — callers that omit the name keep
 * their existing fallback.
 */
export function isUnnamedProductLabel(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return false;
  return isPlaceholderProductName(text) || isUnusableListingTitle(text);
}

/** Empty when the text is a placeholder such as "unknown product". */
export function placeholderFreeText(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return isPlaceholderProductName(text) ? "" : text;
}

/**
 * Name used to start collection. A slug title wins. A bare /dp or /gp/product
 * link still contributes its product id, so the listing page is fetched and
 * the shopper name comes from that page. Never "Amazon product" or "unknown product".
 */
export function collectionProductName(url: unknown, ...fallbacks: unknown[]): string {
  for (const value of fallbacks) {
    const text = placeholderFreeText(value);
    if (text) return text;
  }
  const identity = identityFromProductLink(url);
  if (!identity) return "";
  return placeholderFreeText(identity.displayName) || identity.productId;
}

function displayFromSlug(slug: string | null): string {
  if (!slug || slug === "-" || /^site$/i.test(slug)) return "";
  const words = decodeURIComponent(slug).replace(/\.(?:p|html)$/i, "").split(/[-_]+/).filter(Boolean);
  return words.map((word) => {
    if (/\d/.test(word) && /[A-Za-z]/.test(word)) return word.toUpperCase();
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ").replace(/\s+/g, " ").trim();
}

function modelTokensFrom(slug: string | null): string[] {
  if (!slug) return [];
  const found = new Set<string>();
  for (const part of decodeURIComponent(slug).split(/[-_./]+/)) {
    if (part.length < 4 || part.length > 24) continue;
    if (!/[A-Za-z]/.test(part) || !/\d/.test(part)) continue;
    found.add(part.toUpperCase());
  }
  return [...found];
}

function amazonSlug(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const markers = new Set(["dp", "product", "d", "product-reviews"]);
  for (let index = 0; index < parts.length; index += 1) {
    if (!markers.has(parts[index].toLowerCase())) continue;
    let cursor = index - 1;
    while (cursor >= 0 && /^(?:gp|aw)$/i.test(parts[cursor])) cursor -= 1;
    const previous = parts[cursor];
    if (!previous || /^[A-Z0-9]{10}$/i.test(previous)) return null;
    return previous;
  }
  return null;
}

function walmartSlug(pathname: string): string | null {
  const match = pathname.match(/\/ip\/([^/]+)\/[A-Z0-9]{6,14}(?:\/|$)/i);
  if (!match || /^\d+$/.test(match[1])) return null;
  return match[1];
}

function targetSlug(pathname: string): string | null {
  const match = pathname.match(/\/p\/([^/]+)\/-\/A-\d+/i);
  if (!match || match[1] === "-") return null;
  return match[1];
}

export function identityFromProductLink(value: unknown): LinkIdentity | null {
  const raw = String(value || "").trim();
  if (!raw || !collectorForUrl(raw)) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const amazonId = amazonStableId(raw);
  if (amazonId) {
    const slug = amazonSlug(url.pathname);
    return {
      storeId: "amazon",
      storeLabel: amazonStoreLabel(raw) || "Amazon",
      productId: amazonId,
      slug,
      displayName: displayFromSlug(slug),
      modelTokens: modelTokensFrom(slug),
      url: raw,
    };
  }
  const walmartId = walmartItemId(raw);
  if (walmartId) {
    const slug = walmartSlug(url.pathname);
    return {
      storeId: "walmart",
      storeLabel: host.endsWith(".ca") ? "Walmart.ca" : "Walmart",
      productId: walmartId,
      slug,
      displayName: displayFromSlug(slug),
      modelTokens: modelTokensFrom(slug),
      url: raw,
    };
  }
  const bestBuy = bestBuyIdentity(raw);
  if (bestBuy) {
    return {
      storeId: "bestbuy",
      storeLabel: bestBuy.ca ? "Best Buy Canada" : "Best Buy",
      productId: bestBuy.sku,
      slug: bestBuy.slug,
      displayName: displayFromSlug(bestBuy.slug),
      modelTokens: modelTokensFrom(bestBuy.slug),
      url: raw,
    };
  }
  const tcin = targetTcin(raw);
  if (tcin) {
    const slug = targetSlug(url.pathname);
    return {
      storeId: "target",
      storeLabel: "Target",
      productId: tcin,
      slug,
      displayName: displayFromSlug(slug),
      modelTokens: modelTokensFrom(slug),
      url: raw,
    };
  }
  const homeDepot = homeDepotIdentity(raw);
  if (homeDepot) {
    return {
      storeId: "homedepot",
      storeLabel: host.endsWith(".ca") ? "Home Depot Canada" : "Home Depot",
      productId: homeDepot.id,
      slug: homeDepot.slug,
      displayName: displayFromSlug(homeDepot.slug),
      modelTokens: modelTokensFrom(homeDepot.slug),
      url: raw,
    };
  }
  return null;
}

function compact(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Same store product id, or a title that contains every model token from the
 * link (or the product id itself). Generic words are not enough.
 */
export function candidateMatchesLinkIdentity(link: LinkIdentity, candidate: { url?: string | null; title?: string | null }): boolean {
  const other = identityFromProductLink(candidate.url);
  if (other && other.storeId === link.storeId && other.productId.toUpperCase() === link.productId.toUpperCase()) return true;
  const title = compact(candidate.title);
  if (!title) return false;
  const models = link.modelTokens.map((token) => compact(token)).filter((token) => token.length >= 4);
  if (models.length > 0 && models.every((token) => title.includes(token))) return true;
  const id = compact(link.productId);
  return id.length >= 5 && title.includes(id);
}
