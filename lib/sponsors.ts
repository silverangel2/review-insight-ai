export type SponsorCategory =
  | "seller_tools"
  | "shopify_apps"
  | "ai_writing"
  | "analytics"
  | "fulfillment"
  | "marketing"
  | "product_research"
  | "automation";

export type SponsorPlacement = "landing" | "dashboard" | "results" | "seller_dashboard";

export type SponsorCard = {
  id: string;
  title: string;
  description: string;
  category: SponsorCategory;
  logoText: string;
  url: string;
  affiliateUrl?: string;
  cta: string;
  sponsored?: boolean;
  placements: SponsorPlacement[];
};

export type SponsorEventType = "impression" | "click";

export const SPONSORS_ENABLED = process.env.NEXT_PUBLIC_SPONSORS_ENABLED !== "false";

export const sponsorCategoryLabels: Record<SponsorCategory, string> = {
  seller_tools: "Amazon seller tools",
  shopify_apps: "Shopify apps",
  ai_writing: "AI writing",
  analytics: "Ecommerce analytics",
  fulfillment: "Fulfillment",
  marketing: "Marketing tools",
  product_research: "Product research",
  automation: "AI automation"
};

export const sponsorCards: SponsorCard[] = [
  {
    id: "seller-command-center",
    title: "Seller Command Center",
    description: "Track marketplace listings, product feedback, and operational tasks from one seller workspace.",
    category: "seller_tools",
    logoText: "SC",
    url: "https://example.com/seller-command-center",
    affiliateUrl: "https://example.com/seller-command-center?ref=reviewintel",
    cta: "Explore tool",
    sponsored: true,
    placements: ["landing", "seller_dashboard"]
  },
  {
    id: "listing-ai-studio",
    title: "Listing AI Studio",
    description: "Turn review complaints into clearer titles, bullets, FAQs, and product-page copy tests.",
    category: "ai_writing",
    logoText: "LA",
    url: "https://example.com/listing-ai-studio",
    affiliateUrl: "https://example.com/listing-ai-studio?utm_source=reviewintel",
    cta: "View resource",
    sponsored: true,
    placements: ["landing", "dashboard", "results"]
  },
  {
    id: "fulfillment-check",
    title: "Fulfillment Check",
    description: "Audit packaging, delivery complaints, and warehouse handoff issues before refund risk rises.",
    category: "fulfillment",
    logoText: "FC",
    url: "https://example.com/fulfillment-check",
    cta: "Learn more",
    placements: ["dashboard", "seller_dashboard"]
  }
];

export function sponsorsForPlacement(placement: SponsorPlacement, limit = 3) {
  if (!SPONSORS_ENABLED) return [];
  return sponsorCards.filter((sponsor) => sponsor.placements.includes(placement)).slice(0, limit);
}

export function sponsorHref(sponsor: SponsorCard) {
  return sponsor.affiliateUrl || sponsor.url;
}
