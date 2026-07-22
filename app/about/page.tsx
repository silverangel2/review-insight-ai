import Link from "next/link";
import { Badge } from "@/components/Badge";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Badge tone="info">About</Badge>
      <h1 className="mt-5 text-4xl font-black tracking-tight text-ink dark:text-white">ReviewIntel is built for clearer review-driven decisions.</h1>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <h2 className="text-xl font-black text-ink dark:text-white">Customer goal</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Shoppers get a fast read on quality, complaints, praised features, value, and buying risk without reading pages of reviews.
          </p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <h2 className="text-xl font-black text-ink dark:text-white">Seller goal</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Sellers get product improvement signals, listing fixes, packaging issues, refund-risk themes, and competitor openings.
          </p>
        </article>
      </div>
      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black text-ink dark:text-white">Product boundary</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          ReviewIntel helps shoppers make faster buying decisions from a product screenshot or product link. It reads visible product details, checks public review signals when available, and summarizes complaints, ratings, value, and AI-like review patterns into a simple BUY, CONSIDER, or AVOID verdict.
        </p>
      </section>
      <Link href="/analyze" className="mt-8 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
        Open Analyzer
      </Link>
    </main>
  );
}
