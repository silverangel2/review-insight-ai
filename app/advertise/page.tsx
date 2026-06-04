import Link from "next/link";
import { Badge } from "@/components/Badge";

const adPlans = [
  {
    name: "Sponsored Resource Placement",
    price: "$49.99 CAD / month",
    href: "https://buy.stripe.com/3cI9ATccE6li7qo1Bmgfu05",
    description: "Standard sponsored placement for ecommerce tools, seller resources, business offers, or product services relevant to ReviewIntel users.",
    features: ["Sponsored resource listing", "Manual review before publishing", "Good for early visibility", "Best for smaller campaigns"]
  },
  {
    name: "Featured Sponsored Resource",
    price: "$99.99 CAD / month",
    href: "https://buy.stripe.com/9B63cv1y02524ec1Bmgfu04",
    description: "Higher-visibility sponsored placement for businesses that want stronger exposure inside ReviewIntel.",
    features: ["Featured placement", "Higher visibility", "Manual review before publishing", "Best for premium campaigns"]
  }
];

export default function AdvertisePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <Badge tone="warn">Advertise with ReviewIntel</Badge>
      <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-ink dark:text-white">
        Feature your ecommerce tool, product service, or seller resource.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
        Sponsored placements are manually reviewed during launch. After payment, we will contact you by email to collect your logo, link, description, and placement details.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {adPlans.map((plan) => (
          <article key={plan.name} className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <Badge tone={plan.name.includes("Featured") ? "good" : "info"}>
              {plan.name.includes("Featured") ? "Featured" : "Sponsored"}
            </Badge>
            <h2 className="mt-5 text-2xl font-black text-ink dark:text-white">{plan.name}</h2>
            <p className="mt-4 text-4xl font-black text-ocean dark:text-cyan-300">{plan.price}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature} className="rounded-xl border border-line px-3 py-2 dark:border-white/10">
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href={plan.href}
              className="mt-6 inline-flex w-full justify-center rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Pay for {plan.name}
            </a>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-2xl font-black text-ink dark:text-white">What happens after payment?</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          We manually review each sponsored resource before publishing. We may reject irrelevant, unsafe, misleading, or low-quality placements and issue a refund when appropriate.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/contact" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
            Contact before paying
          </Link>
          <Link href="/refunds" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
            Refund policy
          </Link>
        </div>
      </section>
    </main>
  );
}
