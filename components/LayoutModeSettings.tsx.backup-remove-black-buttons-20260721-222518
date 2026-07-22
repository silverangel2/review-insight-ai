"use client";

import { useEffect, useState } from "react";

type LayoutMode = "auto" | "mobile" | "desktop";

const STORAGE_KEY = "reviewintel_layout_mode";

const modes: { value: LayoutMode; label: string; description: string }[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Best layout based on screen size.",
  },
  {
    value: "mobile",
    label: "Mobile",
    description: "Force phone-style stacked layout.",
  },
  {
    value: "desktop",
    label: "Desktop",
    description: "Force wider dashboard layout.",
  },
];

function safeMode(value: string | null): LayoutMode {
  if (value === "mobile" || value === "desktop" || value === "auto") return value;
  return "auto";
}

export default function LayoutModeSettings() {
  const [mode, setMode] = useState<LayoutMode>("auto");

  useEffect(() => {
    const saved = safeMode(window.localStorage.getItem(STORAGE_KEY));
    setMode(saved);
    document.documentElement.dataset.layoutMode = saved;
  }, []);

  function updateMode(next: LayoutMode) {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.layoutMode = next;
    window.dispatchEvent(new CustomEvent("reviewintel-layout-mode", { detail: { mode: next } }));
  }

  return (
    <section className="rounded-[1.5rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
        Layout settings
      </p>
      <h2 className="mt-3 text-xl font-black text-ink dark:text-white sm:text-2xl">
        Mobile / desktop layout
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
        Choose how ReviewIntel should display dashboards. Auto is recommended, but mobile and desktop can be forced for testing.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {modes.map((item) => {
          const active = mode === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => updateMode(item.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-ocean bg-ocean text-white shadow-soft"
                  : "border-line bg-mist text-ink hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              }`}
            >
              <span className="block text-sm font-black">{item.label}</span>
              <span className={`mt-2 block text-xs font-bold leading-5 ${active ? "text-white/80" : "text-slate-500 dark:text-slate-300"}`}>
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
