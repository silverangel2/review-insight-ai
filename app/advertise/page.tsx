import type { Metadata } from "next";
import Link from "next/link";
import { adPackages } from "@/lib/adConfig";
import { loadAdvertiseStats } from "@/lib/advertiseStats";
import { AdvertiseInquiry } from "@/components/advertising/AdvertiseInquiry";
import { FeaturedDeals } from "@/components/advertising/FeaturedDeals";

export const metadata: Metadata = { title: "Advertise with ReviewIntel", description: "Reach shoppers right when they're deciding, with clearly labelled, honest placements." };

const PREVIEW = [
  { slug: "results_below_verdict", name: "Results page", where: "Just below the verdict, when a shopper has decided what to do next." },
  { slug: "analyze_below_card", name: "Scan page", where: "Next to the link box, while shoppers start a scan." },
  { slug: "homepage_mid", name: "Homepage", where: "On the homepage, below the example and how-it-works section." },
] as const;

export default async function AdvertisePage() {
  const stats = await loadAdvertiseStats();
  const shown = ([["Product scans run", stats.scans], ["Page views, last 30 days", stats.pageViews30d], ["Ad impressions, last 30 days", stats.adImpressions30d]] as const).filter(([, v]) => typeof v === "number" && v > 0) as Array<readonly [string, number]>;
  return (
    <main>
      <section className="bg-[linear-gradient(135deg,#e6f7f1_0%,#fff6ec_55%,#ffeee6_100%)] px-5 pb-12 pt-10 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex rounded-full bg-peach px-3 py-1 text-sm font-semibold text-coralink ring-1 ring-coral/30">Advertise with ReviewIntel</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Reach shoppers right when they&apos;re deciding.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Clean, clearly labelled placements next to honest, review-based answers. Ads never change a verdict, and that&apos;s exactly why shoppers trust the page they see your ad on.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#inquiry" className="ri-lift rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white">Start an inquiry</a>
            <a href="#placements" className="rounded-full border border-coral/60 bg-white px-6 py-3 text-sm font-semibold text-coralink hover:bg-peach">See placements</a>
          </div>
          {shown.length ? (
            <dl className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3" data-testid="advertise-stats">
              {shown.map(([k, v]) => <div key={k} className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-900/5"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 text-2xl font-semibold text-slate-900">{v.toLocaleString()}</dd></div>)}
            </dl>
          ) : null}
        </div>
      </section>

      <section id="placements" className="bg-[linear-gradient(180deg,#f1edff_0%,#ffffff_100%)] px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-slate-900">Where your ad appears</h2>
          <p className="mt-1 text-sm text-slate-600">This is the real ad card, shown here with placeholder content.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {PREVIEW.map((p, n) => (
              <article key={p.slug} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-slate-900/5">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="mt-1 text-sm text-slate-600">{p.where}</p>
                <div className="mt-3"><FeaturedDeals slides={[{ ad: { id: `preview-${n}`, sponsorName: "Your brand", headline: "Your headline here", description: "One short line about your offer.", destinationUrl: "#inquiry", placement: p.slug, active: true, status: "approved" }, kind: "direct", partner: "Your brand", headline: "Your headline here", description: "One short line about your offer.", cta: "Learn more" }]} /></div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">No ads on paid seller pages or Premium accounts. Every ad is labelled &ldquo;Sponsored&rdquo;.</p>
        </div>
      </section>

      <section className="bg-butter px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-slate-900">Packages</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {Object.values(adPackages).map(plan => (
              <article key={plan.id} className="rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-900/5">
                <p className="text-sm font-semibold text-teal">{plan.id === "featured_monthly" ? "Featured" : "Sponsored"}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{plan.price}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li>Up to {plan.dailyImpressionCap.toLocaleString()} impressions a day</li>
                  <li>{plan.durationDays}-day campaign on dates you agree with us</li>
                  <li>Image or short muted video</li>
                  <li>Private report: impressions, clicks, CTR</li>
                </ul>
              </article>
            ))}
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-4">
            {["Send an inquiry", "We review and approve", "Pay securely by link", "Your ad starts on the start date"].map((s, i) => (
              <li key={s} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5"><p className="text-xs font-semibold text-teal">Step {i + 1}</p><p className="mt-1 text-sm font-semibold text-slate-900">{s}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section id="inquiry" className="px-5 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <AdvertiseInquiry />
          <p className="mt-6 text-sm text-slate-600">Already approved and have creative ready? <Link href="/advertise/apply" className="font-semibold text-teal underline">Upload your campaign</Link>. Read the <Link href="/ad-policy" className="underline">ad content policy</Link> and <Link href="/advertiser-terms" className="underline">advertiser terms</Link>.</p>
        </div>
      </section>
    </main>
  );
}
