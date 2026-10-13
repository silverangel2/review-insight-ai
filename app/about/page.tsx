import Link from "next/link";
import { Badge } from "@/components/Badge";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Badge tone="info">About</Badge>
      <h1 className="mt-5 text-4xl font-black tracking-tight text-ink dark:text-white">ReviewIntel is built for clearer review-driven decisions.</h1>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black text-ink dark:text-white">Mission</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Online reviews stopped being simple years ago. Star ratings get gamed, genuinely helpful reviews drown under thousands of one-liners, and the complaints that actually matter — the ones that predict a return — hide inside review text nobody has time to read. ReviewIntel exists for one job: make review-driven decisions clearer.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          For shoppers, that means knowing whether to buy before the return window starts. For sellers, that means seeing what customers keep complaining about before the rating drops. We don&rsquo;t sell reviews and we don&rsquo;t edit them — we read them at a scale no human can, and say what they mean in plain language.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black text-ink dark:text-white">How it works</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-base font-black text-ink dark:text-white">Shopper scans</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Paste a product link, upload a screenshot of a listing, or import a TXT or CSV of reviews. ReviewIntel reads the review language, maps rating patterns, groups repeated complaint themes, checks value signals against the price, and flags fake-review risk indicators. The result is a BUY, REVIEW FIRST, or AVOID verdict with the risk signals, complaint patterns, and best-for match behind it — plus a confidence level so you know how much weight to give it.
            </p>
          </div>
          <div>
            <h3 className="text-base font-black text-ink dark:text-white">Seller intelligence</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Sellers scan their own products and their competitors&rsquo;. Reviews get clustered into complaint themes — sizing surprises, packaging damage, missing parts — alongside sentiment trends and the praise phrases buyers repeat. That&rsquo;s the improvement signal: what to fix in the product, what to clarify in the listing, and where competitors are vulnerable.
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Every scan follows the same honest pipeline. We look at what people wrote (recurring phrases and complaint wording), how ratings distribute (whether five-star and one-star reviews disagree), which themes repeat across many reviewers, whether the described quality matches the price, and whether any reviews look inauthentic or incentivized. Nothing more exotic than that — the value is in reading everything instead of skimming.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black text-ink dark:text-white">Honest boundaries</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          ReviewIntel is decision support, not a guarantee. It estimates buying risk from the reviews you provide — it can&rsquo;t verify manufacturing quality, can&rsquo;t see reviews you didn&rsquo;t include, and can&rsquo;t predict your experience. A verdict built on ten reviews is weaker than one built on ten thousand, which is why every scan carries a confidence indicator.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Sellers should treat complaint clusters as a starting point for investigation, not proof of a defect — pair them with your own returns and support data before spending on fixes. Risk estimation is what we do; proof is something we never claim.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black text-ink dark:text-white">Who it&rsquo;s for</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-base font-black text-ink dark:text-white">Shoppers</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Anyone who buys online and is tired of gambling on review sections. If a purchase matters — electronics, gear, anything with a return hassle — a scan tells you what the reviews are actually saying before you commit. Visitors get 3 free scans with no sign-in.
            </p>
          </div>
          <div>
            <h3 className="text-base font-black text-ink dark:text-white">Sellers</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Brands and store owners who want review-driven product and listing improvements without hiring an analyst. Point scans at your catalog and your competitors&rsquo;, and let the complaint patterns tell you where the next rating drop is coming from.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/analyze" className="inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Open Analyzer
        </Link>
        <Link href="/contact" className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:text-white">
          Contact
        </Link>
        <Link href="/guides" className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:text-white">
          Guides
        </Link>
      </div>
    </main>
  );
}
