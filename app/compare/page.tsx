import { CompareForm } from "@/components/CompareForm";

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Product comparison</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-ink dark:text-white">Compare two products by review evidence</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          Paste reviews for two products and ReviewIntel will compare shopper risk, praise, complaints, sentiment, and seller opportunities.
        </p>
      </div>
      <CompareForm />
    </main>
  );
}
