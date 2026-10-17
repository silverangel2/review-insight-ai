/**
 * HeroProofCard — the homepage's proof card: a REAL result, rendered from the
 * verified live numbers (AirPods 4 guest scan: Buy, 87/100, 4.4/5 from 2,345
 * ratings) and the findings-engine factor language (regenerated 2026-10-17
 * from the AirPods corpus in findings-bullet format).
 * Static-but-real: no fetching, no invented stats, no placeholders.
 */
const FOR = [
  {
    title: "Clear sound quality",
    summary: "Buyers praise it — mentioned in 19 of 62 reviews.",
    basis: "19 of 62 reviews",
  },
  {
    title: "Strong battery life",
    summary: "Buyers praise it — up to 30 hours, mentioned in 8 of 62 reviews.",
    basis: "8 of 62 reviews",
  },
  {
    title: "Pairing and connectivity",
    summary: "Buyers praise it — mentioned in 8 of 62 reviews.",
    basis: "8 of 62 reviews",
  },
];

const AGAINST = [
  {
    title: "Fit problems",
    summary: "Buyers flag it — mentioned in 6 of 62 reviews.",
    basis: "6 of 62 reviews",
  },
  {
    title: "Fit isn't secure for everyone",
    summary: "Buyers flag it — mentioned in 2 of 62 reviews.",
    basis: "2 of 62 reviews",
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
