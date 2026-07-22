"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { saveActiveMode, saveClientAccount } from "@/lib/clientAccount";
import { clearLatestResult } from "@/lib/resultStorage";
import { canAccessSellerAnalytics, type ClientAccount } from "@/lib/account";

function readVerificationParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

  return {
    accessToken: hash.get("access_token") || url.searchParams.get("access_token") || "",
    error: url.searchParams.get("error_description") || url.searchParams.get("error") || hash.get("error_description") || hash.get("error") || "",
    type: url.searchParams.get("type") || hash.get("type") || ""
  };
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [message, setMessage] = useState("Checking your email verification link...");

  useEffect(() => {
    let cancelled = false;

    async function completeVerification() {
      const params = readVerificationParams();

      if (params.error) {
        setStatus("error");
        setMessage(params.error);
        return;
      }

      if (!params.accessToken) {
        setStatus("ready");
        setMessage("Check your inbox and approve the ReviewIntel verification link. After approval, return here or sign in.");
        return;
      }

      const response = await fetch("/api/auth/oauth-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: params.accessToken, intent: "login" })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.account) {
        setStatus("error");
        setMessage(data.error || "Email verification was accepted, but ReviewIntel could not open the account.");
        return;
      }

      const account = data.account as ClientAccount;
      saveClientAccount(account);
      const hasSellerAccess = canAccessSellerAnalytics(account.role, account.plan);
      saveActiveMode(hasSellerAccess ? "seller" : "buyer");
      clearLatestResult();

      if (!cancelled) {
        setStatus("ready");
        setMessage("Email verified. Opening your ReviewIntel workspace...");
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

    void completeVerification();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <section className="rounded-2xl border border-line bg-white p-8 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <Badge tone={status === "error" ? "bad" : status === "checking" ? "warn" : "info"}>Email verification</Badge>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink dark:text-white">
          {status === "error" ? "Verification needs attention" : status === "checking" ? "Verifying your email" : "Verification link ready"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
            Back to login
          </Link>
          <Link href="/signup" className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
