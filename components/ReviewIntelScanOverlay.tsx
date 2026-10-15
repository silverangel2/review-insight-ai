"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  SCAN_ORDER,
  SCAN_STEPS,
  progressFraction,
  type LiveScanProgress,
  type ScanStage,
} from "@/lib/scanProgress";

export type { LiveScanProgress, ScanStage };
export { progressFraction };

type ReviewIntelScanOverlayProps = {
  stage: ScanStage;
  /** 0-100. Real upload progress from the XHR upload events — not simulated. */
  uploadProgress: number;
  productLabel?: string;
  /** Real product thumbnail when available (e.g. the uploaded screenshot preview). Never a placeholder. */
  productImage?: string | null;
  /** Client scan id; when present the overlay polls REAL pipeline progress. */
  scanId?: string | null;
  /** Test/preview hook: a fixed progress snapshot instead of polling. */
  initialProgress?: LiveScanProgress | null;
  /** Poll interval (ms). */
  pollMs?: number;
  /** Where to land when the scan finishes server-side. Defaults to /results?scanId=<id>. */
  resultUrl?: string;
};

const STEPS = SCAN_STEPS;
const ORDER = SCAN_ORDER;

/**
 * Honest live scan overlay. Every number comes from the server's real
 * pipeline events (/api/scan-progress). When no event has arrived yet (or the
 * poll lands on another server instance), the stage is shown as
 * indeterminate — never a fake timer or invented count. Stages move only on
 * real milestones; the progress bar fills by stages completed.
 */

