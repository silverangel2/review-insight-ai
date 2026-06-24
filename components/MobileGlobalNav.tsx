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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setAccount(getClientAccount() as NavAccount);
    } catch {
      setAccount(null);
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

  return (
    <nav
      data-mobile-global-nav="compact"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[9999] md:hidden"
      aria-label="Mobile navigation"
    >
      {open ? (
        <div className="mb-2 w-44 rounded-[2rem] border border-white/20 bg-slate-950/92 p-3 shadow-2xl backdrop-blur-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
              {account ? accountLabel(account) : "Menu"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white"
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
                className={`flex h-14 items-center justify-center rounded-2xl text-center text-[11px] font-black ${
                  isActive(item.href)
                    ? "bg-cyan-200 text-slate-950"
                    : "bg-white/10 text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-white/20 bg-slate-950/90 text-[11px] font-black uppercase tracking-[-0.02em] text-white shadow-2xl backdrop-blur-2xl active:scale-95"
        aria-label="Open mobile menu"
      >
        {open ? "×" : accountLabel(account)}
      </button>
    </nav>
  );
}
