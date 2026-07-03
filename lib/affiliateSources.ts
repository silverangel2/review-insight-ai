import {
  buildAffiliateUrl,
  getAffiliateDisclosure,
  isAmazonUrl,
  isSupportedAffiliateUrl,
  isWalmartUrl,
} from "@/lib/affiliate";

export type AffiliateSourceLink = {
  provider: "amazon" | "walmart";
  label: string;
  sourceUrl: string;
  affiliateUrl: string;
  host: string;
  qualifying: boolean;
};

type SourceCandidate = {
  url: string;
  label?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanUrl(value: string) {
  const text = value
    .trim()
    .replace(/[)\].,;'"`]+$/g, "")
    .replace(/^['"`(]+/g, "");

  if (!/^https?:\/\//i.test(text)) return "";

  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function urlsFromText(value: string) {
  return Array.from(value.matchAll(/https?:\/\/[^\s"'<>]+/gi))
    .map((match) => cleanUrl(match[0]))
    .filter(Boolean);
}

function isMediaOrAssetUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    return (
      host.includes("media-amazon") ||
      host.includes("ssl-images-amazon") ||
      host.includes("walmartimages.com") ||
      /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i.test(path)
    );
  } catch {
    return true;
  }
}

function providerFor(url: string): AffiliateSourceLink["provider"] | null {
  if (isAmazonUrl(url)) return "amazon";
  if (isWalmartUrl(url)) return "walmart";
  return null;
}

function hostFor(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function labelFor(candidate: SourceCandidate, provider: AffiliateSourceLink["provider"]) {
  const explicit = (candidate.label || "").replace(/\s+/g, " ").trim();
  if (explicit && !/^https?:\/\//i.test(explicit)) return explicit.slice(0, 90);

  const host = hostFor(candidate.url);
  if (host) return provider === "amazon" ? `Amazon source (${host})` : `Walmart source (${host})`;
  return provider === "amazon" ? "Amazon source" : "Walmart source";
}

function collectCandidates(value: unknown, out: SourceCandidate[], depth = 0) {
  if (depth > 7 || out.length > 120) return;

  if (typeof value === "string") {
    for (const url of urlsFromText(value)) out.push({ url });
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectCandidates(item, out, depth + 1);
    return;
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) return;

  const label =
    getString(record.label) ||
    getString(record.title) ||
    getString(record.name) ||
    getString(record.domain) ||
    getString(record.store) ||
    getString(record.source);

  for (const key of [
    "url",
    "sourceUrl",
    "source_url",
    "exactListingUrl",
    "exact_listing_url",
    "listingUrl",
    "listing_url",
    "productUrl",
    "product_url",
    "affiliateUrl",
    "affiliate_url",
  ]) {
    const url = cleanUrl(getString(record[key]));
    if (url) out.push({ url, label });
  }

  for (const item of Object.values(record)) {
    collectCandidates(item, out, depth + 1);
  }
}

export function collectAffiliateSourceLinks(payload: unknown, limit = 8): AffiliateSourceLink[] {
  const candidates: SourceCandidate[] = [];
  collectCandidates(payload, candidates);

  const unique = new Map<string, AffiliateSourceLink>();

  for (const candidate of candidates) {
    if (!candidate.url || unique.size >= Math.max(1, limit)) continue;
    if (!isSupportedAffiliateUrl(candidate.url) || isMediaOrAssetUrl(candidate.url)) continue;
    if (unique.has(candidate.url)) continue;

    const provider = providerFor(candidate.url);
    if (!provider) continue;

    const sourceUrl = candidate.url;
    const affiliateUrl = buildAffiliateUrl(sourceUrl);
    const host = hostFor(sourceUrl);

    unique.set(sourceUrl, {
      provider,
      label: labelFor(candidate, provider),
      sourceUrl,
      affiliateUrl,
      host,
      qualifying: affiliateUrl !== sourceUrl || provider === "walmart",
    });
  }

  return Array.from(unique.values());
}

export function affiliateSourceDisclosure() {
  return getAffiliateDisclosure();
}
