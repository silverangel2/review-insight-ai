"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearClientAccount,
  getClientAccount,
  getStoredActiveMode
} from "@/lib/clientAccount";
import { planLabel, type ClientAccount } from "@/lib/account";
import { clearLatestResult } from "@/lib/resultStorage";
import type { AnalysisAudience } from "@/lib/types";

function roleLabel(role: ClientAccount["role"]) {
  if (role === "admin") return "Admin";
  if (role === "seller") return "Seller";
  if (role === "buyer") return "Shopper";
  return "Guest";
}

function modeLabel(mode: AnalysisAudience) {
  if (mode === "seller") return "Seller Mode";
  if (mode === "both") return "Dual Mode";
  return "Shopper Mode";
}

export function AccountNav() {
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [activeMode, setActiveMode] = useState<AnalysisAudience>("buyer");

  useEffect(() => {
    function refresh() {
      setAccount(getClientAccount());
      setActiveMode(getStoredActiveMode());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("reviewintel:account", refresh);
    window.addEventListener("reviewintel:active-mode", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("reviewintel:account", refresh);
      window.removeEventListener("reviewintel:active-mode", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  function logout() {
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    clearLatestResult();
    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    window.dispatchEvent(new CustomEvent("reviewintel:quota"));

    // Fire-and-forget admin/session logout. Do not wait before redirecting.
    fetch("/api/admin/logout", { method: "POST", keepalive: true }).catch(() => null);

    // Force every account type back to the login page.
    window.location.replace("/login");
  }

  if (!account) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden px-1 text-xs font-black uppercase tracking-wide text-ocean dark:text-cyan-300 sm:inline-flex">
          {modeLabel(activeMode)}
        </span>
        <Link
          href="/login"
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          Log in
        </Link>
      </div>
    );
  }

  const displayedMode =
    account.role === "admin"
      ? activeMode
      : account.role === "seller"
        ? "seller"
        : "buyer";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`hidden px-1 text-xs font-black uppercase tracking-wide sm:inline-flex ${
          displayedMode === "seller"
            ? "text-plum dark:text-purple-300"
            : displayedMode === "both"
              ? "text-amber"
              : "text-ocean dark:text-cyan-300"
        }`}
      >
        {modeLabel(displayedMode)}
      </span>
      <span className="hidden px-1 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300 sm:inline-flex">
        {roleLabel(account.role)}
      </span>
      <Link
        href="/account"
        title={account.email}
        className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white sm:px-4"
      >
        {planLabel(account.plan)}
      </Link>
      <button
        type="button"
        onClick={logout}
        className="rounded-xl bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-coral dark:bg-white dark:text-ink sm:px-4"
      >
        Log out
      </button>
    </div>
  );
}
