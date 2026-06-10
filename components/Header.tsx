"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClientAccount, logoutEverywhere } from "@/lib/clientAccount";

export function Header() {
  const [account, setAccount] = useState<ReturnType<typeof getClientAccount> | null>(null);

  const isLoggedIn = Boolean(
    account?.email ||
    account?.role === "admin" ||
    account?.role === "seller" ||
    account?.plan === "seller_pro" ||
    account?.plan === "seller_starter" ||
    account?.plan === "buyer_pro"
  );

  useEffect(() => {
    const refresh = () => setAccount(getClientAccount());
    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const authenticatedAccount = isLoggedIn ? account : null;

  const planLabel =
    authenticatedAccount?.plan === "seller_pro"
      ? "Seller Pro"
      : authenticatedAccount?.plan === "seller_starter"
        ? "Seller Premium"
        : authenticatedAccount?.plan === "free_buyer"
          ? ""
          : authenticatedAccount?.plan
            ? "Premium"
            : "";

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#172033,#2356a3,#08b7a8)] text-sm font-black text-white shadow-soft">
            RI
          </span>
          <span className="bg-[linear-gradient(135deg,#172033,#2356a3,#08b7a8)] bg-clip-text text-lg font-black tracking-tight text-transparent dark:from-white dark:via-cyan-100 dark:to-amber">
            ReviewIntel
          </span>
        </Link>

        <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
          {planLabel ? (
            <Link
              href="/account"
              className="hidden rounded-2xl border border-line px-4 py-2.5 text-xs font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white sm:inline-flex"
            >
              {planLabel}
            </Link>
          ) : null}

          {authenticatedAccount ? (
            <button
              type="button"
              onClick={() => void logoutEverywhere()}
              className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink sm:text-sm"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-2xl bg-ink px-4 py-2.5 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink sm:text-sm"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
