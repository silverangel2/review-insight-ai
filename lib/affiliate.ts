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

export function getAmazonAssociateTag() {
  return process.env.AMAZON_ASSOCIATE_TAG?.trim() || "";
}

export function getAffiliateDisclosure() {
  return (
    process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE?.trim() ||
    "As an Amazon Associate I earn from qualifying purchases."
  );
}

function isAmazonHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  return AMAZON_HOST_SUFFIXES.some(
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

export function attachAffiliateUrl(
  product: Omit<AffiliateProduct, "affiliateUrl">
): AffiliateProduct {
  return {
    ...product,
    affiliateUrl: buildAmazonAffiliateUrl(product.url),
  };
}
