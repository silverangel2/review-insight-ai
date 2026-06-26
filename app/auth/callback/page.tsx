"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveActiveMode, saveClientAccount } from "@/lib/clientAccount";
import { clearLatestResult } from "@/lib/resultStorage";
import { canAccessSellerAnalytics, type ClientAccount } from "@/lib/account";

function readOAuthParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;

  return {
    accessToken: hash.get("access_token") || query.get("access_token") || "",
    error: query.get("error_description") || query.get("error") || hash.get("error_description") || hash.get("error") || "",
    code: query.get("code") || "",
    state: query.get("state") || hash.get("state") || "",
    intent: query.get("intent") || hash.get("intent") || "",
    marketingConsent: query.get("marketingConsent") || hash.get("marketingConsent") || "",
    role: query.get("role") || hash.get("role") || ""
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing Google sign in...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function completeGoogleAuth() {
      const params = readOAuthParams();
      if (params.error) {
        setError(params.error);
        return;
      }

      if (!params.accessToken && !params.code) {
        setError("Google login did not return a session token. Please try again.");
        return;
      }

      if (params.code) {
        setMessage("Completing secure Google sign in...");
      }

      const response = await fetch("/api/auth/oauth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          params.accessToken
            ? { accessToken: params.accessToken }
            : {
                code: params.code,
                intent: params.intent === "signup" ? "signup" : "login",
                marketingConsent: params.marketingConsent === "true",
                role: params.role === "seller" ? "seller" : "buyer",
                state: params.state
              }
        )
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.account) {
        setError(data.error || "Google sign in could not be completed.");
        return;
      }

      const account = data.account as ClientAccount;
      const isAdminAccount = String(account.role || "").toLowerCase() === "admin";

      // Security cleanup:
      // A normal Google buyer/seller login must never inherit an old admin/owner session
      // from the same browser. Only a real admin account may keep admin access.
      if (!isAdminAccount) {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);

        try {
          Object.keys(window.localStorage)
            .filter((key) => key.toLowerCase().includes("admin") || key.toLowerCase().includes("owner"))
            .forEach((key) => window.localStorage.removeItem(key));

          Object.keys(window.sessionStorage)
            .filter((key) => key.toLowerCase().includes("admin") || key.toLowerCase().includes("owner"))
            .forEach((key) => window.sessionStorage.removeItem(key));
        } catch {
          // Ignore browser storage cleanup failures.
        }
      }

      saveClientAccount(account);
      const hasSellerAccess = canAccessSellerAnalytics(account.role, account.plan);
      saveActiveMode(hasSellerAccess ? "seller" : "buyer");
      clearLatestResult();
      setMessage("Google sign in complete. Opening ReviewIntel...");

      if (!cancelled) {
        router.replace(
          hasSellerAccess
            ? "/seller/analyze"
            : account.role === "seller"
              ? "/pricing?plan=seller_premium"
            : account.plan === "buyer_pro"
              ? "/analyze"
              : "/analyze"
        );
      }
    }

    void completeGoogleAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-[70vh] bg-[linear-gradient(135deg,#d6fbf5_0%,#eef8ff_46%,#fff0c9_100%)] px-6 py-16 text-ink">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-white/72 p-8 text-center shadow-soft backdrop-blur">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#08b7a8,#2356a3_58%,#ffb238)] text-sm font-black text-white shadow-glow">
          RI
        </span>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-ocean">Google account</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">{error ? "Google sign in needs attention" : message}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {error || "ReviewIntel is securely preparing your shopper or seller workspace."}
        </p>
        {error ? (
          <a href="/login" className="mt-7 inline-flex rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white transition hover:bg-ocean">
            Back to login
          </a>
        ) : (
          <div className="mx-auto mt-7 h-3 max-w-xs overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#08b7a8,#2356a3,#ffb238)]" />
          </div>
        )}
      </section>
    </main>
  );
}
