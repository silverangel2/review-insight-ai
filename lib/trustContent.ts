export const SUPPORT_EMAIL = "support@getreviewintel.com";
export const BILLING_EMAIL = "support@getreviewintel.com";
export const PRIVACY_EMAIL = "privacy@reviewintel.ai";

export type TrustPageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  updated: string;
  tone: "trust" | "support" | "billing" | "warning";
  sections: Array<{
    title: string;
    body: string;
    items?: string[];
  }>;
  cta?: {
    label: string;
    href: string;
  };
};

export const footerLinkGroups = [
  {
    title: "Product",
    links: [
      { label: "Analyzer", href: "/analyze" },
      { label: "Pricing", href: "/pricing" },
      { label: "Advertise", href: "/advertise" },
      { label: "User Reviews", href: "/reviews" },
      { label: "Seller dashboard", href: "/dashboard/seller" },
      { label: "Shopper Premium", href: "/pricing" }
    ]
  },
  {
    title: "Trust",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Disclaimer", href: "/disclaimer" },
      { label: "Refunds", href: "/refunds" },
      { label: "Cookies", href: "/cookies" },
      { label: "Acceptable Use", href: "/acceptable-use" }
    ]
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
      { label: "Manage Subscription", href: "/manage-subscription" },
      { label: "Billing Support", href: "/billing-support" },
      { label: "Account Support", href: "/account-support" },
      { label: "Delete Account", href: "/delete-account" }
    ]
  },
  {
    title: "SEO pages",
    links: [
      { label: "Shopper Review Analyzer", href: "/consumer-review-analyzer" },
      { label: "Amazon Review Analyzer", href: "/amazon-review-analyzer" },
      { label: "Fake Review Detector", href: "/fake-review-detector" },
      { label: "Seller Review Analytics", href: "/seller-review-analytics" }
    ]
  }
];

