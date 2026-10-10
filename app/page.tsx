import { unstable_cache } from "next/cache";
import { AdSlot } from "@/components/advertising/AdSlot";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { HomePasteLink } from "@/components/HomePasteLink";
import { VerdictSummaryCard } from "@/components/VerdictSummaryCard";
import homeSample from "@/lib/homeSample.json";
import { supabaseCount } from "@/lib/supabaseServer";
import { HomepageInstructionVideo } from "@/components/HomepageInstructionVideo";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { getHomepageVideo } from "@/lib/homepageVideo";



/** Real scan count from the database only; 0 (hidden) when unavailable. Bounded so it never slows the page. */
// Cached for 10 minutes so the homepage never waits on the database per request (TTFB).
const realScanCount = unstable_cache(realScanCountUncached, ["reviewintel-home-scan-count"], { revalidate: 600 });
async function realScanCountUncached(): Promise<number> {
  try {
    const count = await Promise.race([
      supabaseCount("analyses", "select=id&limit=1"),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 1500)),
    ]);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch { return 0; }
}

export default async function LandingPage() {
  const t = await getTranslations("Home");
  const [homepageVideo, scanCount] = await Promise.all([getHomepageVideo(), realScanCount()]);

  const buyerWins = [
    t("buyerWins.verdict"),
    t("buyerWins.fakeRisk"),
    t("buyerWins.bestFor"),
    t("buyerWins.complaint")
  ];

  const sellerWins = [
    t("sellerWins.complaintClusters"),
    t("sellerWins.keywordIntelligence"),
    t("sellerWins.painPoints"),
    t("sellerWins.exportReport")
  ];

  return (
    <>
    <main className="reviewintel-home-main bg-white text-ink">
      <SponsorAnalytics placement="landing" />

      <section className="ri-home-hero border-b border-slate-200/70 bg-[linear-gradient(180deg,#f2fbfa_0%,#ffffff_100%)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14 lg:pb-16">
          <div>
            <p className="text-sm font-semibold text-teal">Real buyer reviews. Plain answers.</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              Should you buy it? Ask the people who already did.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
              ReviewIntel reads the written reviews for the exact product and tells you Buy, Wait or Skip, with the quotes to back it up.
            </p>
            <div className="mt-7 max-w-xl"><HomePasteLink /></div>
            <p className="text-sm text-slate-500">
              Or <Link href="/analyze" className="font-medium text-slate-700 underline underline-offset-2 hover:text-teal">upload review screenshots</Link> instead.
            </p>
          </div>
          <div>
            <VerdictSummaryCard summary={homeSample} eyebrow="A real result" />
            <p className="mt-3 text-xs text-slate-500">
              From a saved ReviewIntel scan of {homeSample.reviewCount} real Amazon.ca buyer reviews. Quotes are shown as written.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="bg-white px-5 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="how-it-works" className="text-2xl font-semibold text-slate-900">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              ["Paste a link", "Any Amazon product link, or screenshots of its reviews."],
              ["We read real reviews", "Only written reviews of this exact product count. Other models, sizes and bundles are left out."],
              ["Get a plain answer", "Buy, Wait or Skip, with real quotes. If there aren't enough reviews, we say so."],
            ].map(([title, body], index) => (
              <li key={title} className="rounded-2xl bg-slate-50 p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-teal text-sm font-semibold text-white" aria-hidden="true">{index + 1}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-5 text-sm text-slate-600">
            {scanCount > 0 ? <span><strong className="font-semibold text-slate-900">{scanCount.toLocaleString("en-CA")}</strong> scans run on ReviewIntel</span> : null}
            <span>Never fake or generated reviews</span>
            <span>No scores without written evidence</span>
            <Link href="/about" className="font-medium text-teal underline-offset-2 hover:underline">About ReviewIntel</Link>
          </div>
        </div>
      </section>

      {/* Platform logo orbit removed: it implied TikTok/eBay coverage we do not scan. */}

      <section aria-labelledby="home-video" className="home-premium-payoff bg-slate-50 px-5 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-teal">{t("instructionVideo.eyebrow")}</p>
            <h2 id="home-video" className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">{t("instructionVideo.title")}</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">{t("instructionVideo.body")}</p>
          </div>
          <div className="home-instruction-video-frame mx-auto w-full max-w-[400px] overflow-hidden rounded-[1.75rem] bg-white p-2.5 ring-1 ring-slate-900/5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <HomepageInstructionVideo video={homepageVideo} />
          </div>
        </div>
      </section>

      <section aria-labelledby="home-audience" className="home-premium-audience bg-white px-5 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="home-audience" className="text-2xl font-semibold text-slate-900">Built for both sides of the purchase</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              { eyebrow: t("shopperMode"), title: t("fastShoppingVerdict"), items: buyerWins, href: "/analyze", cta: t("tryShopperScan"), primary: true },
              { eyebrow: t("sellerPro"), title: t("businessIntelligence"), items: sellerWins, href: "/pricing", cta: t("seeSellerPlans"), primary: false },
            ].map((card) => (
              <article key={card.href} className="home-premium-audience-card flex flex-col rounded-[1.75rem] bg-slate-50 p-6 sm:p-8">
                <p className="text-sm font-semibold text-teal">{card.eyebrow}</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">{card.title}</h3>
                <ul className="mt-5 grid gap-2.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-slate-700">
                      <span aria-hidden="true" className="mt-0.5 text-teal">✓</span>{item}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Link href={card.href} className={card.primary
                    ? "inline-flex rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-teal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    : "inline-flex rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"}>
                    {card.cta}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="home-premium-featured-reviews hidden sm:block"><FeaturedReviews /></div>
    
      <section className="home-premium-ad-section hidden mx-auto max-w-6xl px-6 pb-12 sm:block">
        <AdSlot placement="homepage_mid" />
      </section>

    </main>
    </>
  );
}
