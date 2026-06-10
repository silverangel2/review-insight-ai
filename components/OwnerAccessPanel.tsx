"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { makeQuotaInfo } from "@/lib/account";
import { clearClientAccount, saveActiveMode, saveClientAccount, saveQuota } from "@/lib/clientAccount";
import { clearLatestResult } from "@/lib/resultStorage";
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

const OWNER_UNLOCK_KEY = "reviewintel:owner-unlocked";
const OWNER_LAST_ACTIVE_KEY = "reviewintel:owner-last-active";
const OWNER_IDLE_LIMIT_MS = 60 * 60 * 1000;

function clearOwnerBrowserSession() {
  window.sessionStorage.removeItem(OWNER_UNLOCK_KEY);
  window.sessionStorage.removeItem(OWNER_LAST_ACTIVE_KEY);
}

function markOwnerActivity() {
  window.sessionStorage.setItem(OWNER_UNLOCK_KEY, "1");
  window.sessionStorage.setItem(OWNER_LAST_ACTIVE_KEY, String(Date.now()));
}

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
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  const lockOwnerAccess = useCallback(() => {
    clearOwnerBrowserSession();
    setUnlocked(false);
    setCode("");
    fetch("/api/owner/logout", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => null);
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/owner/session", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => {
        if (!active) return;

        if (response.ok) {
          markOwnerActivity();
          setUnlocked(true);
        } else {
          clearOwnerBrowserSession();
          setUnlocked(false);
        }
      })
      .catch(() => {
        if (!active) return;
        clearOwnerBrowserSession();
        setUnlocked(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    const expireIfIdle = () => {
      const lastActive = Number(window.sessionStorage.getItem(OWNER_LAST_ACTIVE_KEY) ?? "0");
      if (!lastActive || Date.now() - lastActive >= OWNER_IDLE_LIMIT_MS) {
        lockOwnerAccess();
        setError("Owner access locked after 1 hour of inactivity.");
        return true;
      }
      return false;
    };

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"] as const;
    const recordActivity = () => {
      if (!expireIfIdle()) markOwnerActivity();
    };

    markOwnerActivity();
    const interval = window.setInterval(expireIfIdle, 60 * 1000);
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [lockOwnerAccess, unlocked]);

  async function unlock() {
    const response = await fetch("/api/owner/access", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    }).catch(() => null);

    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Wrong owner access code.");
      return;
    }

    setError("");
    markOwnerActivity();
    setUnlocked(true);
  }

  async function openAccount(account: OwnerAccount) {
    setError("");
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    clearLatestResult();
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => null);
    markOwnerActivity();

    if (account.role === "admin") {
      const response = await fetch("/api/owner/admin-session", { method: "POST", credentials: "same-origin" }).catch(() => null);

      if (!response?.ok) {
        setError("Admin session could not be opened. Unlock owner access again, then retry Admin.");
        return;
      }
    }

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

    saveActiveMode(account.role === "admin" ? "both" : account.role === "seller" ? "seller" : "buyer");
    saveQuota(makeQuotaInfo(account.plan, 0));
    window.localStorage.setItem("reviewintel:account-last-active", String(Date.now()));

    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    window.location.assign(account.route);
  }

  return (
    <section className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <Badge tone="warn">Private owner access</Badge>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">ReviewIntel owner access</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        This page is for private testing only. It is separate from the public customer login page.
      </p>

      {checkingSession ? (
        <div className="mt-6 rounded-2xl border border-line bg-mist p-5 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          Checking private owner session...
        </div>
      ) : !unlocked ? (
        <div className="mt-6 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <label className="block">
            <span className="text-sm font-black text-ink dark:text-white">Owner access code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void unlock();
              }}
              type="password"
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Enter owner code"
            />
          </label>
          {error ? <p className="mt-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
          <button
            type="button"
            onClick={() => void unlock()}
            className="mt-4 rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Unlock owner access
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/20 bg-teal/10 p-4">
            <p className="text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
              Owner access is unlocked for this browser session. It locks automatically after 1 hour idle.
            </p>
            <button
              type="button"
              onClick={lockOwnerAccess}
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Lock owner access
            </button>
          </div>
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
