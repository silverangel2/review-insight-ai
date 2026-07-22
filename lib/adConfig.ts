export type AdPlacement =
  | "mobile_homepage"
  | "homepage_hero"
  | "homepage_mid"
  | "analyze_below_card"
  | "analyze_premium_top"
  | "analyze_premium_bottom"
  | "results_below_verdict"
  | "buyer_dashboard"
  | "seller_dashboard"
  | "pricing"
  | "footer";

export type AdvertiserApplicationStatus = "pending" | "approved" | "rejected" | "paused";
export type AdPaymentStatus = "unpaid" | "pending_review" | "paid" | "refunded";
export type AdMediaType = "image" | "video";
export type AdPackageId = "sponsored_monthly" | "featured_monthly";
export type AdSourceType = "direct" | "affiliate" | "house";
export type AffiliatePartner = "amazon" | "travelpayouts" | "stay22" | "custom";
export const managedAffiliatePartners = ["amazon", "travelpayouts", "stay22"] as const;
export type ManagedAffiliatePartner = (typeof managedAffiliatePartners)[number];
export const affiliatePartnerPlacements = [
  "mobile_homepage",
  "homepage",
  "results",
  "dashboard",
  "pricing",
] as const;
export type AffiliatePartnerPlacement = (typeof affiliatePartnerPlacements)[number];

export type AffiliatePartnerSettings = {
  enabled: boolean;
  placements: Record<AffiliatePartnerPlacement, boolean>;
};

export type SponsorAd = {
  id: string;
  sponsorName: string;
  campaignTitle?: string;
  headline: string;
  description: string;
  imageUrl?: string;
  mediaUrl?: string;
  mediaType?: AdMediaType;
  destinationUrl: string;
  placement: AdPlacement;
  active: boolean;
  status: AdvertiserApplicationStatus;
  paymentStatus?: AdPaymentStatus;
  dailyImpressionCap?: number | null;
  impressionsToday?: number;
  startsAt?: string;
  endsAt?: string;
  sponsorType?: AdSourceType;
  affiliatePartner?: AffiliatePartner;
  labels?: string[];
  disclosureText?: string;
  ctaLabel?: string;
};

export type AdSettings = {
  adsEnabled: boolean;
  googleAdsEnabled: boolean;
  directSponsorAdsEnabled: boolean;
  requireOwnerApproval: boolean;
  placements: Record<AdPlacement, boolean>;
  affiliatePartners: Record<ManagedAffiliatePartner, AffiliatePartnerSettings>;
};

export const defaultAffiliatePartnerPlacements: Record<AffiliatePartnerPlacement, boolean> = {
  mobile_homepage: true,
  homepage: true,
  results: true,
  dashboard: true,
  pricing: true,
};

export const defaultAffiliatePartnerSettings: Record<ManagedAffiliatePartner, AffiliatePartnerSettings> = {
  amazon: {
    enabled: true,
    placements: { ...defaultAffiliatePartnerPlacements },
  },
  travelpayouts: {
    enabled: true,
    placements: { ...defaultAffiliatePartnerPlacements },
  },
  stay22: {
    enabled: true,
    placements: { ...defaultAffiliatePartnerPlacements },
  },
};

export function isManagedAffiliatePartner(partner: AffiliatePartner): partner is ManagedAffiliatePartner {
  return managedAffiliatePartners.includes(partner as ManagedAffiliatePartner);
}

export function normalizeAffiliatePartnerPlacement(
  value: unknown,
  fallback: AffiliatePartnerPlacement = "results",
): AffiliatePartnerPlacement {
  return affiliatePartnerPlacements.includes(value as AffiliatePartnerPlacement)
    ? (value as AffiliatePartnerPlacement)
    : fallback;
}

export function affiliatePlacementGroupForAdPlacement(
  placement: AdPlacement,
): AffiliatePartnerPlacement | null {
  if (placement === "mobile_homepage") return "mobile_homepage";
  if (placement === "homepage_hero" || placement === "homepage_mid") return "homepage";
  if (placement === "results_below_verdict") return "results";
  if (placement === "buyer_dashboard" || placement === "seller_dashboard") return "dashboard";
  if (placement === "pricing") return "pricing";
  return null;
}

export function affiliatePartnerIsEnabled(
  partner: AffiliatePartner,
  settings?: Partial<Record<ManagedAffiliatePartner, Partial<AffiliatePartnerSettings>>>,
): boolean {
  if (!isManagedAffiliatePartner(partner)) return true;
  return settings?.[partner]?.enabled ?? defaultAffiliatePartnerSettings[partner].enabled;
}

export function affiliatePartnerCanShowInGroup(
  partner: AffiliatePartner,
  placement: AffiliatePartnerPlacement,
  settings?: Partial<Record<ManagedAffiliatePartner, Partial<AffiliatePartnerSettings>>>,
): boolean {
  if (!isManagedAffiliatePartner(partner)) return true;
  if (!affiliatePartnerIsEnabled(partner, settings)) return false;

  return (
    settings?.[partner]?.placements?.[placement] ??
    defaultAffiliatePartnerSettings[partner].placements[placement]
  );
}

export function affiliatePartnerCanShowAtPlacement(
  partner: AffiliatePartner,
  placement: AdPlacement,
  settings?: Partial<Record<ManagedAffiliatePartner, Partial<AffiliatePartnerSettings>>>,
): boolean {
  if (!isManagedAffiliatePartner(partner)) return true;

  const group = affiliatePlacementGroupForAdPlacement(placement);
  if (!group) return false;

  return affiliatePartnerCanShowInGroup(partner, group, settings);
}

