export type AffiliateProduct = {
  title: string;
  store: string;
  url: string;
  affiliateUrl: string;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  price?: string | null;
  badge: string;
  whyBetter: string;
  aiLikeRisk?: string | null;
};

const AMAZON_HOST_SUFFIXES = [
  "amazon.ca",
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.co.jp",
  "amazon.com.au",
  "amazon.in",
];

const WALMART_HOST_SUFFIXES = [
  "walmart.com",
  "walmart.ca",
];

const DEFAULT_WALMART_AFFILIATE_ID = "ReviewIntel";
const DEFAULT_WALMART_PUBLISHER_ID = "4722495";
const DEFAULT_WALMART_AD_ID = "565706";
const DEFAULT_WALMART_CAMPAIGN_ID = "9383";

export function getAmazonAssociateTag() {
  return process.env.AMAZON_ASSOCIATE_TAG?.trim() || "";
}

/**
 * Per-store Amazon Associate tags (Junel's directive, Oct 2026):
 *  - amazon.com links earn through the Roamly Associates account, whose
 *    site list includes getreviewintel.com → default tag `roamly02e-20`.
 *  - amazon.ca links keep the legacy AMAZON_ASSOCIATE_TAG when one is
 *    configured (e.g. reviewintel-20), else default to `roamly060-20`.
 *  - Other Amazon marketplaces keep legacy behavior (env tag or untagged).
 *
 * Per-store env overrides (AMAZON_ASSOCIATE_TAG_COM / _CA) win over the
 * defaults without touching the legacy variable.
 */
const DEFAULT_AMAZON_TAG_COM = "roamly02e-20";
const DEFAULT_AMAZON_TAG_CA = "roamly060-20";

function amazonStoreKind(hostname: string): "ca" | "com" | "other" {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host === "amazon.ca" || host.endsWith(".amazon.ca")) return "ca";
  if (host === "amazon.com" || host.endsWith(".amazon.com")) return "com";
  return "other";
}

export function getAmazonAssociateTagForHost(
  hostname: string,
  env: Record<string, string | undefined> = process.env
) {
  const kind = amazonStoreKind(hostname);
  const explicitCom = (env.AMAZON_ASSOCIATE_TAG_COM || "").trim();
  const explicitCa = (env.AMAZON_ASSOCIATE_TAG_CA || "").trim();
  const legacy = (env.AMAZON_ASSOCIATE_TAG || "").trim();
  if (kind === "ca") return explicitCa || legacy || DEFAULT_AMAZON_TAG_CA;
  if (kind === "com") return explicitCom || DEFAULT_AMAZON_TAG_COM;
  return legacy;
}

export function getWalmartAffiliateId() {
  return (
    process.env.WALMART_AFFILIATE_ID?.trim() ||
    process.env.NEXT_PUBLIC_WALMART_AFFILIATE_ID?.trim() ||
    DEFAULT_WALMART_AFFILIATE_ID
  );
}

export function getWalmartPublisherId() {
  return (
    process.env.WALMART_PUBLISHER_ID?.trim() ||
    process.env.WALMART_SID?.trim() ||
    process.env.NEXT_PUBLIC_WALMART_PUBLISHER_ID?.trim() ||
    process.env.NEXT_PUBLIC_WALMART_SID?.trim() ||
    DEFAULT_WALMART_PUBLISHER_ID
  );
}

export function getWalmartImpactTemplate() {
  return (
    process.env.WALMART_IMPACT_TRACKING_URL_TEMPLATE?.trim() ||
    process.env.WALMART_AFFILIATE_LINK_TEMPLATE?.trim() ||
    ""
  );
}

function getWalmartAdId() {
  return process.env.WALMART_IMPACT_AD_ID?.trim() || DEFAULT_WALMART_AD_ID;
}

function getWalmartCampaignId() {
  return process.env.WALMART_IMPACT_CAMPAIGN_ID?.trim() || DEFAULT_WALMART_CAMPAIGN_ID;
}

