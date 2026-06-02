"use client";

const platforms = [
  { name: "Amazon", mark: "a", sub: "Marketplace", accent: "from-amber-300/35 to-orange-400/10" },
  { name: "Walmart", mark: "✹", sub: "Retail", accent: "from-sky-300/35 to-blue-500/10" },
  { name: "TikTok Shop", mark: "♪", sub: "Social commerce", accent: "from-cyan-300/35 to-fuchsia-500/10" },
  { name: "Shopify", mark: "S", sub: "Storefront", accent: "from-emerald-300/35 to-lime-400/10" },
  { name: "Etsy", mark: "E", sub: "Handmade", accent: "from-orange-300/35 to-rose-400/10" },
  { name: "eBay", mark: "e", sub: "Resale", accent: "from-lime-300/35 to-sky-400/10" },
  { name: "Best Buy", mark: "B", sub: "Electronics", accent: "from-yellow-300/35 to-blue-500/10" }
];

const carouselItems = [...platforms, ...platforms];

export function PlatformLogoOrbit() {
  return (
    <section className="relative min-h-[560px] overflow-hidden rounded-[2.5rem] border border-white/25 bg-[radial-gradient(circle_at_18%_10%,rgba(20,184,166,0.42),transparent_28%),radial-gradient(circle_at_78%_12%,rgba(96,165,250,0.36),transparent_30%),radial-gradient(circle_at_50%_95%,rgba(251,191,36,0.34),transparent_30%),linear-gradient(135deg,#06111f_0%,#123b70_42%,#072033_100%)] px-6 py-10 text-white shadow-[0_40px_130px_rgba(15,23,42,0.34)]">
      <style jsx>{`
        @keyframes riCarouselPan {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes riCenterFloat {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-8px) scale(1.025);
          }
        }

        @keyframes riLightSweep {
          0%, 45%, 100% {
            transform: translateX(-130%) skewX(-18deg);
            opacity: 0;
          }
          55% {
            opacity: 0.85;
          }
          72% {
            transform: translateX(135%) skewX(-18deg);
            opacity: 0;
          }
        }

        @keyframes riSoftPulse {
          0%, 100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.06);
          }
        }

        .ri-carousel-track {
          animation: riCarouselPan 26s linear infinite;
          will-change: transform;
        }

        .ri-carousel-track:hover {
          animation-play-state: paused;
        }

        .ri-glass-card {
          transform-style: preserve-3d;
          transform: perspective(1000px) rotateY(-16deg) rotateX(3deg);
        }

        .ri-glass-card:nth-child(even) {
          transform: perspective(1000px) rotateY(16deg) rotateX(3deg);
        }

        .ri-glass-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 2rem;
          background: linear-gradient(115deg, transparent 12%, rgba(255,255,255,0.5) 34%, transparent 58%);
          animation: riLightSweep 6s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.36)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="absolute bottom-[-120px] left-[12%] h-72 w-72 rounded-full bg-amber/25 blur-3xl" />
      <div className="absolute right-[8%] top-[8%] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="relative z-20 mx-auto max-w-3xl text-center">
        <p className="mx-auto inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-xl">
          AI review source mesh
        </p>
        <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
          Scan reviews from the places shoppers already trust.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-100/85">
          A premium AI layer that turns marketplace review text into fast buying decisions and seller intelligence.
        </p>
      </div>

      <div className="relative z-10 mt-12 overflow-hidden py-12">
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-28 bg-gradient-to-r from-[#06111f] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-28 bg-gradient-to-l from-[#072033] to-transparent" />

        <div className="ri-carousel-track flex w-max gap-7 px-8">
          {carouselItems.map((platform, index) => (
            <article
              key={`${platform.name}-${index}`}
              className={`ri-glass-card relative h-56 w-48 shrink-0 overflow-hidden rounded-[2rem] border border-white/25 bg-white/12 p-5 text-center shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl transition duration-500 hover:-translate-y-2 hover:scale-[1.03]`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${platform.accent}`} />
              <div className="absolute inset-[1px] rounded-[1.95rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.26),rgba(255,255,255,0.05)_48%,rgba(255,255,255,0.14))]" />
              <div className="relative flex h-full flex-col items-center justify-center">
                <div className="grid h-20 w-20 place-items-center rounded-3xl border border-white/30 bg-white/18 text-4xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_60px_rgba(0,0,0,0.25)]">
                  {platform.mark}
                </div>
                <p className="mt-5 text-lg font-black">{platform.name}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/75">{platform.sub}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-48 w-48 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[2.25rem] border border-white/35 bg-white/16 text-center shadow-[0_0_100px_rgba(20,184,166,0.48)] backdrop-blur-2xl" style={{ animation: "riCenterFloat 5s ease-in-out infinite" }}>
          <div className="absolute inset-0 rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.06))]" />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_54%,#ffb238)] text-3xl font-black text-white shadow-glow" style={{ animation: "riSoftPulse 4s ease-in-out infinite" }}>
            RI
          </div>
          <p className="relative mt-4 text-sm font-black tracking-[0.22em]">REVIEWINTEL</p>
          <p className="relative mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/80">AI scan core</p>
        </div>
      </div>

      <div className="relative z-30 mx-auto mt-2 max-w-6xl rounded-2xl border border-white/15 bg-slate-950/42 px-4 py-3 text-center text-[10px] font-bold uppercase leading-5 tracking-[0.13em] text-slate-200 backdrop-blur-xl">
        Marketplace names are examples of review sources only. ReviewIntel is not affiliated with, sponsored by, endorsed by, or officially partnered with these marketplaces.
      </div>
    </section>
  );
}
