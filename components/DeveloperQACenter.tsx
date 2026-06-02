"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { makeQuotaInfo, planLabel, type ClientAccount } from "@/lib/account";
import { getClientAccount, getStoredQuota, quotaText, saveActiveMode, saveClientAccount, saveQuota } from "@/lib/clientAccount";
import type { AnalysisAudience, QuotaInfo, SubscriptionPlan, UserRole } from "@/lib/types";

type Diagnostics = {
  admin: {
    email: string;
    expires_at: string;
  };
  services: Record<"openai" | "stripe" | "supabase" | "api", string>;
  feature_flags: Record<string, boolean | string>;
  route_access: Record<string, string>;
  performance: Record<string, string | number>;
  validation: Record<string, string>;
};

const validationItems = [
  "Shopper Free flow",
  "Shopper Premium simulation",
  "Seller Starter simulation",
  "Seller Pro simulation",
  "Admin access guard",
  "Screenshot upload",
  "CSV validation",
  "TXT validation",
  "Quota reset",
  "Stripe sandbox",
  "Supabase persistence",
  "Build and smoke test"
];

const sampleDatasets = [
  {
    title: "Shopper quick decision",
    detail: "Six mixed reviews with praise, quality concerns, and value language."
  },
  {
    title: "Seller complaint mining",
    detail: "CSV-style dataset for defects, support delay, packaging, and refund risk."
  },
  {
    title: "Screenshot quick scan",
    detail: "Mobile screenshot workflow with compressed JPG/PNG review evidence."
  }
];

const testModes: Array<{
  label: string;
  role: UserRole;
  plan: SubscriptionPlan;
  audience: AnalysisAudience;
  detail: string;
}> = [
  {
    label: "Shopper Free",
    role: "buyer",
    plan: "free_buyer",
    audience: "buyer",
    detail: "Only shopper verdicts, 3 free daily analyses, no Seller Pro report."
  },
  {
    label: "Shopper Premium",
    role: "buyer",
    plan: "buyer_pro",
    audience: "buyer",
    detail: "Unlimited shopper verdicts, still no seller analytics interface."
  },
  {
    label: "Seller Starter",
    role: "seller",
    plan: "seller_starter",
    audience: "seller",
    detail: "Seller-only intelligence, complaint mining, and improvement actions."
  },
  {
    label: "Seller Pro",
    role: "seller",
    plan: "seller_pro",
    audience: "seller",
    detail: "Full seller command report, charts, exports, and competitor strategy."
  },
  {
    label: "Admin",
    role: "admin",
    plan: "seller_pro",
    audience: "both",
    detail: "Developer bypass for testing every route and response contract."
  }
];

function serviceTone(value: string): "good" | "warn" | "bad" | "info" {
  if (value === "configured" || value === "online") return "good";
  if (value === "missing") return "warn";
  return "info";
}

function displayRole(role: UserRole | undefined) {
  if (role === "buyer") return "shopper";
  return role ?? "guest";
}

