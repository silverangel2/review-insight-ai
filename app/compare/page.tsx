import { CompareForm } from "@/components/CompareForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata: Metadata = withSeo("/compare", { title: "Compare two products by their real reviews", description: "Put two products side by side and see which one real buyers were happier with, what they complained about, and how many reviews back each answer." }, { noindex: true });

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Product comparison</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-ink dark:text-white">Compare two products by review evidence</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          Compare two products with ReviewIntel. Use product screenshots, links, or available product feedback to compare buying risk, strengths, complaints, value, and shopper confidence.
        </p>
      </div>
      <p className="mb-6 text-sm text-slate-600">Already scanned both? <a href="/compare/side-by-side" className="font-semibold text-teal underline underline-offset-2">Compare two saved scans side by side</a>.</p>
      <CompareForm />
    </main>
  );
}
