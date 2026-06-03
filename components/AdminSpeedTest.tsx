"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";

type SpeedResult = {
  label: string;
  ms: number;
  status: "good" | "warn" | "bad";
  detail: string;
};

function toneFor(ms: number): SpeedResult["status"] {
  if (ms < 350) return "good";
  if (ms < 1200) return "warn";
  return "bad";
}

export function AdminSpeedTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [lastRun, setLastRun] = useState("");

  async function measure(label: string, action: () => Promise<void>): Promise<SpeedResult> {
    const start = performance.now();
    try {
      await action();
      const ms = Math.round(performance.now() - start);
      return { label, ms, status: toneFor(ms), detail: "Responded successfully" };
    } catch (error) {
      const ms = Math.round(performance.now() - start);
      return { label, ms, status: "bad", detail: error instanceof Error ? error.message : "Failed" };
    }
  }

  async function runSpeedTest() {
    setIsRunning(true);
    setResults([]);
    const checks: SpeedResult[] = [];

    checks.push(await measure("Homepage fetch", async () => {
      const response = await fetch("/", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }));

    checks.push(await measure("Admin users API", async () => {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }));

    checks.push(await measure("Local storage", async () => {
      const key = "reviewintel:speed-test";
      window.localStorage.setItem(key, String(Date.now()));
      window.localStorage.removeItem(key);
    }));

    setResults(checks);
    setLastRun(new Date().toLocaleString());
    setIsRunning(false);
  }

  const average = results.length ? Math.round(results.reduce((sum, item) => sum + item.ms, 0) / results.length) : 0;

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge tone="info">Admin speed test</Badge>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Site performance check</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Quick owner-side test for homepage response, admin API response, and browser storage speed.
          </p>
        </div>
        <button type="button" onClick={runSpeedTest} disabled={isRunning} className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink">
          {isRunning ? "Testing..." : "Run speed test"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Average</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{results.length ? `${average} ms` : "—"}</p>
        </div>
        {results.map((result) => (
          <div key={result.label} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{result.label}</p>
              <Badge tone={result.status === "good" ? "good" : result.status === "warn" ? "warn" : "bad"}>{result.status}</Badge>
            </div>
            <p className="mt-2 text-2xl font-black text-ink dark:text-white">{result.ms} ms</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{result.detail}</p>
          </div>
        ))}
      </div>

      {lastRun ? <p className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">Last run: {lastRun}</p> : null}
    </section>
  );
}
