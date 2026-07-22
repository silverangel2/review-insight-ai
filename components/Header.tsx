"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getClientAccount, logoutEverywhere } from "@/lib/clientAccount";
import { getUiTextTranslation, normalizeLocale, readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";

type HeaderProps = {
  initialLocale?: ReviewIntelLocale | string;
};

export function Header({ initialLocale = "en" }: HeaderProps) {
  const [account, setAccount] = useState<ReturnType<typeof getClientAccount> | null>(null);
  const [locale, setLocale] = useState<ReviewIntelLocale>(normalizeLocale(initialLocale));

  const isLoggedIn = Boolean(
    account?.email ||
    account?.role === "admin" ||
    account?.role === "seller" ||
    account?.plan === "seller_pro" ||
    account?.plan === "seller_premium" ||
    account?.plan === "buyer_pro"
  );

  useEffect(() => {
    const refresh = () => setAccount(getClientAccount());
    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("reviewintel:account", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("reviewintel:account", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const refreshLocale = (event?: Event) => {
      const detail = event && "detail" in event ? (event as CustomEvent).detail : undefined;
      setLocale(normalizeLocale(detail || readStoredLocale()));
    };

    refreshLocale();
    window.addEventListener("reviewintel:locale", refreshLocale);
    window.addEventListener("storage", refreshLocale);

    return () => {
      window.removeEventListener("reviewintel:locale", refreshLocale);
      window.removeEventListener("storage", refreshLocale);
    };
  }, []);

  const labelFor = (label: string) => getUiTextTranslation(locale, label) || label;

  const authenticatedAccount = isLoggedIn ? account : null;
  const accountPlanText = JSON.stringify(authenticatedAccount || {}).toLowerCase();

  const headerRole = String(authenticatedAccount?.role || "").toLowerCase();
  const headerPlan = String(authenticatedAccount?.plan || "").toLowerCase();
  const headerEmail = String(authenticatedAccount?.email || "").toLowerCase();

  const isAdminAccount = headerRole === "admin";

  const isSellerAccount =
    headerRole === "seller" ||
    headerPlan === "seller_premium" ||
    headerPlan === "seller_pro" ||
    headerPlan === "seller_beta" ||
    headerEmail === "seller.starter@reviewintel.test";

  const headerAccountBlob = JSON.stringify(authenticatedAccount || {}).toLowerCase();

  const hasSellerAccess =
    isAdminAccount ||
    authenticatedAccount?.role === "seller" ||
    authenticatedAccount?.plan === "seller_premium" ||
    authenticatedAccount?.plan === "seller_pro" ||
    authenticatedAccount?.plan === "seller_beta" ||
    authenticatedAccount?.email === "seller.starter@reviewintel.test" ||
    headerAccountBlob.includes("seller.starter@reviewintel.test") ||
    headerAccountBlob.includes("seller_premium") ||
    headerAccountBlob.includes("seller_pro") ||
    headerAccountBlob.includes("seller_beta") ||
    headerAccountBlob.includes('"role":"seller"') ||
    headerAccountBlob.includes('"role": "seller"');

  const isShopperPremium =
    !hasSellerAccess &&
    (
      accountPlanText.includes("buyer_pro") ||
      accountPlanText.includes("buyer_beta") ||
      accountPlanText.includes("shopper premium")
    );

  const isPendingSeller = headerRole === "seller" && !isSellerAccount;

  const isSellerProAccount = headerPlan === "seller_pro";

  const navLinks: Array<[string, string]> = authenticatedAccount
    ? isAdminAccount
      ? [
          ["Admin", "/admin"],
          ["Customers", "/admin/customers"],
          ["Email", "/admin/email"],
          ["Security", "/admin/security"],
          ["SEO", "/admin/seo"],
          ["System", "/admin/system"],
        ]
      : hasSellerAccess
      ? [
          ["Analyze", "/seller/analyze"],
          ...(isSellerProAccount ? [["Compare", "/dashboard/seller/compare"] as [string, string]] : []),
          ["Dashboard", "/dashboard/seller"],
          ["Results", "/seller/result"],
          ["Pricing", "/pricing"],
        ]
      : isPendingSeller
        ? [
            ["Pricing", "/pricing?plan=seller_premium"],
            ["Account", "/account"],
          ]
      : isShopperPremium
        ? [
            ["Analyze", hasSellerAccess ? "/seller/analyze" : "/analyze"],
            ["Compare", "/compare"],
            ["Dashboard", "/dashboard/customer"],
            ["Results", "/results"],
            ["Pricing", "/pricing"],
          ]
        : [
            ["Analyze", hasSellerAccess ? "/seller/analyze" : "/analyze"],
            ["Results", "/results"],
            ["Pricing", "/pricing"],
            ["Advertise", "/advertise"],
          ]
    : [
        ["Pricing", "/pricing"],
        ["Advertise", "/advertise"],
        ["Reviews", "/reviews"],
      ];

  const planLabel =
    isAdminAccount
      ? "Admin"
      : authenticatedAccount?.plan === "seller_pro"
      ? "Seller Pro"
      : authenticatedAccount?.plan === "seller_premium"
        ? "Seller Premium"
        : authenticatedAccount?.plan === "free_buyer"
          ? ""
          : authenticatedAccount?.plan
            ? "Premium"
            : "";

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/95">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#172033,#2356a3,#08b7a8)] text-sm font-black text-white shadow-soft">
            RI
          </span>
          <span className="bg-[linear-gradient(135deg,#172033,#2356a3,#08b7a8)] bg-clip-text text-lg font-black tracking-tight text-transparent dark:from-white dark:via-cyan-100 dark:to-amber">
            ReviewIntel
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {navLinks.map(([label, href]) => (
            <Link
              key={`${label}-${href}`}
              href={href}
              className="rounded-2xl px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-ocean/10 hover:text-ocean dark:text-slate-300"
            >
              {labelFor(label)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
          <span className="inline-flex"><LanguageSwitcher compact initialLocale={locale} /></span>
          {authenticatedAccount ? (
            <Link
              href="/account"
              className="hidden rounded-2xl border border-line px-4 py-2.5 text-xs font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white sm:inline-flex"
            >
              {planLabel || labelFor("Profile")}
            </Link>
          ) : null}

          {authenticatedAccount ? (
            <button
              type="button"
              onClick={() => void logoutEverywhere()}
              className="inline-flex rounded-2xl bg-ink px-3 py-2 text-[11px] font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink sm:px-4 sm:py-2.5 sm:text-sm"
            >
              {labelFor("Log out")}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink sm:text-sm"
            >
              {labelFor("Log in")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
