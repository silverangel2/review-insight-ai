"use client";

import { useState } from "react";

export default function MetaVisibilityDiagnostic() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/meta-diagnostics", { method: "GET", credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Meta diagnosis failed.");
      setResult(data?.diagnostic || data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meta diagnosis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Meta visibility diagnosis</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">Read-only Page, token, Reel, and restriction evidence. No Facebook write is possible from this control.</p>
      <button type="button" onClick={run} disabled={busy} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">
        {busy ? "Running…" : "Run Meta visibility diagnosis"}
      </button>
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p> : null}
      {result ? <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-700">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}
