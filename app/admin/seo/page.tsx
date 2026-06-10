import Link from "next/link";

const seoPages = [
  {
    title: "Amazon Review Analyzer",
    slug: "/amazon-review-analyzer",
    audience: "Amazon shoppers and sellers",
    keyword: "amazon review analyzer",
    angle: "Find fake reviews, repeated complaints, and buying risk before checkout.",
    cta: "Scan Amazon Reviews",
  },
  {
    title: "Fake Review Detector",
    slug: "/fake-review-detector",
    audience: "Online shoppers",
    keyword: "fake review detector",
    angle: "Detect suspicious review patterns and decide if a product is trustworthy.",
    cta: "Check Reviews Now",
  },
  {
    title: "Buyer Review Analyzer",
    slug: "/buyer-review-analyzer",
    audience: "Shoppers comparing products",
    keyword: "buyer review analyzer",
    angle: "Turn messy reviews into a clear buy, avoid, or compare-first verdict.",
    cta: "Analyze Before Buying",
  },
  {
    title: "Product Complaint Analyzer",
    slug: "/product-complaint-analyzer",
    audience: "Sellers and product teams",
    keyword: "product complaint analyzer",
    angle: "Find the complaints customers repeat most and know what to fix first.",
    cta: "Find Product Complaints",
  },
  {
    title: "Seller Review Analytics",
    slug: "/seller-review-analytics",
    audience: "Amazon, Shopify, Walmart, and ecommerce sellers",
    keyword: "seller review analytics",
    angle: "Convert customer reviews into product improvement and listing strategy.",
    cta: "Analyze Seller Reviews",
  },
  {
    title: "Product Feedback Dashboard",
    slug: "/product-feedback-dashboard",
    audience: "Ecommerce founders and brand owners",
    keyword: "product feedback dashboard",
    angle: "Track customer complaints, strengths, product health, and next actions.",
    cta: "Open Seller Dashboard",
  },
];

const contentTemplates = [
  {
    label: "Homepage hero",
    copy: "Find out if a product is worth buying. ReviewIntel scans customer reviews for fake-review signals, repeated complaints, buyer confidence, and value-for-money insights.",
  },
  {
    label: "Buyer ad copy",
    copy: "Before you buy, scan the reviews. ReviewIntel shows the hidden complaints, fake-review risk, and whether the product is actually worth your money.",
  },
  {
    label: "Seller ad copy",
    copy: "Your customers are already telling you what to fix. ReviewIntel turns reviews into product improvements, listing strategy, and buyer objection insights.",
  },
  {
    label: "Meta description",
    copy: "ReviewIntel is an AI review analyzer for shoppers and sellers. Detect fake-review signals, repeated complaints, buying risks, product strengths, and seller improvement opportunities.",
  },
];

const launchChecklist = [
  "Each SEO page has one main keyword and one clear user intent.",
  "Every page links to Analyze, Pricing, and one related SEO page.",
  "Hero text explains the product in under 5 seconds.",
  "Buyer pages focus on fast purchase decisions, not long analytics.",
  "Seller pages focus on product improvement, complaints, and growth strategy.",
  "Meta titles stay under 60 characters when possible.",
  "Meta descriptions stay around 150–160 characters when possible.",
  "Every page has one strong call-to-action above the fold.",
  "Avoid fake claims like guaranteed fake-review detection.",
  "Use screenshots, demo results, and real examples when ready.",
];

export default function AdminSeoPage() {
  return (
    <main className="min-h-screen bg-mist px-4 py-10 text-ink">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[2rem] bg-ink p-8 text-white shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-teal">
            Admin SEO Command Center
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                Make ReviewIntel searchable, clickable, and easy to understand.
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-white/75">
                Use this page to guide SEO pages, product messaging, ads, and landing-page copy.
                The goal is simple: shoppers should instantly know if a product is worth buying,
                and sellers should instantly see what customers want fixed.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">
                Primary positioning
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                AI review analyzer for shoppers and ecommerce sellers
              </p>
              <Link
                href="/analyze"
                className="mt-5 inline-flex rounded-full bg-teal px-5 py-3 text-sm font-black text-ink"
              >
                Test Analyzer
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Buyer promise
            </p>
            <h2 className="mt-3 text-2xl font-black">Upload → Scan → Decision</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Buyers do not want a long report. They want a fast answer: worth buying,
              compare first, or avoid.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Seller promise
            </p>
            <h2 className="mt-3 text-2xl font-black">Reviews into strategy</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Sellers need complaint mining, product health, buyer objections, listing angles,
              and fix-first recommendations.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              SEO goal
            </p>
            <h2 className="mt-3 text-2xl font-black">Rank for buying intent</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Target people already searching for review analysis, fake review detection,
              product complaints, and ecommerce feedback tools.
            </p>
          </div>
        </div>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean">
                SEO landing pages
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                Pages that advertise ReviewIntel
              </h2>
            </div>
            <Link href="/pricing" className="text-sm font-black text-ocean">
              Check Pricing →
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {seoPages.map((page) => (
              <div key={page.slug} className="rounded-[1.25rem] border border-line bg-mist/50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black">{page.title}</h3>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      {page.audience}
                    </p>
                  </div>
                  <Link href={page.slug} className="rounded-full bg-ink px-4 py-2 text-xs font-black text-white">
                    Open Page
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      Keyword
                    </p>
                    <p className="mt-2 font-black text-ocean">{page.keyword}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      CTA
                    </p>
                    <p className="mt-2 font-black">{page.cta}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                  {page.angle}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean">
              Message hierarchy
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              What every page should say
            </h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-mist p-5">
                <p className="text-sm font-black text-ocean">1. The pain</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Reviews are messy, fake-looking, repetitive, and hard to trust.
                </p>
              </div>
              <div className="rounded-2xl bg-mist p-5">
                <p className="text-sm font-black text-ocean">2. The result</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  ReviewIntel gives a clear verdict, risk signals, complaints, and next action.
                </p>
              </div>
              <div className="rounded-2xl bg-mist p-5">
                <p className="text-sm font-black text-ocean">3. The action</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Shoppers scan before buying. Sellers scan before improving or advertising.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean">
              Ready-to-use copy
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
              Advertising lines
            </h2>

            <div className="mt-6 space-y-4">
              {contentTemplates.map((item) => (
                <div key={item.label} className="rounded-2xl border border-line bg-mist/40 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-base font-bold leading-7 text-ink">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean">
            Launch checklist
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
            Before advertising ReviewIntel
          </h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {launchChecklist.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-mist p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-xs font-black text-ink">
                  {index + 1}
                </span>
                <p className="text-sm font-bold leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-gradient-to-br from-ink to-ocean p-7 text-white shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">
            Recommended next SEO work
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
            Build pages around buyer intent and seller growth intent.
          </h2>
          <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-white/75">
            The strongest traffic angle is not generic AI. It is specific intent:
            “Is this product worth buying?”, “Are these reviews fake?”, “What complaints do customers repeat?”,
            and “How do I improve my product from reviews?”
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/analyze" className="rounded-full bg-teal px-5 py-3 text-sm font-black text-ink">
              Run Analyzer
            </Link>
            <Link href="/results" className="rounded-full bg-white/12 px-5 py-3 text-sm font-black text-white">
              View Results
            </Link>
            <Link href="/dashboard/seller" className="rounded-full bg-white/12 px-5 py-3 text-sm font-black text-white">
              Seller Dashboard
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
