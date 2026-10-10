"use client";

import Link from "next/link";
import { useState } from "react";
import { deriveShopperAnswer, type ShopperPoint } from "@/lib/shopperAnswer";

const TONE = {
  buy: { chip: "bg-teal text-white", ring: "ring-teal/20" },
  wait: { chip: "bg-slate-900 text-white", ring: "ring-slate-900/10" },
  skip: { chip: "bg-slate-900 text-white", ring: "ring-slate-900/10" },
  not_enough: { chip: "bg-slate-100 text-slate-700", ring: "ring-slate-900/5" },
} as const;

function PointList({ title, points, empty }: { title: string; points: ShopperPoint[]; empty: string }) {
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-900/5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
      {points.length ? (
        <ul className="mt-4 space-y-5">
          {points.map(point => (
            <li key={point.claim}>
              <p className="font-semibold text-slate-900">
                {point.claim.charAt(0).toUpperCase() + point.claim.slice(1)}
                <span className="ml-2 text-xs font-normal text-slate-400">{point.count} review{point.count === 1 ? "" : "s"}</span>
              </p>
              {point.quote ? (
                <blockquote className="mt-2 border-l-2 border-teal pl-3 text-sm leading-6 text-slate-600">
                  “{point.quote}”
                  {point.sourceHost ? (
                    <span className="mt-1 block text-xs text-slate-400">
                      {point.sourceUrl ? <a href={point.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">{point.sourceHost}</a> : point.sourceHost}
                    </span>
                  ) : null}
                </blockquote>
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
      setStatus(accepted ? `We found ${accepted} real review${accepted === 1 ? "" : "s"} of this product in your screenshots.` : "We read the screenshots but found no reviews we could verify for this exact product.");
    } catch { setStatus("Upload failed. Please try again."); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
    <label className="inline-flex cursor-pointer items-center rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal/90">
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
  return (
    <div className="space-y-4 sm:space-y-6" data-testid="shopper-answer">
      <section className={`rounded-[2rem] bg-white p-6 ring-1 ${tone.ring} sm:p-10`}>
        <p className="text-sm text-slate-500">Our answer</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-5 py-2 text-2xl font-bold tracking-tight sm:text-3xl ${tone.chip}`}>{answer.label}</span>
          {answer.score !== null ? <span className="text-sm text-slate-500">Score {answer.score.toFixed(1)} / 10</span> : null}
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-800 sm:text-xl">{answer.why}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Confidence</dt><dd className="mt-1 font-semibold text-slate-900" data-testid="answer-confidence">{answer.confidencePercent !== null ? `${answer.confidencePercent}% · ${answer.confidenceWords}` : "Unknown"}</dd></div>
          <div><dt className="text-slate-500">Value for money</dt><dd className="mt-1 font-semibold text-slate-900">{answer.value}</dd></div>
          <div className="col-span-2 sm:col-span-1"><dt className="text-slate-500">Evidence</dt><dd className="mt-1 font-semibold text-slate-900">{answer.reviewCount ? `${answer.reviewCount} real reviews` : "None yet"}</dd></div>
        </dl>
        <p className="mt-5 text-sm text-slate-500">{answer.trustLine}</p>
      </section>

      {answer.kind !== "not_enough" ? (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <PointList title="What buyers love" points={answer.loves} empty="No repeated praise in the real reviews yet." />
          <PointList title="What buyers complain about" points={answer.complaints} empty="No repeated complaints in the real reviews." />
        </div>
      ) : null}

      {answer.nextSteps.length ? (
        <section className="rounded-3xl bg-slate-50 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-900">{answer.kind === "not_enough" ? "Here's how to get a real answer" : "Want a stronger answer?"}</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {answer.nextSteps.map(step => (
              <li key={step.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
                <p className="font-semibold text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                {step.id === "screenshots" ? <ScreenshotUpload productName={productName} /> : (
                  <Link href="/analyze" className="mt-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal">
                    {step.id === "compare" ? "Scan another product" : "Scan another listing"}
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
