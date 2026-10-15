/**
 * HeroProofCard — the homepage's proof card: a REAL result, rendered from the
 * verified live numbers (AirPods 4 guest scan: Buy, 87/100, 4.4/5 from 2,345
 * ratings) and the Junel-approved decision-brief factor language.
 * Static-but-real: no fetching, no invented stats, no placeholders.
 */
const FOR = [
  {
    title: "Comfortable, lightweight fit",
    summary:
      "Buyers return to this more than any other point: they stay light and comfortable through everyday wear. It's the strongest pattern in the reviews, with only isolated notes that the fit feels less secure for some ears.",
    basis: "Pattern across most reviews",
  },
  {
    title: "Clear sound, instant pairing",
    summary:
      "Buyer after buyer mentions this as well: the sound comes through clear, and iPhone owners say they connect almost immediately, every time. It's one of the strongest patterns in the reviews.",
    basis: "Pattern across most reviews",
  },
  {
    title: "Worth the price",
    summary:
      "This comes through as well: buyers feel the quality matches the cost. It's mentioned by buyer after buyer.",
    basis: "Repeated across reviews",
  },
];

const AGAINST = [
  {
    title: "Fit isn't secure for everyone",
    summary: "One buyer flagged the fit as not secure enough in the ear — fit varies by ear shape.",
    basis: "One buyer reported this",
  },
  {
    title: "Watch the seller, not just the product",
    summary:
      "There is one red flag: one buyer believed the unit received wasn't genuine. The product reviews are strong — but buy from a seller you trust.",
    basis: "One buyer reported this",
  },
];

export function HeroProofCard() {
  return (
    <div className="ri-card ri-hairline ri-reveal p-5 text-left sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Apple AirPods 4 Wireless</p>
        <p className="shrink-0 text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
          Buy · 87/100
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-amber-500" aria-hidden="true">
          ★★★★<span className="text-slate-300 dark:text-slate-600">☆</span>
        </span>
        <span className="font-semibold text-ink dark:text-white">4.4 / 5</span>
        <span className="text-slate-400">from 2,345 ratings</span>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/10">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          Why you&apos;d buy it
        </p>
        <ul className="mt-2 space-y-2.5">
          {FOR.map((f) => (
            <li key={f.title}>
              <p className="text-[14px] font-bold text-ink dark:text-white">
                <span className="mr-1.5 text-emerald-600 dark:text-emerald-400">✓</span>
                {f.title}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-6 text-slate-600 dark:text-slate-300">
                {f.summary}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          Why you might not
        </p>
        <ul className="mt-2 space-y-2.5">
          {AGAINST.map((f) => (
            <li key={f.title}>
              <p className="text-[14px] font-bold text-ink dark:text-white">
                <span className="mr-1.5 text-amber-600 dark:text-amber-400">!</span>
                {f.title}
              </p>
              <p className="mt-0.5 text-[13.5px] leading-6 text-slate-600 dark:text-slate-300">
                {f.summary}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
