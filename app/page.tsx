import { AdSlot } from "@/components/advertising/AdSlot";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/Badge";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { HomePasteLink } from "@/components/HomePasteLink";
import { VerdictSummaryCard } from "@/components/VerdictSummaryCard";
import homeSample from "@/lib/homeSample.json";
import { supabaseCount } from "@/lib/supabaseServer";
import { HomepageInstructionVideo } from "@/components/HomepageInstructionVideo";
import { PlatformLogoOrbit } from "@/components/PlatformLogoOrbit";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { getHomepageVideo } from "@/lib/homepageVideo";



/** Real scan count from the database only; 0 (hidden) when unavailable. Bounded so it never slows the page. */
async function realScanCount(): Promise<number> {
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
  const locale = await getLocale();
  const homepageVideo = await getHomepageVideo();
  const scanCount = await realScanCount();

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
    <main className="reviewintel-home-main bg-[linear-gradient(135deg,#a8eee8_0%,#e7fbff_34%,#c7e2ff_66%,#fff0c9_100%)] text-ink">
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

      <PlatformLogoOrbit initialLocale={locale} />

      <section className="home-premium-payoff min-h-[100svh] snap-start overflow-visible bg-[linear-gradient(180deg,#f6fdff_0%,#ffffff_100%)] px-5 py-10 text-ink sm:min-h-[calc(100vh-73px)] sm:px-6 sm:py-12">
        <div className="home-premium-payoff-grid mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <Badge tone="warn">{t("instructionVideo.eyebrow")}</Badge>
            <h2 className="mt-4 text-4xl font-black leading-tight md:text-5xl">{t("instructionVideo.title")}</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t("instructionVideo.body")}
            </p>
          </div>
          <div className="home-instruction-video-frame mx-auto w-full max-w-[430px] overflow-hidden rounded-[2rem] border border-white/70 bg-white/82 p-3 shadow-[0_30px_100px_rgba(12,36,68,0.16)] backdrop-blur">
            <HomepageInstructionVideo video={homepageVideo} />
          </div>
        </div>
      </section>

      <section className="home-premium-audience min-h-[100svh] snap-start overflow-visible bg-[linear-gradient(135deg,#e7fbff_0%,#f8f2ff_48%,#fff4d8_100%)] px-5 py-10 text-ink sm:min-h-[calc(100vh-73px)] sm:px-6 sm:py-10">
        <div className="home-premium-audience-grid mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          <article className="home-premium-audience-card rounded-[2rem] border border-white/70 bg-white/54 p-6 shadow-soft backdrop-blur">
            <Badge tone="good">{t("shopperMode")}</Badge>
            <h2 className="mt-4 text-3xl font-black">{t("fastShoppingVerdict")}</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {buyerWins.map((item) => (
                <span key={item} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm font-black">
                  {item}
                </span>
              ))}
            </div>
            <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white sm:bg-ink">
              {t("tryShopperScan")}
            </Link>
          </article>

          <article className="home-premium-audience-card rounded-[2rem] border border-white/70 bg-white/54 p-6 shadow-soft backdrop-blur">
            <Badge tone="warn">{t("sellerPro")}</Badge>
            <h2 className="mt-4 text-3xl font-black">{t("businessIntelligence")}</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {sellerWins.map((item) => (
                <span key={item} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm font-black">
                  {item}
                </span>
              ))}
            </div>
            <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white sm:bg-ink">
              {t("seeSellerPlans")}
            </Link>
          </article>
        </div>
      </section>

      <section className="home-premium-mode hidden min-h-0 bg-mist px-5 py-8 text-ink sm:block sm:min-h-0 sm:px-6 sm:py-12">
        <div className="home-premium-mode-card mx-auto max-w-5xl rounded-[2rem] border border-line bg-white p-6 shadow-soft md:p-8">
          <Badge tone="info">{t("modeIntro.eyebrow")}</Badge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-ink md:text-4xl">{t("modeIntro.title")}</h2>
          <p className="mt-4 text-base font-semibold leading-7 text-slate-700 sm:hidden">
            Shopper mode helps buyers decide. Seller mode finds product signals.
          </p>
          <p className="mt-4 hidden text-base font-semibold leading-8 text-slate-700 sm:block md:text-lg md:leading-9">
            {t("modeIntro.body")}
          </p>
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
