import type { Metadata } from "next";
import Link from "next/link";
import { planLabel, planPrice } from "@/lib/account";

export const metadata: Metadata = { title: "Seller plans", robots: { index: false } };

type Props = { searchParams: Promise<{ feature?: string }> };

const STARTER = ["Seller dashboard and review analysis from your CSV", "Complaint and praise themes from real reviews", "Exportable reports"];
const PRO = ["Everything in Starter", "Competitor compare from both products' real reviews", "Improvement calendar and journal", "Scan history and momentum tracking"];

function Plan({ name, price, items, highlight }: { name: string; price: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${highlight ? "bg-white ring-teal" : "bg-white ring-slate-900/10"}`}>
      <p className="text-sm font-semibold text-slate-900">{name}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{price}<span className="text-sm font-normal text-slate-500"> / month</span></p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {items.map(item => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-teal">✓</span>{item}</li>)}
      </ul>
    </div>
  );
}

export default async function SellerUpsellPage({ searchParams }: Props) {
  const compare = (await searchParams).feature === "compare";
  return (
    <main className="min-h-[70vh] bg-slate-50 px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-900/5 sm:p-10">
          <p className="text-sm font-semibold text-teal">{compare ? "Seller Pro feature" : "For sellers"}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900">
            {compare ? "Competitor compare is part of Seller Pro" : "Seller tools need a seller plan"}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            {compare
              ? "Compare your product with a competitor using both products' real written reviews: where you're ahead, where buyers hesitate, and what to fix first."
              : "You're signed in with a shopper account. Seller plans turn your own product reviews into complaint themes, fixes and reports."}
          </p>
          {compare ? (
            <div aria-hidden="true" className="relative mt-6 overflow-hidden rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-900/5">
              <div className="grid gap-3 opacity-40 blur-[2px] sm:grid-cols-2">
                <div className="h-20 rounded-xl bg-white" /><div className="h-20 rounded-xl bg-white" />
                <div className="h-28 rounded-xl bg-white sm:col-span-2" />
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-700">🔒 Locked on {planLabel("seller_premium")}</span>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/pricing" className="inline-flex rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-teal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
              {compare ? `Upgrade to ${planLabel("seller_pro")}` : "See seller plans"}
            </Link>
            <Link href={compare ? "/dashboard/seller" : "/analyze"} className="inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal">
              {compare ? "Back to seller dashboard" : "Back to shopping"}
            </Link>
          </div>
        </section>
        <section aria-label="Seller plans" className="mt-6 grid gap-4 sm:grid-cols-2">
          <Plan name={planLabel("seller_premium")} price={planPrice("seller_premium")} items={STARTER} />
          <Plan name={planLabel("seller_pro")} price={planPrice("seller_pro")} items={PRO} highlight />
        </section>
      </div>
    </main>
  );
}
