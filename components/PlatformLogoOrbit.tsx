"use client";

const platforms = [
  { name: "Amazon", mark: "a", sub: "Marketplace", delay: "0s", ring: "ring-amber-300/40", glow: "shadow-[0_0_45px_rgba(255,178,56,0.28)]", position: "left-[8%] top-[48%] -rotate-[10deg] scale-[0.82]" },
  { name: "Walmart", mark: "✹", sub: "Retail", delay: "-1.2s", ring: "ring-sky-300/40", glow: "shadow-[0_0_45px_rgba(56,189,248,0.26)]", position: "left-[22%] top-[23%] -rotate-[6deg] scale-[0.92]" },
  { name: "TikTok Shop", mark: "♪", sub: "Social commerce", delay: "-2.4s", ring: "ring-cyan-300/40", glow: "shadow-[0_0_45px_rgba(34,211,238,0.24)]", position: "left-[43%] top-[10%] rotate-[2deg] scale-[0.95]" },
  { name: "Shopify", mark: "S", sub: "Storefront", delay: "-3.6s", ring: "ring-emerald-300/40", glow: "shadow-[0_0_45px_rgba(52,211,153,0.24)]", position: "right-[21%] top-[23%] rotate-[7deg] scale-[0.92]" },
  { name: "Etsy", mark: "E", sub: "Handmade", delay: "-4.8s", ring: "ring-orange-300/40", glow: "shadow-[0_0_45px_rgba(251,146,60,0.24)]", position: "right-[8%] top-[48%] rotate-[10deg] scale-[0.82]" },
  { name: "eBay", mark: "e", sub: "Resale", delay: "-6s", ring: "ring-lime-300/40", glow: "shadow-[0_0_45px_rgba(163,230,53,0.20)]", position: "right-[22%] bottom-[10%] rotate-[5deg] scale-[0.88]" },
  { name: "Best Buy", mark: "B", sub: "Electronics", delay: "-7.2s", ring: "ring-yellow-300/40", glow: "shadow-[0_0_45px_rgba(250,204,21,0.22)]", position: "left-[22%] bottom-[10%] -rotate-[5deg] scale-[0.88]" }
];

export function PlatformLogoOrbit() {
  return (
    <section className="relative min-h-[560px] overflow-hidden rounded-[2.5rem] border border-white/20 bg-[radial-gradient(circle_at_20%_15%,rgba(45,212,191,0.35),transparent_30%),radial-gradient(circle_at_75%_12%,rgba(96,165,250,0.35),transparent_28%),radial-gradient(circle_at_50%_88%,rgba(251,191,36,0.28),transparent_32%),linear-gradient(135deg,#07111f,#102a56_42%,#07111f)] p-6 text-white shadow-[0_34px_120px_rgba(15,23,42,0.32)]">
      <style jsx>{`
        @keyframes riFlipFloat {
          0%, 100% {
            transform: translateY(0) rotateY(-14deg) rotateX(4deg);
          }
          45% {
            transform: translateY(-12px) rotateY(14deg) rotateX(-4deg);
          }
          70% {
            transform: translateY(4px) rotateY(180deg) rotateX(0deg);
          }
        }

        @keyframes riSlowTurn {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes riReverseTurn {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes riGlowPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }

        .ri-flip-card {
          transform-style: preserve-3d;
          animation: riFlipFloat 7.5s ease-in-out infinite;
        }

        .ri-card-face {
          backface-visibility: hidden;
        }

        .ri-card-back {
          transform: rotateY(180deg);
        }

        .ri-glass-shine::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 12%, rgba(255,255,255,0.38) 32%, transparent 54%);
          transform: translateX(-130%);
          animation: shine 5.5s ease-in-out infinite;
        }

        @keyframes shine {
          0%, 48%, 100% { transform: translateX(-130%); }
          62% { transform: translateX(130%); }
        }
      `}</style>

      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.38)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.38)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] rounded-full border border-cyan-200/15" style={{ animation: "riSlowTurn 28s linear infinite" }} />
      <div className="absolute left-1/2 top-1/2 h-[55%] w-[55%] rounded-full border border-amber-200/15" style={{ animation: "riReverseTurn 20s linear infinite" }} />
      <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] rounded-full border border-white/10" style={{ animation: "riSlowTurn 16s linear infinite" }} />

      <div className="absolute left-1/2 top-1/2 z-20 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[2.25rem] border border-white/30 bg-white/12 shadow-[0_0_90px_rgba(45,212,191,0.40)] backdrop-blur-2xl">
        <div className="absolute inset-0 rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(255,255,255,0.04))]" />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_52%,#ffb238)] text-3xl font-black text-white shadow-glow" style={{ animation: "riGlowPulse 4s ease-in-out infinite" }}>
          RI
        </div>
        <p className="relative mt-4 text-sm font-black tracking-[0.22em]">REVIEWINTEL</p>
        <p className="relative mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/80">AI review source mesh</p>
      </div>

      {platforms.map((platform) => (
        <div
          key={platform.name}
          className={`absolute z-10 h-36 w-36 sm:h-40 sm:w-40 ${platform.position}`}
          style={{ perspective: "900px" }}
        >
          <div className={`ri-flip-card relative h-full w-full ${platform.glow}`} style={{ animationDelay: platform.delay }}>
            <div className={`ri-card-face ri-glass-shine absolute inset-0 overflow-hidden rounded-[2rem] border border-white/25 bg-white/12 p-4 backdrop-blur-2xl ring-1 ${platform.ring}`}>
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.30),rgba(255,255,255,0.04)_45%,rgba(255,255,255,0.12))]" />
              <div className="relative flex h-full flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/18 text-3xl font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                  {platform.mark}
                </div>
                <p className="mt-3 text-sm font-black">{platform.name}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/70">{platform.sub}</p>
              </div>
            </div>

            <div className={`ri-card-face ri-card-back absolute inset-0 overflow-hidden rounded-[2rem] border border-white/25 bg-white/10 p-4 backdrop-blur-2xl ring-1 ${platform.ring}`}>
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Review source</p>
                <p className="mt-3 text-sm font-bold leading-5 text-white/90">Paste review text from {platform.name} and let AI find the real buying signals.</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="absolute bottom-5 left-5 right-5 z-30 rounded-2xl border border-white/15 bg-slate-950/48 px-4 py-3 text-[10px] font-bold uppercase leading-5 tracking-[0.13em] text-slate-200 backdrop-blur-xl">
        Marketplace names are examples of review sources only. ReviewIntel is not affiliated with, sponsored by, endorsed by, or officially partnered with these marketplaces.
      </div>
    </section>
  );
}
