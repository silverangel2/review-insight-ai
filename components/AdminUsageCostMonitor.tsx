"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { clearLocalTelemetry, readLocalTelemetry, type LocalTelemetrySummary } from "@/lib/adminLocalTelemetry";
import { planLabel } from "@/lib/account";

function money(value: number) {
  return `$${value.toFixed(4)}`;
}

function dateLabel(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function AdminUsageCostMonitor() {
  const [summary, setSummary] = useState<LocalTelemetrySummary>(() => readLocalTelemetry());

  useEffect(() => {
    function refresh() {
      setSummary(readLocalTelemetry());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("reviewintel:admin-telemetry", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("reviewintel:admin-telemetry", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge tone="info">Local admin monitor</Badge>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink dark:text-white">Sign-ins, scans, and estimated AI cost</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Local launch monitor for QA and early deployment testing. Production should later connect this to Supabase or a database table.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearLocalTelemetry();
            setSummary(readLocalTelemetry());
          }}
          className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-white"
        >
          Clear local monitor
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total logins</p>
          <p className="mt-2 text-3xl font-black text-ocean">{summary.totalLogins}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total scans</p>
          <p className="mt-2 text-3xl font-black text-teal">{summary.totalScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Estimated AI cost</p>
          <p className="mt-2 text-3xl font-black text-amber">{money(summary.totalEstimatedCostUsd)}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line dark:border-white/10">
        <div className="grid grid-cols-6 gap-2 bg-mist px-4 py-3 text-xs font-black uppercase text-slate-500 dark:bg-white/[0.04]">
          <span>Email</span>
          <span>Role</span>
          <span>Plan</span>
          <span>Logins</span>
          <span>Scans</span>
          <span>Est. cost</span>
        </div>
        {summary.users.length ? (
          summary.users.map((user) => (
            <div key={`${user.email}:${user.plan}`} className="grid grid-cols-6 gap-2 border-t border-line px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
              <span className="font-bold">{user.email}</span>
              <span>{user.role}</span>
              <span>{planLabel(user.plan)}</span>
              <span>{user.loginCount}</span>
              <span>{user.scanCount}</span>
              <span>{money(user.estimatedCostUsd)}</span>
              <span className="col-span-6 text-xs text-slate-500">
                Last login: {dateLabel(user.lastLoginAt)} · Last scan: {dateLabel(user.lastScanAt)}
              </span>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-sm font-bold text-slate-500">No local sign-ins or scans recorded yet.</div>
        )}
      </div>
    </section>
  );
}
