# ReviewIntel

Professional AI review intelligence SaaS for buyers, online sellers, and owner/admin operations.

ReviewIntel is platform-neutral. It works with manually pasted review text, TXT review batches, and quick screenshot uploads from Amazon, Walmart, Etsy, eBay, Shopify stores, AliExpress, Best Buy, TikTok Shop, Google Reviews, and future app-review sources. It does not scrape websites.

## What is built

- Premium AI-themed landing page focused on the buyer moment of doubt: “Are these reviews real, and should I buy this?”
- Catchy first-screen hero with AI scan visuals, fake-review risk, buyer verdict, trust checks, review snippets, dark/light mode, and responsive layout
- Review analyzer with platform selector, buyer/seller mode, primary Paste Reviews workflow, multi-section bulk paste, TXT/CSV upload, Quick Scan Beta screenshots, preview, browser-side image compression, and optional screenshot stitching
- OpenAI Responses API route with structured JSON output and screenshot vision support when `OPENAI_API_KEY` is configured
- Real AI error handling: if OpenAI is configured but quota/billing fails, the API returns the OpenAI error instead of showing a mock result
- Results dashboard with product score, buyer recommendation, fake-review warnings, seller insights, keyword frequency, and issue categories
- Product comparison page for Buyer mode and Seller mode with 2-5 products, user priorities, winner badges, and report export
- Sponsored resources section for future affiliate tools, partner placements, and ecommerce service recommendations
- Login, sign up, Google login endpoint, password reset, email verification page, and local demo session fallback
- Separate Buyer, Seller, and private Admin/Developer experiences with route guards
- Stripe Checkout, Billing Portal, and signed webhook routes
- Supabase/PostgreSQL schema for users, profiles, subscriptions, uploaded images, review analyses, saved products, comparisons, usage tracking, app settings, billing history, sponsors, logs, and abuse reports
- Guest quota: 3 free analyses total before signup
- Free Buyer quota: 3 product analyses per UTC day, persisted in Supabase when production keys are configured
- Private Admin/Developer access bypasses all usage limits and can simulate Buyer Pro, Seller Starter, and Seller Pro for testing
- Confidence scoring by review volume: Low under 10 reviews, Medium from 10-50 reviews, High at 50+ reviews
- Rate limiting, max request/text/file protections, large-batch model chunking, upload validation, security headers, robots, sitemap, OpenGraph, and JSON-LD

## How users scan a product

Open:

```txt
http://localhost:3000/analyze
```

Use:

- `Quick Scan Beta`: upload JPG/PNG screenshots for a fast mobile-style check.
- `Deep Analysis`: paste review batches or upload TXT/CSV for stronger confidence.
- `Compare`: open `/compare` to compare 2-5 products.

Product URLs are accepted as reference metadata only. ReviewIntel does not fetch or scrape the URL in this version.

## Code Map

Main pages:

- `app/page.tsx`: homepage and first impression hero
- `app/analyze/page.tsx`: analyzer page shell
- `app/results/page.tsx`: latest result page shell
- `app/compare/page.tsx`: product comparison page
- `app/pricing/page.tsx`: pricing page
- `app/admin-access/page.tsx`: hidden admin unlock route
- `app/admin/page.tsx`: admin/developer control center

Main components:

- `components/Header.tsx`: top navigation
- `components/AnalyzerForm.tsx`: paste reviews, TXT/CSV upload, screenshot upload, scan animation, quota UI
- `components/ResultsDashboard.tsx`: separated Buyer and Seller result dashboards
- `components/ResultsClient.tsx`: reads latest session result and demo result loaders
- `components/SellerIntelligenceTabs.tsx`: interactive Seller Pro signal tabs for clusters, keywords, and risks
- `components/SellerReportActions.tsx`: functional Seller report export and local save actions
- `components/SellerProCommandPanel.tsx`: interactive Seller dashboard command board
- `components/CompareForm.tsx`: Buyer/Seller comparison workflow
- `components/DeveloperControlCenter.tsx`: admin system controls and plan simulation
- `components/DeveloperQACenter.tsx`: QA checklist and diagnostics
- `components/SponsoredResources.tsx`: future sponsored/affiliate resource cards

Core logic:

- `app/api/analyze/route.ts`: protected analysis API, OpenAI call, quota/rate limits, local fallback
- `lib/prompts.ts`: AI prompt architecture
- `lib/reviewSchema.ts`: structured JSON schema expected from AI
- `lib/reviewIngestion.ts`: paste/TXT/CSV normalization and valid review counting
- `lib/localAnalyzer.ts`: local analysis fallback when OpenAI is not configured
- `lib/supabaseServer.ts`: Supabase persistence, quota, profiles, analysis history
- `lib/stripe.ts`: Stripe checkout and billing portal helpers
- `lib/account.ts` and `lib/clientAccount.ts`: roles, plans, local account state, quota labels
- `db/schema.sql`: Supabase/PostgreSQL schema

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
STRICT_OPENAI_ERRORS=true
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_BUYER_PRO_PRICE_ID=
STRIPE_SELLER_STARTER_PRICE_ID=
STRIPE_SELLER_PRO_PRICE_ID=

NEXT_PUBLIC_SPONSORS_ENABLED=true

