"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type LayoutMode = "auto" | "mobile" | "desktop";

const STORAGE_KEY = "reviewintel_layout_mode";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Scan" },
  { href: "/pricing", label: "Premium" },
  { href: "/dashboard/customer", label: "Buyer" },
  { href: "/dashboard/seller", label: "Seller" },
  { href: "/compare", label: "Compare" },
  { href: "/account", label: "Account" },
  { href: "/admin", label: "Admin" },
];

function safeMode(value: string | null): LayoutMode {
  if (value === "mobile" || value === "desktop" || value === "auto") return value;
  return "auto";
}

export default function MobileGlobalNav() {
  const pathname = usePathname();
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
    <nav className="fixed inset-x-2 bottom-2 z-[9999] rounded-2xl border border-white/15 bg-ink/95 p-2 shadow-2xl backdrop-blur md:hidden">
      <div data-mobile-global-nav="true" className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition ${
                active
                  ? "bg-white text-ink"
                  : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-1 grid grid-cols-3 gap-1 border-t border-white/10 pt-1">
        {(["auto", "mobile", "desktop"] as LayoutMode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => updateMode(item)}
            className={`rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${
              mode === item
                ? "bg-cyan-300 text-ink"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </nav>
  );
}
