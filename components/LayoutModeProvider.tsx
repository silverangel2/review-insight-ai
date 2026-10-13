"use client";

import { useEffect, useState, type ReactNode } from "react";

type LayoutMode = "auto" | "mobile" | "desktop" | "desktop-mini";
type ResolvedLayoutMode = "mobile" | "desktop" | "desktop-mini";

const STORAGE_KEY = "reviewintel_layout_mode";

function safeMode(value: string | null): LayoutMode {
  if (value === "mobile" || value === "desktop" || value === "desktop-mini" || value === "auto") {
    return value;
  }

  return "auto";
}

function resolveLayoutMode(mode: LayoutMode): ResolvedLayoutMode {
  if (mode === "mobile" || mode === "desktop" || mode === "desktop-mini") {
    return mode;
  }

  if (typeof window === "undefined") {
    return "desktop";
  }

  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export default function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LayoutMode>("auto");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [resolvedMode, setResolvedMode] = useState<ResolvedLayoutMode>("desktop");
  const showTester = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const initialMode = showTester
      ? safeMode(window.localStorage.getItem(STORAGE_KEY))
      : "auto";

    if (!showTester) {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    const applyMode = (nextMode: LayoutMode) => {
      const nextResolved = resolveLayoutMode(nextMode);

      setMode(nextMode);
      setResolvedMode(nextResolved);

      // Important:
      // Never put data-layout-mode="auto" on the real DOM.
      // "auto" must resolve to either mobile or desktop.
      document.documentElement.dataset.layoutMode = nextResolved;
      document.documentElement.dataset.layoutPreference = nextMode;
    };

    applyMode(initialMode);

    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function onViewportChange() {
      applyMode(showTester ? safeMode(window.localStorage.getItem(STORAGE_KEY)) : "auto");
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      applyMode(showTester ? safeMode(event.newValue) : "auto");
    }

    function onLayoutModeChange(event: Event) {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      applyMode(showTester ? safeMode(detail?.mode ?? null) : "auto");
    }

    mediaQuery.addEventListener("change", onViewportChange);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("reviewintel-layout-mode", onLayoutModeChange);

    return () => {
      mediaQuery.removeEventListener("change", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("reviewintel-layout-mode", onLayoutModeChange);
    };
  }, [showTester]);

  if (!showTester) return <>{children}</>;

  // Collapsed by default so the tester control never covers page content on phones.
  if (!switcherOpen) {
    return (
      <>
        {children}
        <button
          type="button"
          aria-label="Open layout switcher"
          onClick={() => setSwitcherOpen(true)}
          style={{ right: "auto" }}
          className="reviewintel-view-switcher-toggle fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-2 z-[9999] rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700 shadow-md"
        >
          Layout · {resolvedMode}
        </button>
      </>
    );
  }

  return (
    <>
      {children}
      <div style={{ right: "auto", left: "0.5rem", bottom: "calc(0.5rem + env(safe-area-inset-bottom))" }} className="reviewintel-view-switcher fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-2 z-[9999] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-1 rounded-2xl border border-slate-300 bg-white/95 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 shadow-2xl backdrop-blur-sm">
      <button type="button" aria-label="Close layout switcher" onClick={() => setSwitcherOpen(false)} className="rounded-full px-1.5 text-slate-500 hover:text-slate-900">×</button>
      <span className="text-slate-700">Layout:</span>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "auto");
          window.dispatchEvent(new CustomEvent("reviewintel-layout-mode", { detail: { mode: "auto" } }));
        }}
        className={`ml-2 rounded-full px-2 py-1 ${mode === "auto" ? "border border-slate-900 bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
      >
        Auto/{resolvedMode}
      </button>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "mobile");
          window.dispatchEvent(new CustomEvent("reviewintel-layout-mode", { detail: { mode: "mobile" } }));
        }}
        className={`rounded-full px-2 py-1 ${mode === "mobile" ? "border border-slate-900 bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
      >
        Mobile
      </button>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "desktop");
          window.dispatchEvent(new CustomEvent("reviewintel-layout-mode", { detail: { mode: "desktop" } }));
        }}
        className={`rounded-full px-2 py-1 ${mode === "desktop" ? "border border-slate-900 bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
      >
        Desktop
      </button>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "desktop-mini");
          window.dispatchEvent(new CustomEvent("reviewintel-layout-mode", { detail: { mode: "desktop-mini" } }));
        }}
        className={`rounded-full px-2 py-1 ${mode === "desktop-mini" ? "border border-slate-900 bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
      >
        Mini
      </button>
      </div>
      <style jsx global>{`
        @media (max-width: 640px) {
          .reviewintel-view-switcher {
            left: 0.5rem !important;
            right: 0.5rem !important;
            bottom: 4.2rem !important;
            justify-content: center !important;
            border-radius: 999px !important;
            font-size: 0.56rem !important;
            letter-spacing: 0.08em !important;
          }

          .reviewintel-view-switcher button {
            min-height: 1.65rem !important;
            padding: 0.32rem 0.5rem !important;
            border-radius: 999px !important;
          }
        }
      `}</style>
    </>
  );
}
