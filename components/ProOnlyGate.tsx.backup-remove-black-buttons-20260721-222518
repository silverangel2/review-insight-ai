"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/Badge";
import { getClientAccount } from "@/lib/clientAccount";
import { canAccessSellerAnalytics } from "@/lib/account";
import type { ClientAccount } from "@/lib/account";

export function ProOnlyGate({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function refresh() {
      setAccount(getClientAccount());
      setLoaded(true);
    }

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

  if (!loaded) {
    return (
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <Badge tone="info">Checking access</Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Loading seller workspace...</h1>
      </section>
    );
  }

  if (!account) {
    return (
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <Badge tone="warn">Login required</Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Please log in to open the seller dashboard.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Seller dashboards are tied to a real account so scans, usage, and product history stay separated by user.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Log in
        </Link>
      </section>
    );
  }

  if (canAccessSellerAnalytics(account.role, account.plan)) {
    return <>{children}</>;
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <Badge tone="warn">Seller plan</Badge>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Seller dashboard requires a seller plan</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        Shopper accounts can still analyze products. Upgrade when you need seller analytics, complaint clustering, product tracking, history, and export-ready insights.
      </p>
      <Link href="/pricing" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
        View seller plans
      </Link>
    </section>
  );
}
