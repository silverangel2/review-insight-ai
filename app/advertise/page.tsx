import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/Badge";

export const metadata: Metadata = {
  title: "Advertise with ReviewIntel",
  description: "Apply for sponsored ecommerce resource placements inside ReviewIntel for shoppers and sellers."
};

const placementOptions = [
  {
    name: "Starter Resource",
    price: "$49/month",
    detail: "Directory-style sponsored resource card for ecommerce tools, seller services, or AI workflows.",
    features: ["Resource card", "Category placement", "Sponsored label", "Manual approval"]
  },
  {
    name: "Featured Resource",
    price: "$99/month",
    detail: "Higher-visibility placement across resource sections and seller-facing pages.",
    features: ["Featured card", "Priority placement", "Seller audience", "Monthly review"]
  },
  {
    name: "Premium Partner",
    price: "$199/month",
    detail: "Launch partner visibility for seller dashboards, resources, and selected product workflows.",
    features: ["Premium placement", "Dashboard visibility", "Performance summary", "Priority approval"]
  }
];

export default function AdvertisePage() {
  return (
    <main className="bg-mist dark:bg-slate-950">
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <Badge tone="info">Sponsored resources</Badge>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-ink dark:text-white">
              Feature your ecommerce tool inside ReviewIntel.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              ReviewIntel connects shoppers and sellers with useful ecommerce resources. Apply for a sponsored placement if your tool helps with selling, analytics, fulfillment, product research, marketing, automation, or AI workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:support@reviewintel.ai?subject=Advertise%20with%20ReviewIntel&body=Business%20name%3A%0AWebsite%3A%0AContact%20email%3A%0APlacement%20interest%3A%0ATarget%20audience%20%28Shopper%2FSeller%29%3A%0AShort%20description%3A%0A"
                className="rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
              >
                Apply by email
              </a>
              <Link
                href="/contact"
                className="rounded-2xl border border-line bg-white px-6 py-4 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                Contact support
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">Application details</p>
            <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">What we need from you</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <li>• Business or product name</li>
              <li>• Website URL</li>
              <li>• Contact email</li>
              <li>• Resource category</li>
              <li>• Short description</li>
              <li>• Target audience: Shopper or Seller</li>
              <li>• Preferred placement option</li>
            </ul>
            <p className="mt-5 rounded-2xl border border-amber/25 bg-amber/10 p-4 text-xs font-bold leading-5 text-amber">
              Sponsored resources are reviewed manually. Approval is not guaranteed, and every placement must remain clearly labeled as sponsored.
            </p>
          </aside>
        </div>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {placementOptions.map((option) => (
            <article key={option.name} className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{option.name}</p>
              <p className="mt-3 text-3xl font-black text-ink dark:text-white">{option.price}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{option.detail}</p>
              <ul className="mt-5 space-y-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                {option.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <Badge tone="neutral">No false partnership</Badge>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Sponsored, not endorsed.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Sponsored resource placements are paid listings or partner placements. ReviewIntel does not automatically endorse, guarantee, or certify the products shown. All sponsored resources should be relevant, transparent, and clearly labeled.
          </p>
        </section>
      </section>
    </main>
  );
}
