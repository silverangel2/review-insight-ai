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
  buyer_beta: "Beta",
  seller_premium: "$29.99",
  seller_beta: "Beta",
  seller_pro: "$59.99"
};

const defaultLocalizedPrices: Record<SupportedCurrency, Record<SubscriptionPlan, string>> = {
  USD: defaultUsdPrices,
  CAD: {
    free_buyer: "$0",
    buyer_pro: "CAD $9.99",
    buyer_beta: "Beta",
    seller_premium: "CAD $29.99",
    seller_beta: "Beta",
    seller_pro: "CAD $59.99"
  },
  EUR: {
    free_buyer: "$0",
    buyer_pro: "CAD $9.99",
    buyer_beta: "Beta",
    seller_premium: "CAD $29.99",
    seller_beta: "Beta",
    seller_pro: "CAD $59.99"
  },
  GBP: {
    free_buyer: "$0",
    buyer_pro: "CAD $9.99",
    buyer_beta: "Beta",
    seller_premium: "CAD $29.99",
    seller_beta: "Beta",
    seller_pro: "CAD $59.99"
  },
  PHP: {
    free_buyer: "$0",
    buyer_pro: "CAD $9.99",
    buyer_beta: "Beta",
    seller_premium: "CAD $29.99",
    seller_beta: "Beta",
    seller_pro: "CAD $59.99"
  }
};

const planEnvKey: Record<Exclude<SubscriptionPlan, "free_buyer">, string> = {
  buyer_pro: "BUYER_PRO",
  buyer_beta: "BUYER_BETA",
  seller_premium: "SELLER_PREMIUM",
  seller_beta: "SELLER_BETA",
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
  if (plan === "buyer_beta" || plan === "seller_beta") return "Beta";
  return configuredPublicPrice(plan, currency) || defaultLocalizedPrices[currency][plan];
}

export function isPlanCurrencyConfigured(plan: SubscriptionPlan, currency: SupportedCurrency) {
  if (plan === "free_buyer" || plan === "buyer_beta" || plan === "seller_beta") return true;
  if (currency === "USD") return true;
  return Boolean(configuredPublicPrice(plan, currency));
}

export function localizedPriceNote(currency: SupportedCurrency) {
  if (currency === "USD") return "USD prices are shown by default.";
  return `ReviewIntel pricing is shown in CAD and matches the active Stripe checkout prices.`;
}