export function ReviewIntelScanOverlay({ stage, uploadProgress, productLabel, productImage, scanId, initialProgress = null, pollMs = 1200, resultUrl }: ReviewIntelScanOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [live, setLive] = useState<LiveScanProgress | null>(initialProgress);
  // Defect batch 2, rule 7c: if the scan completes server-side but the form's
  // own response never lands (stuck "Finding your product"), the poll lands
  // on the result and a recovery button appears after a long stall.
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const resultTarget = resultUrl ?? (scanId ? `/results?scanId=${encodeURIComponent(scanId)}` : null);

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
        if (!cancelled && data?.progress) {
          setLive(data.progress as LiveScanProgress);
          // Server-side finished while the submit POST response never
          // arrived: land on the result instead of hanging forever.
          if (data.progress?.stage === "done" && resultTarget) {
            window.location.assign(resultTarget);
          }
        }
      } catch { /* keep last known state */ }
    };
    void poll();
    const timer = window.setInterval(poll, pollMs);
    // 3.5 minutes with no completion: offer an honest escape hatch rather
    // than a stuck screen. The result page handles missing/expired scans.
    const recoveryTimer = window.setTimeout(() => { if (!cancelled) setRecoveryVisible(true); }, 210000);
    return () => { cancelled = true; window.clearInterval(timer); window.clearTimeout(recoveryTimer); };
  }, [scanId, stage, pollMs, initialProgress, resultTarget]);

  if (!visible) return null;

  const fraction = progressFraction(stage, uploadProgress, live);
  const currentIndex = live ? ORDER.indexOf(live.stage) : -1;
  const isDone = stage === "done" || live?.stage === "done";
  const counters: Array<{ label: string; value: string | null }> = [
    { label: "Product identified", value: live ? (live.productIdentified ? "Yes" : "Working…") : null },
    { label: "Sources checked", value: live ? String(live.sourcesChecked) : null },
  ];

  const overlay = (
    <div
      style={{ zIndex: 2147483000 }}
      className={`ri-scan-overlay fixed inset-0 flex items-center justify-center overflow-y-auto px-4 py-8 transition-opacity duration-500 ${stage === "done" ? "opacity-0" : "opacity-100"}`}
      role="status" aria-live="polite" aria-label="Product scan in progress" data-testid="scan-overlay"
    >
      {/* Aurora backdrop: same canvas as the result page, so the handoff feels continuous. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[#14142b]/90 backdrop-blur-xl" />
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl motion-reduce:hidden" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl motion-reduce:hidden" />
        <div className="absolute top-1/3 right-0 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl motion-reduce:hidden" />
      </div>
      {/* Scoped to the overlay only; outranks the site-wide mobile "1 column" grid rules without changing them. */}
      <style>{`html .ri-scan-overlay .ri-scan-counters, html[data-layout-mode] .ri-scan-overlay .ri-scan-counters { display: grid !important; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }`}</style>
      <div className="ri-glass ri-hairline relative w-full max-w-lg rounded-3xl p-6 text-left text-slate-900 shadow-[0_30px_80px_rgba(50,44,140,0.35)] sm:p-8">
        {/* The product, pinned and highlighted at the top as soon as it's identified. */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {productImage ? (
              <img
                src={productImage}
                alt=""
                className="size-16 rounded-2xl object-cover ring-2 ring-indigo-500/40 shadow-[0_8px_24px_rgba(91,61,240,0.35)]"
              />
            ) : (
              <div
                className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a6cff] to-[#5b3df0] text-white shadow-[0_8px_24px_rgba(91,61,240,0.35)]"
                aria-hidden="true"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </div>
            )}
            {live?.productIdentified ? (
              <span
                className="ri-stage-dot-done absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                aria-hidden="true"
              >
                ✓
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
              {live?.productIdentified ? "Product identified" : stage === "uploading" ? "Uploading" : "Scanning your product"}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold leading-snug">
              {live?.productName || productLabel || "Working…"}
            </p>
          </div>
        </div>

        <div className="ri-progress-track mt-5 h-2 overflow-hidden rounded-full" aria-hidden="true">
          {fraction === null ? (
            <div className="ri-shimmer h-full rounded-full" style={{ width: "33%" }} />
          ) : (
            <div
              className="ri-progress-fill h-full w-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${Math.max(0.02, fraction)})` }}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {stage === "uploading" ? `${Math.round(uploadProgress)}% uploaded` : fraction === null ? "Waiting for the first live update…" : "Live from the scan as it runs"}
        </p>

        <dl className="ri-scan-counters mt-6">
          {counters.map(item => (
            <div key={item.label} className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-slate-900/5">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">
                {item.value ?? <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200 align-middle motion-reduce:animate-none" aria-label="not yet known" />}
              </dd>
            </div>
          ))}
        </dl>

        <ol className="mt-6 space-y-1">
          {STEPS.map(step => {
            const index = ORDER.indexOf(step.id);
            const state = isDone || currentIndex > index ? "done" : currentIndex === index ? "active" : "pending";
            return (
              <li
                key={step.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${state === "active" ? "ri-shimmer bg-indigo-500/5" : ""} ${state === "pending" ? "text-slate-400" : "text-slate-800"}`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${state === "done" ? "ri-stage-dot-done text-white" : state === "active" ? "ri-stage-active bg-indigo-500/25 text-indigo-600" : "bg-slate-100 text-slate-400"}`}
                  aria-hidden="true"
                >
                  {state === "done" ? "✓" : state === "active" ? "●" : ""}
                </span>
                <span className={state === "active" ? "font-semibold" : ""}>
                  {state === "active" ? <span className="ri-gradient-text">{step.label}</span> : step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {live?.snippets?.length ? (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Real reviews we kept</p>
            {live.snippets.slice(0, 3).map((snippet, index) => (
              <blockquote key={`${index}-${snippet.text.slice(0, 40)}`} className="rounded-2xl border-l-4 border-indigo-500 bg-white/70 px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-900/5">
                “{snippet.text}”{snippet.host ? <span className="block text-xs text-slate-500">{snippet.host}</span> : null}
              </blockquote>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-xs text-slate-400">Deep scans can take a minute or two. Keep this tab open.</p>

        {recoveryVisible && resultTarget && stage !== "done" ? (
          <button
            type="button"
            onClick={() => window.location.assign(resultTarget)}
            className="mt-4 w-full rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm font-bold text-teal transition hover:bg-teal/20"
          >
            This is taking longer than usual — check your result
          </button>
        ) : null}
      </div>
    </div>
  );
  // Portal to <body> so page transforms/stacking contexts and mobile layout CSS can't trap the overlay.
  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
