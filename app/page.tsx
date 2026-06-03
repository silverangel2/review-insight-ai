import Link from "next/link";
import { Badge } from "@/components/Badge";
import { FeaturedReviews } from "@/components/FeaturedReviews";
import { PlatformLogoOrbit } from "@/components/PlatformLogoOrbit";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { SponsoredResources } from "@/components/SponsoredResources";

const scanSignals = [
  ["Review trust", "82%", "Clean language mix"],
  ["Fake risk", "24%", "Low pattern match"],
  ["Complaint heat", "41%", "Durability repeats"],
  ["Value score", "78%", "Good under $45"]
];

const scanSteps = ["Paste reviews", "AI scans trust", "See verdict"];

const buyerWins = ["Buy / Maybe / Avoid", "Fake-review risk", "Best-for match", "Biggest complaint"];
const sellerWins = ["Complaint clusters", "Keyword intelligence", "Pain points", "Export-ready report"];

export default function LandingPage() {
  return (
    <main className="bg-[radial-gradient(circle_at_top_left,rgba(8,183,168,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(255,178,56,0.14),transparent_28%),linear-gradient(180deg,#08111f_0%,#102a56_44%,#eefcff_76%,#fff7ed_100%)] text-white">
      <SponsorAnalytics placement="landing" />

      <section className="relative isolate min-h-[calc(100vh-73px)] overflow-hidden">
        <div className="ri-hero-aurora absolute inset-0" />
        <div className="ri-home-warm-blob absolute right-[-8%] top-[10%] h-72 w-72 rounded-full bg-amber/20 blur-3xl" />
        <div className="absolute bottom-[10%] left-[-8%] h-80 w-80 rounded-full bg-teal/20 blur-3xl" />
        <div className="ri-pixie-field absolute inset-0 opacity-85" aria-hidden="true">
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
        <div className="ri-home-orb ri-home-orb-one" aria-hidden="true" />
        <div className="ri-home-orb ri-home-orb-two" aria-hidden="true" />
        <div className="ri-scan-grid absolute inset-0 opacity-45" />
        <div className="ri-scan-beam absolute inset-x-0 top-0 h-32 opacity-70" />

        <div className="relative mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <Badge tone="good">AI review scanner</Badge>
            <h1 className="mt-6 max-w-4xl text-6xl font-black leading-[0.9] md:text-8xl">
              Do not trust the reviews yet.
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-slate-200">
              Paste reviews from any product page. ReviewIntel finds the hype, the red flags, and the real buying answer.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/analyze" className="rounded-2xl bg-white px-7 py-4 text-center text-sm font-black text-ink shadow-glow transition hover:-translate-y-0.5 hover:bg-cyan-100">
                Scan a Product
              </Link>
              <Link href="/reviews" className="rounded-2xl border border-white/15 bg-white/10 px-7 py-4 text-center text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                Read User Reviews
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs font-black uppercase text-slate-300">
              {["Amazon", "Walmart", "Temu", "TikTok Shop", "Etsy", "Shopify", "eBay"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{item}</span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[560px] md:min-h-[640px]">
            <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-5 shadow-[0_35px_140px_rgba(15,159,154,0.25)] backdrop-blur-2xl md:absolute md:left-0 md:top-8 md:w-[86%]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-black uppercase text-teal">Live product scan</p>
                  <h2 className="mt-1 text-2xl font-black">Portable Blender</h2>
                </div>
                <span className="rounded-full border border-amber/30 bg-amber/15 px-3 py-1 text-xs font-black text-amber">Maybe</span>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
                <div className="grid place-items-center rounded-3xl border border-teal/30 bg-teal/10 p-6 text-center shadow-[0_0_60px_rgba(15,159,154,0.2)]">
                  <p className="text-7xl font-black">78%</p>
                  <p className="mt-2 text-xs font-black uppercase text-teal">Shopper score</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
                  <p className="text-xs font-black uppercase text-slate-400">AI verdict</p>
                  <p className="mt-3 text-3xl font-black">Good product. Check durability first.</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Shoppers like the speed and cleanup. The risk is repeated lid leaks and motor-life complaints.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {scanSignals.map(([label, value, detail]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black">{label}</p>
                      <p className="text-2xl font-black text-teal">{value}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
	                      <div className="h-full rounded-full bg-teal" style={{ width: value }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute right-0 top-0 hidden w-[48%] rounded-3xl border border-white/15 bg-white/[0.09] p-4 shadow-glow backdrop-blur-xl md:block">
              <p className="text-xs font-black uppercase text-slate-300">Pasted review</p>
              <p className="mt-3 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-slate-200">
                Works great at first, but mine leaked after two weeks.
              </p>
            </div>

            <div className="absolute bottom-6 right-4 hidden w-[58%] rounded-3xl border border-white/15 bg-white/[0.09] p-4 shadow-[0_20px_80px_rgba(118,87,184,0.28)] backdrop-blur-xl md:block">
              <p className="text-xs font-black uppercase text-purple-200">AI scan path</p>
              <div className="mt-4 grid gap-3">
                {scanSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                    <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-black text-ink">{index + 1}</span>
                    <span className="text-sm font-black">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PlatformLogoOrbit />

      <section className="bg-white px-6 py-10 text-ink dark:bg-slate-950 dark:text-white">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <Badge tone="warn">Screenshot-worthy payoff</Badge>
            <h2 className="mt-4 text-4xl font-black leading-tight md:text-5xl">The result should feel like opening a prize box.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Shoppers get the answer without reading a report. Sellers get a separate command view built for decisions, not shopping.
            </p>
          </div>
          <div className="ri-reveal-pop grid gap-4 md:grid-cols-3">
            {[
              ["87%", "Worth Buying", "Low fake risk", "bg-teal"],
              ["Top complaint", "Battery life", "Check before buying", "bg-coral"],
              ["Best for", "Students, office, travel", "Great value", "bg-ocean"]
            ].map(([eyebrow, title, detail, color]) => (
              <article key={title} className="relative overflow-hidden rounded-[1.6rem] border border-line bg-mist p-5 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
                <div className={`absolute right-4 top-4 size-10 rounded-2xl ${color}`} />
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{eyebrow}</p>
                <h3 className="mt-5 text-3xl font-black">{title}</h3>
                <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950 px-6 py-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          <article className="rounded-[2rem] border border-teal/25 bg-teal/10 p-6 shadow-glow">
            <Badge tone="good">Shopper mode</Badge>
            <h2 className="mt-4 text-3xl font-black">Fast shopping verdict.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {buyerWins.map((item) => <span key={item} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">{item}</span>)}
            </div>
            <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink">Try Shopper Scan</Link>
          </article>

          <article className="rounded-[2rem] border border-plum/30 bg-plum/15 p-6 shadow-[0_24px_80px_rgba(118,87,184,0.22)]">
            <Badge tone="warn">Seller Pro</Badge>
            <h2 className="mt-4 text-3xl font-black">Business intelligence.</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {sellerWins.map((item) => <span key={item} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">{item}</span>)}
            </div>
            <Link href="/pricing" className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink">See Seller Plans</Link>
          </article>
        </div>
      </section>

      <section className="bg-mist px-6 py-12 text-ink dark:bg-slate-950 dark:text-white">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {[
            ["1", "Paste or upload", "Reviews, TXT, CSV, or quick screenshots."],
            ["2", "AI scan", "Trust, complaints, value, keywords, and patterns."],
	            ["3", "Clear answer", "Shopper verdict or Seller Pro report."]
          ].map(([step, title, detail]) => (
            <article key={step} className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
              <span className="grid size-11 place-items-center rounded-full bg-ink text-sm font-black text-white dark:bg-white dark:text-ink">{step}</span>
              <h3 className="mt-5 text-2xl font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <SponsoredResources
        placement="landing"
        compact
        eyebrow="AI commerce resources"
        title="Useful tools, kept quiet"
        description="Partner resources stay below the product experience."
      />
      <FeaturedReviews />
    </main>
  );
}
