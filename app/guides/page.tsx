import type { Metadata } from "next";
import Link from "next/link";
import { loadCategoryGuides } from "@/lib/guideData";

export const metadata: Metadata = { title: "Buying guides from real buyer reviews", description: "Category guides built only from ReviewIntel scans of real written buyer reviews." };

export default async function GuidesIndex() {
  const guides = await loadCategoryGuides();
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <p className="inline-flex rounded-full bg-mint px-3 py-1 text-sm font-semibold text-teal">Guides</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">What buyers reported, by category</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Each guide is built only from products ReviewIntel has scanned. No paid placements and no made-up reviews.</p>
      {guides.length ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {guides.map(g => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="ri-lift block rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
                <p className="text-lg font-semibold text-slate-900">{g.name}</p>
                <p className="mt-1 text-sm text-slate-600">{g.products.length} product{g.products.length === 1 ? "" : "s"} · {g.totalReviews} real reviews</p>
                {g.thin ? <p className="mt-2 inline-flex rounded-full bg-butter px-2.5 py-0.5 text-xs font-semibold text-[#7a4a06]">Not enough data yet</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="mt-8 rounded-2xl bg-butter p-5 text-sm text-slate-700">No guides yet. Guides appear once enough products in a category have been scanned.</p>}
    </main>
  );
}
