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
  return (
    process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE?.trim() ||
    "ReviewIntel may earn from qualifying purchases through Amazon Associates and Walmart affiliate links. Affiliate compensation does not affect ReviewIntel verdicts or review analysis."
  );
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
  const tag = getAmazonAssociateTag();

  if (!url || !url.startsWith("http") || !tag) return url;

  try {
    const parsed = new URL(url);

    if (!isAmazonHost(parsed.hostname)) return url;

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
