"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ScanStage = "uploading" | "analyzing" | "done";

export type LiveScanProgress = {
  stage: "starting" | "identifying" | "searching" | "reading" | "checking" | "scoring" | "done" | "failed";
  productIdentified: boolean;
  productName: string | null;
  sourcesChecked: number;
  sourceHosts: string[];
  reviewsFound: number | null;
  reviewsAccepted: number | null;
  snippets: Array<{ text: string; host: string | null }>;
};

type ReviewIntelScanOverlayProps = {
  stage: ScanStage;
  /** 0-100. Real upload progress from the XHR upload events — not simulated. */
  uploadProgress: number;
  productLabel?: string;
  /** Client scan id; when present the overlay polls REAL pipeline progress. */
  scanId?: string | null;
  /** Test/preview hook: a fixed progress snapshot instead of polling. */
  initialProgress?: LiveScanProgress | null;
  /** Poll interval (ms). */
  pollMs?: number;
};

/**
 * Honest live scan overlay. Every number comes from the server's real
 * pipeline events (/api/scan-progress). When no event has arrived yet (or the
 * poll lands on another server instance), the stage is shown as
 * indeterminate — never a fake timer or invented count.
 */
const STEPS: Array<{ id: LiveScanProgress["stage"]; label: string }> = [
  { id: "identifying", label: "Identifying the exact product" },
  { id: "searching", label: "Checking review sources" },
  { id: "reading", label: "Reading written reviews" },
  { id: "checking", label: "Keeping only real reviews of this product" },
  { id: "scoring", label: "Weighing praise against complaints" },
];
const ORDER = ["starting", "identifying", "searching", "reading", "checking", "scoring", "done"];

/** Stage-based fraction (real stage reached), not elapsed time. */
export function progressFraction(stage: ScanStage, uploadProgress: number, live: LiveScanProgress | null): number | null {
  if (stage === "done") return 1;
  if (stage === "uploading") return Math.max(0, Math.min(1, uploadProgress / 100)) * 0.1;
  if (!live) return null;
  const index = Math.max(0, ORDER.indexOf(live.stage));
  return Math.min(0.95, 0.1 + (index / (ORDER.length - 1)) * 0.85);
}

export function ReviewIntelScanOverlay({ stage, uploadProgress, productLabel, scanId, initialProgress = null, pollMs = 1200 }: ReviewIntelScanOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [live, setLive] = useState<LiveScanProgress | null>(initialProgress);

  useEffect(() => {
    if (stage === "done") {
      const timer = window.setTimeout(() => setVisible(false), 900);
      return () => window.clearTimeout(timer);
    }
    setVisible(true);
  }, [stage]);

  useEffect(() => {
    if (!scanId || initialProgress || stage === "done") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/scan-progress?scanId=${encodeURIComponent(scanId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.progress) setLive(data.progress as LiveScanProgress);
      } catch { /* keep last known state */ }
    };
    void poll();
    const timer = window.setInterval(poll, pollMs);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [scanId, stage, pollMs, initialProgress]);

  if (!visible) return null;

  const fraction = progressFraction(stage, uploadProgress, live);
  const currentIndex = live ? ORDER.indexOf(live.stage) : -1;
  const counters: Array<{ label: string; value: string | null }> = [
    { label: "Product identified", value: live ? (live.productIdentified ? "Yes" : "Working…") : null },
    { label: "Sources checked", value: live ? String(live.sourcesChecked) : null },
    { label: "Reviews found", value: live && live.reviewsFound !== null ? String(live.reviewsFound) : null },
    { label: "Real reviews kept", value: live && live.reviewsAccepted !== null ? String(live.reviewsAccepted) : null },
  ];

  const overlay = (
    <div
      style={{ zIndex: 2147483000 }}
      className={`ri-scan-overlay fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-md transition-opacity duration-500 ${stage === "done" ? "opacity-0" : "opacity-100"}`}
      role="status" aria-live="polite" aria-label="Product scan in progress" data-testid="scan-overlay"
    >
      {/* Scoped to the overlay only; outranks the site-wide mobile "1 column" grid rules without changing them. */}
      <style>{`html .ri-scan-overlay .ri-scan-counters, html[data-layout-mode] .ri-scan-overlay .ri-scan-counters { display: grid !important; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }`}</style>
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 text-left text-slate-900 shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">Scanning reviews</p>
        <h2 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">
          {live?.productName || productLabel || (stage === "uploading" ? "Uploading your screenshot" : "Finding your product")}
        </h2>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          {fraction === null ? (
            <div className="animate-pulse rounded-full" style={{ width: "33%", height: "100%", background: "rgba(15,159,154,0.5)" }} />
          ) : (
            <div className="rounded-full transition-[width] duration-700" style={{ width: `${Math.round(fraction * 100)}%`, height: "100%", background: "#0f9f9a" }} />
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {stage === "uploading" ? `${Math.round(uploadProgress)}% uploaded` : fraction === null ? "Waiting for the first live update…" : "Live from the scan as it runs"}
        </p>

        <dl className="ri-scan-counters mt-6">
          {counters.map(item => (
            <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">
                {item.value ?? <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200 align-middle" aria-label="not yet known" />}
              </dd>
            </div>
          ))}
        </dl>

        <ol className="mt-6 space-y-2">
          {STEPS.map(step => {
            const index = ORDER.indexOf(step.id);
            const state = currentIndex > index ? "done" : currentIndex === index ? "active" : "pending";
            return (
              <li key={step.id} className={`flex items-center gap-3 text-sm ${state === "pending" ? "text-slate-400" : "text-slate-800"}`}>
                <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${state === "done" ? "bg-teal text-white" : state === "active" ? "animate-pulse bg-teal/15 text-teal" : "bg-slate-100"}`} aria-hidden="true">
                  {state === "done" ? "✓" : ""}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>

        {live?.snippets?.length ? (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Real reviews we kept</p>
            {live.snippets.slice(0, 3).map((snippet, index) => (
              <blockquote key={index} className="rounded-2xl border-l-4 border-teal bg-slate-50 px-4 py-2 text-sm text-slate-700">
                “{snippet.text}”{snippet.host ? <span className="block text-xs text-slate-400">{snippet.host}</span> : null}
              </blockquote>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-xs text-slate-400">Deep scans can take a minute or two. Keep this tab open.</p>
      </div>
    </div>
  );
  // Portal to <body> so page transforms/stacking contexts and mobile layout CSS can't trap the overlay.
  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
