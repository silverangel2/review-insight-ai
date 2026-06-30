import { seoLandingPages } from "@/lib/seoLandingPages";

export type RobotsMode = "index,follow" | "noindex,nofollow";

export type SeoDraft = {
  title: string;
  description: string;
  ogImage: string;
  canonicalUrl: string;
  robots: RobotsMode;
  keywords?: string[];
};

export type AutomatedSeoPage = {
  label: string;
  path: string;
  title: string;
  description: string;
  keywords: string[];
  robots: RobotsMode;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
};

const defaultDescription =
  "ReviewIntel helps shoppers and ecommerce sellers turn product review signals into clear buying, trust, and product-growth decisions.";

const coreSeoPages: AutomatedSeoPage[] = [
  {
    label: "Home",
    path: "/",
    title: "ReviewIntel | AI Review Intelligence Platform",
    description: defaultDescription,
    keywords: ["AI review intelligence", "ReviewIntel", "review analyzer"],
    robots: "index,follow",
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    label: "Analyzer",
    path: "/analyze",
    title: "AI Product Review Analyzer | ReviewIntel",
    description: "Upload a product screenshot, review text, or product link to get a clear AI buying verdict with risks, value signals, complaints, and next steps.",
    keywords: ["AI product review analyzer", "product scan", "buying verdict"],
    robots: "index,follow",
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    label: "Compare",
    path: "/compare",
    title: "Product Compare AI | ReviewIntel",
    description: "Compare two products with AI review intelligence so shoppers can see the stronger choice, important tradeoffs, and when products should not be compared.",
    keywords: ["product compare AI", "compare product reviews", "shopping comparison"],
    robots: "index,follow",
    priority: 0.86,
    changeFrequency: "weekly",
  },
  {
    label: "Pricing",
    path: "/pricing",
    title: "ReviewIntel Pricing | Shopper and Seller Plans",
    description: "Choose Shopper Premium, Seller Premium, or Seller Pro for AI review analysis, seller intelligence, competitor comparison, and growth tracking.",
    keywords: ["ReviewIntel pricing", "seller review analytics pricing", "shopper review AI pricing"],
    robots: "index,follow",
    priority: 0.82,
    changeFrequency: "monthly",
  },
  {
    label: "Advertise",
    path: "/advertise",
    title: "Advertise on ReviewIntel | Reach Smart Shoppers and Sellers",
    description: "Apply for ReviewIntel ad placements and reach people who are actively checking products, reviews, risk signals, and ecommerce growth opportunities.",
    keywords: ["advertise on ReviewIntel", "review intelligence ads", "shopper ad placement"],
    robots: "index,follow",
    priority: 0.74,
    changeFrequency: "monthly",
  },
  {
    label: "Reviews",
    path: "/reviews",
    title: "ReviewIntel Reviews and Use Cases",
    description: "See how ReviewIntel helps shoppers and ecommerce sellers turn messy reviews into fast, practical decisions before buying or improving products.",
    keywords: ["ReviewIntel reviews", "review intelligence examples", "product review AI use cases"],
    robots: "index,follow",
    priority: 0.72,
    changeFrequency: "monthly",
  },
  {
    label: "About",
    path: "/about",
    title: "About ReviewIntel | AI Review Intelligence",
    description: "Learn how ReviewIntel turns review language, complaint patterns, and trust signals into clearer shopper decisions and seller growth intelligence.",
    keywords: ["about ReviewIntel", "AI review intelligence company", "review analysis platform"],
    robots: "index,follow",
    priority: 0.68,
    changeFrequency: "monthly",
  },
];

