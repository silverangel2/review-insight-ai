"use client";

import { useEffect, useState } from "react";

type ReviewAskCtaProps = {
  scanId: string;
  productName?: string;
};

/**
 * Non-blocking in-results review ask: rendered once per scan, after the
 * results, linking to the community review form below (#community-reviews,
 * which includes the optional order-proof upload).
 *
 * - Dismissible permanently per scan (localStorage) — never blocks the
 *   results, never a series, never re-asks for the same scan.
 * - Copy is neutral and incentive-free: no rewards, no positivity steering
 *   (FTC / Competition Bureau + Amazon anti-manipulation rules).
 * - Feeds the existing PR #27 lane: community_reviews → Tier A
 *   (approved + purchase-verified) can enter the library corpus with
 *   provenance reviewintel_community; Tier B stays display-only.
 */
export function ReviewAskCta({ scanId, productName }: ReviewAskCtaProps) {
  const storageKey = `ri_review_ask_dismissed_${scanId}`;
  // Start hidden to avoid a flash; reveal in the effect when not dismissed.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(storageKey)) setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (!scanId || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable — still hide for this page view.
    }
    setDismissed(true);
  }

  function goToForm() {
    document
      .getElementById("community-reviews")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      aria-label="Share your experience"
      className="rounded-3xl border border-teal-200 bg-teal-50/70 p-5 shadow-soft dark:border-teal-300/20 dark:bg-teal-300/10 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
            Own this product?
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
            {productName ? (
              <>
                Bought <span className="text-ink dark:text-white">{productName}</span>?
                Your honest experience — good or bad — helps the next shopper decide.
              </>
            ) : (
              "Bought this product? Your honest experience — good or bad — helps the next shopper decide."
            )}{" "}
            Takes about a minute, and you can attach your order photo as proof.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={goToForm}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Share my experience
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss this invitation"
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-slate-500 transition hover:text-ink dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
