"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type LayoutMode = "auto" | "mobile" | "desktop";

const STORAGE_KEY = "reviewintel_layout_mode";

function safeMode(value: string | null): LayoutMode {
  if (value === "desktop-mini") return "mobile";

  if (
    value === "mobile" ||
    value === "desktop" ||
    value === "auto"
  ) {
    return value;
  }

  return "auto";
}

function isLocalOrAdmin(pathname: string | null) {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_VIEW_TESTER === "true" ||
    Boolean(pathname?.startsWith("/admin"))
  );
}

function modeLabel(mode: LayoutMode) {
  if (mode === "mobile") return "Mobile";
  if (mode === "desktop") return "Desktop";
  /* Desktop Mini disabled because it caused broken compressed layouts. */
  return "Auto";
}


function routeClassName(pathname: string | null) {
  if (!pathname) return "reviewintel-route-unknown";

  const clean = pathname
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "");

  return clean ? `reviewintel-route-${clean}` : "reviewintel-route-home";
}

export default function LayoutModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<LayoutMode>("auto");
  const [open, setOpen] = useState(false);

  const showTester = isLocalOrAdmin(pathname);
  const routeClass = routeClassName(pathname);

  function applyMode(nextMode: LayoutMode) {
    setMode(nextMode);
    document.documentElement.dataset.layoutMode = nextMode;
    window.localStorage.setItem(STORAGE_KEY, nextMode);

    window.dispatchEvent(
      new CustomEvent("reviewintel-layout-mode", {
        detail: { mode: nextMode },
      })
    );
  }

  useEffect(() => {
    const saved = safeMode(window.localStorage.getItem(STORAGE_KEY));

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

  return (
    <>
      <div className={`reviewintel-layout-root ${routeClass}`} data-current-layout-mode={mode}>
        <div className="reviewintel-layout-canvas">{children}</div>
      </div>

      {showTester ? (
        <div className="reviewintel-view-switcher" aria-label="ReviewIntel view settings">
          {open ? (
            <div className="reviewintel-view-panel">
              <div className="reviewintel-view-panel-title">
                Appearance View
              </div>

              <div className="reviewintel-view-panel-subtitle">
                Test mobile / desktop locally
              </div>

              <button
                type="button"
                className={mode === "auto" ? "active" : ""}
                onClick={() => applyMode("auto")}
              >
                <span className="reviewintel-auto-icon">A</span>
                Auto Detect
              </button>

              <button
                type="button"
                className={mode === "mobile" ? "active" : ""}
                onClick={() => applyMode("mobile")}
              >
                <span className="reviewintel-phone-icon" />
                Mobile Vertical
              </button>

              <button
                type="button"
                className={mode === "desktop" ? "active" : ""}
                onClick={() => applyMode("desktop")}
              >
                <span className="reviewintel-desktop-icon" />
                Desktop Full
              </button>

              {/* Desktop Miniature disabled until rebuilt safely. */}

              <button
                type="button"
                className="reviewintel-view-reset"
                onClick={() => {
                  window.localStorage.removeItem(STORAGE_KEY);
                  applyMode("auto");
                }}
              >
                Reset
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="reviewintel-view-toggle"
            onClick={() => setOpen((value) => !value)}
          >
            {mode === "mobile" ? (
              <span className="reviewintel-phone-icon" />
            ) : mode === "desktop" ? (
              <span className="reviewintel-desktop-icon" />
            ) : false ? (
              <span className="reviewintel-mini-icon" />
            ) : (
              <span className="reviewintel-auto-icon">A</span>
            )}
            <span>{modeLabel(mode)}</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