const trustSeoPages: AutomatedSeoPage[] = [
  {
    label: "Terms",
    path: "/terms",
    title: "Terms of Service | ReviewIntel",
    description: "ReviewIntel terms for accounts, subscriptions, analysis outputs, acceptable use, billing, data handling, and platform responsibilities.",
    keywords: ["ReviewIntel terms", "terms of service"],
    robots: "index,follow",
    priority: 0.45,
    changeFrequency: "yearly",
  },
  {
    label: "Privacy",
    path: "/privacy",
    title: "Privacy Policy | ReviewIntel",
    description: "ReviewIntel privacy information covering account data, uploaded review evidence, analysis results, billing identifiers, cookies, and security practices.",
    keywords: ["ReviewIntel privacy", "privacy policy"],
    robots: "index,follow",
    priority: 0.45,
    changeFrequency: "yearly",
  },
  {
    label: "Disclaimer",
    path: "/disclaimer",
    title: "AI Analysis Disclaimer | ReviewIntel",
    description: "ReviewIntel AI analysis is decision support, not a guarantee. Learn how shopper and seller outputs should be interpreted responsibly.",
    keywords: ["ReviewIntel disclaimer", "AI analysis disclaimer"],
    robots: "index,follow",
    priority: 0.42,
    changeFrequency: "yearly",
  },
  {
    label: "Refunds",
    path: "/refunds",
    title: "Refund Policy | ReviewIntel",
    description: "ReviewIntel refund, billing, subscription, and support guidance for shoppers, sellers, advertisers, and account owners.",
    keywords: ["ReviewIntel refund policy", "subscription refund"],
    robots: "index,follow",
    priority: 0.4,
    changeFrequency: "yearly",
  },
  {
    label: "FAQ",
    path: "/faq",
    title: "ReviewIntel FAQ | Shopper and Seller Help",
    description: "Answers about ReviewIntel shopper scans, seller analysis, AI outputs, subscriptions, privacy, upload handling, and account support.",
    keywords: ["ReviewIntel FAQ", "AI review analyzer help"],
    robots: "index,follow",
    priority: 0.55,
    changeFrequency: "monthly",
  },
  {
    label: "Contact",
    path: "/contact",
    title: "Contact ReviewIntel Support",
    description: "Contact ReviewIntel for account help, billing questions, seller support, advertising inquiries, product feedback, and technical assistance.",
    keywords: ["contact ReviewIntel", "ReviewIntel support"],
    robots: "index,follow",
    priority: 0.55,
    changeFrequency: "monthly",
  },
  {
    label: "Billing Support",
    path: "/billing-support",
    title: "Billing Support | ReviewIntel",
    description: "Get ReviewIntel billing support for subscriptions, invoices, checkout questions, customer portal access, and plan changes.",
    keywords: ["ReviewIntel billing", "subscription support"],
    robots: "index,follow",
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    label: "Account Support",
    path: "/account-support",
    title: "Account Support | ReviewIntel",
    description: "Get help with ReviewIntel login, signup, email verification, Google sign-in, account roles, beta access, and workspace access.",
    keywords: ["ReviewIntel account support", "login help"],
    robots: "index,follow",
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    label: "Cookies",
    path: "/cookies",
    title: "Cookie Policy | ReviewIntel",
    description: "ReviewIntel cookie information for essential site behavior, remembered preferences, analytics, consent, and privacy choices.",
    keywords: ["ReviewIntel cookies", "cookie policy"],
    robots: "index,follow",
    priority: 0.36,
    changeFrequency: "yearly",
  },
  {
    label: "Acceptable Use",
    path: "/acceptable-use",
    title: "Acceptable Use Policy | ReviewIntel",
    description: "ReviewIntel acceptable use rules for uploads, accounts, AI analysis, advertising, automation, and safe platform behavior.",
    keywords: ["ReviewIntel acceptable use", "AI platform rules"],
    robots: "index,follow",
    priority: 0.36,
    changeFrequency: "yearly",
  },
];

const landingSeoPages: AutomatedSeoPage[] = Object.values(seoLandingPages).map((page) => ({
  label: page.title,
  path: `/${page.slug}`,
  title: page.metaTitle,
  description: page.description,
  keywords: page.keywords,
  robots: "index,follow",
  priority: page.audience === "Seller" ? 0.86 : 0.88,
  changeFrequency: "weekly",
}));

export const automatedSeoPages: AutomatedSeoPage[] = [
  ...coreSeoPages,
  ...landingSeoPages,
  ...trustSeoPages,
];

export function seoBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://getreviewintel.com"
  ).replace(/\/$/, "");
}

function canonicalUrl(baseUrl: string, routePath: string) {
  return `${baseUrl}${routePath === "/" ? "" : routePath}`;
}

function ogImageForIndex(index: number) {
  const imageNumber = ((index % 100) + 1).toString().padStart(3, "0");
  return `/social/house/reviewintel-house-${imageNumber}.png`;
}

export function defaultSeoDraftForPath(routePath: string, baseUrl = seoBaseUrl()): SeoDraft {
  const page = automatedSeoPages.find((item) => item.path === routePath) || automatedSeoPages[0];
  const index = Math.max(0, automatedSeoPages.findIndex((item) => item.path === page.path));

  return {
    title: page.title,
    description: page.description,
    ogImage: ogImageForIndex(index),
    canonicalUrl: canonicalUrl(baseUrl, page.path),
    robots: page.robots,
    keywords: page.keywords,
  };
}

export function buildAutomatedSeoSettings(baseUrl = seoBaseUrl()) {
  return automatedSeoPages.reduce<Record<string, SeoDraft>>((settings, page, index) => {
    settings[page.path] = {
      title: page.title,
      description: page.description,
      ogImage: ogImageForIndex(index),
      canonicalUrl: canonicalUrl(baseUrl, page.path),
      robots: page.robots,
      keywords: page.keywords,
    };

    return settings;
  }, {});
}
