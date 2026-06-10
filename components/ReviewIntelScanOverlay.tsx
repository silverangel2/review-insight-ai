"use client";

import { useEffect, useState } from "react";

type ReviewIntelScanOverlayProps = {
  activeStep: number;
};

const scanSteps = [
  "Reading reviews...",
  "Detecting fake review patterns...",
  "Finding complaints...",
  "Measuring sentiment...",
  "Preparing results..."
];

export function ReviewIntelScanOverlay({ activeStep }: ReviewIntelScanOverlayProps) {
  const totalWatchBars = 32;
  const watchRevealDurationMs = 65000;
  const [visibleWatchBars, setVisibleWatchBars] = useState(0);
  const safeActiveStep = Math.max(0, Math.min(scanSteps.length - 1, activeStep));
  const scanProgressPercent = Math.min(100, Math.round((visibleWatchBars / totalWatchBars) * 100));

  useEffect(() => {
    const startedAt = Date.now();

    const revealTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextVisibleBars = Math.min(
        totalWatchBars,
        Math.floor((elapsed / watchRevealDurationMs) * totalWatchBars)
      );

      setVisibleWatchBars(nextVisibleBars);
    }, 250);

    return () => window.clearInterval(revealTimer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-5 py-8 backdrop-blur-xl" role="status" aria-live="polite">
      <div className="ri-scan-grid absolute inset-0 opacity-20" />
      <div className="ri-scan-fog absolute inset-0" aria-hidden="true" />
      <div className="ri-energy-wave ri-energy-wave-one" aria-hidden="true" />
      <div className="ri-energy-wave ri-energy-wave-two" aria-hidden="true" />

      <div className="ri-loading-particles absolute inset-0" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            style={{
              left: `${(index * 19 + 7) % 96}%`,
              top: `${(index * 31 + 11) % 88}%`,
              animationDelay: `${index * 0.16}s`,
              animationDuration: `${4.8 + (index % 5) * 0.55}s`
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/10 p-7 text-center text-white shadow-[0_40px_140px_rgba(0,0,0,0.52)]">
        <div className="ri-scan-corner ri-scan-corner-a" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-b" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-c" aria-hidden="true" />
        <div className="ri-scan-corner ri-scan-corner-d" aria-hidden="true" />
        <div className="ri-orb-haze absolute inset-0 opacity-80" />

        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">ReviewIntel scan</p>

          <div className="relative mx-auto mt-8 grid size-56 place-items-center">
            <div className="ri-progress-ring ri-watch-progress-controlled absolute inset-0">
              {Array.from({ length: totalWatchBars }).map((_, index) => {
                const isVisible = index < visibleWatchBars;

                return (
                  <span
                    key={index}
                    className={`ri-progress-segment ri-watch-progress-segment ${
                      isVisible ? "ri-watch-progress-segment-visible" : "ri-watch-progress-segment-hidden"
                    }`}
                    style={{
                      transform: `rotate(${index * (360 / totalWatchBars)}deg) translateY(-104px)`,
                      animationDelay: `${index * 0.09}s`
                    }}
                  />
                );
              })}
            </div>

            <div className="ri-ai-orb">
              <span className="ri-ai-orb-core" />
              <span className="ri-ai-orb-ring" />
              <span className="ri-ai-orb-ring ri-ai-orb-ring-delay" />
            </div>
          </div>

          <h3 className="mt-8 text-3xl font-black">Analyzing review intelligence</h3>
          <p className="mt-3 text-lg font-black text-teal">{scanSteps[safeActiveStep]}</p>

          <div className="mt-6 grid gap-2">
            {scanSteps.map((step, index) => {
              const stepStart = (index / scanSteps.length) * 100;
              const stepEnd = ((index + 1) / scanSteps.length) * 100;
              const stepFillPercent = Math.max(
                0,
                Math.min(100, ((scanProgressPercent - stepStart) / (stepEnd - stepStart)) * 100)
              );
              const isStarted = stepFillPercent > 0;

              return (
                <div
                  key={step}
                  className={`relative overflow-hidden rounded-2xl border px-4 py-3 transition ${
                    isStarted
                      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-50"
                      : "border-white/10 bg-white/5 text-white/45"
                  }`}
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-2xl bg-cyan-300/15 transition-[width] duration-700 ease-out"
                    style={{ width: `${stepFillPercent}%` }}
                  />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/35">
                      0{index + 1}
                    </span>
                    <p className="mt-1 text-xs font-bold">{step}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-300">
            Preparing a clean result page. Please keep this tab open.
          </p>
        </div>
      </div>
    </div>
  );
}
