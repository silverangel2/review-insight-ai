import { AdSlot } from "@/components/advertising/AdSlot";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { PlatformLogoOrbit } from "@/components/PlatformLogoOrbit";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";



const buyerWins = ["Buy / Maybe / Avoid", "Fake-review risk", "Best-for match", "Biggest complaint"];
const sellerWins = ["Complaint clusters", "Keyword intelligence", "Pain points", "Export-ready report"];

export default function LandingPage() {
  return (
    <>
    <main className="bg-[linear-gradient(135deg,#a8eee8_0%,#e7fbff_34%,#c7e2ff_66%,#fff0c9_100%)] text-ink">
      <SponsorAnalytics placement="landing" />

      <section className="relative isolate min-h-[calc(100vh-73px)] overflow-hidden border-b border-white/60">
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
        `}</style>

        <div className="relative mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl gap-10 px-6 py-10 xl:grid-cols-[0.92fr_1.08fr] xl:items-center">
          <div>
            <Badge tone="good">AI review scanner</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.01em] text-[#06111f] md:text-7xl xl:text-[6.35rem]">
              Find out if a product is worth buying.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
              Paste reviews and get a clear verdict, fake-review risk, top complaints, and value score. Selling products? Turn review feedback into product improvements and listing strategy.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/analyze"
                className="rounded-2xl bg-ink px-7 py-4 text-center text-sm font-black text-white shadow-[0_20px_70px_rgba(15,23,42,0.25)] transition hover:-translate-y-0.5 hover:bg-ocean"
              >
                Scan Reviews Now
              </Link>
              <Link
                href="/results"
                className="rounded-2xl border border-white/70 bg-white/60 px-7 py-4 text-center text-sm font-black text-ink shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
              >
                See Example Result
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs font-black uppercase text-slate-600">
              {["Amazon", "Walmart", "Temu", "TikTok Shop", "Etsy", "Shopify", "eBay"].map((item) => (
                <span key={item} className="rounded-full border border-white/70 bg-white/45 px-3 py-2 shadow-sm backdrop-blur">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="ri-hero-visual relative mx-auto min-h-[620px] w-full max-w-[760px] overflow-hidden rounded-[2.8rem] border border-white/70 bg-[linear-gradient(135deg,rgba(6,17,35,0.96),rgba(16,72,111,0.78)_42%,rgba(56,148,180,0.48)_68%,rgba(255,255,255,0.28)_100%)] shadow-[0_45px_150px_rgba(12,36,68,0.3)] backdrop-blur-lg md:min-h-[690px]">
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

            <div className="relative z-10 grid min-h-[620px] grid-cols-1 grid-rows-[auto_auto_auto_auto_auto] gap-4 p-5 sm:grid-cols-2 sm:grid-rows-[auto_auto_auto] md:min-h-[690px] md:gap-5 md:p-8">
              <article className="ri-home-card self-start rounded-[2rem] bg-[#11182a] p-5 text-white shadow-[0_30px_90px_rgba(4,10,24,0.42)] ring-1 ring-white/10 [--ri-end:-1deg] [--ri-rot:-24deg] [--ri-x:-340px] [--ri-y:210px]">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-900">Live AI scan</p>
                <p className="mt-3 text-sm font-black text-white/70">Review score</p>
                <p className="mt-3 text-6xl font-black md:text-7xl reviewintel-flip-card" style={{ animationDelay: "0.4s" }}>87%</p>
                <p className="mt-4 text-sm font-black leading-6 text-cyan-900 md:text-base">Worth buying with durability caution</p>
              </article>

              <article className="ri-home-card self-start rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_26px_90px_rgba(12,36,68,0.24)] backdrop-blur-lg [--ri-end:2deg] [--ri-rot:24deg] [--ri-x:340px] [--ri-y:-180px]" style={{ animationDelay: "120ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">AI verdict</p>
                <p className="mt-3 text-2xl font-black leading-tight text-ink">Good product. Check repeated risks first.</p>
                <p className="mt-4 text-sm font-bold leading-6 text-slate-700">Buyers like speed and cleanup. Watch lid leaks and motor life.</p>
              </article>

              <article className="ri-home-card row-start-auto self-center rounded-3xl border border-white/18 bg-[#19243a]/86 p-5 text-white shadow-[0_24px_80px_rgba(4,10,24,0.3)] backdrop-blur-lg [--ri-end:-2deg] [--ri-rot:-26deg] [--ri-x:-300px] [--ri-y:230px] sm:row-start-2" style={{ animationDelay: "240ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-900">Shopper answer</p>
                <p className="mt-3 text-base font-black leading-6 text-white">Best for casual use — not heavy daily use.</p>
              </article>

              <article className="ri-home-card row-start-auto self-center rounded-3xl border border-white/70 bg-white/84 p-4 shadow-[0_20px_70px_rgba(12,36,68,0.18)] backdrop-blur-lg [--ri-end:1deg] [--ri-rot:-18deg] [--ri-x:120px] [--ri-y:260px] sm:row-start-2" style={{ animationDelay: "360ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Complaint heat</p>
                <div className="mt-4 h-3 rounded-full bg-white/70">
                  <div className="h-full w-[58%] rounded-full bg-[linear-gradient(90deg,#10a7a0,#ffbd58,#df5f63)]" />
                </div>
                <p className="mt-3 text-sm font-black text-slate-700">Moderate risk</p>
              </article>

              <article className="ri-home-card row-start-auto max-w-[430px] justify-self-stretch self-end rounded-3xl border border-white/18 bg-[#11182a]/86 p-5 text-white shadow-[0_24px_80px_rgba(4,10,24,0.3)] backdrop-blur-lg [--ri-end:2deg] [--ri-rot:26deg] [--ri-x:320px] [--ri-y:220px] sm:col-span-2 sm:row-start-3 sm:justify-self-end" style={{ animationDelay: "480ms" }}>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-900">Seller insight</p>
                <p className="mt-3 text-base font-black leading-6 text-white">Seller insight: clarify warranty and replacement support.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <PlatformLogoOrbit />

      <section className="bg-[linear-gradient(180deg,#f6fdff_0%,#ffffff_100%)] px-6 py-12 text-ink">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <Badge tone="warn">Screenshot-worthy payoff</Badge>
            <h2 className="mt-4 text-4xl font-black leading-tight md:text-5xl">The result should feel like opening a prize box.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.
            </p>
          </div>
          <div className="ri-reveal-pop grid gap-4 md:grid-cols-3">
            {[
              ["87%", "Worth Buying", "Low fake risk", "bg-teal"],
              ["Top complaint", "Battery life", "Check before buying", "bg-coral"],
              ["Best for", "Students, office, travel", "Great value", "bg-ocean"]
            ].map(([eyebrow, title, detail, color]) => (
              <article key={title} className="relative overflow-hidden rounded-[1.6rem] border border-line bg-white p-5 shadow-soft">
                <div className={`absolute right-4 top-4 size-10 rounded-2xl ${color}`} />
                <p className="text-xs font-black uppercase text-slate-500">{eyebrow}</p>
                <h3 className="mt-5 text-3xl font-black">{title}</h3>
                <p className="mt-3 text-sm font-bold text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,#e7fbff_0%,#f8f2ff_48%,#fff4d8_100%)] px-6 py-10 text-ink">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          <article className="rounded-[2rem] border border-white/70 bg-white/54 p-6 shadow-soft backdrop-blur">
            <Badge tone="good">Shopper mode</Badge>
            <h2 className="mt-4 text-3xl font-black">Fast shopping verdict.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {buyerWins.map((item) => (
                <span key={item} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm font-black">
                  {item}
                </span>
              ))}
            </div>
            <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white">
              Try Shopper Scan
            </Link>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white/54 p-6 shadow-soft backdrop-blur">
            <Badge tone="warn">Seller Pro</Badge>
            <h2 className="mt-4 text-3xl font-black">Business intelligence.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {sellerWins.map((item) => (
                <span key={item} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-sm font-black">
                  {item}
                </span>
              ))}
            </div>
            <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white">
              See Seller Plans
            </Link>
          </article>
        </div>
      </section>

      <section className="bg-mist px-6 py-12 text-ink">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            ["1", "Paste or upload", "Reviews, TXT, CSV, or quick screenshots."],
            ["2", "AI scan", "Trust, complaints, value, keywords, and patterns."],
            ["3", "Clear answer", "Shopper verdict or Seller Pro report."]
          ].map(([step, title, detail]) => (
            <article key={step} className="rounded-3xl border border-line bg-white p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-full bg-ink text-sm font-black text-white">{step}</span>
              <h3 className="mt-5 text-2xl font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <FeaturedReviews />
    
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <AdSlot placement="homepage_mid" />
      </section>

    </main>
    </>
  );
}
