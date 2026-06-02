"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { PlatformLogoOrbit } from "@/components/PlatformLogoOrbit";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { SponsoredResources } from "@/components/SponsoredResources";

const heroPanels = [
  { title: "Fake-review risk", value: "Low", detail: "Language and pattern signals checked" },
  { title: "Buyer verdict", value: "Worth it", detail: "Fast answer without reading every review" },
  { title: "Seller insight", value: "3 gaps", detail: "Complaints, requests, and market angles" }
];

const steps = [
  "Create a free account",
  "Paste reviews inside Analyzer or Compare",
  "Let AI scan trust, complaints, value, and risk",
  "Save your verdict or seller intelligence"
];

const buyerWins = ["Buy / Maybe / Avoid", "Fake-review risk", "Best-for match", "Biggest complaint"];
const sellerWins = ["Complaint clusters", "Keyword intelligence", "Pain points", "Export-ready report"];

export default function LandingPage() {
  return (
    <main className="overflow-hidden bg-[linear-gradient(180deg,#f8feff_0%,#eefcff_38%,#fff7ed_70%,#ffffff_100%)] text-ink dark:bg-slate-950">
      <SponsorAnalytics placement="landing" />

      <section className="relative isolate overflow-hidden border-b border-white/60 bg-[radial-gradient(circle_at_12%_18%,rgba(20,184,166,0.34),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.30),transparent_30%),radial-gradient(circle_at_58%_92%,rgba(251,191,36,0.28),transparent_30%),radial-gradient(circle_at_88%_78%,rgba(236,72,153,0.16),transparent_24%),linear-gradient(135deg,#f8feff_0%,#e7fbff_42%,#fff7ed_100%)] px-6 py-12 text-ink">
        <style jsx>{`
          @keyframes riHeroPanelFloat {
            0%, 100% { transform: translateY(0) rotate(var(--rotate)); }
            50% { transform: translateY(-10px) rotate(calc(var(--rotate) + 1deg)); }
          }
          @keyframes riHeroOrbOne {
            0%, 100% { transform: translate3d(0,0,0) scale(1); }
            50% { transform: translate3d(60px,-34px,0) scale(1.08); }
          }
          @keyframes riHeroOrbTwo {
            0%, 100% { transform: translate3d(0,0,0) scale(1); }
            50% { transform: translate3d(-52px,40px,0) scale(1.06); }
          }
          @keyframes riHeroShine {
            0%, 62%, 100% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
            74% { opacity: 0.55; }
            88% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
          }
        `}</style>

        <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(15,23,42,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.22)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute left-[-8%] top-[8%] h-80 w-80 rounded-full bg-teal/28 blur-3xl" style={{ animation: "riHeroOrbOne 15s ease-in-out infinite" }} />
        <div className="absolute right-[-8%] top-[5%] h-96 w-96 rounded-full bg-blue-400/22 blur-3xl" style={{ animation: "riHeroOrbTwo 17s ease-in-out infinite" }} />
        <div className="absolute bottom-[-18%] left-[32%] h-96 w-96 rounded-full bg-amber/26 blur-3xl" style={{ animation: "riHeroOrbOne 19s ease-in-out infinite reverse" }} />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="py-4">
            <Badge tone="good">AI shopping intelligence</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl xl:text-7xl">
              Know what reviews really say.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
              ReviewIntel scans messy product reviews and turns them into clear buying decisions, fake-review signals, complaint patterns, and seller opportunities.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-2xl bg-slate-950 px-7 py-4 text-center text-sm font-black text-white shadow-[0_22px_60px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-ocean">
                Create free account
              </Link>
              <Link href="/compare" className="rounded-2xl border border-slate-950/10 bg-white/80 px-7 py-4 text-center text-sm font-black text-slate-950 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-ocean hover:text-ocean">
                Compare products
              </Link>
            </div>

            <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              {heroPanels.map((panel) => (
                <div key={panel.title} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-soft backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{panel.title}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{panel.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{panel.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[520px]">
            <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/24 blur-3xl" />

            <div className="absolute inset-x-4 top-10 h-[440px] rounded-[2.7rem] border border-white/70 bg-white/30 shadow-[0_35px_110px_rgba(35,86,163,0.18)] backdrop-blur-2xl">
              <div className="absolute inset-0 overflow-hidden rounded-[2.7rem]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(255,255,255,0.12)_45%,rgba(8,183,168,0.13))]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(20,184,166,0.25),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.22),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(251,191,36,0.20),transparent_32%)]" />
                <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(15,23,42,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.28)_1px,transparent_1px)] [background-size:36px_36px]" />
                <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.36),transparent)]" style={{ animation: "riHeroShine 8s ease-in-out infinite" }} />
              </div>

              <div className="relative z-10 flex h-full flex-col justify-between p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Live AI scan</p>
                    <h2 className="mt-2 text-xl font-black text-slate-950">Portable Blender</h2>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_54%,#ffb238)] text-xl font-black text-white shadow-glow">RI</div>
                </div>

                <div className="grid gap-4 md:grid-cols-[0.8fr_1fr]">
                  <div className="rounded-[1.8rem] border border-white/70 bg-slate-950/86 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.23)] backdrop-blur-xl">
                    <p className="text-xs font-black uppercase text-cyan-100">Review score</p>
                    <p className="mt-4 text-5xl font-black">87%</p>
                    <p className="mt-3 text-sm font-bold leading-5 text-cyan-100">Worth buying with durability caution</p>
                  </div>
                  <div className="rounded-[1.8rem] border border-white/70 bg-white/76 p-5 shadow-soft backdrop-blur-xl">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">AI verdict</p>
                    <h3 className="mt-3 text-xl font-black leading-tight text-slate-950">Good product. Check leaking complaints first.</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">Shoppers like speed and cleanup. The repeated risk is lid leaks and short motor life.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {["Trust scan", "Complaint heat", "Best-for match"].map((item, index) => (
                    <div key={item} className="rounded-2xl border border-white/70 bg-white/68 p-3 shadow-soft backdrop-blur-xl">
                      <p className="text-[10px] font-black uppercase text-slate-500">{item}</p>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-[linear-gradient(90deg,#08b7a8,#2356a3,#ffb238)]" style={{ width: `${index === 0 ? 82 : index === 1 ? 41 : 74}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {[
              ["Paste review", "Works great at first, but mine leaked after two weeks.", "right-2 top-0", "-2deg"],
              ["Seller insight", "Top complaint: replacement parts and lid seal.", "right-0 bottom-16", "2deg"],
              ["Buyer answer", "Best for casual smoothies, not heavy daily use.", "left-8 bottom-12", "1deg"]
            ].map(([title, text, pos, rotate], index) => (
              <div key={title} className={`absolute ${pos} max-w-[180px] rounded-[1.5rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.13)] backdrop-blur-2xl`} style={{ "--rotate": rotate, animation: `riHeroPanelFloat ${7 + index}s ease-in-out infinite` } as React.CSSProperties}>
                <p className="text-[10px] font-black uppercase tracking-wide text-ocean">{title}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-700">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <PlatformLogoOrbit />
        </div>
      </section>

      <section className="px-6 py-12 text-ink dark:bg-slate-950 dark:text-white">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          <article className="rounded-[2rem] border border-teal/25 bg-white/75 p-6 shadow-soft backdrop-blur-xl dark:bg-teal/15">
            <Badge tone="good">Shopper</Badge>
            <h2 className="mt-4 text-3xl font-black">Fast buying decisions.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {buyerWins.map((item) => <span key={item} className="rounded-2xl bg-teal/10 px-4 py-3 text-sm font-black">{item}</span>)}
            </div>
            <Link href="/signup" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Start Free Scan</Link>
          </article>

          <article className="rounded-[2rem] border border-plum/25 bg-white/75 p-6 shadow-soft backdrop-blur-xl dark:bg-plum/15">
            <Badge tone="warn">Seller Pro</Badge>
            <h2 className="mt-4 text-3xl font-black">Business intelligence.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {sellerWins.map((item) => <span key={item} className="rounded-2xl bg-plum/10 px-4 py-3 text-sm font-black">{item}</span>)}
            </div>
            <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">See Seller Plans</Link>
          </article>
        </div>
      </section>

      <section className="px-6 py-12 text-ink dark:bg-slate-950 dark:text-white">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-line bg-white/80 p-6 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
          <Badge tone="info">How it works</Badge>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">{index + 1}</span>
                <p className="mt-4 text-sm font-black">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <SponsoredResources placement="landing" />
        </div>
      </section>

      <FeaturedReviews />
    </main>
  );
}
