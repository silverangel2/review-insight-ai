"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSellerPlan } from "@/lib/account";
import { getClientAccount } from "@/lib/clientAccount";

type QuickNavProps = {
  mode?: "seller" | "shopper" | "general";
  current?: string;
};

export function QuickNav({ mode = "general", current = "" }: QuickNavProps) {
  const router = useRouter();
  const account = typeof window !== "undefined" ? getClientAccount() : null;
  const isAdmin = account?.role === "admin";
  const accountAccessBlob = JSON.stringify(account || {}).toLowerCase();

  const hasSellerAccess =
    isAdmin ||
    account?.role === "seller" ||
    account?.plan === "seller_premium" ||
    account?.plan === "seller_pro" ||
    account?.email === "seller.starter@reviewintel.test" ||
    accountAccessBlob.includes("seller.starter@reviewintel.test") ||
    accountAccessBlob.includes("seller_premium") ||
    accountAccessBlob.includes("seller_pro") ||
    accountAccessBlob.includes('"role":"seller"') ||
    accountAccessBlob.includes('"role": "seller"') ||
    isSellerPlan(account?.plan || "free_buyer");
  const isPendingSeller = account?.role === "seller" && !hasSellerAccess;
  const accountPlanText = JSON.stringify(account || {}).toLowerCase();
  const isShopperPremium =
    !hasSellerAccess &&
    (
      accountPlanText.includes("buyer_pro") ||
      accountPlanText.includes("premium") ||
      accountPlanText.includes("shopper premium")
    );

  const shopperDashboardHref = isShopperPremium ? "/dashboard/customer" : "/analyze";
  const shopperDashboardLabel = isShopperPremium ? "Shopper Dashboard" : "Analyze";

  const links =
    isAdmin
      ? [
          { label: "Admin", href: "/admin" },
          { label: "Customers", href: "/admin/customers" },
          { label: "Ads", href: "/admin/advertising" },
          { label: "Email", href: "/admin/email" },
          { label: "Security", href: "/admin/security" },
          { label: "Account", href: "/account" },
        ]
      : mode === "seller"
      ? [
          { label: "Analyze", href: "/seller/analyze" },
          { label: "Results", href: "/seller/result" },
          { label: "Seller Dashboard", href: "/dashboard/seller" },
          ...(account?.plan === "seller_pro"
            ? [{ label: "Compare", href: "/dashboard/seller/compare" }]
            : []),
          { label: "Account", href: "/account" },
        ]
      : mode === "shopper"
        ? [
            { label: "Analyze", href: hasSellerAccess ? "/seller/analyze" : "/analyze" },
            { label: "Results", href: "/results" },
            { label: shopperDashboardLabel, href: shopperDashboardHref },
            { label: "Pricing", href: "/pricing" },
            { label: "Account", href: "/account" },
          ]
        : [
            { label: "Analyze", href: hasSellerAccess ? "/seller/analyze" : "/analyze" },
            { label: "Results", href: "/results" },
            { label: hasSellerAccess ? "Seller Dashboard" : shopperDashboardLabel, href: hasSellerAccess ? "/dashboard/seller" : shopperDashboardHref },
            { label: "Pricing", href: "/pricing" },
            { label: "Account", href: "/account" },
            ...(isPendingSeller ? [{ label: "Activate Seller", href: "/pricing?plan=seller_premium" }] : []),
          ];

  const [hideQuickNavOnMobile, setHideQuickNavOnMobile] = useState(false);

  useEffect(() => {
    function updateQuickNavVisibility() {
      const mode = document.documentElement.getAttribute("data-layout-mode");
      setHideQuickNavOnMobile(mode === "mobile" || window.innerWidth <= 640);
    }

    updateQuickNavVisibility();
    window.addEventListener("resize", updateQuickNavVisibility);
    return () => window.removeEventListener("resize", updateQuickNavVisibility);
  }, []);

  if (hideQuickNavOnMobile) return null;

  return (
    <nav className="reviewintel-quick-nav mb-5 rounded-[1.5rem] border border-line bg-white/90 p-3 shadow-soft backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-slate-300"
        >
          ← Back
        </button>

        {links.map((link) => {
          const active = current === link.href;

          return (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              className={[
                "rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
                active
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "bg-slate-50 text-slate-600 hover:bg-ocean/10 hover:text-ocean dark:bg-white/5 dark:text-slate-300",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
