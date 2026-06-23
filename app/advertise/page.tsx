import Link from "next/link";
import { Badge } from "@/components/Badge";
import { adPackages } from "@/lib/adConfig";

const adPlans = Object.values(adPackages);

export default function AdvertisePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <Badge tone="warn">Partner with ReviewIntel</Badge>
      <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-ink">
        Run clean sponsored campaigns inside ReviewIntel.
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        Advertisers submit an application first. ReviewIntel reviews the brand, placement, and creative before payment is requested.
        After approval, ReviewIntel sends the payment step and activates the campaign only after payment and creative review.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/advertise/apply"
          className="rounded-xl bg-ocean px-6 py-3 text-sm font-black text-white shadow-soft transition hover:bg-ink"
        >
          Apply for ads
        </Link>
        <a
          href="#ad-packages"
          className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean"
        >
          View ad packages
        </a>
      </div>

      <div id="ad-packages" className="mt-10 grid gap-5 md:grid-cols-2">
        {adPlans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <Badge tone={plan.id === "featured_monthly" ? "good" : "info"}>
              {plan.id === "featured_monthly" ? "Featured" : "Sponsored"}
            </Badge>
            <h2 className="mt-5 text-2xl font-black text-ink">{plan.name}</h2>
            <p className="mt-4 text-4xl font-black text-ocean">{plan.price}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="rounded-xl border border-line px-3 py-2">
                {plan.dailyImpressionCap.toLocaleString()} daily impression cap
              </li>
              <li className="rounded-xl border border-line px-3 py-2">
                {plan.durationDays}-day campaign window
              </li>
              <li className="rounded-xl border border-line px-3 py-2">
                Image or short muted video creative
              </li>
              <li className="rounded-xl border border-line px-3 py-2">
                Manual payment verification and creative approval
              </li>
            </ul>
            <a
              href={plan.stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full justify-center rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean"
            >
              Pay for {plan.name}
            </a>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-black text-ink">How campaign approval works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[
            "Pay for a package",
            "Upload banner or video",
            "ReviewIntel verifies payment",
            "Approved ads rotate automatically"
          ].map((item, index) => (
            <div key={item} className="rounded-2xl border border-line bg-mist p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Step {index + 1}</p>
              <p className="mt-2 text-sm font-black text-ink">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/advertise/apply" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean">
            Upload campaign
          </Link>
          <Link href="/contact" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean">
            Contact before paying
          </Link>
          <Link href="/refunds" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean">
            Refund policy
          </Link>
        </div>
      </section>
    </main>
  );
}
