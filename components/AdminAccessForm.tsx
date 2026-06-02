"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeQuotaInfo } from "@/lib/account";
import { saveClientAccount, saveQuota } from "@/lib/clientAccount";

export function AdminAccessForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function unlock() {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Access failed.");
      }

      saveClientAccount({
        email: data.account?.email ?? "developer@reviewintel.local",
        name: data.account?.name ?? "ReviewIntel Operator",
        role: "admin",
        plan: "seller_pro",
        subscriptionStatus: "developer",
        createdAt: new Date().toISOString()
      });
      saveQuota(makeQuotaInfo("seller_pro", 0));
      router.push("/admin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Access failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Secure access</p>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Control Center</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Enter your access code to continue to the operations workspace.
      </p>

      <label className="mt-6 block">
        <span className="text-sm font-bold text-ink dark:text-white">Access code</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          type="password"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          placeholder="Enter access code"
        />
      </label>

      {error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <button
        type="button"
        onClick={() => void unlock()}
        disabled={isLoading || code.trim().length === 0}
        className="mt-6 w-full rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-ink"
      >
        {isLoading ? "Checking..." : "Continue"}
      </button>
    </section>
  );
}
