"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  clearClientAccount,
  getClientAccount,
  getStoredActiveMode
} from "@/lib/clientAccount";
import { planLabel, type ClientAccount } from "@/lib/account";
import { clearLatestResult } from "@/lib/resultStorage";
import type { AnalysisAudience } from "@/lib/types";

const ACCOUNT_LAST_ACTIVE_KEY = "reviewintel:account-last-active";
const ACCOUNT_IDLE_LIMIT_MS = 60 * 60 * 1000;

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

function clearPrivateBrowserSessions() {
  window.sessionStorage.removeItem("reviewintel:owner-unlocked");
  window.sessionStorage.removeItem("reviewintel:owner-last-active");
}

function markAccountActivity() {
  window.localStorage.setItem(ACCOUNT_LAST_ACTIVE_KEY, String(Date.now()));
}

function handleLogout() {
  try {
    localStorage.removeItem("reviewintel_user");
    localStorage.removeItem("reviewintel_account");
    localStorage.removeItem("reviewintel_plan");
    sessionStorage.clear();
  } catch {
    // Ignore storage errors.
  }

  window.location.href = "/";
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

  const logout = useCallback(async () => {
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    window.localStorage.removeItem(ACCOUNT_LAST_ACTIVE_KEY);
    clearPrivateBrowserSessions();
    clearLatestResult();
    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    window.dispatchEvent(new CustomEvent("reviewintel:quota"));

    await Promise.allSettled([
      fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }),
      fetch("/api/owner/logout", { method: "POST", credentials: "same-origin" })
    ]);

    // Force every account type back to the login page.
    window.location.replace("/login");
  }, []);

  useEffect(() => {
    if (!account) return;

    const expireIfIdle = () => {
      const lastActive = Number(window.localStorage.getItem(ACCOUNT_LAST_ACTIVE_KEY) ?? "0");
      if (!lastActive || Date.now() - lastActive >= ACCOUNT_IDLE_LIMIT_MS) {
        void logout();
        return true;
      }
      return false;
    };

    const recordActivity = () => {
      if (!expireIfIdle()) markAccountActivity();
    };

    markAccountActivity();
    const interval = window.setInterval(expireIfIdle, 60 * 1000);
    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"] as const;
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [account, logout]);

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
        onClick={() => void handleLogout()}
        className="rounded-xl bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-coral dark:bg-white dark:text-ink sm:px-4"
      >
        Log out
      </button>
    </div>
  );
}
