export type ReviewIntelLocale = "en" | "fr" | "es" | "tl";

export const DEFAULT_LOCALE: ReviewIntelLocale = "en";

export const SUPPORTED_LOCALES: Array<{
  code: ReviewIntelLocale;
  label: string;
  status: "default" | "prepared";
}> = [
  { code: "en", label: "English", status: "default" },
  { code: "fr", label: "French", status: "prepared" },
  { code: "es", label: "Spanish", status: "prepared" },
  { code: "tl", label: "Tagalog", status: "prepared" }
];

type Dictionary = {
  productName: string;
  runAnalysis: string;
  shopperScore: string;
  sellerDashboard: string;
  manageSubscription: string;
};

export const dictionaries: Record<ReviewIntelLocale, Dictionary> = {
  en: {
    productName: "Product name",
    runAnalysis: "Run AI Analysis",
    shopperScore: "Shopper Score",
    sellerDashboard: "Seller Dashboard",
    manageSubscription: "Manage Subscription"
  },
  fr: {
    productName: "Product name",
    runAnalysis: "Run AI Analysis",
    shopperScore: "Shopper Score",
    sellerDashboard: "Seller Dashboard",
    manageSubscription: "Manage Subscription"
  },
  es: {
    productName: "Product name",
    runAnalysis: "Run AI Analysis",
    shopperScore: "Shopper Score",
    sellerDashboard: "Seller Dashboard",
    manageSubscription: "Manage Subscription"
  },
  tl: {
    productName: "Product name",
    runAnalysis: "Run AI Analysis",
    shopperScore: "Shopper Score",
    sellerDashboard: "Seller Dashboard",
    manageSubscription: "Manage Subscription"
  }
};

export function getDictionary(locale: string | undefined) {
  const safeLocale = SUPPORTED_LOCALES.some((item) => item.code === locale) ? (locale as ReviewIntelLocale) : DEFAULT_LOCALE;
  return dictionaries[safeLocale];
}
