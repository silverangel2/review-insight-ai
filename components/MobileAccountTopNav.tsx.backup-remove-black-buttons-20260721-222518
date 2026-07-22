"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type Account = {
  role?: string;
  plan?: string;
} | null;

type NavItem = {
  href: string;
  label: string;
};

function itemsForAccount(account: Account): NavItem[] {
  const role = String(account?.role || "").toLowerCase();
  const plan = String(account?.plan || "").toLowerCase();

  // Shopper Free
  if (role === "buyer" && plan === "free_buyer") {
    return [
      { href: "/analyze", label: "Scan" },
      { href: "/results", label: "Result" },
      { href: "/account", label: "Account" },
      { href: "/pricing", label: "Pricing" }
    ];
  }

  // Shopper Premium
  if (role === "buyer" && plan === "buyer_pro") {
    return [
      { href: "/analyze", label: "Scan" },
      { href: "/compare", label: "Compare" },
      { href: "/dashboard/customer", label: "Dashboard" },
      { href: "/results", label: "Result" },
      { href: "/account", label: "Account" }
    ];
  }

  // Seller Premium
  if (role === "seller" && plan === "seller_premium") {
    return [
      { href: "/dashboard/seller/upload", label: "Scan" },
      { href: "/dashboard/seller", label: "Dashboard" },
      { href: "/dashboard/seller/result", label: "Result" },
      { href: "/account", label: "Account" }
    ];
  }

  // Seller Pro
  if (role === "seller" && plan === "seller_pro") {
    return [
      { href: "/dashboard/seller/upload", label: "Scan" },
      { href: "/dashboard/seller/compare", label: "Compare" },
      { href: "/dashboard/seller", label: "Dashboard" },
      { href: "/dashboard/seller/result", label: "Result" },
      { href: "/account", label: "Account" }
    ];
  }

  // Logged out fallback
  return [
    { href: "/login", label: "Login" },
    { href: "/analyze", label: "Scan" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Help" }
  ];
}

export default function MobileAccountTopNav() {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setAccount(getClientAccount() as Account);
    } catch {
      setAccount(null);
    } finally {
      setReady(true);
    }
  }, [pathname]);

  const items = useMemo(() => itemsForAccount(account), [account]);

  if (!ready) return null;

  return (
    <nav
      className="reviewintel-mobile-account-top-nav md:hidden"
      aria-label="Mobile account navigation"
    >
      <div className="flex gap-1 overflow-x-auto px-2 py-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : Boolean(pathname?.startsWith(item.href));

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${
                active
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
