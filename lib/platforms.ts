import type { ReviewPlatform } from "@/lib/types";

export const REVIEW_PLATFORMS: Array<{ value: ReviewPlatform; label: string }> = [
  { value: "amazon", label: "Amazon" },
  { value: "walmart", label: "Walmart" },
  { value: "etsy", label: "Etsy" },
  { value: "ebay", label: "eBay" },
  { value: "shopify", label: "Shopify store" },
  { value: "aliexpress", label: "AliExpress" },
  { value: "best_buy", label: "Best Buy" },
  { value: "tiktok_shop", label: "TikTok Shop" },
  { value: "google_reviews", label: "Google Reviews" },
  { value: "app_reviews", label: "App reviews" },
  { value: "other", label: "Other source" }
];

export function normalizePlatform(value: string | null | undefined): ReviewPlatform {
  return REVIEW_PLATFORMS.some((platform) => platform.value === value) ? (value as ReviewPlatform) : "other";
}

export function platformLabel(platform: ReviewPlatform) {
  return REVIEW_PLATFORMS.find((item) => item.value === platform)?.label ?? "Other source";
}
