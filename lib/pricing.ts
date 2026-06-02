import type { SubscriptionPlan } from "@/lib/types";

export type SupportedCurrency = "USD" | "CAD" | "EUR" | "GBP" | "PHP";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["USD", "CAD", "EUR", "GBP", "PHP"];

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: "USD",
  CAD: "CAD",
  EUR: "EUR",
  GBP: "GBP",
  PHP: "PHP"
};

const defaultUsdPrices: Record<SubscriptionPlan, string> = {
  free_buyer: "$0",
  buyer_pro: "$9.99",
  seller_starter: "$29",
  seller_pro: "$79"
};

const planEnvKey: Record<Exclude<SubscriptionPlan, "free_buyer">, string> = {
  buyer_pro: "BUYER_PRO",
  seller_starter: "SELLER_STARTER",
  seller_pro: "SELLER_PRO"
};

export function normalizeCurrency(value: unknown): SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(String(value).toUpperCase() as SupportedCurrency)
    ? (String(value).toUpperCase() as SupportedCurrency)
    : "USD";
}

export function priceLabelEnv(plan: Exclude<SubscriptionPlan, "free_buyer">, currency: SupportedCurrency) {
  return `NEXT_PUBLIC_REVIEWINTEL_${planEnvKey[plan]}_${currency}_PRICE`;
}

function configuredPublicPrice(plan: Exclude<SubscriptionPlan, "free_buyer">, currency: SupportedCurrency) {
  return process.env[priceLabelEnv(plan, currency)]?.trim() ?? "";
}

export function pricingLabelForPlan(plan: SubscriptionPlan, currency: SupportedCurrency) {
  if (plan === "free_buyer") return "$0";
  if (currency === "USD") return configuredPublicPrice(plan, currency) || defaultUsdPrices[plan];
  return configuredPublicPrice(plan, currency) || "Stripe price required";
}

export function isPlanCurrencyConfigured(plan: SubscriptionPlan, currency: SupportedCurrency) {
  if (plan === "free_buyer") return true;
  if (currency === "USD") return true;
  return Boolean(configuredPublicPrice(plan, currency));
}

export function localizedPriceNote(currency: SupportedCurrency) {
  if (currency === "USD") return "USD prices are shown by default.";
  return `Show ${currency} only when the matching Stripe Checkout price is configured.`;
}
