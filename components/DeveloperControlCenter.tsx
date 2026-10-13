"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { makeQuotaInfo, planLabel, roleForPlan, type ClientAccount } from "@/lib/account";
import { accountHeaders, clearClientAccount, getClientAccount, saveActiveMode, saveClientAccount, saveQuota } from "@/lib/clientAccount";
import { clearLatestResult } from "@/lib/resultStorage";
import type { SubscriptionPlan, UserRole } from "@/lib/types";

const settingDefaults = {
  maintenance_mode: false,
  allow_new_signups: true,
  ai_enabled: true,
  payments_enabled: true,
  sponsored_section_enabled: true,
  announcement_enabled: false,
  announcement_text: "ReviewIntel is temporarily updating. Please check back shortly.",
  stripe_sandbox_mode: true
};

type DeveloperSettings = typeof settingDefaults;
type BooleanSettingKey = Exclude<keyof DeveloperSettings, "announcement_text">;

const SETTINGS_KEY = "reviewintel:developer-settings";

function readSettings(): DeveloperSettings {
  if (typeof window === "undefined") return settingDefaults;
  try {
    return { ...settingDefaults, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return settingDefaults;
  }
}

function writeSettings(settings: DeveloperSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function developerAccount(): ClientAccount {
  const existing = getClientAccount();
  return {
    userId: existing?.userId ?? null,
    authUserId: existing?.authUserId ?? null,
    email: existing?.email ?? "developer@reviewintel.local",
    name: existing?.name ?? "ReviewIntel Operator",
    plan: "seller_pro",
    role: "admin",
    accessToken: existing?.accessToken,
    stripeCustomerId: existing?.stripeCustomerId ?? null,
    subscriptionStatus: "developer",
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };
}

function simulatedAccount(plan: SubscriptionPlan): ClientAccount {
  const role = roleForPlan(plan) as Exclude<UserRole, "admin" | "guest">;
  return {
    userId: null,
    authUserId: null,
    email: `${plan}@reviewintel.test`,
    name: `${planLabel(plan)} Tester`,
    plan,
    role,
    stripeCustomerId: plan === "free_buyer" ? null : `cus_test_${plan}`,
    subscriptionStatus: plan === "free_buyer" ? "free" : "active",
    createdAt: new Date().toISOString()
  };
}

export function DeveloperControlCenter({ serverDeveloperMode = false }: { serverDeveloperMode?: boolean }) {
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [settings, setSettings] = useState<DeveloperSettings>(settingDefaults);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const existing = getClientAccount();
    if (serverDeveloperMode && existing?.role !== "admin") {
      const nextAccount = developerAccount();
      saveClientAccount(nextAccount);
      saveQuota(makeQuotaInfo("seller_pro", 0));
      setAccount(nextAccount);
    } else {
      setAccount(existing);
    }
    setSettings(readSettings());
  }, [serverDeveloperMode]);

  const developerMode = account?.role === "admin";

  function activateDeveloperMode() {
    const nextAccount = developerAccount();
    saveClientAccount(nextAccount);
    saveQuota(makeQuotaInfo("seller_pro", 0));
    setAccount(nextAccount);
    setNotice("Developer Mode Active. Admin bypasses all quotas and feature gates.");
  }

  async function simulatePlan(plan: SubscriptionPlan) {
    const next = simulatedAccount(plan);
    clearClientAccount({ preserveOwnerSession: true });
    await Promise.all([
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      }).catch(() => null),
      fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin"
      }).catch(() => null),
      fetch("/api/owner/logout", {
        method: "POST",
        credentials: "same-origin"
      }).catch(() => null)
    ]);
    clearLatestResult();
    saveClientAccount(next);
    saveActiveMode(next.role === "seller" ? "seller" : "buyer");
    saveQuota(makeQuotaInfo(plan, 0));
    setAccount(next);
    setNotice(`${planLabel(plan)} customer session active. Opening the matching customer workspace.`);
    window.location.href =
      next.role === "seller"
        ? "/dashboard/seller"
        : plan === "buyer_pro"
          ? "/analyze"
          : "/analyze";
  }

  function resetQuota() {
    const plan = account?.plan ?? "free_buyer";
    saveQuota(makeQuotaInfo(plan, 0));
    setNotice("Quota reset instantly for this test session.");
  }

  async function endAdminSession() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    clearClientAccount();
    window.location.href = "/admin-access";
  }

  async function syncServerSettings(next: DeveloperSettings) {
    await fetch("/api/app-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...accountHeaders() },
      body: JSON.stringify(next)
    }).catch(() => null);
  }

  function toggle(key: BooleanSettingKey) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    writeSettings(next);
    void syncServerSettings(next);
  }

  function updateAnnouncement(text: string) {
    const next = { ...settings, announcement_text: text };
    setSettings(next);
    writeSettings(next);
    void syncServerSettings(next);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone={developerMode ? "good" : "warn"}>{developerMode ? "Developer Mode Active" : "Developer Mode Off"}</Badge>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-ink dark:text-white">System Control Center</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Admin accounts bypass review limits, comparisons, screenshot limits, AI usage limits, seller gates, and Stripe payment requirements for testing.
            </p>
          </div>
          <button onClick={activateDeveloperMode} className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
            Activate Developer Mode
          </button>
          <button onClick={() => void endAdminSession()} className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-white">
            End Admin Session
          </button>
        </div>
        {notice ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm font-bold text-teal">{notice}</p> : null}
      </article>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["maintenance_mode", "Maintenance", "Show users the updating screen."],
          ["allow_new_signups", "New Signups", "Allow people to create accounts."],
          ["ai_enabled", "AI Analysis", "Allow review analysis requests."],
          ["payments_enabled", "Stripe Payments", "Allow checkout and billing flows."],
          ["sponsored_section_enabled", "Sponsors", "Show partner resource sections."],
          ["announcement_enabled", "Announcement", "Show a system banner."],
          ["stripe_sandbox_mode", "Stripe Sandbox", "Use test-mode checkout behavior."]
        ].map(([key, title, detail]) => {
          const typedKey = key as BooleanSettingKey;
          return (
            <button
              key={key}
              onClick={() => toggle(typedKey)}
              className="rounded-2xl border border-line bg-white p-5 text-left shadow-soft transition hover:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500"
            >
              <Badge tone={settings[typedKey] ? "good" : "neutral"}>{settings[typedKey] ? "On" : "Off"}</Badge>
              <h3 className="mt-4 text-lg font-black text-ink dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black tracking-tight text-ink dark:text-white">System announcement</h2>
        <textarea
          value={settings.announcement_text}
          onChange={(event) => updateAnnouncement(event.target.value)}
          className="mt-4 min-h-[90px] w-full rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Toggle Announcement or Maintenance above to test platform messaging.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <h2 className="text-xl font-black tracking-tight text-ink dark:text-white">Test account access</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(["free_buyer", "buyer_pro", "seller_premium", "seller_pro"] as SubscriptionPlan[]).map((plan) => (
            <button
              key={plan}
              onClick={() => void simulatePlan(plan)}
              className={`rounded-xl border px-4 py-3 text-sm font-black transition ${
                account?.plan === plan && account?.role === roleForPlan(plan)
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-line text-ink hover:border-ocean dark:border-white/10 dark:text-white"
              }`}
            >
              Test {planLabel(plan)}
            </button>
          ))}
          <button onClick={resetQuota} className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-black text-amber">
            Reset quota now
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">API usage</p>
          <p className="mt-4 text-3xl font-black text-ocean dark:text-cyan-300">Live soon</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Production stats will read usage_tracking and token fields.</p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Failed webhooks</p>
          <p className="mt-4 text-3xl font-black text-amber">0</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Placeholder for Stripe webhook failure logs.</p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Screenshot logs</p>
          <p className="mt-4 text-3xl font-black text-teal">Ready</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Uploaded image records are modeled in Supabase.</p>
        </article>
      </section>
    </section>
  );
}
