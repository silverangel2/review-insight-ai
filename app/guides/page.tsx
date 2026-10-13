import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { formatGuideDate } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical ReviewIntel guides on reading product reviews like a pro: spotting fake reviews, understanding star ratings, and checking products before you buy."
};

export default function GuidesPage() {
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
            New guides are added regularly.
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
    </main>
  );
}
