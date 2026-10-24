"use client";

import Link from "next/link";
import { useState } from "react";
import { deriveShopperAnswer, formatShopperConfidence, isSpecificShopperFinding, marketplaceAggregateForDisplay, unreadableRetryPhrase, type ShopperPoint } from "@/lib/shopperAnswer";
import { CountUp } from "./motion/CountUp";
import { INDEPENDENCE_STATEMENT } from "@/lib/trustContent";

const TONE = {
  buy: { chip: "bg-emerald-700 text-white", ring: "ring-emerald-700/20" },
  wait: { chip: "bg-[#fdf0d5] text-[#7a4a06]", ring: "ring-amber-500/20" },
  skip: { chip: "bg-rose-700 text-white", ring: "ring-rose-700/20" },
  not_enough: { chip: "bg-slate-100 text-slate-700", ring: "ring-slate-900/5" },
} as const;

function PointList({ title, points, empty, tint = "bg-white" }: { title: string; points: ShopperPoint[]; empty: string; tint?: string }) {
  const shown = points.filter((point) => point.finding && isSpecificShopperFinding(point.finding));
  return (
    <section className={`rounded-3xl ${tint} p-5 ring-1 ring-slate-900/5 sm:p-6`}>
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      {shown.length ? (
        <ul className="mt-4 space-y-5">
          {shown.map(point => (
            <li key={point.claim}>
              <p className="font-semibold text-slate-900">{point.finding}</p>
              {point.sourceHost ? (
                <p className="mt-1 text-xs text-slate-400">
                  {point.sourceUrl ? <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">{point.sourceHost}</a> : point.sourceHost}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

function ScreenshotUpload({ productName }: { productName: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setBusy(true); setStatus("Reading your screenshots…");
    try {
      const form = new FormData();
      form.append("productName", productName);
      files.slice(0, 5).forEach(file => form.append("screenshots", file));
      const response = await fetch("/api/review-screenshot", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setStatus(data?.error || "We couldn't read those screenshots."); return; }
      const accepted = (data?.results || []).reduce((sum: number, item: { accepted?: unknown[] }) => sum + (item.accepted?.length || 0), 0);
      setStatus(accepted ? "We found real reviews of this product in your screenshots." : "We read the screenshots but found no reviews we could verify for this exact product.");
    } catch { setStatus("Upload failed. Please try again."); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
    <label className="ri-lift inline-flex cursor-pointer items-center rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal/90">
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={onChange} disabled={busy} />
      {busy ? "Reading…" : "Upload screenshots"}
    </label>
    {status ? <p className="mt-2 text-sm text-slate-600" role="status">{status}</p> : null}
    </div>
  );
}

export function ShopperAnswerCard({ result, productName }: { result: unknown; productName: string }) {
  const answer = deriveShopperAnswer(result);
  const tone = TONE[answer.kind];
  const aggregate = marketplaceAggregateForDisplay(result);
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="shopper-answer">
      <section className={`rounded-[2rem] bg-white p-6 ring-1 ${tone.ring} sm:p-10`}>
        <p className="text-sm text-slate-500">Our answer</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`ri-reveal rounded-full px-5 py-2 text-2xl font-bold tracking-tight sm:text-3xl ${tone.chip}`}>{answer.label}</span>
          {answer.score !== null ? <span className="text-sm text-slate-500">Score <CountUp value={answer.score} decimals={0} /> / 100</span> : null}
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-800 sm:text-xl" data-testid={answer.unreadable ? "unreadable-amazon-page" : undefined}>{answer.why}</p>
        {answer.unreadable ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">{unreadableRetryPhrase(result)} Add a screenshot of the product page if a retry still cannot read it.</p>
        ) : (
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
          <div><dt className="text-slate-500">How sure we are</dt><dd className="mt-1 font-semibold text-slate-900" data-testid="answer-confidence">{formatShopperConfidence(answer)}</dd></div>
          {/* Satisfaction pass: no fact row without a computable value — no dashes, no "Unknown". */}
          {answer.value !== "Unknown" ? (
            <div><dt className="text-slate-500">Value for money</dt><dd className="mt-1 font-semibold text-slate-900">{answer.value}</dd></div>
          ) : null}
          {aggregate.rating ? (
            <div><dt className="text-slate-500">Marketplace rating</dt><dd className="mt-1 font-semibold text-slate-900" data-testid="answer-marketplace-rating">{aggregate.rating}</dd></div>
          ) : null}
        </dl>
        )}
        {answer.unreadable ? null : <p className="mt-5 text-sm text-slate-500">{answer.trustLine}</p>}
        <p className="mt-2 text-xs leading-5 text-slate-500" data-testid="independence-note">
          {INDEPENDENCE_STATEMENT}{" "}
          <a href="/affiliate-disclosure" className="underline underline-offset-2 hover:text-teal">Affiliate disclosure</a> · <a href="/terms" className="underline underline-offset-2 hover:text-teal">Terms</a> · <a href="/privacy" className="underline underline-offset-2 hover:text-teal">Privacy</a>
        </p>
      </section>

      {answer.unreadable || (answer.reviewCount === 0 && answer.loves.length === 0 && answer.complaints.length === 0) ? null : (
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <PointList title="What buyers love" points={answer.loves} empty="Nothing specific to praise in the reviews we read." tint="bg-mint" />
        <PointList title="What buyers complain about" points={answer.complaints} empty="Nothing specific to warn about in the reviews we read." tint="bg-peach" />
      </div>
      )}

      {answer.nextSteps.length ? (
        <section className="rounded-3xl bg-butter p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-900">{answer.kind === "not_enough" ? "A clear next step" : "Want a stronger answer?"}</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {answer.nextSteps.map(step => (
              <li key={step.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
                <p className="font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                {step.id === "screenshots" ? <ScreenshotUpload productName={productName} /> : (
                  <Link href={step.href || "/analyze"} className="mt-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
