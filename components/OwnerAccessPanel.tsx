"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { makeQuotaInfo } from "@/lib/account";
import { clearClientAccount, saveActiveMode, saveClientAccount, saveQuota } from "@/lib/clientAccount";
import type { SubscriptionPlan, UserRole } from "@/lib/types";

type OwnerAccount = {
  label: string;
  email: string;
  name: string;
  role: Exclude<UserRole, "guest">;
  plan: SubscriptionPlan;
  route: string;
  profileId: string;
  description: string;
};

const OWNER_ACCESS_CODE = "reviewintel-owner-2026";

const ownerAccounts: OwnerAccount[] = [
  {
    label: "Admin",
    email: "admin@reviewintel.test",
    name: "ReviewIntel Admin",
    role: "admin",
    plan: "seller_pro",
    route: "/admin",
    profileId: "ADMIN-001",
    description: "Owner/admin dashboard access."
  },
  {
    label: "Shopper Free",
    email: "shopper.free@reviewintel.test",
    name: "Shopper Free",
    role: "buyer",
    plan: "free_buyer",
    route: "/dashboard/customer",
    profileId: "SHOP-FREE-001",
    description: "Free shopper account with the shared 3-action limit."
  },
  {
    label: "Shopper Premium",
    email: "shopper.premium@reviewintel.test",
    name: "Shopper Premium",
    role: "buyer",
    plan: "buyer_pro",
    route: "/dashboard/customer",
    profileId: "SHOP-PREMIUM-001",
    description: "Premium shopper account."
  },
  {
    label: "Seller Premium",
    email: "seller.premium@reviewintel.test",
    name: "Seller Premium",
    role: "seller",
    plan: "seller_starter",
    route: "/dashboard/seller",
    profileId: "SELL-PREMIUM-001",
    description: "Starter seller account for seller analytics without Pro calendar."
  },
  {
    label: "Seller Pro",
    email: "seller.pro@reviewintel.test",
    name: "Seller Pro",
    role: "seller",
    plan: "seller_pro",
    route: "/dashboard/seller",
    profileId: "SELL-PRO-001",
    description: "Full seller pro account with advanced seller features."
  }
];

export function OwnerAccessPanel() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

  function unlock() {
    if (code.trim() !== OWNER_ACCESS_CODE) {
      setError("Wrong owner access code.");
      return;
    }

    setError("");
    setUnlocked(true);
  }

  async function openAccount(account: OwnerAccount) {
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    window.sessionStorage.removeItem("reviewintel:last-result");
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);

    saveClientAccount({
      userId: `owner-${account.email}`,
      authUserId: `owner-auth-${account.email}`,
      email: account.email,
      name: account.name,
      plan: account.plan,
      role: account.role,
      subscriptionStatus: account.plan === "free_buyer" ? "free" : "active",
      createdAt: new Date().toISOString(),
      profileId: account.profileId,
      marketingConsent: false
    });

    saveActiveMode(account.role === "seller" || account.role === "admin" ? "seller" : "buyer");
    saveQuota(makeQuotaInfo(account.plan, 0));

    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    window.location.href = account.route;
  }

  return (
    <section className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <Badge tone="warn">Private owner access</Badge>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">ReviewIntel owner access</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        This page is for private testing only. It is separate from the public customer login page.
      </p>

      {!unlocked ? (
        <div className="mt-6 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <label className="block">
            <span className="text-sm font-black text-ink dark:text-white">Owner access code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlock();
              }}
              type="password"
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Enter owner code"
            />
          </label>
          {error ? <p className="mt-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
          <button
            type="button"
            onClick={unlock}
            className="mt-4 rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Unlock owner access
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {ownerAccounts.map((account) => (
            <article key={account.email} className="rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-black text-ink dark:text-white">{account.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{account.email}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{account.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void openAccount(account)}
                  className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
                >
                  Open {account.label}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
        <Link href="/login" className="text-ocean hover:underline">Public login</Link>
        <Link href="/admin-access" className="text-ocean hover:underline">Admin access</Link>
      </div>
    </section>
  );
}
