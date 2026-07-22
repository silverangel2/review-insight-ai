"use client";

import { useMemo, useState } from "react";

type CheckStatus = "idle" | "running" | "passed" | "warning" | "failed";

type DailyCheckResult = {
  id: string;
  label: string;
  status: "passed" | "warning" | "failed";
  message: string;
  details?: Record<string, unknown>;
  suggested_fix?: string;
};

type DailyCheckResponse = {
  ok: boolean;
  status: "passed" | "warning" | "failed";
  duration_ms: number;
  checked_at: string;
  results: DailyCheckResult[];
};

const CHECKS = [
  { id: "all", label: "Run All Checks" },
  { id: "api", label: "API" },
  { id: "openai", label: "OpenAI" },
  { id: "supabase", label: "Supabase" },
  { id: "adminUsers", label: "Admin Users" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "auth", label: "Login/Logout" },
  { id: "security", label: "Security" },
  { id: "env", label: "Environment" },
  { id: "analyze", label: "Analyze Config" },
  { id: "routes", label: "Program Paths" },
  { id: "history", label: "Scan History" },
  { id: "social", label: "Social Auto-Post" }
];

function statusLabel(status: CheckStatus) {
  if (status === "running") return "Running...";
  if (status === "passed") return "Working good";
  if (status === "warning") return "Warning";
  if (status === "failed") return "Failed";
  return "Not checked";
}

function statusClass(status: CheckStatus) {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200";
  if (status === "running") return "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200";
  return "border-line bg-mist text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300";
}

function buildRustyReport(response: DailyCheckResponse | null, errorMessage?: string) {
  if (!response) {
    return `ReviewIntel Admin Daily Check Error

Status: Failed
Message: ${errorMessage ?? "No check response available."}

Please troubleshoot this issue.`;
  }

  const lines = [
    "ReviewIntel Admin Daily Check Report",
    "",
    `Overall status: ${response.status}`,
    `Checked at: ${response.checked_at}`,
    `Duration: ${response.duration_ms}ms`,
    "",
    "Results:"
  ];

  for (const item of response.results) {
    lines.push("");
    lines.push(`- ${item.label}: ${item.status}`);
    lines.push(`  Message: ${item.message}`);

    if (item.suggested_fix) {
      lines.push(`  Suggested fix: ${item.suggested_fix}`);
    }

    if (item.details) {
      lines.push(`  Details: ${JSON.stringify(item.details, null, 2)}`);
    }
  }

  lines.push("");
  lines.push("Please troubleshoot based on this report.");

  return lines.join("\n");
}

export function AdminDailyCheckCenter() {
  const [runningCheck, setRunningCheck] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<DailyCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const overallStatus: CheckStatus = runningCheck
    ? "running"
    : lastResponse?.status ?? (error ? "failed" : "idle");

  const rustyReport = useMemo(() => buildRustyReport(lastResponse, error ?? undefined), [lastResponse, error]);

  async function runCheck(check: string) {
    setRunningCheck(check);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/admin/daily-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ check })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? `Check failed with HTTP ${response.status}`);
      }

      setLastResponse(data);
    } catch (err) {
      setLastResponse(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningCheck(null);
    }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(rustyReport);
    setCopied(true);
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Daily check center
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink dark:text-white">
            One-click system health checks
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Press a button and ReviewIntel will check the important systems for you. If anything fails, copy the report into the AI troubleshooter.
          </p>
        </div>

        <div className={`rounded-2xl border px-5 py-4 text-sm font-black ${statusClass(overallStatus)}`}>
          {statusLabel(overallStatus)}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CHECKS.map((check) => (
          <button
            key={check.id}
            type="button"
            onClick={() => void runCheck(check.id)}
            disabled={Boolean(runningCheck)}
            className={`rounded-2xl px-4 py-4 text-left text-sm font-black transition ${
              check.id === "all"
                ? "bg-ink text-white hover:bg-ocean disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:bg-white dark:text-ink"
                : "border border-line bg-mist text-ink hover:-translate-y-0.5 hover:border-ocean disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            }`}
          >
            <span>{runningCheck === check.id ? "Running..." : check.label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          <p className="font-black">Check failed</p>
          <p className="mt-2">{error}</p>
        </div>
      ) : null}

      {lastResponse ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-ink dark:text-white">
                Last result: {statusLabel(lastResponse.status)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Checked at {new Date(lastResponse.checked_at).toLocaleString()} · {lastResponse.duration_ms}ms
              </p>
            </div>

            <button
              type="button"
              onClick={() => void copyReport()}
              className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink"
            >
              {copied ? "Copied" : "Copy Troubleshooting Report"}
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {lastResponse.results.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-5 ${statusClass(item.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black">{item.label}</p>
                    <p className="mt-2 text-sm leading-6">{item.message}</p>
                  </div>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase dark:bg-gradient-to-r from-sky-600 to-teal-500/20">
                    {item.status}
                  </span>
                </div>

                {item.suggested_fix ? (
                  <p className="mt-3 rounded-xl bg-white/70 p-3 text-xs font-bold leading-5 dark:bg-gradient-to-r from-sky-600 to-teal-500/20">
                    Fix: {item.suggested_fix}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
