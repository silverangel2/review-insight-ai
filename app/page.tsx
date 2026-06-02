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

      <section className="relative isolate min-h-[calc(100vh-73px)] overflow-hidden border-b border-white/60 bg-[radial-gradient(circle_at_12%_14%,rgba(20,184,166,0.36),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.32),transparent_30%),radial-gradient(circle_at_58%_90%,rgba(251,191,36,0.34),transparent_32%),radial-gradient(circle_at_88%_75%,rgba(236,72,153,0.20),transparent_25%),linear-gradient(135deg,#f8feff_0%,#dff9ff_38%,#fff7ed_100%)] px-6 pb-20 pt-14 text-ink">
        <style jsx>{`
          @keyframes riHeroPan {
            0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg); }
            50% { transform: translate3d(-18px, -12px, 0) rotate(1deg); }
          }
          @keyframes riHeroPanelFloat {
            0%, 100% { transform: translateY(0) rotate(var(--rotate)); }
            50% { transform: translateY(-14px) rotate(calc(var(--rotate) + 2deg)); }
          }
          @keyframes riHeroOrbOne {
            0%, 100% { transform: translate3d(0,0,0) scale(1); }
            50% { transform: translate3d(80px,-50px,0) scale(1.12); }
          }
          @keyframes riHeroOrbTwo {
            0%, 100% { transform: translate3d(0,0,0) scale(1); }
            50% { transform: translate3d(-70px,55px,0) scale(1.1); }
          }
          @keyframes riHeroShine {
            0%, 55%, 100% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
            70% { opacity: 0.75; }
            86% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
          }
        `}</style>

        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(15,23,42,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.22)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute left-[-8%] top-[10%] h-96 w-96 rounded-full bg-teal/30 blur-3xl" style={{ animation: "riHeroOrbOne 15s ease-in-out infinite" }} />
        <div className="absolute right-[-8%] top-[5%] h-[30rem] w-[30rem] rounded-full bg-blue-400/25 blur-3xl" style={{ animation: "riHeroOrbTwo 17s ease-in-out infinite" }} />
        <div className="absolute bottom-[-18%] left-[32%] h-[32rem] w-[32rem] rounded-full bg-amber/30 blur-3xl" style={{ animation: "riHeroOrbOne 19s ease-in-out infinite reverse" }} />
        <div className="absolute bottom-[2%] right-[18%] h-80 w-80 rounded-full bg-fuchsia-400/18 blur-3xl" style={{ animation: "riHeroOrbTwo 21s ease-in-out infinite reverse" }} />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <Badge tone="good">AI shopping intelligence</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-tight text-slate-950 sm:text-6xl xl:text-7xl">
              Know what product reviews are really saying.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              ReviewIntel scans messy product reviews and turns them into clear buying decisions, fake-review signals, complaint patterns, and seller opportunities.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-2xl bg-slate-950 px-7 py-4 text-center text-sm font-black text-white shadow-[0_22px_60px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:bg-ocean">
                Create free account
              </Link>
              <Link href="/compare" className="rounded-2xl border border-slate-950/10 bg-white/70 px-7 py-4 text-center text-sm font-black text-slate-950 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-ocean hover:text-ocean">
                Compare products
              </Link>
            </div>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
              {heroPanels.map((panel) => (
                <div key={panel.title} className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-soft backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{panel.title}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{panel.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{panel.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[590px] lg:translate-x-5">
            <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute inset-x-12 top-14 h-[460px] rounded-[3rem] border border-white/65 bg-white/28 shadow-[0_40px_130px_rgba(35,86,163,0.20)] backdrop-blur-2xl" style={{ animation: "riHeroPan 9s ease-in-out infinite" }}>
              <div className="absolute inset-0 overflow-hidden rounded-[3rem]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.10)_45%,rgba(8,183,168,0.16))]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(20,184,166,0.35),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_50%_90%,rgba(251,191,36,0.24),transparent_32%)]" />
                <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(15,23,42,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.28)_1px,transparent_1px)] [background-size:36px_36px]" />
                <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.44),transparent)]" style={{ animation: "riHeroShine 8s ease-in-out infinite" }} />
              </div>

              <div className="relative z-10 flex h-full flex-col justify-between p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Live AI scan</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">Portable Blender</h2>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_54%,#ffb238)] text-2xl font-black text-white shadow-glow">RI</div>
                </div>

                <div className="grid gap-5 md:grid-cols-[0.82fr_1fr]">
                  <div className="rounded-[2rem] border border-white/70 bg-slate-950/85 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.26)] backdrop-blur-xl">
                    <p className="text-xs font-black uppercase text-cyan-100">Review score</p>
                    <p className="mt-5 text-6xl font-black">87%</p>
                    <p className="mt-3 text-sm font-bold text-cyan-100">Worth buying with durability caution</p>
                  </div>
                  <div className="rounded-[2rem] border border-white/70 bg-white/72 p-6 shadow-soft backdrop-blur-xl">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">AI verdict</p>
                    <h3 className="mt-3 text-2xl font-black text-slate-950">Good product. Check leaking complaints first.</h3>
                    <p className="mt-4 text-sm leading-6 text-slate-600">Shoppers like speed and cleanup. The repeated risk is lid leaks and short motor life.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {["Trust scan", "Complaint heat", "Best-for match"].map((item, index) => (
                    <div key={item} className="rounded-2xl border border-white/70 bg-white/62 p-4 shadow-soft backdrop-blur-xl">
                      <p className="text-xs font-black uppercase text-slate-500">{item}</p>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-[linear-gradient(90deg,#08b7a8,#2356a3,#ffb238)]" style={{ width: `${index === 0 ? 82 : index === 1 ? 41 : 74}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {[
              ["Paste review", "Works great at first, but mine leaked after two weeks.", "left-10 top-2", "-3deg"],
              ["Seller insight", "Top complaint: replacement parts and lid seal.", "right-8 bottom-28", "3deg"],
              ["Buyer answer", "Best for casual smoothies, not heavy daily use.", "left-20 bottom-20", "2deg"]
            ].map(([title, text, pos, rotate], index) => (
              <div key={title} className={`absolute ${pos} max-w-[210px] rounded-[1.7rem] border border-white/70 bg-white/64 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl`} style={{ "--rotate": rotate, animation: `riHeroPanelFloat ${7 + index}s ease-in-out infinite` } as React.CSSProperties}>
                <p className="text-xs font-black uppercase tracking-wide text-ocean">{title}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{text}</p>
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
