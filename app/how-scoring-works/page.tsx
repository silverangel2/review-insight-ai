import Link from "next/link";
import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";

export const metadata: Metadata = withSeo("/how-scoring-works", {
  title: "How scoring works | ReviewIntel",
  description:
    "Plain-language explainer: what the Buying Score (0–100) means, how it is built from real written buyer reviews, what review authenticity means, and what the Buy, Wait and Skip verdicts mean."
});

const verdicts = [
  {
    word: "Buy",
    meaning: "The written reviews are mostly strong and we read enough of them to trust the picture.",
    style: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
  },
  {
    word: "Wait",
    meaning: "The picture is mixed, or too few reviews were readable to be sure. Check the details before you buy.",
    style: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
  },
  {
    word: "Skip",
    meaning: "The reviews show real problems — serious complaints, a low score, or too many warning signs.",
    style: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
  }
];

export default function HowScoringWorksPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-8 shadow-soft dark:border-white/10 dark:bg-gradient-to-r dark:from-indigo-950 dark:via-indigo-900 dark:to-violet-950 md:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.08] via-indigo-400/[0.04] to-violet-500/[0.10]"
        />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            How scoring works
          </p>
          <h1 className="mt-4 max-w-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent md:text-5xl">
            One score. Built from what buyers actually wrote.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
            Every scan ends with a Buying Score and a one-word verdict. This page explains, in plain
            language, where both come from and what they mean for your decision.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">What the Buying Score means</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          The Buying Score runs from 0 to 100. It is our read of whether this product is worth your
          money, built from reviews — not from the star rating alone. A higher score means the reviews
          paint a stronger picture; a lower score means they point to real problems.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Most of the score comes from written reviews — what people actually typed — with the public
          star rating and review count supporting it. If we could not read enough written reviews, the
          score says so openly instead of pretending to be sure.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">Built from real written reviews</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          We look for patterns across many buyers: the themes that keep coming up in written reviews,
          grouped into reasons to buy and reasons not to. Then we summarize the whole picture in our
          own words — you get the analysis, not a wall of copied review quotes.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Complaints are never hidden. If even one review reports something serious — a safety issue,
          a product that arrived broken or not genuine — it gets named at its true size.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">Complaints weigh more than praise</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Written reviews can lower the score much more than they can raise it — on purpose. Every
          repeated complaint pulls the score down harder than each repeated strength lifts it. That is
          because one bad experience tells you more about the risk of a product than one happy
          experience tells you it is safe.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">What &ldquo;Review authenticity&rdquo; means</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          The Review authenticity grade is our read of whether the written reviews look naturally
          written. It looks for AI-like signs — writing patterns a person would not normally produce:
          repetition across reviews from supposedly different buyers, template-style sentences, and
          unnaturally uniform wording.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          This is a grade of signs, not an accusation. It never claims a review is fake or points at a
          person — it simply says how strong the pattern of suspicious signs is. A strong pattern can
          pull the score down, and a very strong pattern keeps a scan from ever earning a Buy.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">The three verdict words</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          The Buying Score decides the verdict word you see on the answer card. There are only three:
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {verdicts.map((v) => (
            <div key={v.word} className={`rounded-2xl border p-5 ${v.style}`}>
              <p className="text-lg font-black">{v.word}</p>
              <p className="mt-2 text-sm leading-6">{v.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04] md:p-8">
        <h2 className="text-2xl font-black text-ink dark:text-white">Try it free</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          You get 3 free scans a day, with no sign-in needed. Run one and see the Buying Score,
          the verdict, and the review analysis behind it — now you will know exactly what you are
          reading.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/analyze"
            className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-soft transition hover:bg-indigo-500"
          >
            Run a free scan
          </Link>
          <Link
            href="/faq"
            className="inline-flex rounded-xl border border-line bg-white px-6 py-3 text-sm font-black text-ink transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:text-white"
          >
            Read the FAQ
          </Link>
        </div>
      </section>
    </main>
  );
}
