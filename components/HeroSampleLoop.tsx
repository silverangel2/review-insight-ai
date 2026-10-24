/**
 * HeroSampleLoop — the hero's working product moment (homepage overhaul,
 * 2026-10-23). A calm 8-second CSS-only loop in three beats:
 *   (a) a product screenshot card arrives,
 *   (b) a quiet "Reading buyers…" state with shimmering buyer lines,
 *   (c) the sample verdict card lands.
 * The stage is fixed-height (set by the parent grid) so the page never
 * shifts while it plays. Under prefers-reduced-motion the loop does not
 * run and beat (c) sits as a still frame (app/theme.css, ri-hero-*).
 *
 * The sample is the SAME product and verdict as the "What you get" card
 * further down the page (wireless earbuds, BUY 82) and is labelled
 * "Sample result" — it is a product demonstration, not a live scan.
 * Decorative: aria-hidden, because the same story is told in real text
 * by the sample verdict section below.
 */
export function HeroSampleLoop() {
  return (
    <div className="ri-hero-stage h-[332px] lg:h-auto lg:min-h-[380px]" aria-hidden="true">
      {/* Beat (a): the screenshot arrives */}
      <div className="ri-hero-beat ri-hero-beat-a">
        <div className="w-[min(320px,88%)] rounded-[18px] border border-[#e2e8f0] bg-white p-4 shadow-[0_14px_34px_rgba(23,32,51,0.10)] dark:border-white/10 dark:bg-[#171824]">
          <div className="flex h-[104px] items-end rounded-xl bg-[linear-gradient(140deg,#dbeafe,#ede9fe)] p-2.5 text-xs font-semibold text-slate-500">
            Product photo
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <b className="text-[16.5px] text-ink dark:text-white">Wireless earbuds</b>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">$49.99</span>
          </div>
          <div className="mt-1 text-[13px] tracking-[2px] text-[#5b3df0]">
            ★★★★☆
            <span className="ml-1.5 text-[12.5px] tracking-normal text-slate-500 dark:text-slate-400">
              2,300 buyer reviews
            </span>
          </div>
          <div className="mt-3 border-t border-[#e2e8f0] pt-2.5 text-[13px] leading-5 text-slate-600 dark:border-white/10 dark:text-slate-300">
            <span className="text-[11px] tracking-[2px] text-[#5b3df0]">★★★★★</span>
            <br />
            &ldquo;Battery easily lasts my whole work week&hellip;&rdquo;
          </div>
        </div>
      </div>

      {/* Beat (b): reading the buyers */}
      <div className="ri-hero-beat ri-hero-beat-b">
        <div className="w-[min(340px,88%)]">
          <p className="text-center text-[17px] font-bold text-ink dark:text-white">
            Reading buyers
            <span className="ri-hero-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
          {["82%", "64%", "74%"].map((width) => (
            <div key={width} className="mt-4 flex items-center gap-2.5">
              <span className="size-[26px] flex-none rounded-full bg-[#e0e7ff] dark:bg-[#2b2a4a]" />
              <span className="ri-hero-shimmer h-3 rounded-md" style={{ width }} />
            </div>
          ))}
        </div>
      </div>

      {/* Beat (c): the verdict lands */}
      <div className="ri-hero-beat ri-hero-beat-c">
        <div className="w-[min(360px,92%)] rounded-[20px] border border-[#e2e8f0] bg-white p-[22px] shadow-[0_14px_34px_rgba(23,32,51,0.10)] dark:border-white/10 dark:bg-[#171824]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[linear-gradient(92deg,#0a6cff,#5b3df0)] px-[18px] py-2 text-[15px] font-extrabold tracking-[0.04em] text-white">
              BUY
            </span>
            <span className="text-[22px] font-extrabold text-ink dark:text-white">82 / 100</span>
            <span className="rounded-full border border-[#e2e8f0] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:border-white/15 dark:text-slate-400">
              Sample result
            </span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-ink dark:text-white">
            Wireless earbuds — what 2,300 buyers said
          </h3>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-slate-600 dark:text-slate-300">
            <b className="text-ink dark:text-white">Buyers liked:</b> battery life and fit come up
            again and again.
          </p>
        </div>
      </div>
    </div>
  );
}
