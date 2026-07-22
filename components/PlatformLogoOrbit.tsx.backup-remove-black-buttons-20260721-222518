"use client";

import { getUiTextTranslation, normalizeLocale, type ReviewIntelLocale } from "@/lib/i18n";

const platforms = [
  {
    name: "Amazon",
    mark: "a",
    sub: "Marketplace",
    accent: "from-amber-300/38 via-orange-300/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(255,178,56,0.22)]",
    delay: "-0.4s",
    shineDelay: "-1.2s",
    duration: "8.4s",
    review: "Portable blender: works fast, but several buyers mention leaking lids after two weeks."
  },
  {
    name: "Walmart",
    mark: "✹",
    sub: "Retail",
    accent: "from-sky-300/38 via-blue-400/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(56,189,248,0.22)]",
    delay: "-3.1s",
    shineDelay: "-4.6s",
    duration: "9.8s",
    review: "Air fryer: easy cleanup and crispy food, but basket coating scratches faster than expected."
  },
  {
    name: "TikTok Shop",
    mark: "♪",
    sub: "Social commerce",
    accent: "from-cyan-300/38 via-fuchsia-400/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(34,211,238,0.20)]",
    delay: "-6.8s",
    shineDelay: "-7.1s",
    duration: "10.6s",
    review: "LED mirror: looks beautiful on video, but buyers complain the stand feels unstable."
  },
  {
    name: "Shopify",
    mark: "S",
    sub: "Storefront",
    accent: "from-emerald-300/38 via-lime-300/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(52,211,153,0.22)]",
    delay: "-1.9s",
    shineDelay: "-9.3s",
    duration: "8.9s",
    review: "Premium backpack: strong zippers and clean design, but laptop padding could be thicker."
  },
  {
    name: "Etsy",
    mark: "E",
    sub: "Handmade",
    accent: "from-orange-300/38 via-rose-300/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(251,146,60,0.22)]",
    delay: "-5.4s",
    shineDelay: "-2.7s",
    duration: "11.2s",
    review: "Handmade candle: scent is cozy and elegant, but some orders arrived with cracked glass."
  },
  {
    name: "eBay",
    mark: "e",
    sub: "Resale",
    accent: "from-lime-300/38 via-cyan-300/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(163,230,53,0.18)]",
    delay: "-8.2s",
    shineDelay: "-6.2s",
    duration: "9.3s",
    review: "Refurbished headphones: sound quality is solid, but battery life varies by seller."
  },
  {
    name: "Best Buy",
    mark: "B",
    sub: "Electronics",
    accent: "from-yellow-300/38 via-blue-400/16 to-white/8",
    shadow: "shadow-[0_30px_90px_rgba(250,204,21,0.20)]",
    delay: "-2.6s",
    shineDelay: "-11.1s",
    duration: "10.1s",
    review: "Gaming monitor: smooth refresh rate and bright color, but the stand takes too much desk space."
  }
];

const carouselItems = [...platforms, ...platforms.map((platform) => ({
  ...platform,
  review: platform.name === "Amazon"
    ? "Robot vacuum: great on hardwood floors, but pet hair clogs the brush more often than expected."
    : platform.name === "Walmart"
      ? "Coffee maker: affordable and simple, but reviews mention the plastic smell during first uses."
      : platform.name === "TikTok Shop"
        ? "Mini projector: fun for bedrooms, but buyers say daytime brightness is weaker than ads suggest."
        : platform.name === "Shopify"
          ? "Skincare set: packaging feels premium, but sensitive-skin buyers report mild irritation."
          : platform.name === "Etsy"
            ? "Custom mug: print quality looks sharp, but delivery time depends heavily on the seller."
            : platform.name === "eBay"
              ? "Used tablet: screen condition was better than expected, but charger quality was inconsistent."
              : "Bluetooth speaker: strong bass for the size, but app pairing confused several buyers."
}))];

type PlatformLogoOrbitProps = {
  initialLocale?: ReviewIntelLocale | string;
};

function t(locale: ReviewIntelLocale, text: string) {
  return getUiTextTranslation(locale, text) || text;
}

