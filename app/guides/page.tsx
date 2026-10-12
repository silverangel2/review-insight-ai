import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { formatGuideDate } from "@/components/GuideArticle";
import { loadCategoryGuides } from "@/lib/guideData";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical ReviewIntel guides on reading product reviews, plus category guides built only from real scanned buyer reviews."
};

export default async function GuidesPage() {
  const categoryGuides = await loadCategoryGuides();

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#172033,#2356a3_52%,#08b7a8)] p-8 text-white shadow-glow sm:p-10">
        <div className="ri-scan-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber">
            ReviewIntel Guides
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight">Guides</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            Practical, no-hype guides to reading product reviews like a pro — how to spot
            suspicious patterns, interpret star ratings, and check a product before you buy.
            Category pages below are built only from products ReviewIntel has scanned.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group flex flex-col rounded-3xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-300"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {formatGuideDate(guide.publishedAt)} · {guide.readingMinutes} min read
            </p>
            <h2 className="mt-3 text-xl font-black leading-7 text-ink transition group-hover:text-ocean dark:text-white dark:group-hover:text-cyan-300">
              {guide.title}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {guide.excerpt}
            </p>
            <span className="mt-5 text-sm font-black text-ocean dark:text-cyan-300">
              Read the guide →
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-14">
        <p className="inline-flex rounded-full bg-mint px-3 py-1 text-sm font-semibold text-teal">From real scans</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">What buyers reported, by category</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Each category guide is built only from products ReviewIntel has scanned. No paid placements and no made-up reviews.</p>
        {categoryGuides.length ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {categoryGuides.map(g => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="ri-lift block rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
                  <p className="text-lg font-semibold text-slate-900">{g.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{g.products.length} product{g.products.length === 1 ? "" : "s"} · {g.totalReviews} real reviews</p>
                  {g.thin ? <p className="mt-2 inline-flex rounded-full bg-butter px-2.5 py-0.5 text-xs font-semibold text-[#7a4a06]">Not enough data yet</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-8 rounded-2xl bg-butter p-5 text-sm text-slate-700">No category guides yet. They appear once enough products in a category have been scanned.</p>}
      </section>
    </main>
  );
}
