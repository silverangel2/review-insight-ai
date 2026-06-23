"use client";

import { ReactNode, useEffect, useState } from "react";

export type LayoutMode = "auto" | "mobile" | "desktop";

const STORAGE_KEY = "reviewintel_layout_mode";

function safeMode(value: string | null): LayoutMode {
  if (value === "mobile" || value === "desktop" || value === "auto") return value;
  return "auto";
}

export default function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<LayoutMode>("auto");

  useEffect(() => {
    let saved = safeMode(window.localStorage.getItem(STORAGE_KEY));

    // Safety: do not let an old forced desktop mode trap real phones in a broken wide layout.
    if (window.innerWidth < 768 && saved === "desktop") {
      saved = "auto";
      window.localStorage.setItem(STORAGE_KEY, saved);
    }

    setMode(saved);
    document.documentElement.dataset.layoutMode = saved;

    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      const next = safeMode(event.newValue);
      setMode(next);
      document.documentElement.dataset.layoutMode = next;
    }

    function onLayoutModeChange(event: Event) {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      const next = safeMode(detail?.mode ?? null);
      setMode(next);
      document.documentElement.dataset.layoutMode = next;
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("reviewintel-layout-mode", onLayoutModeChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("reviewintel-layout-mode", onLayoutModeChange);
    };
  }, []);

  return <div data-current-layout-mode={mode}>{children}</div>;
}
