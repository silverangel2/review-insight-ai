"use client";

import { useState } from "react";

/**
 * Guest opt-in for the rescue verdict. Shown on the result page when a scan
 * ends with no verdict (insufficient review evidence): a human on the team
 * will research the product and email the shopper their verdict.
 *
 * Verdict-purpose ONLY: the email address is used for one service email
 * (the researched verdict) and is never added to marketing.
 */

type Props = {
  scanRef?: string | null;
  productName?: string | null;
  productUrl?: string | null;
  productKey?: string | null;
};

export function RescueEmailCapture({ scanRef, productName, productUrl, productKey }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending" || status === "done") return;
    setStatus("sending");
    setErrorMessage("");
    try {
      const res = await fetch("/api/rescue-subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          scanRef: scanRef ?? null,
          productName: productName ?? null,
          productUrl: productUrl ?? null,
          productKey: productKey ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setStatus("error");
        setErrorMessage(
          typeof data?.error === "string" && data.error
            ? data.error
            : "Something went wrong. Please try again."
        );
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <section
      id="rescue-verdict-request"
      className="mt-6 rounded-[1.4rem] border border-sky-200 bg-sky-50 p-5 shadow-soft sm:p-6 dark:border-sky-300/20 dark:bg-sky-900/20"
    >
      <h2 className="text-lg font-black text-ink dark:text-white">Want a personal verdict?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        We couldn&apos;t score this product from the reviews available. Leave your email and a
        human on our team will research it and send you the verdict — usually within a day.
      </p>
      {status === "done" ? (
        <p data-testid="rescue-subscribed" className="mt-4 text-sm font-black text-emerald-700 dark:text-emerald-300">
          You&apos;re on the list — we&apos;ll email you the verdict once we&apos;ve researched this product.
        </p>
      ) : (
        <form onSubmit={(event) => void subscribe(event)} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="rescue-email" className="sr-only">
            Email address
          </label>
          <input
            id="rescue-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:opacity-50 dark:bg-white dark:text-ink"
          >
            {status === "sending" ? "Saving…" : "Email me the verdict"}
          </button>
        </form>
      )}
      {status === "error" ? (
        <p className="mt-3 text-sm font-bold text-red-700 dark:text-red-300">{errorMessage}</p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        One email with your verdict — nothing else. We never add rescue emails to marketing lists.
      </p>
    </section>
  );
}
