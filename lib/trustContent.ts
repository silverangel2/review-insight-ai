export const SUPPORT_EMAIL = "support@getreviewintel.com";
export const BILLING_EMAIL = "support@getreviewintel.com";
export const PRIVACY_EMAIL = "support@getreviewintel.com";

export type TrustPageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  updated: string;
  tone: "trust" | "support" | "billing" | "warning";
  sections: Array<{
    title: string;
    body: string | string[];
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
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
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
    title: "Terms of Service",
    eyebrow: "Rules for using ReviewIntel",
    summary:
      "These Terms explain ReviewIntel's review-intelligence services, account responsibilities, acceptable use, third-party integrations, TikTok posting requirements, and service boundaries.",
    updated: "July 30, 2026",
    tone: "trust",
    sections: [
      {
        title: "Agreement to these Terms",
        body: [
          "These Terms of Service govern access to ReviewIntel at getreviewintel.com and related ReviewIntel tools, accounts, dashboards, automations, support pages, and APIs.",
          "By creating an account, using the website, submitting review evidence, connecting a social account, or using a paid plan, you agree to these Terms and to the Privacy Policy. If you use ReviewIntel for a company, store, agency, client, or other organization, you confirm that you are authorized to bind that organization."
        ]
      },
      {
        title: "What ReviewIntel does",
        body: [
          "ReviewIntel provides AI-assisted review intelligence for shoppers and ecommerce sellers. The service can analyze pasted review text, uploaded screenshots, TXT or CSV review batches, product details, public product signals, seller feedback, complaint patterns, fake-review risk signals, Buy Scores, recommendations, and seller improvement themes.",
          "ReviewIntel also includes account dashboards, subscription features, advertising and affiliate placements, admin operations tools, and social content automation for ReviewIntel-owned marketing content. Social posting features may connect to Facebook or TikTok when the relevant platform credentials and permissions are approved and configured."
        ]
      },
      {
        title: "Eligibility and accounts",
        body:
          "You must be at least 18 years old, or the age of majority where you live, to create a paid account or connect third-party integrations. You must provide accurate account, contact, company, and billing information and keep it current.",
        items: [
          "You are responsible for activity under your account.",
          "You must keep passwords, session access, API credentials, and connected social accounts secure.",
          "You must notify ReviewIntel promptly if you suspect unauthorized access."
        ]
      },
      {
        title: "Subscriptions, billing, and plan limits",
        body:
          "Free, Shopper Premium, Seller, and other paid plans may include different usage limits, features, quotas, billing periods, and support options. Subscription checkout and payment processing may be handled by Stripe or another payment provider. Cancellation stops future renewal unless the billing page or payment processor states otherwise.",
        items: [
          "ReviewIntel may change feature limits, prices, or plan packaging prospectively.",
          "Refund requests are reviewed under the Refund Policy and applicable law.",
          "You may not bypass quotas, payment controls, trial limits, or subscription checks."
        ]
      },
      {
        title: "User responsibilities",
        body:
          "You are responsible for the text, files, screenshots, product details, URLs, media, captions, and other content you submit to ReviewIntel. You must have the right to submit and process that content and to use any resulting analysis or social post.",
        items: [
          "Do not upload private customer data unless you have permission and a lawful reason.",
          "Do not submit confidential business data, payment card data, passwords, government IDs, health data, or other sensitive personal information unless ReviewIntel specifically supports that use in writing.",
          "Do not rely on ReviewIntel as the only source for safety, medical, legal, tax, financial, warranty, or regulatory decisions."
        ]
      },
      {
        title: "Acceptable use",
        body:
          "ReviewIntel must be used to understand review evidence, improve products, and make better shopping or seller decisions. You may not use ReviewIntel to harm customers, reviewers, marketplaces, creators, platforms, or the integrity of reviews.",
        items: [
          "No fake-review creation, review manipulation, reviewer harassment, or deceptive marketplace activity.",
          "No unlawful, hateful, abusive, adult, exploitative, privacy-invasive, or infringing content.",
          "No scraping, credential sharing, rate-limit bypassing, malware, spam, denial-of-service activity, reverse engineering, or attempts to access systems you are not authorized to use."
        ]
      },
      {
        title: "Intellectual property",
        body:
          "ReviewIntel, including its software, prompts, scoring systems, workflows, interface design, copy, branding, logos, generated templates, and service documentation, is owned by ReviewIntel or its licensors and is protected by intellectual property laws. These Terms do not transfer ownership of ReviewIntel intellectual property to you."
      },
      {
        title: "User-generated content",
        body:
          "You keep ownership of content you submit, subject to any rights held by the original owner or platform. You grant ReviewIntel a limited license to host, process, reproduce, transform, display, and use your submitted content only as needed to provide, secure, troubleshoot, support, and improve the service and to comply with law.",
        items: [
          "You are responsible for ensuring your submissions do not violate another person's rights.",
          "You may request deletion of account or analysis data as described in the Privacy Policy.",
          "ReviewIntel may remove content or suspend access if content creates legal, security, platform, or abuse risk."
        ]
      },
      {
        title: "Third-party services and integrations",
        body:
          "ReviewIntel may depend on third-party services for hosting, authentication, database storage, payment processing, email, AI analysis, analytics, advertising, affiliate links, and social posting. These services are governed by their own terms and privacy policies.",
        items: [
          "Marketplace names such as Amazon, Walmart, TikTok Shop, Etsy, eBay, and Shopify may be used to identify product sources. ReviewIntel is not affiliated with those marketplaces unless expressly stated.",
          "Third-party APIs can change, fail, limit access, require additional review, or revoke permissions.",
          "You must comply with the terms of any third-party platform you connect or use through ReviewIntel."
        ]
      },
      {
        title: "TikTok integration terms",
        body: [
          "If you connect TikTok to ReviewIntel, TikTok Login Kit sends you to TikTok for authorization and returns you to ReviewIntel only after you approve the requested scopes. ReviewIntel currently uses TikTok integration for the admin social posting workflow and ReviewIntel-owned educational or marketing content.",
          "ReviewIntel may request TikTok scopes such as user.info.basic and video.upload. If TikTok approves Direct Post access for the app, ReviewIntel may request video.publish so authorized users can post content directly through the Content Posting API. You may grant or deny permissions through TikTok, and ReviewIntel may not be able to provide posting functionality if required scopes are not granted.",
          "You may only connect TikTok accounts that you own, administer, or are authorized to use. You are responsible for ensuring any media, captions, titles, hashtags, privacy settings, and post metadata submitted through ReviewIntel are original, authorized, accurate, and compliant with TikTok's Terms, Community Guidelines, Developer Terms, Content Posting API requirements, and applicable law."
        ],
        items: [
          "Do not use ReviewIntel to post third-party private data, customer scan results, marketplace review text, copyrighted media without permission, misleading claims, unwanted watermarks, spam, or prohibited promotional content to TikTok.",
          "ReviewIntel may check TikTok creator information, available privacy options, posting limits, media accessibility, and API status before posting.",
          "TikTok may restrict, reject, make private, remove, or limit posts or app permissions. ReviewIntel is not responsible for TikTok's platform decisions."
        ]
      },
      {
        title: "AI analysis and product guidance",
        body:
          "ReviewIntel uses AI-assisted and rules-based analysis to identify review themes, evidence strength, fake-review risk signals, product complaints, seller opportunities, and shopping recommendations. Outputs are estimates based on available evidence and can be incomplete, stale, biased, or wrong.",
        items: [
          "ReviewIntel does not guarantee that a review, product, seller, listing, claim, score, or recommendation is accurate, authentic, safe, lawful, or complete.",
          "Buy Scores, verdicts, fake-review risk, and seller insights are decision-support signals, not professional advice or guaranteed truth.",
          "You should verify important details directly with the seller, marketplace, manufacturer, regulator, or another authoritative source."
        ]
      },
      {
        title: "Service availability and changes",
        body:
          "ReviewIntel may update, suspend, remove, or limit features, integrations, plans, pages, or automated workflows at any time. We aim to keep the service reliable, but we do not guarantee uninterrupted access, error-free operation, exact analysis timing, or continued availability of any third-party API."
      },
      {
        title: "Suspension and termination",
        body:
          "ReviewIntel may suspend, restrict, or terminate access if we believe an account violates these Terms, creates legal or security risk, abuses the service, infringes rights, bypasses billing or usage controls, misuses social integrations, or threatens ReviewIntel, users, creators, reviewers, or third-party platforms.",
        items: [
          "You may stop using ReviewIntel at any time.",
          "You may request account deletion through the Delete Account / Data Request page.",
          "Some billing, tax, fraud-prevention, legal, and security records may be retained as required or permitted by law."
        ]
      },
      {
        title: "Disclaimers",
        body:
          "ReviewIntel is provided on an as-is and as-available basis to the fullest extent permitted by law. We disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, accuracy, and results. Some jurisdictions do not allow certain disclaimers, so parts of this section may not apply to you."
      },
      {
        title: "Limitation of liability",
        body:
          "To the fullest extent permitted by law, ReviewIntel will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost data, lost goodwill, marketplace penalties, third-party API decisions, or business interruption. ReviewIntel's aggregate liability for claims relating to the service will not exceed the amount you paid to ReviewIntel for the service in the 12 months before the event giving rise to the claim, or CAD $100 if you did not pay for the service."
      },
      {
        title: "Governing law",
        body:
          "Unless mandatory consumer protection law requires otherwise, these Terms are governed by the laws of New Brunswick, Canada, and the applicable federal laws of Canada, without regard to conflict-of-law rules. Courts located in New Brunswick, Canada will have exclusive jurisdiction where permitted by law."
      },
      {
        title: "Changes and contact",
        body:
          `We may update these Terms as ReviewIntel changes or as legal, security, platform, or TikTok Developer requirements evolve. The Last updated date shows when the Terms were last revised. Questions about these Terms can be sent to ${SUPPORT_EMAIL}.`
      }
    ],
    cta: { label: "Read Acceptable Use", href: "/acceptable-use" }
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    eyebrow: "How ReviewIntel handles data",
    summary:
      "This Privacy Policy explains what ReviewIntel collects, how review and TikTok data are used, how cookies and analytics work, and how users can access, correct, or delete data.",
    updated: "July 30, 2026",
    tone: "trust",
    sections: [
      {
        title: "Scope of this Policy",
        body: [
          "This Privacy Policy applies to ReviewIntel websites, accounts, dashboards, review-analysis tools, seller tools, admin social posting workflows, support pages, and related services operated at getreviewintel.com.",
          "ReviewIntel is an AI review-intelligence service for shoppers and ecommerce sellers. It is not TikTok, Amazon, Walmart, Etsy, eBay, Shopify, Stripe, Supabase, OpenAI, Google, Meta, or any other third-party platform unless expressly stated."
        ]
      },
      {
        title: "Data ReviewIntel collects",
        body:
          "ReviewIntel collects only the information needed to provide accounts, analysis, billing, support, security, analytics, advertising, and authorized social posting.",
        items: [
          "Account data: email address, display name, role, plan, login status, language, country, company or store name, address fields you provide, and subscription status.",
          "Review-analysis data: product names, brands, stores, URLs, pasted review text, uploaded screenshots, uploaded TXT or CSV files, extracted review evidence, analysis outputs, Buy Scores, verdicts, recommendation results, seller reports, and saved history.",
          "Operational data: usage counts, quotas, page paths, support messages, admin notes, security events, error logs, connected integration status, selected media, captions, and public media URLs used for social posts."
        ]
      },
      {
        title: "Review, screenshot, and seller data",
        body:
          "When you paste review text, upload screenshots, upload files, or enter product details, ReviewIntel processes that data to generate the requested analysis. This may include extracting review snippets, identifying product complaints, estimating fake-review risk, creating seller insights, and saving results to your account history where the feature is enabled.",
        items: [
          "Do not upload private customer data unless you have permission and a lawful reason.",
          "Do not upload passwords, payment card data, government IDs, health data, or other sensitive personal data.",
          "ReviewIntel may use de-identified or aggregated operational patterns to improve reliability, abuse prevention, and product quality."
        ]
      },
      {
        title: "TikTok Login and API integration",
        body: [
          "ReviewIntel uses TikTok Login Kit and TikTok Content Posting API only when an authorized user connects a TikTok account for the social posting workflow. TikTok authorization is consent-based, and TikTok may show the scopes requested before you approve access.",
          "The default ReviewIntel TikTok OAuth scopes are user.info.basic and video.upload. If TikTok approves Direct Post access and ReviewIntel enables full direct posting, the app may request video.publish. ReviewIntel does not request TikTok permissions that are unrelated to the posting workflow."
        ],
        items: [
          "TikTok user data accessed if authorized: open_id, union_id when returned by TikTok, display name, avatar URL, granted scopes, access token, refresh token, token expiration, connected account name, creator posting information, privacy options, API status, post status, and TikTok responses needed to publish or troubleshoot posts.",
          "TikTok content data processed if authorized: ReviewIntel-selected public media URL, caption, title or description, hashtags, privacy level, interaction settings, media type, and Content Posting API identifiers or status.",
          "ReviewIntel does not use TikTok Login to collect private messages, contacts, unrelated TikTok videos, follower lists, or TikTok analytics unless a future feature clearly requests and obtains the required TikTok approval and user consent."
        ]
      },
      {
        title: "How TikTok data is used",
        body:
          "TikTok data is used only for the functionality requested by the authorized user: connecting the TikTok account, verifying the account and scopes, checking creator posting requirements, uploading or posting ReviewIntel-owned or user-authorized content, displaying connection status, troubleshooting API errors, disconnecting the integration, and complying with TikTok Developer requirements.",
        items: [
          "ReviewIntel does not sell TikTok user data.",
          "ReviewIntel does not use TikTok user data for unrelated advertising, unrelated review analysis, or marketplace scoring.",
          "ReviewIntel does not post customer scan data, private account data, or third-party review text to TikTok through the TikTok integration."
        ]
      },
      {
        title: "How TikTok data is stored and protected",
        body:
          "TikTok tokens and connection records are stored server-side in ReviewIntel's database infrastructure and are not exposed in browser JavaScript. ReviewIntel stores the connected provider, account identifier, account name, access token, refresh token when provided, scopes, token type, expiration time, and limited troubleshooting metadata needed to maintain the connection.",
        items: [
          "OAuth state cookies are used to reduce authorization tampering during the TikTok connection flow.",
          "Access to TikTok credentials is limited to server-side posting, refresh, diagnostics, and disconnect operations.",
          "When TikTok is disconnected, ReviewIntel marks the connection inactive and clears stored access and refresh tokens where supported by the database operation."
        ]
      },
      {
        title: "How ReviewIntel uses data",
        body:
          "ReviewIntel uses collected data to provide the service, authenticate users, enforce quotas and plan limits, generate review analysis, save user-requested results, run seller dashboards, manage subscriptions, process support requests, secure the service, detect abuse, improve product quality, and operate authorized social posting workflows.",
        items: [
          "Review analysis data is used to create the requested reports, verdicts, recommendations, and follow-up insights.",
          "Account and billing data are used to manage login, subscriptions, invoices, refunds, support, and fraud prevention.",
          "Operational data is used to diagnose errors, improve speed and reliability, maintain security, and understand feature usage."
        ]
      },
      {
        title: "Cookies, local storage, and analytics",
        body:
          "ReviewIntel uses essential cookies and browser storage for login state, OAuth state, security, language, account mode, theme, quotas, workspace preferences, and cookie-consent choices. ReviewIntel also records privacy-aware traffic events after a cookie choice is made.",
        items: [
          "Traffic events may include page path, referrer, browser, device type, platform, approximate country, region, city from hosting headers, UTM campaign parameters, account role, account plan, consent choice, and a hashed visitor key.",
          "ReviewIntel does not store raw IP addresses in traffic analytics, but may use IP address and user-agent data transiently to create abuse-resistant hashed visitor keys and security records.",
          "Where advertising or affiliate features are enabled, Google advertising, affiliate networks, or sponsor systems may process data under their own policies. Optional advertising cookies are controlled through the cookie banner where supported."
        ]
      },
      {
        title: "Third-party services",
        body:
          "ReviewIntel may use third-party providers to host the website, store data, authenticate users, process payments, send email, run AI analysis, analyze traffic, protect security, manage affiliate links, serve ads, and connect social platforms.",
        items: [
          "Examples may include Vercel or similar hosting, Supabase or similar database/auth infrastructure, Stripe for payments, OpenAI or other AI providers for requested analysis, Google services for advertising or measurement, Meta/Facebook APIs, and TikTok APIs.",
          "Third-party providers process data only as needed for their role, subject to their own terms, policies, data-processing commitments, and legal obligations.",
          "ReviewIntel may disclose data when required by law, to protect rights and security, to prevent abuse, during a business transfer, or with your consent."
        ]
      },
      {
        title: "Legal bases and regional rights",
        body:
          "Depending on where you live, ReviewIntel may rely on consent, contract necessity, legitimate interests, legal obligations, or another lawful basis to process personal data. Users in the European Economic Area, United Kingdom, California, Canada, and other regions may have specific privacy rights under laws such as GDPR, UK GDPR, CCPA/CPRA, and PIPEDA."
      },
      {
        title: "Your privacy rights",
        body:
          `You may request access, correction, deletion, export, restriction, objection, withdrawal of consent, or information about how your data is processed by contacting ${PRIVACY_EMAIL} or using the Delete Account / Data Request page. We may need to verify your identity and account before completing a request.`,
        items: [
          "GDPR and UK GDPR users may have rights to access, rectify, erase, restrict, port, and object to certain processing, plus the right to complain to a supervisory authority.",
          "California users may have rights to know, access, correct, delete, opt out of certain sharing or sales, limit sensitive personal information use where applicable, and avoid discrimination for exercising rights.",
          "Canadian users may request access and correction under PIPEDA and applicable provincial privacy laws."
        ]
      },
      {
        title: "Data deletion",
        body:
          `You can request deletion of your ReviewIntel account, review-analysis data, uploaded content, saved results, support data, or connected TikTok data by emailing ${PRIVACY_EMAIL} or using /delete-account. For TikTok specifically, disconnecting TikTok removes active connection status and clears stored tokens where supported; you may also revoke ReviewIntel access from your TikTok account settings.`,
        items: [
          "Tell us whether you want full account deletion or deletion of specific analyses, files, or integration data.",
          "We may retain limited billing, tax, legal, security, fraud-prevention, dispute, backup, or audit records where required or permitted by law.",
          "Deletion from active systems and backup systems may occur on different schedules."
        ]
      },
      {
        title: "Data retention",
        body:
          "ReviewIntel keeps personal data only as long as reasonably needed for the purpose collected, including account operation, analysis history, subscriptions, customer support, security, legal compliance, platform audit requirements, and dispute handling.",
        items: [
          "Account and subscription records are retained while the account is active and for a reasonable period after closure if needed for billing, tax, legal, security, or support reasons.",
          "Review analyses, uploads, and seller reports may be retained until you delete them, delete your account, or request deletion, subject to operational backups and legal needs.",
          "TikTok tokens are retained while the TikTok connection is active or as needed to refresh, post, troubleshoot, disconnect, or meet audit requirements."
        ]
      },
      {
        title: "Security",
        body:
          "ReviewIntel uses administrative, technical, and organizational safeguards designed to protect personal data. These include server-side token handling, access controls, HTTPS transport, limited admin access, security logging, OAuth state validation, and separation of public pages from admin workflows.",
        items: [
          "No online service can guarantee absolute security.",
          "You are responsible for keeping your login credentials and connected platform accounts secure.",
          `If you believe your account or connected TikTok integration has been compromised, contact ${PRIVACY_EMAIL} promptly.`
        ]
      },
      {
        title: "International processing",
        body:
          "ReviewIntel and its service providers may process data in Canada, the United States, and other countries where infrastructure or providers operate. When data is transferred internationally, ReviewIntel relies on appropriate legal mechanisms, provider commitments, contractual protections, or consent where required."
      },
      {
        title: "Children's privacy",
        body:
          "ReviewIntel is not directed to children under 13, or under the minimum age required by local law. We do not knowingly collect personal data from children. If you believe a child provided personal data to ReviewIntel, contact us and we will review deletion."
      },
      {
        title: "Changes and contact",
        body:
          `ReviewIntel may update this Privacy Policy as the product, legal requirements, third-party APIs, or TikTok Developer requirements change. The Last updated date shows when this Policy was last revised. Privacy questions and requests can be sent to ${PRIVACY_EMAIL}.`
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
      "ReviewIntel uses essential cookies and browser storage for login state, account role, plan mode, quotas, preferences, product operation, and privacy-friendly traffic counts. Optional ad cookies are only used after consent.",
    updated: "June 27, 2026",
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
          "ReviewIntel may count public page views, approximate location, platform, referrer, campaign tags, pricing clicks, and affiliate clicks without storing raw IP addresses. Optional Google AdSense cookies and scripts are only loaded after you accept optional cookies."
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