export function getAffiliateDisclosure() {
  const configured = process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE?.trim();

  // Return the configured disclosure verbatim — never rewrite or scrub
  // merchant mentions out of it.
  if (configured) {
    return configured;
  }

  return "ReviewIntel may earn from qualifying purchases through Amazon Associates and Walmart affiliate links. Affiliate compensation does not affect ReviewIntel verdicts or review analysis.";
}

function isAmazonHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  return AMAZON_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

function isWalmartHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  return WALMART_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

export function isAmazonUrl(url: string) {
  if (!url || !url.startsWith("http")) return false;

  try {
    return isAmazonHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isWalmartUrl(url: string) {
  if (!url || !url.startsWith("http")) return false;

  try {
    return isWalmartHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isSupportedAffiliateUrl(url: string) {
  return isAmazonUrl(url) || isWalmartUrl(url);
}

export function buildAmazonAffiliateUrl(url: string) {
  if (!url || !url.startsWith("http")) return url;

  try {
    const parsed = new URL(url);

    if (!isAmazonHost(parsed.hostname)) return url;

    const tag = getAmazonAssociateTagForHost(parsed.hostname);
    if (!tag) return url;

    // set() replaces any existing tag param — a URL is never double-tagged.
    parsed.searchParams.set("tag", tag);
    return parsed.toString();
  } catch {
    return url;
  }
}

function fillWalmartTemplate(template: string, url: string, publisherId: string, affiliateId: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedPublisherId = encodeURIComponent(publisherId);
  const encodedAffiliateId = encodeURIComponent(affiliateId);

  return template
    .replace(/\{url\}/g, url)
    .replace(/\{encodedUrl\}/g, encodedUrl)
    .replace(/\{destinationUrl\}/g, url)
    .replace(/\{encodedDestinationUrl\}/g, encodedUrl)
    .replace(/\{publisherId\}/g, encodedPublisherId)
    .replace(/\{sid\}/g, encodedPublisherId)
    .replace(/\{affiliateId\}/g, encodedAffiliateId)
    .replace(/\{subId\}/g, encodedAffiliateId);
}

export function buildWalmartAffiliateUrl(url: string) {
  const publisherId = getWalmartPublisherId();
  const affiliateId = getWalmartAffiliateId();

  if (!url || !url.startsWith("http") || !publisherId) return url;

  try {
    const parsed = new URL(url);

    if (!isWalmartHost(parsed.hostname)) return url;

    const template = getWalmartImpactTemplate();
    if (template) return fillWalmartTemplate(template, parsed.toString(), publisherId, affiliateId);

    const impactUrl = new URL(
      `https://goto.walmart.com/c/${encodeURIComponent(publisherId)}/${encodeURIComponent(getWalmartAdId())}/${encodeURIComponent(getWalmartCampaignId())}`
    );
    impactUrl.searchParams.set("veh", "aff");
    if (affiliateId) impactUrl.searchParams.set("sourceid", affiliateId.startsWith("imp_") ? affiliateId : `imp_${affiliateId}`);
    impactUrl.searchParams.set("u", parsed.toString());

    return impactUrl.toString();
  } catch {
    return url;
  }
}

/** Keep an existing associate tag. Add the store default only when Amazon has none. */
export function ensureAmazonAssociateTag(url: string): string {
  if (!url || !isAmazonUrl(url)) return url;
  try {
    const existing = new URL(url).searchParams.get("tag")?.trim();
    if (existing) return url;
  } catch {
    return url;
  }
  return buildAmazonAffiliateUrl(url);
}

export function buildAffiliateUrl(url: string) {
  if (isAmazonUrl(url)) return buildAmazonAffiliateUrl(url);
  if (isWalmartUrl(url)) return buildWalmartAffiliateUrl(url);
  return url;
}

export function attachAffiliateUrl(
  product: Omit<AffiliateProduct, "affiliateUrl">
): AffiliateProduct {
  return {
    ...product,
    affiliateUrl: buildAffiliateUrl(product.url),
  };
}