export const trustPages: Record<string, TrustPageContent> = {
  disclaimer: {
    slug: "disclaimer",
    title: "Disclaimer",
    eyebrow: "Product guidance, not guaranteed truth",
    summary:
      "ReviewIntel summarizes review signals and likely patterns. It is designed to help shoppers and sellers think faster, not replace personal judgment, professional advice, or platform policy review.",
    updated: "June 1, 2026",
    tone: "warning",
    sections: [
      {
        title: "AI analysis boundaries",
        body:
          "ReviewIntel may use AI and local analysis to estimate sentiment, fake-review risk, common complaints, value, and recommendations. AI output can be incomplete or wrong, especially when users paste limited, biased, or low-quality review samples.",
        items: [
          "ReviewIntel does not guarantee a product is good, bad, safe, authentic, or compliant.",
          "ReviewIntel does not verify every reviewer, transaction, order, seller, or marketplace listing.",
          "You should confirm important product, safety, refund, medical, legal, financial, or warranty details from authoritative sources."
        ]
      },
      {
        title: "No scraping or marketplace endorsement",
        body:
          "Users manually paste review text or upload screenshots. ReviewIntel is not affiliated with Amazon, Walmart, TikTok Shop, Etsy, eBay, Shopify, or other marketplaces unless expressly stated."
      },
      {
        title: "Seller use",
        body:
          "Seller analytics are intended to identify product improvement themes, not to manipulate reviews, pressure customers, or bypass platform rules."
      }
    ],
    cta: { label: "Contact customer service", href: "/contact" }
  },
  terms: {
    slug: "terms",
    title: "Terms of Use",
    eyebrow: "Simple rules for using ReviewIntel",
    summary:
      "These terms explain how ReviewIntel can be used, what accounts are responsible for, and where the product boundaries are.",
    updated: "June 1, 2026",
    tone: "trust",
    sections: [
      {
        title: "Using the service",
        body:
          "You may use ReviewIntel to analyze review text, uploaded review files, and screenshots that you have the right to submit. You are responsible for the content you upload and how you use the results."
      },
      {
        title: "Accounts and subscriptions",
        body:
          "Shopper Free usage may be limited. Shopper Premium and Seller subscriptions unlock additional usage and features. You must keep your login information secure and use accurate billing information."
      },
      {
        title: "Prohibited use",
        body:
          "You may not use ReviewIntel to upload unlawful content, personal data you are not allowed to process, malware, spam, deceptive material, or content intended to abuse marketplaces or reviewers.",
        items: [
          "Do not upload private customer data unless you have permission and a lawful reason.",
          "Do not use the product to create fake reviews or manipulate marketplace trust systems.",
          "Do not attempt to reverse engineer, overload, or bypass usage limits."
        ]
      },
      {
        title: "Availability",
        body:
          "ReviewIntel may change features, limits, pricing, or integrations as the service improves. We aim for reliable access, but uptime is not guaranteed."
      }
    ],
    cta: { label: "Read Acceptable Use", href: "/acceptable-use" }
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "How ReviewIntel handles customer data",
    summary:
      "ReviewIntel collects account, billing, and review-analysis data needed to run the product. We keep the policy readable so customers know what is happening.",
    updated: "June 1, 2026",
    tone: "trust",
    sections: [
      {
        title: "Information we process",
        body:
          "We may process account email, plan type, login metadata, uploaded review text, uploaded screenshots, analysis results, usage counts, and billing identifiers from payment providers.",
        items: [
          "Review text and screenshots are used to produce analysis results.",
          "Billing data is handled through payment providers such as Stripe when configured.",
          "Admin and support actions may record operational notes for troubleshooting."
        ]
      },
      {
        title: "How we use information",
        body:
          "We use information to provide analysis, enforce usage limits, manage subscriptions, improve product quality, detect abuse, and respond to support requests."
      },
      {
        title: "Data requests",
        body:
          `For deletion, access, export, or correction requests, email ${PRIVACY_EMAIL} or use the Delete Account / Data Request page.`
      },
      {
        title: "Retention",
        body:
          "We keep information only as long as needed for product operation, legal obligations, billing records, security, and customer support."
      }
    ],
    cta: { label: "Request data deletion", href: "/delete-account" }
  },
  refunds: {
    slug: "refunds",
    title: "Refund Policy",
    eyebrow: "Clear billing expectations",
    summary:
      "ReviewIntel subscriptions are built for self-service cancellation and transparent billing support. This page explains how refund reviews work.",
    updated: "June 1, 2026",
    tone: "billing",
    sections: [
      {
        title: "Subscription cancellation",
        body:
          "You can cancel future renewals from Manage Subscription or by contacting billing support. Cancellation stops future billing but does not automatically refund previous charges."
      },
      {
        title: "Refund review",
        body:
          "Refund requests are reviewed case by case. Include the account email, plan, charge date, and reason so support can locate the subscription quickly.",
        items: [
          "Duplicate charges and accidental upgrades are prioritized.",
          "Refunds may be limited when the service was heavily used during the billing period.",
          "Payment processor timing can affect how quickly funds appear back on a card."
        ]
      },
      {
        title: "How to request help",
        body: `Email ${BILLING_EMAIL} or open the Billing Support page for the fastest path.`
      }
    ],
    cta: { label: "Open Billing Support", href: "/billing-support" }
  },
  faq: {
    slug: "faq",
    title: "FAQ",
    eyebrow: "Fast answers for shoppers and sellers",
    summary:
      "Common questions about ReviewIntel analysis, screenshots, subscriptions, fake-review risk, seller reports, and account support.",
    updated: "June 1, 2026",
    tone: "support",
    sections: [
      {
        title: "What does ReviewIntel analyze?",
        body:
          "It analyzes pasted review text, TXT or CSV batches, and screenshot uploads. It estimates review volume, sentiment, complaints, fake-review risk, value for money, and recommendation signals."
      },
      {
        title: "Is Shopper Mode different from Seller Mode?",
        body:
          "Yes. Shopper Mode gives a fast buying verdict. Seller Mode produces deeper business intelligence with complaint clusters, feature requests, positioning ideas, and improvement actions."
      },
      {
        title: "Can ReviewIntel prove a review is fake?",
        body:
          "No. It estimates fake-review risk using language patterns, repetition, review quality, and evidence strength. Treat the score as a risk signal, not a legal finding."
      },
      {
        title: "How many reviews should I paste?",
        body:
          "More review text usually improves confidence. For quick shopping decisions, a few dozen reviews can help. For Seller Pro decisions, larger CSV or TXT batches are better."
      },
      {
        title: "How do I cancel?",
        body:
          "Open Manage Subscription from the footer or account page. If the billing portal is unavailable, contact Billing Support and include your account email."
      }
    ],
    cta: { label: "Contact customer service", href: "/contact" }
  },
  contact: {
    slug: "contact",
    title: "Contact / Customer Service",
    eyebrow: "We are here to help",
    summary:
      `For product help, billing questions, account access, or data requests, email ${SUPPORT_EMAIL}. Use the form below to prepare a clear support message.`,
    updated: "June 1, 2026",
    tone: "support",
    sections: [
      {
        title: "Customer service",
        body:
          `Use ${SUPPORT_EMAIL} for general support. Include your account email, plan, page URL, and a short description of what happened.`
      },
      {
        title: "Billing",
        body:
          `For charges, cancellations, or invoices, contact ${BILLING_EMAIL} or open Billing Support.`
      },
      {
        title: "Privacy and data",
        body:
          `For access, deletion, or export requests, contact ${PRIVACY_EMAIL} or open Delete Account / Data Request.`
      }
    ]
  },
  "manage-subscription": {
    slug: "manage-subscription",
    title: "Unsubscribe / Manage Product Subscription",
    eyebrow: "Control your plan clearly",
    summary:
      "Manage billing, cancel renewal, downgrade, or contact support if you cannot access the billing portal.",
    updated: "June 1, 2026",
    tone: "billing",
    sections: [
      {
        title: "Self-service billing portal",
        body:
          "Logged-in paid users can open the billing portal from this page or the Account page. Admin and local development accounts may see a simulated portal during development."
      },
      {
        title: "Cancel or downgrade",
        body:
          "Canceling stops future renewals. Downgrading changes future access according to the selected plan. If a portal link fails, email billing support with your account email."
      },
      {
        title: "Need help?",
        body: `Email ${BILLING_EMAIL} and include your account email, plan, and what you want changed.`
      }
    ],
    cta: { label: "Open Billing Support", href: "/billing-support" }
  },
  "billing-support": {
    slug: "billing-support",
    title: "Billing Support",
    eyebrow: "Charges, invoices, cancellations",
    summary:
      "Billing support helps with subscriptions, failed checkout, duplicate charges, cancellation questions, and invoice requests.",
    updated: "June 1, 2026",
    tone: "billing",
    sections: [
      {
        title: "What to include",
        body:
          "Include your account email, plan, charge date, last four digits of the card if available, and what you need changed."
      },
      {
        title: "Fastest path",
        body:
          "Use Manage Subscription first for cancellation and card updates. Contact billing support if the portal cannot find your subscription."
      }
    ],
    cta: { label: "Manage Subscription", href: "/manage-subscription" }
  },
  "account-support": {
    slug: "account-support",
    title: "Account Support",
    eyebrow: "Login, plan, workspace, access",
    summary:
      "Get help with login issues, email verification, password reset, wrong workspace mode, or plan access.",
    updated: "June 1, 2026",
    tone: "support",
    sections: [
      {
        title: "Login and access",
        body:
          "Use password reset if you cannot sign in. If your paid plan is missing, include your account email and payment email when contacting support."
      },
      {
        title: "Shopper, Seller, and Admin modes",
        body:
          "Shopper tools are designed for buying decisions. Seller tools are designed for business intelligence. Admin controls are private developer and operations tools."
      }
    ],
    cta: { label: "Log in", href: "/login" }
  },
  "delete-account": {
    slug: "delete-account",
    title: "Delete Account / Data Request",
    eyebrow: "Control your data",
    summary:
      "Request account deletion, review-data deletion, access, correction, or export. We will use your account email to verify the request.",
    updated: "June 1, 2026",
    tone: "warning",
    sections: [
      {
        title: "Request types",
        body:
          "You can request account deletion, analysis deletion, data export, correction, or privacy questions.",
        items: [
          "Use the same email address as your ReviewIntel account.",
          "Tell us whether you want account deletion or only specific analysis data removed.",
          "Billing records may need to be retained where required by law or payment processors."
        ]
      },
      {
        title: "Where to send requests",
        body: `Email ${PRIVACY_EMAIL} or use the customer service form.`
      }
    ],
    cta: { label: "Contact Privacy Support", href: "/contact" }
  },
  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    eyebrow: "Cookies and local storage",
    summary:
      "ReviewIntel uses cookies and browser storage for login state, account role, plan mode, quotas, preferences, and product operation.",
    updated: "June 1, 2026",
    tone: "trust",
    sections: [
      {
        title: "Essential storage",
        body:
          "The app may store account role, plan, active mode, quota state, guest ID, and theme preference so the product works between page loads."
      },
      {
        title: "Analytics and marketing",
        body:
          "If analytics, ads, or marketing tools are added, ReviewIntel should clearly disclose the provider and purpose before relying on non-essential tracking."
      },
      {
        title: "Managing storage",
        body:
          "You can clear cookies or local storage from your browser settings. Doing so may log you out, reset local workspace mode, or reset local quota display."
      }
    ]
  },
  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    eyebrow: "Keep review intelligence honest",
    summary:
      "ReviewIntel should be used to understand customer feedback, not to abuse marketplaces, customers, or AI systems.",
    updated: "June 1, 2026",
    tone: "warning",
    sections: [
      {
        title: "Allowed use",
        body:
          "Analyze product reviews, compare product feedback, identify complaints, improve listings, and understand customer satisfaction."
      },
      {
        title: "Not allowed",
        body:
          "Do not use ReviewIntel to generate fake reviews, harass reviewers, upload stolen private data, bypass platform terms, or misrepresent AI output as verified fact.",
        items: [
          "No fake-review creation or review manipulation.",
          "No illegal, hateful, abusive, or privacy-invasive uploads.",
          "No attempts to overload, probe, or bypass the app's security and quota systems."
        ]
      },
      {
        title: "Enforcement",
        body:
          "Accounts may be limited, suspended, or terminated if they abuse the service or create risk for customers, marketplaces, or ReviewIntel."
      }
    ]
  }
};

export function getTrustPage(slug: string) {
  return trustPages[slug];
}
