"use client";

import { useState } from "react";

const SCAN_STORAGE_KEYWORDS = [
  "reviewintel_latest_result",
  "reviewintel:last-result",
  "reviewintel:last-preview",
  "reviewintel_result_history",
  "reviewintel_shopper_history",
  "reviewintel_scan_history",
  "reviewintel_recent_scans",
  "reviewintel_shopper_result_history",
  "reviewintel_seller_result_history",
  "reviewintel_seller_journal",
  "reviewintel_seller_products",
  "reviewintel_product_scans",
  "reviewintel_compare_history",
  "reviewintel_last_result",
];

type ClearScanDataButtonProps = {
  label?: string;
  tone?: "danger" | "quiet";
};

export function ClearScanDataButton({
  label = "Clear all scan history",
  tone = "danger",
}: ClearScanDataButtonProps) {
  const [cleared, setCleared] = useState(false);

  const clearScans = () => {
    const confirmed = window.confirm(
      "Clear all saved scan history from this browser? This cannot be undone."
    );

    if (!confirmed) return;

    const keys = Object.keys(window.localStorage);

    for (const key of keys) {
      const lowerKey = key.toLowerCase();

      if (SCAN_STORAGE_KEYWORDS.some((keyword) => lowerKey.includes(keyword))) {
        window.localStorage.removeItem(key);
      }
    }

    setCleared(true);
    window.dispatchEvent(new Event("storage"));
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={clearScans}
      className={
        tone === "danger"
          ? "rounded-xl bg-coral px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-ink"
          : "rounded-xl border border-line px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-slate-300"
      }
    >
      {cleared ? "Cleared" : label}
    </button>
  );
}
