import { seoLandingPages } from "@/lib/seoLandingPages";

export type RobotsMode = "index,follow" | "noindex,follow" | "noindex,nofollow";

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
    robots: "noindex,follow",
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    label: "Compare",
    path: "/compare",
    title: "Product Compare AI | ReviewIntel",
    description: "Compare two products with AI review intelligence so shoppers can see the stronger choice, important tradeoffs, and when products should not be compared.",
    keywords: ["product compare AI", "compare product reviews", "shopping comparison"],
    robots: "noindex,follow",
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

const guideSeoPages: AutomatedSeoPage[] = [
  {
    label: "Guides",
    path: "/guides",
    title: "ReviewIntel Guides | Read Product Reviews Like a Pro",
    description: "Practical ReviewIntel guides on spotting fake reviews, understanding star ratings, reading complaint patterns, and checking products before you buy.",
    keywords: ["review guides", "spot fake reviews", "read product reviews", "shopping guides"],
    robots: "index,follow",
    priority: 0.7,
    changeFrequency: "weekly",
  },
  {
    label: "How to Spot Fake Amazon Reviews",
    path: "/guides/spot-fake-amazon-reviews",
    title: "How to Spot Fake Amazon Reviews: 7 Patterns Worth Checking | ReviewIntel",
    description: "Fake reviews leave patterns: repeated phrases, marketing-like language, review bursts, thin reviewer profiles, and more. Learn seven risk signals to check before trusting a star rating.",
    keywords: ["spot fake amazon reviews", "fake review patterns", "fake product reviews"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
  {
    label: "What Review Velocity Spikes Mean",
    path: "/guides/review-velocity-spikes",
    title: "What Review Velocity Spikes Mean (and When to Worry) | ReviewIntel",
    description: "A product that gains hundreds of reviews in a week is telling you something. Learn to tell a launch surge from a review pattern that deserves suspicion.",
    keywords: ["review velocity", "review spikes", "suspicious review patterns"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
  {
    label: "How to Read Complaint Patterns Before You Buy",
    path: "/guides/read-complaint-patterns",
    title: "How to Read Complaint Patterns Before You Buy | ReviewIntel",
    description: "Every product has complaints. Learn to tell a real durability problem apart from shipping gripes, one-off bad luck, and complaints that don't apply to you.",
    keywords: ["read complaint patterns", "product complaints", "durability issues reviews"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
  {
    label: "What Verified Purchase, Vine, and Unverified Badges Mean",
    path: "/guides/verified-purchase-vine-badges",
    title: "What Verified Purchase, Vine, and Unverified Badges Actually Mean | ReviewIntel",
    description: "Plain-English explainer of Amazon review badges: what Verified Purchase actually verifies, how the Vine program works, and how much weight each badge deserves.",
    keywords: ["verified purchase meaning", "amazon vine reviews", "unverified reviews"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
  {
    label: "Why the Same Star Rating Can Mean Very Different Things",
    path: "/guides/same-star-rating-different-meaning",
    title: "Why the Same Star Rating Can Mean Very Different Things | ReviewIntel",
    description: "Two products can both show 4.3 stars and be completely different bets. Learn to read rating distributions, category norms, and recency before trusting the number.",
    keywords: ["star rating meaning", "rating distribution", "polarized reviews"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
  {
    label: "A 5-Minute Cross-Checking Routine Before You Buy",
    path: "/guides/pre-purchase-cross-check-routine",
    title: "A 5-Minute Cross-Checking Routine Before You Buy | ReviewIntel",
    description: "A practical five-minute checklist for any product page: badges, rating shape, complaint patterns, review timing, and customer photos — in order.",
    keywords: ["check product before buying", "product research checklist", "verify product reviews"],
    robots: "index,follow",
    priority: 0.64,
    changeFrequency: "monthly",
  },
];

export const automatedSeoPages: AutomatedSeoPage[] = [
  ...coreSeoPages,
  ...landingSeoPages,
  ...guideSeoPages,
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
  const codexOgImages = [
    "/uploads/social/reviewintel-premium-day-01-965127d4-66b9-40af-bb73-15c7bbf54e64.png",
    "/uploads/social/reviewintel-premium-day-02-a2e9993b-7cf8-4acc-9ca3-a817a6642fc7.png",
    "/uploads/social/reviewintel-premium-day-03-ce6ce483-8df4-4dcb-9bfe-7b8607242317.png",
    "/uploads/social/reviewintel-premium-day-04-4ccd0bda-d175-4d79-a7e4-e186006005b0.png",
    "/uploads/social/reviewintel-premium-day-05-eeb3999d-1c3d-4995-99c0-ef213795819f.png",
    "/uploads/social/reviewintel-premium-day-06-12940ce9-d4bb-4cd1-982c-fbdf56b361df.png",
  ];

  return codexOgImages[index % codexOgImages.length] || codexOgImages[0];
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
