// Honest upgrade content. Benefits listed here must match what the server actually enforces.
import { pricingLabelForPlan, type SupportedCurrency } from "./pricing";
import { FREE_DAILY_REVIEW_LIMIT } from "./account";

export type UpsellAudience = "shopper" | "seller";
export const UPSELL_SNOOZE_KEY = "reviewintel:upsell-snooze-until";
export const UPSELL_SNOOZE_DAYS = 4;

/** Watch alerts are flag-gated (off by default), so they're only advertised when enabled. */
export function watchAlertsAdvertised(env: Record<string, string | undefined> = process.env) {
  return String(env.NEXT_PUBLIC_REVIEWINTEL_WATCH_ALERTS || "").toLowerCase() === "on";
}

export function shopperBenefits(env: Record<string, string | undefined> = process.env): string[] {
  return [
    `Unlimited scans (free is ${FREE_DAILY_REVIEW_LIMIT} a day)`,
    "Your full scan history, saved to your account",
    "An avoid list for products you've ruled out",
    "Compare two products side by side",
    ...(watchAlertsAdvertised(env) ? ["Watch alerts when a product's verdict changes"] : []),
  ];
}

export const SELLER_BENEFITS: Record<"seller_premium" | "seller_pro", string[]> = {
  seller_premium: ["Seller dashboard for your own products", "Track product health from real reviews", "Saved products and notes"],
  seller_pro: ["Everything in Seller Starter", "Compare your product with a competitor", "Product journal and calendar"],
};

export function upsellOffer(audience: UpsellAudience, currency: SupportedCurrency = "USD", env = process.env) {
  if (audience === "seller") {
    return { audience, title: "Grow with real customer feedback", plans: (["seller_premium", "seller_pro"] as const).map(plan => ({ plan, name: plan === "seller_pro" ? "Seller Pro" : "Seller Starter", price: pricingLabelForPlan(plan, currency), benefits: SELLER_BENEFITS[plan] })) };
  }
  return { audience, title: "Get more from every scan", plans: [{ plan: "buyer_pro" as const, name: "Shopper Premium", price: pricingLabelForPlan("buyer_pro", currency), benefits: shopperBenefits(env) }] };
}

export function snoozed(now = Date.now(), storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined" ? window.localStorage : null) {
  try { return Number(storage?.getItem(UPSELL_SNOOZE_KEY) || 0) > now; } catch { return false; }
}
export function snooze(now = Date.now(), storage: Pick<Storage, "setItem"> | null = typeof window !== "undefined" ? window.localStorage : null) {
  try { storage?.setItem(UPSELL_SNOOZE_KEY, String(now + UPSELL_SNOOZE_DAYS * 86400000)); } catch { /* storage unavailable */ }
}
