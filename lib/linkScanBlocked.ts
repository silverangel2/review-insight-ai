/**
 * A link-only scan was blocked when ReviewIntel's own servers could not read
 * written reviews from a supported store page. Screenshot scans are a different
 * path. A result that already came from the shopper's browser is not blocked.
 */

import { isUnreadableAmazonPage } from "@/lib/shopperAnswer";

const SUPPORTED_HOST =
  /(?:^|\.)(?:amazon\.(?:com|ca|co\.uk|de|fr|es|it|com\.au|in|com\.mx|co\.jp)|walmart\.(?:com|ca)|bestbuy\.(?:com|ca)|target\.com|homedepot\.(?:com|ca))$/i;

type Rec = Record<string, unknown>;

function record(value: unknown): Rec {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

export function supportedShopperStore(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return SUPPORTED_HOST.test(host);
  } catch {
    return false;
  }
}

export function linkScanBlockedForLinkOnly(input: {
  linkOnly: boolean;
  listingUrl: string;
  writtenCount: number;
  diagnostics?: Rec | null;
  mode?: string | null;
}): boolean {
  if (!input.linkOnly) return false;
  if (!supportedShopperStore(input.listingUrl)) return false;
  if (Math.max(0, Math.floor(input.writtenCount || 0)) > 0) return false;
  const diagnostics = input.diagnostics || {};
  const tried =
    diagnostics.nativeScraperBlocked === true ||
    diagnostics.finalStopReason === "access_restricted" ||
    Number(diagnostics.pagesBlocked || 0) > 0 ||
    diagnostics.nativeScraperStarted === true ||
    Number(diagnostics.pagesAttempted || 0) > 0;
  const empty = input.mode === "no_score" || input.mode === "provisional_marketplace" || !input.mode;
  return tried || empty;
}

/** Results-page gate for the free extension prompt. */
export function linkOnlyScanWasBlocked(result: unknown): boolean {
  const source = record(result);
  if (source.pageCapture === true || source.linkOnlyScan === false) return false;
  if (source.linkScanBlocked === true) return true;
  return isUnreadableAmazonPage(source);
}