export function DeveloperQACenter() {
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAccount(getClientAccount());
    setQuota(getStoredQuota());

    fetch("/api/admin/diagnostics")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Diagnostics failed.");
        setDiagnostics(data as Diagnostics);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Diagnostics failed."));
  }, []);

  const completion = useMemo(() => {
    if (!diagnostics) return 0;
    const servicesReady = Object.values(diagnostics.services).filter((status) => status === "configured" || status === "online").length;
    return Math.round((servicesReady / Object.keys(diagnostics.services).length) * 100);
  }, [diagnostics]);

  async function activateTestMode(mode: (typeof testModes)[number]) {
    const nextAccount: ClientAccount = {
      email: `${mode.plan}@reviewintel.local`,
      name: mode.label,
      role: mode.role,
      plan: mode.plan,
      subscriptionStatus: mode.role === "admin" ? "developer" : "active",
      stripeCustomerId: mode.plan === "free_buyer" ? null : `cus_demo_${mode.plan}`,
      createdAt: new Date().toISOString()
    };
    const nextQuota = makeQuotaInfo(mode.plan, 0);
    sessionStorage.removeItem("reviewintel:last-result");
    if (mode.role !== "admin") {
      await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    }
    saveClientAccount(nextAccount);
    saveActiveMode(mode.audience);
    saveQuota(nextQuota);
    setAccount(nextAccount);
    setQuota(nextQuota);
    if (mode.role !== "admin") {
      window.location.href = mode.role === "seller" ? "/dashboard/seller" : "/dashboard/customer";
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge tone="good">Developer QA/Test Center</Badge>
            <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Patch validation cockpit</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use this after every patch to verify role behavior, quotas, upload workflows, service readiness, and release safety.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-mist p-4 text-center dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Validation readiness</p>
            <p className="mt-2 text-4xl font-black text-ink dark:text-white">{completion}%</p>
          </div>
        </div>
      </article>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Active role</p>
          <p className="mt-3 text-2xl font-black capitalize text-ink dark:text-white">{displayRole(account?.role)}</p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Active plan</p>
          <p className="mt-3 text-2xl font-black text-ink dark:text-white">{account ? planLabel(account.plan) : "Guest"}</p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Quota state</p>
          <p className="mt-3 text-sm font-black text-ink dark:text-white">{quota ? quotaText(quota) : "Unknown"}</p>
        </article>
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Admin session</p>
          <p className="mt-3 text-sm font-black text-ink dark:text-white">{diagnostics?.admin.expires_at ? `Expires ${new Date(diagnostics.admin.expires_at).toLocaleTimeString()}` : "Checking"}</p>
        </article>
      </section>

      {error ? <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Role isolation test modes</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Shopper modes stay shopper-only. Seller modes open seller-only analysis and the richer Seller Pro result. Admin is the only dual test mode.
            </p>
          </div>
          <Badge tone={account?.role === "seller" ? "info" : account?.role === "admin" ? "good" : "warn"}>
            Active: {account ? `${displayRole(account.role)} / ${planLabel(account.plan)}` : "Guest"}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {testModes.map((mode) => {
            const active = account?.role === mode.role && account?.plan === mode.plan;
            return (
              <button
                key={mode.label}
                type="button"
                onClick={() => void activateTestMode(mode)}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  active
                    ? "border-ocean bg-ocean/10 shadow-glow"
                    : "border-line bg-mist hover:border-ocean/40 dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                <p className="text-sm font-black text-ink dark:text-white">{mode.label}</p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{mode.audience} output</p>
                <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{mode.detail}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Service diagnostics</h3>
          <div className="mt-4 grid gap-3">
            {Object.entries(diagnostics?.services ?? { openai: "checking", stripe: "checking", supabase: "checking", api: "checking" }).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 dark:border-white/10">
                <span className="font-bold capitalize text-ink dark:text-white">{name}</span>
                <Badge tone={serviceTone(String(status))}>{String(status)}</Badge>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Mode test flows</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Link href="/analyze" className="rounded-xl border border-line p-4 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
              Test Shopper analysis
            </Link>
            <Link href="/compare" className="rounded-xl border border-line p-4 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
              Test comparison
            </Link>
            <Link href="/dashboard/customer" className="rounded-xl border border-line p-4 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
              Inspect Shopper UI
            </Link>
            <Link href="/dashboard/seller" className="rounded-xl border border-line p-4 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
              Inspect Seller UI
            </Link>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Route validation</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Object.entries(diagnostics?.route_access ?? { guest: "analyze only", shopper: "shopper dashboard", seller: "seller dashboard", admin: "all routes" }).map(([roleName, access]) => (
            <div key={roleName} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-black capitalize text-ink dark:text-white">{roleName}</p>
              <p className="mt-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{String(access)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Sample datasets</h3>
          <div className="mt-4 grid gap-3">
            {sampleDatasets.map((item) => (
              <div key={item.title} className="rounded-xl border border-line p-4 dark:border-white/10">
                <p className="font-black text-ink dark:text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h3 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">Release checklist</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {validationItems.map((item) => (
              <div key={item} className="rounded-xl border border-line px-3 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