export const adPackages: Record<AdPackageId, {
  id: AdPackageId;
  name: string;
  price: string;
  stripeUrl: string;
  dailyImpressionCap: number;
  durationDays: number;
  description: string;
}> = {
  sponsored_monthly: {
    id: "sponsored_monthly",
    name: "Sponsored Resource Placement",
    price: "$49.99 CAD / month",
    stripeUrl: "https://buy.stripe.com/3cI9ATccE6li7qo1Bmgfu05",
    dailyImpressionCap: 1000,
    durationDays: 30,
    description: "Standard rotating sponsor placement for relevant ecommerce tools, services, and offers."
  },
  featured_monthly: {
    id: "featured_monthly",
    name: "Featured Sponsored Resource",
    price: "$99.99 CAD / month",
    stripeUrl: "https://buy.stripe.com/9B63cv1y02524ec1Bmgfu04",
    dailyImpressionCap: 2500,
    durationDays: 30,
    description: "Higher-priority rotating campaign with a larger daily impression allowance."
  }
};

export const defaultAdSettings: AdSettings = {
  adsEnabled: true,
  googleAdsEnabled: false,
  directSponsorAdsEnabled: true,
  requireOwnerApproval: true,
  placements: {
    mobile_homepage: true,
    homepage_hero: true,
    homepage_mid: true,
    analyze_below_card: true,
    analyze_premium_top: true,
    analyze_premium_bottom: true,
    results_below_verdict: true,
    buyer_dashboard: true,
    seller_dashboard: true,
    pricing: true,
    footer: true,
  },
  affiliatePartners: defaultAffiliatePartnerSettings,
};

export const reviewIntelPlaceholderAds: SponsorAd[] = [
  {
    id: "reviewintel-self-home",
    sponsorName: "ReviewIntel ad spot",
    headline: "Try ReviewIntel or advertise here",
    description:
      "No paid campaign is live in this slot yet. Apply for ads to place your banner or video in this exact space.",
    destinationUrl: "/advertise/apply",
    placement: "homepage_mid",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze",
    sponsorName: "ReviewIntel ad spot",
    headline: "Advertise beside AI product scans",
    description:
      "This ReviewIntel banner holds the slot until an approved paid campaign is ready. Apply to run your ad here.",
    destinationUrl: "/advertise/apply",
    placement: "analyze_below_card",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze-premium-top",
    sponsorName: "ReviewIntel ad spot",
    headline: "Premium ad space is available",
    description:
      "Paid and approved campaigns rotate into this slot automatically. Apply with a banner or short video.",
    destinationUrl: "/advertise/apply",
    placement: "analyze_premium_top",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze-premium-bottom",
    sponsorName: "ReviewIntel ad spot",
    headline: "Reach buyers at decision time",
    description:
      "Promote your product, store, or service while shoppers check reviews, complaints, and buying confidence.",
    destinationUrl: "/advertise/apply",
    placement: "analyze_premium_bottom",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-results",
    sponsorName: "ReviewIntel ad spot",
    headline: "Promote your product beside buyer decisions",
    description:
      "When no paid advertiser is active, ReviewIntel shows this banner. Approved campaigns replace it in the same slot.",
    destinationUrl: "/advertise/apply",
    placement: "results_below_verdict",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-homepage-hero",
    sponsorName: "ReviewIntel ad spot",
    headline: "Try ReviewIntel before you buy",
    description:
      "Analyze reviews, spot risk, and get instant buyer confidence before making a purchase.",
    destinationUrl: "/analyze",
    placement: "homepage_hero",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-buyer-dashboard",
    sponsorName: "ReviewIntel ad spot",
    headline: "Upgrade your buying confidence",
    description:
      "Use ReviewIntel to scan more products, compare risk, and decide faster with AI review intelligence.",
    destinationUrl: "/pricing",
    placement: "buyer_dashboard",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-seller-dashboard",
    sponsorName: "ReviewIntel ad spot",
    headline: "Advertise with ReviewIntel",
    description:
      "Put your brand in front of shoppers and sellers while they analyze products, reviews, and competitors.",
    destinationUrl: "/advertise/apply",
    placement: "seller_dashboard",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-pricing",
    sponsorName: "ReviewIntel ad spot",
    headline: "Promote your offer beside pricing decisions",
    description:
      "Reach shoppers and sellers while they compare ReviewIntel plan options.",
    destinationUrl: "/advertise/apply",
    placement: "pricing",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-footer",
    sponsorName: "ReviewIntel ad spot",
    headline: "Apply for ReviewIntel ads",
    description:
      "Pay for a package, upload your creative, and ReviewIntel will review it before your campaign goes live.",
    destinationUrl: "/advertise/apply",
    placement: "footer",
    active: true,
    status: "approved",
  },
];

export function getAdForPlacement(placement: AdPlacement): SponsorAd | null {
  if (!defaultAdSettings.adsEnabled) return null;
  if (!defaultAdSettings.directSponsorAdsEnabled) return null;
  if (!defaultAdSettings.placements[placement]) return null;

  return (
    reviewIntelPlaceholderAds.find(
      (ad) => ad.placement === placement && ad.active && ad.status === "approved",
    ) ?? null
  );
}
