export type SEOLandingPage = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  audience: "Shopper" | "Seller" | "Platform";
  primaryCta: string;
  secondaryCta: string;
  keywords: string[];
  highlights: string[];
  sections?: Array<{
    title: string;
    body: string;
  }>;
};

export const seoLandingPages: Record<string, SEOLandingPage> = {
  "consumer-review-analyzer": {
    slug: "consumer-review-analyzer",
    title: "Shopper Review Analyzer",
    metaTitle: "Shopper Review Analyzer | ReviewIntel",
    description:
      "Upload a product screenshot or use a product link to get a fast shopper verdict, risk signals, value score, best-for match, and biggest complaint.",
    audience: "Shopper",
    primaryCta: "Run Shopper Analysis",
    secondaryCta: "See Pricing",
    keywords: ["shopper review analyzer", "product review checker", "AI product review checker", "worth buying verdict"],
    highlights: ["Worth buying verdict", "Fake review risk", "Value for money", "Top complaint"]
  },
  "amazon-review-analyzer": {
    slug: "amazon-review-analyzer",
    title: "Amazon Review Analyzer",
    metaTitle: "Amazon Review Analyzer | ReviewIntel",
    description:
      "Analyze Amazon product screenshots, links, or review evidence to understand product quality, risk signals, complaints, and value before buying.",
    audience: "Shopper",
    primaryCta: "Analyze Amazon Reviews",
    secondaryCta: "Run Analysis",
    keywords: ["Amazon review analyzer", "Amazon fake review checker", "Amazon product review AI", "Amazon complaint summary"],
    highlights: ["Product screenshot scan", "Review quality indicators", "Complaint patterns", "Best-for match"]
  },
  "fake-review-detector": {
    slug: "fake-review-detector",
    title: "Fake Review Detector",
    metaTitle: "Fake Review Detector | ReviewIntel",
    description:
      "Estimate fake-review risk from repeated phrases, unnatural language, low evidence quality, review clusters, and confidence signals.",
    audience: "Shopper",
    primaryCta: "Detect Review Risk",
    secondaryCta: "Read Disclaimer",
    keywords: ["fake review detector", "fake review risk", "AI fake review checker", "review authenticity signals"],
    highlights: ["Risk score", "Confidence level", "Pattern detection", "Evidence quality"]
  },
  "seller-review-analytics": {
    slug: "seller-review-analytics",
    title: "Seller Review Analytics",
    metaTitle: "Seller Review Analytics | ReviewIntel",
    description:
      "Seller Pro review analytics for complaint mining, sentiment trends, feature requests, positioning, and product improvement actions.",
    audience: "Seller",
    primaryCta: "Open Seller Analytics",
    secondaryCta: "View Seller Plans",
    keywords: ["seller review analytics", "ecommerce review analytics", "seller feedback dashboard", "customer complaint mining"],
    highlights: ["Complaint clusters", "Sentiment trends", "Feature requests", "Action plan"]
  },
  "product-complaint-analyzer": {
    slug: "product-complaint-analyzer",
    title: "Product Complaint Analyzer",
    metaTitle: "Product Complaint Analyzer | ReviewIntel",
    description:
      "Find the repeated complaints customers care about most, including durability, support, shipping, packaging, and listing mismatch issues.",
    audience: "Seller",
    primaryCta: "Mine Complaints",
    secondaryCta: "See Seller Pro",
    keywords: ["product complaint analyzer", "complaint mining", "customer pain points", "review pain point analysis"],
    highlights: ["Pain point map", "Refund-risk issues", "Packaging signals", "Fix priority"]
  },
  "product-feedback-dashboard": {
    slug: "product-feedback-dashboard",
    title: "Product Feedback Dashboard",
    metaTitle: "Product Feedback Dashboard | ReviewIntel",
    description:
      "Turn product reviews into a daily feedback command center with ratings, sentiment, complaints, positive feedback, and improvement notes.",
    audience: "Seller",
    primaryCta: "Open Feedback Dashboard",
    secondaryCta: "View Calendar",
    keywords: ["product feedback dashboard", "product improvement dashboard", "customer feedback analytics", "review dashboard"],
    highlights: ["Daily scan calendar", "Sentiment overview", "Progress notes", "Improvement tracking"]
  },
  "ai-review-intelligence-tool": {
    slug: "ai-review-intelligence-tool",
    title: "AI Review Intelligence Tool",
    metaTitle: "AI Review Intelligence Tool | ReviewIntel",
    description:
      "ReviewIntel combines shopper verdicts and seller intelligence so reviews become decisions, not walls of text.",
    audience: "Platform",
    primaryCta: "Start AI Analysis",
    secondaryCta: "Explore Features",
    keywords: ["AI review intelligence tool", "AI review analysis", "review intelligence platform", "review summarizer"],
    highlights: ["Shopper verdict", "Seller report", "Fake-risk confidence", "Shareable results"]
  }
};

Object.values(seoLandingPages).forEach((page) => {
  page.sections = [
    {
      title: "What this page helps with",
      body:
        page.audience === "Seller"
          ? "Seller teams can move from raw comments to product decisions: what to fix, what to show in listings, what customers praise, and what causes refunds."
          : "Shoppers can skip long review threads and get a quick answer: whether the product looks worth buying, what the risks are, and who it is best for."
    },
    {
      title: "What ReviewIntel checks",
      body:
        "ReviewIntel reads review language, rating clues, repeated themes, complaint concentration, sentiment, value signals, and confidence indicators. Results are designed to be easy to scan and screenshot."
    },
    {
      title: "How to use it",
      body:
        "Upload a screenshot, add a product link, or use TXT/CSV batches when you already have review evidence. ReviewIntel creates the correct Shopper or Seller output based on the active workspace."
    }
  ];
});

export function getSEOLandingPage(slug: string) {
  return seoLandingPages[slug];
}
