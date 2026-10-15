"use client";

import { useState } from "react";

type WatchProductButtonProps = {
  listingUrl: string;
  productName?: string;
  verdict?: string;
  className?: string;
};

type ButtonState = "idle" | "saving" | "watching" | "signin" | "error" | "hidden";

/**
 * "Watch this product" — signed-in only, fail-soft.
 *
 * POSTs to /api/product-watches (the server enforces sign-in and the
 * REVIEWINTEL_WATCH_ALERTS feature flag). Client states:
 *  - 401 → shows a sign-in prompt instead of the button
 *  - 404 (feature off) → hides itself entirely
 *  - network/API error → a quiet, retryable error line; the results page
 *    is never blocked by this button.
 */
export function WatchProductButton({
  listingUrl,
  productName,
  verdict,
  className,
}: WatchProductButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [error, setError] = useState("");

  if (state === "hidden" || !listingUrl) return null;

  async function watch() {
    setState("saving");
    setError("");
    try {
      const response = await fetch("/api/product-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          listingUrl,
          productName: productName || undefined,
          verdict: verdict || undefined,
        }),
      });
      if (response.status === 401) {
        setState("signin");
        return;
      }
      if (response.status === 404) {
        setState("hidden");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Could not save the watch (${response.status}).`);
      }
      setState("watching");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the watch.");
      setState("error");
    }
  }

  if (state === "signin") {
    return (
      <p className={className ?? "text-sm text-slate-600 dark:text-slate-300"}>
        <a href="/login" className="font-black text-ocean underline dark:text-cyan-300">
          Sign in
        </a>{" "}
        to watch this product and get an email when its verdict changes.
      </p>
    );
  }

  if (state === "watching") {
    return (
      <p
        className={className ?? "text-sm font-bold text-teal-700 dark:text-teal-300"}
        role="status"
      >
        ✓ Watching — we&apos;ll email you once if its rating or verdict meaningfully
        changes. No spam, ever.
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void watch()}
        disabled={state === "saving"}
        className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
      >
        {state === "saving" ? "Saving…" : "🔔 Watch this product"}
      </button>
      {state === "error" && error ? (
        <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          {error}{" "}
          <button type="button" onClick={() => void watch()} className="underline">
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
