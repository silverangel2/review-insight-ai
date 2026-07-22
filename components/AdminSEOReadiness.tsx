"use client";

import { useState } from "react";

type SeoStatus = "idle" | "checking" | "ready" | "warning" | "failed";

type SeoCheck = {
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
};

function statusText(status: SeoStatus) {
  if (status === "checking") return "Checking...";
  if (status === "ready") return "SEO ready";
  if (status === "warning") return "Needs review";
  if (status === "failed") return "Not ready";
  return "Not checked";
}

function statusClass(status: SeoStatus) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "checking") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  return "border-line bg-mist text-slate-600";
}

export function AdminSEOReadiness() {
  const [status, setStatus] = useState<SeoStatus>("idle");
  const [checks, setChecks] = useState<SeoCheck[]>([]);
  const [error, setError] = useState("");

  async function runReadiness() {
    setStatus("checking");
    setError("");
    setChecks([]);

    try {
      const response = await fetch("/api/admin/seo/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "SEO readiness check failed.");
      }

      setStatus(data.status === "ready" ? "ready" : data.status === "warning" ? "warning" : "failed");
      setChecks(Array.isArray(data.checks) ? data.checks : []);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "SEO readiness check failed.");
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            One-button SEO
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Launch readiness
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Check live-domain setup, SEO page metadata, sitemap, robots, and admin noindex protection in one pass.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className={`rounded-2xl border px-5 py-3 text-sm font-black ${statusClass(status)}`}>
            {statusText(status)}
          </div>
          <button
            type="button"
            onClick={() => void runReadiness()}
            disabled={status === "checking"}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:opacity-60 dark:bg-white dark:text-ink"
          >
            {status === "checking" ? "Checking..." : "Make SEO Ready"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      {checks.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {checks.map((item) => (
            <div key={item.label} className={`rounded-2xl border p-4 text-sm font-bold ${statusClass(item.status === "passed" ? "ready" : item.status)}`}>
              <p className="font-black">{item.label}</p>
              <p className="mt-2 leading-6">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