export function PlatformLogoOrbit({ initialLocale = "en" }: PlatformLogoOrbitProps) {
  const locale = normalizeLocale(initialLocale);

  return (
    <section className="ri-orbit-section relative min-h-[590px] overflow-hidden rounded-[2.5rem] border border-white/70 bg-[radial-gradient(circle_at_16%_14%,rgba(45,212,191,0.36),transparent_30%),radial-gradient(circle_at_78%_14%,rgba(96,165,250,0.34),transparent_33%),radial-gradient(circle_at_54%_94%,rgba(251,191,36,0.36),transparent_34%),radial-gradient(circle_at_92%_82%,rgba(244,114,182,0.20),transparent_26%),linear-gradient(135deg,#d6fff8_0%,#f8fdff_42%,#fff1c8_100%)] px-6 py-10 text-ink shadow-[0_40px_130px_rgba(35,86,163,0.16)]">
      <style jsx>{`
        @keyframes riCarouselPan {
          0% { transform: translateX(0) rotateZ(-0.6deg); }
          50% { transform: translateX(-25%) rotateZ(0.7deg); }
          100% { transform: translateX(-50%) rotateZ(-0.6deg); }
        }
        @keyframes riRandomFlipA {
          0%, 12%, 100% { transform: perspective(1050px) rotateY(-18deg) rotateX(5deg) rotateZ(-2deg) translateY(0) scale(1); }
          28% { transform: perspective(1050px) rotateY(8deg) rotateX(-2deg) rotateZ(1.4deg) translateY(-16px) scale(1.025); }
          48% { transform: perspective(1050px) rotateY(178deg) rotateX(2deg) rotateZ(-1deg) translateY(-6px) scale(1.01); }
          66% { transform: perspective(1050px) rotateY(12deg) rotateX(-4deg) rotateZ(2deg) translateY(9px) scale(0.99); }
        }
        @keyframes riRandomFlipB {
          0%, 18%, 100% { transform: perspective(1050px) rotateY(16deg) rotateX(4deg) rotateZ(1.8deg) translateY(0) scale(1); }
          36% { transform: perspective(1050px) rotateY(-10deg) rotateX(-3deg) rotateZ(-2deg) translateY(12px) scale(0.995); }
          57% { transform: perspective(1050px) rotateY(-178deg) rotateX(2deg) rotateZ(1.2deg) translateY(-18px) scale(1.025); }
          78% { transform: perspective(1050px) rotateY(-8deg) rotateX(5deg) rotateZ(-1.6deg) translateY(-5px) scale(1.01); }
        }
        @keyframes riGlassSweep {
          0%, 58%, 100% { transform: translateX(-150%) skewX(-18deg); opacity: 0; }
          66% { opacity: 0.7; }
          79% { transform: translateX(150%) skewX(-18deg); opacity: 0; }
        }
        @keyframes riOrbFloatOne { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(80px,-45px,0) scale(1.12); } }
        @keyframes riOrbFloatTwo { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-70px,60px,0) scale(1.08); } }
        @keyframes riOrbFloatThree { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(40px,80px,0) scale(1.14); } }
        @keyframes riCenterFloat { 0%, 100% { transform: translate(-50%, -50%) translateY(0) scale(1); } 50% { transform: translate(-50%, -50%) translateY(-8px) scale(1.025); } }
        .ri-carousel-track { animation: riCarouselPan 30s linear infinite; transform-origin: center; will-change: transform; }
        .ri-carousel-track:hover { animation-play-state: paused; }
        .ri-flip-shell { perspective: 1050px; -webkit-perspective: 1050px; }
        .ri-glass-card { position: relative; transform-style: preserve-3d; -webkit-transform-style: preserve-3d; will-change: transform; }
        .ri-glass-card:nth-child(odd) { animation-name: riRandomFlipA; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .ri-glass-card:nth-child(even) { animation-name: riRandomFlipB; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .ri-card-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; transform-style: preserve-3d; -webkit-transform-style: preserve-3d; overflow: hidden; border-radius: 2rem; }
        .ri-card-back { transform: rotateY(180deg); -webkit-transform: rotateY(180deg); }
        .ri-card-shine { animation-name: riGlassSweep; animation-duration: 9s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }

        @media (max-width: 640px) {
          .ri-orbit-section {
            min-height: 330px !important;
            border-radius: 1.25rem !important;
            padding: 1rem 0 !important;
          }

          .ri-orbit-title {
            max-width: 18rem !important;
          }

          .ri-orbit-title h2 {
            margin-top: 0.65rem !important;
            font-size: 1.35rem !important;
            line-height: 1.08 !important;
            letter-spacing: 0 !important;
          }

          .ri-orbit-title p {
            font-size: 0.62rem !important;
            padding: 0.45rem 0.65rem !important;
          }

          .ri-carousel-window {
            margin-top: 0.7rem !important;
            padding-top: 0.75rem !important;
            padding-bottom: 0.85rem !important;
          }

          .ri-carousel-window > div:first-child,
          .ri-carousel-window > div:nth-child(2) {
            width: 2.5rem !important;
          }

          .ri-carousel-track {
            gap: 0.65rem !important;
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            animation-duration: 12s !important;
          }

          .ri-flip-shell {
            width: 6.35rem !important;
            height: 7.15rem !important;
          }

          .ri-glass-card {
            animation-name: none !important;
            transform: none !important;
          }

          .ri-card-face {
            border-radius: 1rem !important;
            padding: 0.65rem !important;
          }

          .ri-card-face > div[style],
          .ri-card-face > div.absolute {
            border-radius: 1.35rem !important;
          }

          .ri-logo-mark {
            width: 2.4rem !important;
            height: 2.4rem !important;
            border-radius: 0.85rem !important;
            font-size: 1.2rem !important;
          }

          .ri-platform-name {
            margin-top: 0.5rem !important;
            font-size: 0.78rem !important;
            line-height: 1.05 !important;
          }

          .ri-platform-sub {
            margin-top: 0.25rem !important;
            font-size: 0.42rem !important;
            letter-spacing: 0.12em !important;
          }

          .ri-review-text {
            margin-top: 0.45rem !important;
            font-size: 0.58rem !important;
            line-height: 1.25 !important;
          }

          .ri-review-chip {
            font-size: 0.42rem !important;
            line-height: 1.15 !important;
            padding: 0.35rem 0.45rem !important;
          }

          .ri-center-core {
            display: none !important;
          }

          .ri-center-core > div:nth-child(2) {
            width: 3rem !important;
            height: 3rem !important;
            border-radius: 1rem !important;
            font-size: 1.25rem !important;
          }

          .ri-center-core p:nth-of-type(1) {
            margin-top: 0.65rem !important;
            font-size: 0.58rem !important;
            letter-spacing: 0.12em !important;
          }

          .ri-center-core p:nth-of-type(2) {
            font-size: 0.45rem !important;
            letter-spacing: 0.12em !important;
          }
        }
      `}</style>

      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.36)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="absolute left-[5%] top-[8%] h-80 w-80 rounded-full bg-cyan-300/38 blur-3xl" style={{ animation: "riOrbFloatOne 13s ease-in-out infinite" }} />
      <div className="absolute right-[4%] top-[10%] h-96 w-96 rounded-full bg-blue-400/34 blur-3xl" style={{ animation: "riOrbFloatTwo 15s ease-in-out infinite" }} />
      <div className="absolute bottom-[-14%] left-[20%] h-96 w-96 rounded-full bg-amber/34 blur-3xl" style={{ animation: "riOrbFloatThree 17s ease-in-out infinite" }} />
      <div className="absolute bottom-[4%] right-[18%] h-72 w-72 rounded-full bg-fuchsia-400/18 blur-3xl" style={{ animation: "riOrbFloatOne 18s ease-in-out infinite reverse" }} />

      <div className="ri-orbit-title relative z-20 mx-auto max-w-3xl text-center">
        <p className="mx-auto inline-flex rounded-full border border-white/70 bg-white/60 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-ocean shadow-sm backdrop-blur-lg">
          {t(locale, "Marketplace intelligence")}
        </p>
        <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
          {t(locale, "All reviews. One AI scan. Clear buying answers.")}
        </h2>
      </div>

      <div className="ri-carousel-window relative z-10 mt-12 overflow-hidden py-16">
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-28 bg-gradient-to-r from-[#e4fffb] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-28 bg-gradient-to-l from-[#fff1cd] to-transparent" />
        <div className="ri-carousel-track flex w-max gap-8 px-8">
          {carouselItems.map((platform, index) => (
            <div key={`${platform.name}-${index}`} className="ri-flip-shell h-56 w-48 shrink-0">
              <article
                className={`ri-glass-card h-full w-full ${platform.shadow}`}
                style={{ animationDelay: platform.delay, animationDuration: platform.duration }}
              >
                <div className={`ri-card-face border border-white/25 bg-white/12 p-5 text-center backdrop-blur-2xl`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${platform.accent}`} />
                  <div className="absolute inset-[1px] rounded-[1.95rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.28),rgba(255,255,255,0.05)_48%,rgba(255,255,255,0.14))]" />
                  <div className="ri-card-shine absolute inset-0 z-[3] rounded-[2rem] bg-[linear-gradient(115deg,transparent_10%,rgba(255,255,255,0.52)_33%,transparent_58%)]" style={{ animationDelay: platform.shineDelay }} />
                  <div className="relative z-[4] flex h-full flex-col items-center justify-center">
                    <div className="ri-logo-mark grid h-20 w-20 place-items-center rounded-3xl border border-white/70 shadow-[0_18px_55px_rgba(15,23,42,0.12)] bg-white/18 text-4xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_60px_rgba(0,0,0,0.25)]">
                      {platform.mark}
                    </div>
                    <p className="ri-platform-name mt-5 text-lg font-black">{platform.name}</p>
                    <p className="ri-platform-sub mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-900/75">{t(locale, platform.sub)}</p>
                  </div>
                </div>

                <div className="ri-card-face ri-card-back border border-white/25 bg-slate-950/70 p-5 text-left backdrop-blur-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.30),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(251,191,36,0.20),transparent_30%)]" />
                  <div className="relative z-[4] flex h-full flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-900">{t(locale, "Review signal")}</p>
                      <p className="ri-review-text mt-4 text-sm font-black leading-6 text-white">{t(locale, platform.review)}</p>
                    </div>
                    <div className="ri-review-chip rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">
                      {t(locale, "AI extracts risk + buyer signal")}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>

        <div className="ri-center-core pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-48 w-48 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[2.25rem] border border-white/35 bg-white/16 text-center shadow-[0_0_110px_rgba(20,184,166,0.52)] backdrop-blur-2xl" style={{ animation: "riCenterFloat 5s ease-in-out infinite" }}>
          <div className="absolute inset-0 rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.06))]" />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_54%,#ffb238)] text-3xl font-black text-white shadow-glow">RI</div>
          <p className="relative mt-4 text-sm font-black tracking-[0.22em]">REVIEWINTEL</p>
          <p className="relative mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-900/80">{t(locale, "AI scan core")}</p>
        </div>
      </div>
    </section>
  );
}
