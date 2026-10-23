import { unstable_cache } from "next/cache";
import { AdSlot } from "@/components/advertising/AdSlot";
import { HouseAdSlot } from "@/components/HouseAdCard";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { HeroScanBar } from "@/components/HeroScanBar";
import { supabaseCount } from "@/lib/supabaseServer";
import { HomepageInstructionVideo } from "@/components/HomepageInstructionVideo";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { getHomepageVideo } from "@/lib/homepageVideo";
import { withSeo } from "@/lib/pageSeo";

export const metadata = withSeo("/", {
  title: { absolute: "ReviewIntel | Should you buy it? We read the real reviews for you" },
  description: "Paste a product link, add a screenshot, and get a plain Buy, Wait or Skip answer built from grouped analysis of real written buyer reviews, with an honest confidence level. Free to start.",
});



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
    <main className="reviewintel-home-main bg-transparent text-ink">
      <SponsorAnalytics placement="landing" />

      {/* Hero (v4): quiet, centered, indigo system. Exactly ONE hero implementation. */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-5 pb-10 pt-14 text-center sm:pt-20">
          <h1 className="text-5xl font-extrabold leading-[1.06] tracking-tight text-ink dark:text-white sm:text-6xl">
            Should you buy it?<br />
            <span className="ri-gradient-text">
              We read the reviews<br className="hidden sm:block" /> so you don&apos;t have to.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Paste a product link. We group what real buyers said — the good and the bad — weigh it
            as a whole, and give you one plain answer.
          </p>
          <div className="mt-8">
            <HeroScanBar />
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            or{" "}
            <Link href="/analyze" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300">
              upload screenshots of the reviews
            </Link>
            {" "}or{" "}
            <Link href="/tools/analyze-page" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-300">
              analyze the page you&apos;re looking at
            </Link>
          </p>
          <p className="mt-6 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">Real buyer reviews only</strong>
            {" · "}No fake or generated reviews{" · "}If there aren&apos;t enough reviews, we say so
          </p>
        </div>
      </section>

      <section aria-label="How it works" className="px-5 py-14 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["Paste a link", "Any product link — or screenshots of its reviews."],
              ["We analyze the reviews", "We group what real buyers said, the good and the bad, and weigh it as a whole."],
              ["Get one plain answer", "Buy, Wait or Skip — and the reasons, in plain words. If there aren't enough reviews, we say so."],
            ].map(([title, body], index) => (
              <li key={title} className="ri-card ri-lift ri-reveal p-5">
                <span className="ri-gradient-text text-sm font-extrabold" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-5 text-sm text-slate-600 dark:text-slate-400">
            {scanCount > 0 ? <span><strong className="font-semibold text-slate-900 dark:text-white">{scanCount.toLocaleString("en-CA")}</strong> scans run on ReviewIntel</span> : null}
            <span>Real buyer reviews only</span>
            <span>No fake or generated reviews</span>
            <span>No scores without written evidence</span>
            <Link href="/about" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300">About ReviewIntel</Link>
          </div>
        </div>
      </section>

      {/* Platform logo orbit removed: it implied TikTok/eBay coverage we do not scan. */}

      <section aria-labelledby="home-video" className="home-premium-payoff px-5 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{t("instructionVideo.eyebrow")}</p>
            <h2 id="home-video" className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl">{t("instructionVideo.title")}</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">{t("instructionVideo.body")}</p>
          </div>
          <div className="ri-card home-instruction-video-frame mx-auto w-full max-w-[400px] overflow-hidden p-2.5">
            <HomepageInstructionVideo video={homepageVideo} />
          </div>
        </div>
      </section>

      <section aria-labelledby="home-audience" className="home-premium-audience px-5 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="home-audience" className="text-2xl font-semibold text-slate-900 dark:text-white">Built for both sides of the purchase</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              { eyebrow: t("shopperMode"), title: t("fastShoppingVerdict"), items: buyerWins, href: "/analyze", cta: t("tryShopperScan"), primary: true },
              { eyebrow: t("sellerPro"), title: t("businessIntelligence"), items: sellerWins, href: "/pricing", cta: t("seeSellerPlans"), primary: false },
            ].map((card) => (
              <article key={card.href} className="ri-card home-premium-audience-card flex flex-col p-6 sm:p-8">
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">{card.eyebrow}</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{card.title}</h3>
                <ul className="mt-5 grid gap-2.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[15px] leading-6 text-slate-700 dark:text-slate-300">
                      <span aria-hidden="true" className="mt-0.5 text-indigo-600 dark:text-indigo-300">✓</span>{item}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Link href={card.href} className={card.primary
                    ? "ri-btn-gradient inline-flex rounded-full px-6 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    : "inline-flex rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-indigo-500 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-white/15 dark:bg-transparent dark:text-slate-100"}>
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

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <HouseAdSlot context="home" placement="home" />
      </section>

    </main>
    </>
  );
}
