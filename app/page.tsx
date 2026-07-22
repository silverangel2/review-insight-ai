import { AdSlot } from "@/components/advertising/AdSlot";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/Badge";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { HomepageHeroCopy } from "@/components/HomepageHeroCopy";
import { HomepageInstructionVideo } from "@/components/HomepageInstructionVideo";
import { PlatformLogoOrbit } from "@/components/PlatformLogoOrbit";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { getHomepageVideo } from "@/lib/homepageVideo";



export default async function LandingPage() {
  const t = await getTranslations("Home");
  const locale = await getLocale();
  const homepageVideo = await getHomepageVideo();

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

  const mobileScanCards = [
    {
      eyebrow: t("heroCards.identityEyebrow"),
      title: t("heroCards.identityTitle"),
      body: t("heroCards.identityLabel"),
      tone: "from-white/90 to-cyan-50/88",
    },
    {
      eyebrow: t("heroCards.evidenceEyebrow"),
      title: t("heroCards.evidenceTitle"),
      body: t("buyerWins.complaint"),
      tone: "from-cyan-50/92 to-white/88",
    },
    {
      eyebrow: t("heroCards.auditEyebrow"),
      title: t("buyerWins.fakeRisk"),
      body: t("heroCards.auditBody"),
      tone: "from-white/92 to-amber-50/86",
    },
    {
      eyebrow: t("shopperMode"),
      title: t("fastShoppingVerdict"),
      body: t("buyerWins.verdict"),
      tone: "from-teal-50/92 to-white/88",
    },
  ];

  return (
    <>
    <main className="reviewintel-home-main bg-[linear-gradient(135deg,#a8eee8_0%,#e7fbff_34%,#c7e2ff_66%,#fff0c9_100%)] text-ink">
      <SponsorAnalytics placement="landing" />

      <section className="reviewintel-home-hero relative isolate min-h-[calc(100svh-112px)] overflow-hidden border-b border-white/60 sm:min-h-[calc(100vh-73px)]">
        <div
          className="absolute inset-0 opacity-35"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.09) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }}
        />
        <div className="ri-pixie-field absolute inset-0 opacity-65" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 17 + 8) % 96}%`,
                top: `${(index * 29 + 12) % 88}%`,
                animationDelay: `${index * 0.22}s`
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes riHomeCardSettle {
            0% { opacity: 0; transform: translate3d(var(--ri-x, 0), var(--ri-y, 0), 0) rotate(var(--ri-rot, 0deg)) scale(0.82); filter: blur(8px); }
            72% { opacity: 1; filter: blur(0); }
            100% { opacity: 1; transform: translate3d(0, 0, 0) rotate(var(--ri-end, 0deg)) scale(1); filter: blur(0); }
          }
          @keyframes riCrystalDrift {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
            34% { transform: translate3d(22px, -20px, 0) rotate(18deg) scale(1.04); }
            68% { transform: translate3d(-18px, 18px, 0) rotate(-12deg) scale(0.98); }
          }
          @keyframes riCrystalPulse {
            0%, 100% { opacity: .54; box-shadow: 0 35px 120px rgba(16, 198, 163, .26); }
            50% { opacity: .76; box-shadow: 0 45px 150px rgba(35, 86, 163, .34); }
          }
          @keyframes riHeroSpark {
            0%, 100% { transform: translate3d(0, 0, 0) scale(.72); opacity: .26; }
            38% { transform: translate3d(18px, -28px, 0) scale(1); opacity: .78; }
            70% { transform: translate3d(-14px, 16px, 0) scale(.82); opacity: .42; }
          }
          .ri-home-card {
            animation: riHomeCardSettle 1320ms cubic-bezier(.19, 1, .22, 1) both;
          }
          .ri-home-crystal {
            animation: riCrystalDrift 8s ease-in-out infinite, riCrystalPulse 4.8s ease-in-out infinite;
          }
          .ri-hero-spark {
            animation: riHeroSpark 4.8s ease-in-out infinite;
          }
          @keyframes riMobileAccentFloat {
            0%, 100% { transform: translate3d(0, 0, 0) scale(.92); opacity: .28; }
            45% { transform: translate3d(12px, -18px, 0) scale(1.08); opacity: .68; }
            72% { transform: translate3d(-8px, 10px, 0) scale(.96); opacity: .44; }
          }
          @keyframes riMobileCarouselCardIn {
            from { opacity: 0; transform: translate3d(16px, 0, 0) scale(.98); }
            to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes riHeroCopySlide {
            0% { opacity: 0; transform: translateY(18px); filter: blur(7px); }
            16%, 84% { opacity: 1; transform: translateY(0); filter: blur(0); }
            100% { opacity: 0; transform: translateY(-10px); filter: blur(5px); }
          }
          .ri-hero-copy-slide {
            animation: riHeroCopySlide 5.2s ease-in-out both;
          }
          @keyframes riHeroMobileCopyStack {
            0%, 28% { opacity: 1; transform: translateY(0); filter: blur(0); }
            34%, 94% { opacity: 0; transform: translateY(-8px); filter: blur(4px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
          }
          .ri-hero-mobile-copy-stack .ri-mobile-copy-line {
            animation: riHeroMobileCopyStack 10.5s ease-in-out infinite both;
            display: block !important;
            font-size: inherit !important;
            line-height: inherit !important;
            letter-spacing: inherit !important;
            overflow-wrap: normal !important;
            white-space: pre-line !important;
            word-break: normal !important;
          }
          .ri-hero-mobile-copy-stack .ri-mobile-copy-line:nth-child(2) {
            animation-delay: -7s;
          }
          .ri-hero-mobile-copy-stack .ri-mobile-copy-line:nth-child(3) {
            animation-delay: -3.5s;
          }
          @media (max-width: 640px) {
            .reviewintel-home-main {
              touch-action: pan-y;
              overflow-x: hidden;
            }
            .reviewintel-home-hero {
              min-height: calc(100svh - 112px) !important;
              overflow: hidden !important;
            }
            .reviewintel-home-hero-grid {
              min-height: calc(100svh - 112px) !important;
              align-content: center !important;
              gap: .75rem !important;
              padding: 1.25rem 1rem 1.4rem !important;
            }
            .reviewintel-home-hero-grid > div:first-child {
              display: flex !important;
              min-height: calc(100svh - 136px) !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
            }
            .reviewintel-home-hero .reviewintel-home-hero-grid > div:first-child > .sm\\:hidden {
              display: flex !important;
              width: min(100%, 22rem) !important;
              flex-direction: column !important;
              align-items: center !important;
            }
            .reviewintel-home-hero .reviewintel-home-hero-grid > div:first-child > .sm\\:hidden > .flex {
              width: 100% !important;
              justify-content: center !important;
            }
            .reviewintel-home-hero h1 {
              font-size: clamp(2.35rem, 10vw, 3rem) !important;
              line-height: .94 !important;
              letter-spacing: 0 !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
            html[data-layout-mode="mobile"] .reviewintel-home-hero .ri-hero-mobile-copy-stack,
            html[data-layout-mode="auto"] .reviewintel-home-hero .ri-hero-mobile-copy-stack {
              width: min(100%, 22rem) !important;
              max-width: 22rem !important;
              min-height: 6.15rem !important;
              font-size: clamp(2.35rem, 10vw, 3rem) !important;
              line-height: .94 !important;
              letter-spacing: 0 !important;
              margin-left: auto !important;
              margin-right: auto !important;
              overflow: hidden !important;
              text-align: center !important;
            }
            .reviewintel-home-hero .ri-hero-mobile-copy-stack .ri-mobile-copy-line {
              left: 0 !important;
              right: 0 !important;
              width: 100% !important;
              text-align: center !important;
            }
            .reviewintel-home-hero .sm\\:hidden > p {
              width: min(100%, 21rem) !important;
              margin-left: auto !important;
              margin-right: auto !important;
              text-align: center !important;
            }
            .reviewintel-home-hero .reviewintel-home-hero-grid > div:first-child > .mt-8 {
              margin-top: 1rem !important;
            }
            .reviewintel-home-hero .ri-hero-spark {
              display: none !important;
            }
            .reviewintel-home-hero .ri-pixie-field {
              display: block !important;
              opacity: .32 !important;
            }
            .reviewintel-home-hero .ri-pixie-field span {
              width: .42rem !important;
              height: .42rem !important;
              animation: riMobileAccentFloat 6.8s ease-in-out infinite !important;
              box-shadow: 0 0 18px rgba(8,183,168,.32) !important;
            }
            .reviewintel-home-hero a[href="/analyze"] {
              margin-left: auto !important;
              margin-right: auto !important;
              width: min(100%, 20rem) !important;
              transform: translateZ(0) !important;
            }
            .reviewintel-home-hero a[href="/analyze"]:active {
              transform: translateY(1px) scale(.99) !important;
            }
            .reviewintel-home-hero .mt-5.flex {
              justify-content: center !important;
              max-width: 21rem !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
            header a[href="/login"] {
              background: #08b7a8 !important;
              color: #fff !important;
              box-shadow: 0 14px 32px rgba(8, 183, 168, .18) !important;
            }
            .reviewintel-home-hero .ri-home-crystal {
              right: -5.25rem !important;
              top: 4.25rem !important;
              width: 18rem !important;
              height: 18rem !important;
              opacity: .58 !important;
              animation: none !important;
              pointer-events: none !important;
            }
            .reviewintel-home-hero .ri-hero-visual {
              min-height: 21.75rem !important;
              max-height: none !important;
              border-radius: 1.5rem !important;
              box-shadow: 0 18px 48px rgba(12, 36, 68, .22) !important;
            }
            .reviewintel-home-card-stage {
              min-height: 21.75rem !important;
              gap: .7rem !important;
              padding: .85rem !important;
            }
            .reviewintel-home-card-stage .ri-home-card {
              transform: none !important;
              animation: none !important;
              filter: none !important;
              border-radius: 1rem !important;
              padding: .85rem !important;
              min-height: auto !important;
            }
            .reviewintel-home-card-stage .ri-home-card:nth-of-type(n + 3) {
              display: none !important;
            }
            .reviewintel-home-card-stage .ri-home-card p {
              letter-spacing: 0 !important;
            }
            .reviewintel-home-card-stage .ri-home-card .text-6xl {
              font-size: 2.4rem !important;
              line-height: .95 !important;
            }
            .home-premium-payoff,
            .home-premium-audience,
            .home-premium-mode,
            .home-premium-ad-section {
              padding-left: 1rem !important;
              padding-right: 1rem !important;
            }
            .home-premium-payoff {
              padding-top: 2rem !important;
              padding-bottom: 2rem !important;
            }
            .home-premium-audience,

            .home-mobile-rainbow-light {
              background:
                radial-gradient(circle at 12% 18%, rgba(255, 124, 214, 0.42), transparent 34%),
                radial-gradient(circle at 82% 24%, rgba(45, 212, 255, 0.45), transparent 36%),
                radial-gradient(circle at 50% 78%, rgba(255, 205, 86, 0.38), transparent 34%),
                linear-gradient(135deg, rgba(232, 255, 252, 0.98), rgba(246, 242, 255, 0.98), rgba(255, 247, 222, 0.98));
              background-size: 180% 180%;
              animation: reviewintelMobileRainbowShift 16s ease-in-out infinite alternate;
            }
            .home-mobile-rainbow-light::after {
              content: "";
              position: absolute;
              inset: -22%;
              background:
                radial-gradient(circle at 30% 32%, rgba(255,255,255,0.72), transparent 22%),
                radial-gradient(circle at 70% 58%, rgba(20,184,166,0.30), transparent 28%),
                radial-gradient(circle at 45% 78%, rgba(147,51,234,0.18), transparent 26%);
              filter: blur(18px);
              animation: reviewintelMobileGlowFloat 20s ease-in-out infinite alternate;
            }
            @keyframes reviewintelMobileRainbowShift {
              0% { background-position: 0% 45%; transform: scale(1); }
              50% { background-position: 62% 30%; transform: scale(1.015); }
              100% { background-position: 100% 70%; transform: scale(1.035); }
            }
            @keyframes reviewintelMobileGlowFloat {
              0% { transform: translate3d(-4%, -2%, 0) rotate(0deg); opacity: .78; }
              100% { transform: translate3d(5%, 4%, 0) rotate(8deg); opacity: 1; }
            }
            .home-mobile-scan-card {
              min-width: min(78vw, 19rem);
              scroll-snap-align: center;
              animation: reviewintelMobileCardFlip 8s ease-in-out infinite;
              transform-style: preserve-3d;
            }
            .home-mobile-scan-card:nth-child(2) { animation-delay: 0.7s; }
            .home-mobile-scan-card:nth-child(3) { animation-delay: 1.4s; }
            .home-mobile-scan-card:nth-child(4) { animation-delay: 2.1s; }
            @keyframes reviewintelMobileCardFlip {
              0%, 100% { transform: translateY(0) rotateY(0deg) rotateZ(-1deg); }
              45% { transform: translateY(-8px) rotateY(0deg) rotateZ(1deg); }
              58% { transform: translateY(-8px) rotateY(8deg) rotateZ(1deg); }
              70% { transform: translateY(-4px) rotateY(0deg) rotateZ(0deg); }
            }

            .home-premium-mode {
              padding-top: 1.75rem !important;
              padding-bottom: 1.75rem !important;
            }
            .home-mobile-carousel-section {
              min-height: 100svh !important;
              overflow: hidden !important;
              padding: 2.25rem 0 1.75rem !important;
            }
            .home-mobile-carousel-shell {
              min-height: calc(100svh - 4rem) !important;
              align-content: center !important;
            }
            .home-mobile-scan-carousel {
              display: flex !important;
              width: 100vw !important;
              max-width: 100vw !important;
              flex-direction: row !important;
              flex-wrap: nowrap !important;
              justify-content: flex-start !important;
              scroll-behavior: smooth !important;
              scroll-snap-type: x mandatory !important;
              -webkit-overflow-scrolling: touch !important;
            }
            .home-mobile-scan-carousel::-webkit-scrollbar {
              display: none !important;
            }
            .home-mobile-scan-card {
              width: min(82vw, 20rem) !important;
              min-width: min(82vw, 20rem) !important;
              max-width: min(82vw, 20rem) !important;
              flex: 0 0 min(82vw, 20rem) !important;
              animation: riMobileCarouselCardIn .62s cubic-bezier(.22,1,.36,1) both;
              scroll-snap-align: center !important;
            }
            .home-premium-mode {
              min-height: auto !important;
              display: grid !important;
              align-content: center !important;
            }
            .home-premium-audience-card,
            .home-premium-mode-card,
            .home-payoff-card {
              border-radius: 1.15rem !important;
              padding: 1rem !important;
            }
          }
        `}</style>

        <div className="reviewintel-home-hero-grid relative isolate mx-auto grid min-h-[calc(100svh-112px)] max-w-7xl snap-start snap-always overflow-hidden gap-10 px-5 py-8 sm:min-h-[calc(100vh-73px)] sm:overflow-visible sm:px-6 sm:py-10 xl:grid-cols-[0.92fr_1.08fr] xl:items-center">
          <div className="home-mobile-rainbow-light pointer-events-none absolute inset-0 -z-10 sm:hidden" aria-hidden="true" />
          <div>
            <HomepageHeroCopy initialLocale={locale} />

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Link
                href="/analyze"
                className="w-full max-w-xs rounded-2xl bg-ocean px-7 py-4 text-center text-sm font-black text-white shadow-[0_20px_70px_rgba(8,183,168,0.24)] transition hover:-translate-y-0.5 hover:bg-teal sm:w-auto sm:max-w-none sm:bg-ink sm:shadow-[0_20px_70px_rgba(15,23,42,0.25)] sm:hover:bg-ocean"
              >
                {t("scanReviewsNow")}
              </Link>
              <Link
                href="/pricing"
                className="hidden rounded-2xl border border-white/70 bg-white/60 px-7 py-4 text-center text-sm font-black text-ink shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:inline-flex sm:justify-center"
              >
                {t("seePricing")}
              </Link>
            </div>

            <div className="mt-5 flex max-w-[19rem] flex-wrap gap-2 text-[11px] font-black uppercase text-slate-600 sm:mt-8 sm:max-w-full sm:text-xs">
              {["Amazon", "Walmart", "Temu", "TikTok Shop", "Etsy", "Shopify", "eBay"].map((item, index) => (
                <span key={item} className={`${index > 2 ? "hidden sm:inline-flex" : "inline-flex"} rounded-full border border-white/70 bg-white/60 px-3 py-2 shadow-sm backdrop-blur`}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="ri-hero-visual relative mx-auto hidden min-h-[620px] w-full max-w-[760px] overflow-hidden rounded-[2.8rem] border border-white/70 bg-[linear-gradient(135deg,rgba(6,17,35,0.96),rgba(16,72,111,0.78)_42%,rgba(56,148,180,0.48)_68%,rgba(255,255,255,0.28)_100%)] shadow-[0_45px_150px_rgba(12,36,68,0.3)] backdrop-blur-lg sm:block md:min-h-[690px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,rgba(142,222,255,0.5),transparent_36%),radial-gradient(circle_at_38%_72%,rgba(255,198,103,0.3),transparent_34%)]" aria-hidden="true" />
            <div className="ri-home-crystal ri-crystal-orb absolute right-[-2%] top-[10%] size-[640px] rounded-full border border-white/36 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,.98),rgba(174,244,238,.9)_20%,rgba(89,170,255,.52)_52%,rgba(255,189,88,.3)_80%,rgba(255,255,255,.08))] opacity-90 blur-[0.2px] backdrop-blur-lg" aria-hidden="true" />
            <div className="absolute right-[16%] top-[31%] size-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.44),rgba(16,198,163,.18)_42%,transparent_72%)] blur-2xl" aria-hidden="true" />
            {[12, 34, 58, 81, 94, 46].map((left, index) => (
              <span
                key={left}
                className="ri-hero-spark absolute size-2 rounded-full bg-white shadow-[0_0_24px_rgba(20,184,166,0.75)]"
                style={{ left: `${left}%`, top: `${18 + ((index * 17) % 58)}%`, animationDelay: `${index * 0.35}s` }}
                aria-hidden="true"
              />
            ))}

            <div className="reviewintel-home-card-stage relative z-10 grid min-h-[620px] grid-cols-1 grid-rows-[auto_auto_auto_auto_auto] gap-4 p-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto] md:min-h-[690px] md:gap-5 md:p-8">
              <article className="ri-home-card self-start rounded-[2rem] bg-[#11182a] p-5 text-white shadow-[0_30px_90px_rgba(4,10,24,0.42)] ring-1 ring-white/10 [--ri-end:-1deg] [--ri-rot:-24deg] [--ri-x:-340px] [--ri-y:210px]">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-900">{t("heroCards.identityEyebrow")}</p>
                <p className="mt-3 text-sm font-black text-white/70">{t("heroCards.identityLabel")}</p>
                <p className="mt-3 text-4xl font-black leading-tight md:text-5xl reviewintel-flip-card" style={{ animationDelay: "0.4s" }}>{t("heroCards.identityTitle")}</p>
                <p className="mt-4 text-sm font-black leading-6 text-cyan-900 md:text-base">{t("heroCards.identityBody")}</p>
              </article>

              <article className="ri-home-card self-start rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_26px_90px_rgba(12,36,68,0.24)] backdrop-blur-lg [--ri-end:2deg] [--ri-rot:24deg] [--ri-x:340px] [--ri-y:-180px]" style={{ animationDelay: "120ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">{t("heroCards.evidenceEyebrow")}</p>
                <p className="mt-3 text-2xl font-black leading-tight text-ink">{t("heroCards.evidenceTitle")}</p>
                <p className="mt-4 text-sm font-bold leading-6 text-slate-700">{t("heroCards.evidenceBody")}</p>
              </article>

              <article className="ri-home-card row-start-auto self-center rounded-3xl border border-white/18 bg-[#19243a]/86 p-5 text-white shadow-[0_24px_80px_rgba(4,10,24,0.3)] backdrop-blur-lg [--ri-end:-2deg] [--ri-rot:-26deg] [--ri-x:-300px] [--ri-y:230px] sm:row-start-2" style={{ animationDelay: "240ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-900">{t("heroCards.shopperEyebrow")}</p>
                <p className="mt-3 text-base font-black leading-6 text-white">{t("heroCards.shopperBody")}</p>
              </article>

              <article className="ri-home-card row-start-auto self-center rounded-3xl border border-white/70 bg-white/84 p-4 shadow-[0_20px_70px_rgba(12,36,68,0.18)] backdrop-blur-lg [--ri-end:1deg] [--ri-rot:-18deg] [--ri-x:120px] [--ri-y:260px] sm:row-start-2" style={{ animationDelay: "360ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">{t("heroCards.auditEyebrow")}</p>
                <div className="mt-4 h-3 rounded-full bg-white/70">
                  <div className="h-full w-[58%] rounded-full bg-[linear-gradient(90deg,#10a7a0,#ffbd58,#df5f63)]" />
                </div>
                <p className="mt-3 text-sm font-black text-slate-700">{t("heroCards.auditBody")}</p>
              </article>

              <article className="ri-home-card row-start-auto max-w-[430px] justify-self-stretch self-end rounded-3xl border border-white/18 bg-[#11182a]/86 p-5 text-white shadow-[0_24px_80px_rgba(4,10,24,0.3)] backdrop-blur-lg [--ri-end:2deg] [--ri-rot:26deg] [--ri-x:320px] [--ri-y:220px] sm:col-span-2 sm:row-start-3 sm:justify-self-end" style={{ animationDelay: "480ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-900">{t("heroCards.sellerEyebrow")}</p>
                <p className="mt-3 text-base font-black leading-6 text-white">{t("heroCards.sellerBody")}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="home-mobile-carousel-section grid min-h-[100svh] snap-start snap-always content-center overflow-hidden bg-[linear-gradient(180deg,#eefcff_0%,#ffffff_100%)] px-5 py-8 text-ink sm:hidden">
        <div className="home-mobile-carousel-shell grid w-full justify-items-center text-center">
          <Badge tone="info">{t("modeIntro.eyebrow")}</Badge>
          <h2 className="mt-4 max-w-sm text-4xl font-black leading-tight tracking-normal">
            What the scan checks.
          </h2>
          <div className="mt-6 -mx-5 overflow-hidden">
            <div className="home-mobile-scan-carousel flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mobileScanCards.map((card, index) => (
                <article
                  key={card.title}
                  className={`home-mobile-scan-card rounded-[1.75rem] border border-white/80 bg-gradient-to-br ${card.tone} p-5 shadow-[0_22px_70px_rgba(12,36,68,0.14)] backdrop-blur`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ocean">{card.eyebrow}</p>
                  <p className="mt-4 text-2xl font-black leading-tight text-ink">{card.title}</p>
                  <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{card.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-1 flex justify-center gap-2">
              {mobileScanCards.map((card, index) => (
                <span
                  key={`${card.title}-dot`}
                  className={`h-1.5 rounded-full ${index === 0 ? "w-6 bg-ocean" : "w-1.5 bg-ocean/30"}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <PlatformLogoOrbit initialLocale={locale} />

      <section className="home-premium-payoff min-h-[100svh] snap-start snap-always overflow-hidden bg-[linear-gradient(180deg,#f6fdff_0%,#ffffff_100%)] px-5 py-8 text-ink sm:min-h-0 sm:overflow-visible sm:px-6 sm:py-12">
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

      <section className="home-premium-audience min-h-[100svh] snap-start snap-always overflow-hidden bg-[linear-gradient(135deg,#e7fbff_0%,#f8f2ff_48%,#fff4d8_100%)] px-5 py-8 text-ink sm:min-h-0 sm:overflow-visible sm:px-6 sm:py-10">
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

      <section className="home-mobile-advert-loop min-h-[100svh] snap-start snap-always overflow-hidden bg-[linear-gradient(180deg,#fff7ed_0%,#f8fbff_100%)] px-5 py-8 text-ink sm:hidden">
        <div className="mx-auto flex h-full max-w-md flex-col justify-center">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-ocean">Sponsored</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Deals from our partners</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Affiliate banners may earn ReviewIntel commission. Verdicts stay independent.
            </p>
          </div>
          <AdSlot placement="mobile_homepage" compact />
        </div>
      </section>
    
      <section className="home-premium-ad-section hidden mx-auto max-w-6xl px-6 pb-12 sm:block">
        <AdSlot placement="homepage_mid" />
      </section>

    </main>
    </>
  );
}
