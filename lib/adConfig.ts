export type AdPlacement =
  | "homepage_hero"
  | "homepage_mid"
  | "analyze_below_card"
  | "analyze_premium_top"
  | "analyze_premium_bottom"
  | "results_below_verdict"
  | "buyer_dashboard"
  | "seller_dashboard"
  | "footer";

export type AdvertiserApplicationStatus = "pending" | "approved" | "rejected" | "paused";

export type SponsorAd = {
  id: string;
  sponsorName: string;
  headline: string;
  description: string;
  imageUrl?: string;
  destinationUrl: string;
  placement: AdPlacement;
  active: boolean;
  status: AdvertiserApplicationStatus;
  startsAt?: string;
  endsAt?: string;
};

export type AdSettings = {
  adsEnabled: boolean;
  googleAdsEnabled: boolean;
  directSponsorAdsEnabled: boolean;
  requireOwnerApproval: boolean;
  placements: Record<AdPlacement, boolean>;
};

export const defaultAdSettings: AdSettings = {
  adsEnabled: true,
  googleAdsEnabled: false,
  directSponsorAdsEnabled: true,
  requireOwnerApproval: true,
  placements: {
    homepage_hero: true,
    homepage_mid: true,
    analyze_below_card: true,
    analyze_premium_top: true,
    analyze_premium_bottom: true,
    results_below_verdict: true,
    buyer_dashboard: true,
    seller_dashboard: true,
    footer: true,
  },
};

export const reviewIntelPlaceholderAds: SponsorAd[] = [
  {
    id: "reviewintel-self-home",
    sponsorName: "ReviewIntel",
    headline: "Advertise with ReviewIntel",
    description:
      "Reach shoppers, sellers, and product researchers directly inside an AI review intelligence platform.",
    destinationUrl: "/advertise/apply",
    placement: "homepage_mid",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze",
    sponsorName: "ReviewIntel Partners",
    headline: "Your brand could be here",
    description:
      "Apply for a sponsored placement and promote your product to ReviewIntel users.",
    destinationUrl: "/advertise/apply",
    placement: "analyze_below_card",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze-premium-top",
    sponsorName: "ReviewIntel Premium Spot",
    headline: "$99 Premium Analyze Spot",
    description:
      "Advertise beside AI product scans while shoppers are actively deciding what to buy.",
    destinationUrl: "/advertise/apply",
    placement: "analyze_premium_top",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-analyze-premium-bottom",
    sponsorName: "ReviewIntel Sponsor Placement",
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
    sponsorName: "ReviewIntel Ads",
    headline: "Promote your product beside buyer decisions",
    description:
      "Get visibility where customers are already comparing products and reading AI-powered verdicts.",
    destinationUrl: "/advertise/apply",
    placement: "results_below_verdict",
    active: true,
    status: "approved",
  },
  {
    id: "reviewintel-self-footer",
    sponsorName: "ReviewIntel",
    headline: "Partner with ReviewIntel",
    description:
      "Clean sponsored placements for brands, tools, and services that help online shoppers and sellers.",
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
