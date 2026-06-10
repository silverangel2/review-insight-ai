export type MarketingChannel =
  | "google"
  | "tiktok"
  | "facebook"
  | "instagram"
  | "reddit"
  | "youtube"
  | "newsletter"
  | "affiliate";

export type ReviewIntelCampaign = {
  id: string;
  channel: MarketingChannel;
  name: string;
  audience: string;
  landingPath: string;
  medium: string;
  campaign: string;
  description: string;
};

export const reviewIntelCampaigns: ReviewIntelCampaign[] = [
  {
    id: "google-buyer-review-checker",
    channel: "google",
    name: "Google Ads — AI Review Checker",
    audience: "People searching before buying online",
    landingPath: "/",
    medium: "paid_search",
    campaign: "ai_review_checker",
    description: "Use for Google Search ads targeting product review checker and fake review detector searches.",
  },
  {
    id: "tiktok-fast-shopper-scan",
    channel: "tiktok",
    name: "TikTok — Fast Shopper Scan",
    audience: "Fast-moving shoppers who want quick product decisions",
    landingPath: "/buyer-review-analyzer",
    medium: "paid_social",
    campaign: "fast_shopper_scan",
    description: "Use for short videos showing Upload → Scan → Verdict.",
  },
  {
    id: "facebook-shopping-confidence",
    channel: "facebook",
    name: "Facebook — Shopping Confidence",
    audience: "Everyday online shoppers",
    landingPath: "/consumer-review-analyzer",
    medium: "paid_social",
    campaign: "shopping_confidence",
    description: "Use for Facebook/Instagram ads focused on avoiding bad purchases.",
  },
  {
    id: "reddit-seller-review-analytics",
    channel: "reddit",
    name: "Reddit — Seller Review Analytics",
    audience: "Amazon sellers, ecommerce founders, product researchers",
    landingPath: "/seller-review-analytics",
    medium: "paid_social",
    campaign: "seller_review_analytics",
    description: "Use for seller-focused communities and ecommerce discussions.",
  },
  {
    id: "youtube-fake-review-detector",
    channel: "youtube",
    name: "YouTube — Fake Review Detector",
    audience: "Shoppers watching product reviews",
    landingPath: "/fake-review-detector",
    medium: "paid_video",
    campaign: "fake_review_detector",
    description: "Use for YouTube pre-roll or creator sponsorship links.",
  },
  {
    id: "newsletter-seller-tools",
    channel: "newsletter",
    name: "Newsletter — Seller Tools",
    audience: "Sellers, ecommerce operators, product teams",
    landingPath: "/product-feedback-dashboard",
    medium: "sponsorship",
    campaign: "seller_tools_newsletter",
    description: "Use for newsletter sponsorships and paid email placements.",
  },
];

export function buildCampaignUrl(origin: string, campaign: ReviewIntelCampaign) {
  const base = origin.replace(/\/$/, "");
  const url = new URL(`${base}${campaign.landingPath}`);

  url.searchParams.set("utm_source", campaign.channel);
  url.searchParams.set("utm_medium", campaign.medium);
  url.searchParams.set("utm_campaign", campaign.campaign);
  url.searchParams.set("utm_content", campaign.id);

  return url.toString();
}
