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
    price: "$19/month",
    detail: "A clean sponsored resource card for ecommerce tools, seller services, or AI workflows.",
    features: ["Resource card", "Category placement", "Sponsored label", "Manual approval"]
  },
  {
    name: "Featured Resource",
    price: "$49/month",
    detail: "Better visibility across resource sections and selected seller-facing pages.",
    features: ["Featured card", "Priority placement", "Seller audience", "Monthly review"]
  },
  {
    name: "Premium Partner",
    price: "$99/month",
    detail: "Launch partner visibility for seller dashboards, resource areas, and selected product workflows.",
    features: ["Premium placement", "Dashboard visibility", "Performance summary", "Priority approval"]
  }
];

export default function AdvertisePage() {
  return (
    <main className="min-h-screen bg-mist text-ink dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <Badge tone="info">Advertise with ReviewIntel</Badge>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight">
              Feature your ecommerce tool inside ReviewIntel.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Reach shoppers and sellers who are already thinking about products, reviews, complaints, seller tools, analytics, fulfillment, marketing, automation, and AI workflows.
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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">Early partner offer</p>
            <h2 className="mt-3 text-2xl font-black">First 10 partners can request a free 30-day beta listing.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Launch pricing stays low while ReviewIntel grows traffic and proof. Sponsored placements are manually reviewed and clearly labeled.
            </p>
          </aside>
        </div>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          {placementOptions.map((option) => (
            <article key={option.name} className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{option.name}</p>
              <p className="mt-3 text-3xl font-black">{option.price}</p>
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
          <Badge tone="neutral">Sponsored, not endorsed</Badge>
          <h2 className="mt-4 text-2xl font-black">Clear labels. No fake partnerships.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Sponsored resources are paid placements or partner listings. ReviewIntel does not automatically endorse, guarantee, or certify the products shown. Every sponsored resource must remain relevant, transparent, and clearly labeled.
          </p>
        </section>
      </section>
    </main>
  );
}
