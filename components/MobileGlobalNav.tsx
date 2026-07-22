"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type NavAccount = {
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
} | null;

const LAYOUT_KEYS = [
  "reviewintel_layout_mode",
  "reviewintel-layout-mode",
  "reviewintel:layout-mode",
  "layoutMode"
];

function setLayoutMode(mode: "mobile" | "desktop") {
  if (typeof window === "undefined") return;

  for (const key of LAYOUT_KEYS) {
    window.localStorage.setItem(key, mode);
  }

  document.documentElement.dataset.layoutMode = mode;
  document.body.dataset.layoutMode = mode;

  window.location.reload();
}

function getLayoutMode() {
  if (typeof window === "undefined") return "mobile";

  for (const key of LAYOUT_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value === "desktop" || value === "mobile") return value;
  }

  return document.documentElement.dataset.layoutMode || "mobile";
}

function accountLabel(account: NavAccount) {
  if (!account) return "RI";

  const role = String(account.role || "").toLowerCase();
  const plan = String(account.plan || "").toLowerCase();

  if (role.includes("admin") || role.includes("owner")) return "AD";
  if (role.includes("seller")) return "SE";
  if (plan.includes("buyer_pro")) return "PRO";
  if (role.includes("buyer")) return "FR";

  return "RI";
}

function accountMenu(account: NavAccount) {
  if (!account) {
    return [
      { href: "/login", label: "Login" },
      { href: "/analyze", label: "Scan" },
      { href: "/pricing", label: "Plans" },
      { href: "/contact", label: "Help" }
    ];
  }

  const role = String(account.role || "").toLowerCase();
  const plan = String(account.plan || "").toLowerCase();

  if (role.includes("admin") || role.includes("owner")) {
    return [
      { href: "/admin", label: "Admin" },
      { href: "/admin/finance", label: "Finance" },
      { href: "/admin/security", label: "Security" },
      { href: "/account", label: "Account" }
    ];
  }

  if (role.includes("seller")) {
    return [
      { href: "/dashboard/seller", label: "Seller" },
      { href: "/dashboard/seller/upload", label: "Scan" },
      { href: "/dashboard/seller/compare", label: "Compare" },
      { href: "/account", label: "Account" }
    ];
  }

  if (plan.includes("buyer_pro")) {
    return [
      { href: "/analyze", label: "Scan" },
      { href: "/results", label: "Results" },
      { href: "/dashboard/customer", label: "History" },
      { href: "/account", label: "Account" }
    ];
  }

  return [
    { href: "/analyze", label: "Scan" },
    { href: "/pricing", label: "Premium" },
    { href: "/dashboard/customer", label: "History" },
    { href: "/account", label: "Account" }
  ];
}

export default function MobileGlobalNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<NavAccount>(null);
  const [layoutMode, setLayoutModeState] = useState("mobile");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setAccount(getClientAccount() as NavAccount);
      setLayoutModeState(getLayoutMode());
    } catch {
      setAccount(null);
      setLayoutModeState("mobile");
    } finally {
      setLoaded(true);
    }
  }, [pathname]);

  const links = useMemo(() => accountMenu(account), [account]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return Boolean(pathname?.startsWith(href));
  }

  if (!loaded) return null;

  if (layoutMode === "desktop") {
    return (
      <nav
        data-mobile-global-nav="apple"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[9999] md:hidden"
        aria-label="Return to mobile mode"
      >
        <button
          type="button"
          onClick={() => setLayoutMode("mobile")}
          className="reviewintel-apple-float-button"
          aria-label="Switch to mobile mode"
        >
          Mobile
        </button>
      </nav>
    );
  }

  return (
    <nav
      data-mobile-global-nav="apple"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[9999] md:hidden"
      aria-label="Mobile navigation"
    >
      {open ? (
        <div className="reviewintel-apple-menu mb-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950">
              {accountLabel(account)}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-950"
              aria-label="Close mobile menu"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex h-11 items-center justify-center rounded-2xl text-center text-[11px] font-black ${
                  isActive(item.href)
                    ? "bg-cyan-200 text-slate-950"
                    : "bg-slate-100 text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <button
              type="button"
              onClick={() => setLayoutMode("desktop")}
              className="col-span-2 flex h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-600 to-teal-500 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white"
            >
              Desktop
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="reviewintel-apple-float-button"
        aria-label="Open mobile menu"
      >
        {open ? "×" : accountLabel(account)}
      </button>
    </nav>
  );
}