REVIEWINTEL_ADMIN_CODE=
REVIEWINTEL_ADMIN_CODE_HASH=
REVIEWINTEL_ADMIN_SESSION_SECRET=
REVIEWINTEL_ADMIN_EMAIL=developer@reviewintel.local
```

The app can render without Supabase or Stripe in local demo mode, but public paid launch needs Supabase and Stripe configured. If `OPENAI_API_KEY` is set and OpenAI returns a quota, billing, model, or network error, ReviewIntel returns that error instead of a placeholder result. In local development only, `/admin-access` accepts `reviewintel-dev-admin` when no admin code environment variable is set.

## Key Routes

- `/` landing page
- `/analyze` deep paste/TXT analyzer plus quick screenshot analyzer
- `/results` latest analysis dashboard
- `/compare` Buyer/Seller product comparison for 2-5 products
- `/login`, `/signup`, `/auth/reset-password`, `/auth/verify-email`
- `/dashboard`, `/dashboard/customer` (Buyer dashboard), `/dashboard/seller`
- `/account`, `/pricing`
- `/admin-access` private admin unlock route
- `/admin` System Control Center and Developer Mode

## API

`POST /api/analyze`

```json
{
  "productName": "Optional product or business name",
  "productUrl": "Optional reference URL. The API does not fetch it yet.",
  "platform": "shopify",
  "audience": "both",
  "reviewSections": [
    {
      "id": "batch-1",
      "title": "Recent negative reviews",
      "text": "Pasted review text...",
      "source": "paste"
    }
  ],
  "ingestionMode": "deep_paste",
  "imageAggregation": "individual",
  "images": [
    {
      "name": "reviews.png",
      "type": "image/png",
      "dataUrl": "data:image/png;base64,...",
      "size": 120000
    }
  ]
}
```

Returns structured JSON including:

- `overall_summary`
- `positive_points`
- `negative_points`
- `common_complaints`
- `praised_features`
- `sentiment_score`
- `confidence_score`
- `buyer_recommendation`
- `seller_insights`
- `improvement_suggestions`
- `feature_requests`
- `quality_concerns`
- `packaging_issues`
- `durability_issues`
- `support_issues`
- `keyword_analysis`

## Supabase

1. Create a Supabase project.
2. Run `db/schema.sql` in the SQL editor.
3. Create a private storage bucket named `review-screenshots`.
4. Add Supabase environment variables to Vercel.
5. Wire auth callback URLs to `/dashboard` and `/auth/verify-email`.
6. Confirm `SUPABASE_SERVICE_ROLE_KEY` is present only in server-side environments. It powers persistent quota, profile creation, saved analysis history, and Stripe webhook updates.

## Review Ingestion Roadmap

- `Deep Analysis = Paste Reviews`: primary path for long review batches, TXT uploads, multiple pasted sections, buyer decisions, and seller analytics.
- `Quick Scan Beta = Screenshot Upload`: lightweight path for mobile users and fast checks from a few visible reviews.
- `Mixed Evidence`: combines pasted review batches with quick screenshots.
- `Product URL Import`: reserved architecture only; no fetching or scraping is implemented yet.
- `Ecommerce Connectors`: future approved APIs, seller-owned store integrations, CSV feeds, and partner connectors.

Large pasted batches are accepted up to the configured server cap, then chunked before model analysis for stability. Admin accounts bypass quota/rate limits for testing, while public users remain protected by request size, file size, and daily usage gates.

## Stripe

1. Create monthly prices for Buyer Pro ($9.99), Seller Starter ($29), and Seller Pro ($79).
2. Add `STRIPE_BUYER_PRO_PRICE_ID`, `STRIPE_SELLER_STARTER_PRICE_ID`, `STRIPE_SELLER_PRO_PRICE_ID`, and `STRIPE_SECRET_KEY`.
3. Set webhook URL to `/api/stripe/webhook`.
4. Add `STRIPE_WEBHOOK_SECRET`.
5. Webhook events upsert `subscriptions` and `billing_history`.

## Admin / Developer Mode

Admin accounts do not use public signup/login. Open `/admin-access`, enter the private admin code, then use `/admin` for the System Control Center. Admin sessions are server-validated, hidden from search indexing, rate-limited on access attempts, and auto-expire.

- Toggle AI analysis, payments, sponsored resources, announcements, and maintenance-mode messaging
- Simulate Buyer Pro, Seller Starter, or Seller Pro without paying
- Reset quota instantly for local testing
- View API usage, failed webhook, screenshot, sponsor, and abuse-report placeholders

## Launch Checks

```bash
npm run lint
npm run typecheck
npm run build
```

Before selling access, run one real `/analyze` request with a funded OpenAI project. A `429 insufficient_quota` response means the app is correctly calling OpenAI, but the OpenAI billing/quota setup is not ready yet.

## Sponsored Resources

Sponsored placements are intentionally designed as a small resource library, not banner ads. The current build uses `lib/sponsors.ts` placeholders and can be disabled with:

```bash
NEXT_PUBLIC_SPONSORS_ENABLED=false
```

The Supabase schema includes `sponsors` and `sponsor_events` tables for future admin add/edit/remove controls, affiliate URLs, active windows, placements, impressions, and clicks.

## Vercel Deployment

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add all production environment variables.
4. Deploy.
5. Confirm `/robots.txt`, `/sitemap.xml`, `/api/analyze`, and Stripe webhook routes.

## Security Notes

- No direct scraping is implemented.
- API requests are rate-limited in memory for local/Vercel runtime protection.
- Uploads are limited to JPG/PNG data URLs and size-checked before analysis.
- Protected dashboards set `Cache-Control: no-store`.
- Production usage limits should move from memory to `usage_tracking`.
