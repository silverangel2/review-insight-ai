export type AffiliateProduct = {
  title: string;
  store: string;
  url: string;
  affiliateUrl: string;
  rating?: number | null;
  reviewCount?: number | null;
  price?: string | null;
  badge: string;
  whyBetter: string;
  aiLikeRisk?: string | null;
};

export function getAmazonAssociateTag() {
  return process.env.AMAZON_ASSOCIATE_TAG || "";
}

export function getAffiliateDisclosure() {
  return (
    process.env.NEXT_PUBLIC_AFFILIATE_DISCLOSURE ||
    "ReviewIntel may earn a commission from qualifying purchases through affiliate links. This does not affect our verdicts or review analysis."
  );
}

export function buildAmazonAffiliateUrl(url: string) {
  const tag = getAmazonAssociateTag();

  if (!url || !url.startsWith("http")) return url;
  if (!url.includes("amazon.")) return url;
  if (!tag) return url;

  try {
    const parsed = new URL(url);
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
