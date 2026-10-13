"use client";

import { useEffect, useState } from "react";

export type ScanStage = "uploading" | "analyzing" | "done" | "failed";

type ReviewIntelScanOverlayProps = {
  stage: ScanStage;
  /** 0-100. Real upload progress from the XHR upload events — not simulated. */
  uploadProgress: number;
  productLabel?: string;
};

/**
 * Honest staged scan overlay.
 *
 * What each stage means (no fake progress anywhere):
 * - "uploading": the screenshot is being sent. The bar shows REAL bytes-sent
 *   progress from XMLHttpRequest upload events.
 * - "analyzing": the server is working. We cannot see inside the single
 *   request, so this stage is deliberately indeterminate and makes no claim
 *   about review volume or a completed provider step.
 * - "done": a terminal result arrived; the overlay hands off to the results page.
 * - "failed": the request ended with a real error; no verdict is presented.
 */
const STAGES: Array<{ id: ScanStage; label: string; hint: string }> = [
  {
    id: "uploading",
    label: "Uploading screenshot",
    hint: "Sending your image securely",
  },
  {
    id: "analyzing",
    label: "Researching review evidence",
    hint: "Waiting for the evidence-backed scan result",
  },
  {
    id: "done",
    label: "Verdict ready",
    hint: "Preparing your results",
  },
  {
    id: "failed",
    label: "Scan stopped",
    hint: "No evidence-backed result was prepared",
  },
];

function stageState(stage: ScanStage, current: ScanStage): "done" | "active" | "pending" {
  const order: ScanStage[] = ["uploading", "analyzing", "done", "failed"];
  const stageIdx = order.indexOf(stage);
  const currentIdx = order.indexOf(current);
  if (current === "failed") {
    if (stage === "failed") return "active";
    if (stage === "done") return "pending";
  }
  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

export function ReviewIntelScanOverlay({
  stage,
  uploadProgress,
  productLabel,
}: ReviewIntelScanOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (stage === "done" || stage === "failed") {
      const timer = window.setTimeout(() => setVisible(false), 900);
      return () => window.clearTimeout(timer);
    }
    setVisible(true);
  }, [stage]);

  if (!visible) return null;

  const safeUpload = Math.max(0, Math.min(100, Math.round(uploadProgress)));

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0b1226]/92 px-5 py-8 backdrop-blur-xl transition-opacity duration-500 ${
        stage === "done" || stage === "failed" ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Product scan in progress"
    >
      {/* ambient gold/navy glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,189,88,0.14),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ffbd58]/70 to-transparent"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#ffbd58]/30 bg-[linear-gradient(135deg,#101a30_0%,#16244a_60%,#1e2f5e_100%)] p-7 text-center text-white shadow-[0_40px_140px_rgba(0,0,0,0.55)] sm:p-9">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffbd58]">
          ReviewIntel scan
        </p>
        {productLabel ? (
          <p className="mx-auto mt-2 max-w-sm truncate text-sm font-bold text-slate-300">
            {productLabel}
          </p>
        ) : null}

        {/* pulsing AI orb — indeterminate by design */}
        <div className="relative mx-auto mt-6 grid size-28 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#ffbd58]/15" />
          <span className="absolute inset-3 rounded-full border-2 border-[#ffbd58]/50" />
          <span className="absolute inset-6 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,189,88,0.9),rgba(255,189,88,0.25)_70%)]" />
        </div>

        {/* stages */}
        <ol className="mt-8 grid gap-2.5 text-left">
          {STAGES.map((s, index) => {
            const state = stageState(s.id, stage);
            const label =
              s.id === "done" && stage !== "done" ? "Preparing result" : s.label;
            const hint =
              s.id === "done" && stage !== "done"
                ? "Waiting for the completed server response"
                : s.hint;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all duration-500 ${
                  state === "done"
                    ? "border-[#ffbd58]/40 bg-[#ffbd58]/10"
                    : state === "active"
                      ? "border-white/20 bg-white/[0.07] shadow-[0_0_30px_rgba(255,189,88,0.12)]"
                      : "border-white/10 bg-white/[0.03] opacity-50"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black transition-all duration-500 ${
                    state === "done"
                      ? "bg-[#ffbd58] text-[#172033]"
                      : state === "active"
                        ? "animate-pulse bg-white/15 text-[#ffbd58]"
                        : "bg-white/10 text-white/40"
                  }`}
                  aria-hidden="true"
                >
                  {state === "done" ? "✓" : state === "active" ? "●" : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">{label}</span>
                  <span className="block truncate text-xs font-semibold text-slate-400">
                    {s.id === "uploading" && state === "active"
                      ? `${safeUpload}% uploaded`
                      : hint}
                  </span>
                </span>
                {s.id === "uploading" && state === "active" ? (
                  <span className="text-xs font-black tabular-nums text-[#ffbd58]">
                    {safeUpload}%
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* real upload bar — only meaningful during the upload stage */}
        {stage === "uploading" ? (
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#ffbd58,#ffb238,#08b7a8)] transition-[width] duration-200"
              style={{ width: `${safeUpload}%` }}
            />
          </div>
        ) : null}

        <p className="mt-6 text-xs font-semibold leading-5 text-slate-400">
          {stage === "uploading"
            ? "Upload in progress. Keep this tab open."
            : stage === "analyzing"
              ? "ReviewIntel is checking the available evidence. Keep this tab open."
              : stage === "failed"
                ? "The scan stopped before a usable result was prepared."
                : "Preparing a clean result page."}
        </p>
      </div>
    </div>
  );
}
