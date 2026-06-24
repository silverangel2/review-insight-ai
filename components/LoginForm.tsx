"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { canAccessSellerAnalytics, type ClientAccount } from "@/lib/account";
import { getClientAccount, saveActiveMode, saveClientAccount } from "@/lib/clientAccount";
import { clearLatestResult } from "@/lib/resultStorage";
import type { UserRole } from "@/lib/types";

type AuthMode = "login" | "signup" | "reset";
type SignupRole = Extract<UserRole, "buyer" | "seller">;


function defaultPlanForRole(role: SignupRole) {
  void role;
  return "free_buyer";
}

function nextPathForAccount(role: SignupRole, plan: ClientAccount["plan"]) {
  if (role === "seller") {
    return canAccessSellerAnalytics(role, plan) ? "/seller/analyze" : "/pricing?plan=seller_premium";
  }

  return "/analyze";
}

function profileCompletionPath(nextPath = "/analyze") {
  return `/account?completeProfile=1&next=${encodeURIComponent(nextPath)}`;
}

function isProfileComplete(account: Partial<ClientAccount> | null | undefined) {
  if (!account) return false;

  const requiredValues = [
    account.name,
    account.companyName,
    account.phone,
    account.addressLine1,
    account.addressLine2,
    account.city,
    account.region,
    account.postalCode,
    account.country,
    account.website,
    account.preferredLanguage,
    account.preferredCurrency,
    account.profileNotes,
  ];

  return requiredValues.every((value) => String(value ?? "").trim().length > 0);
}

export function LoginForm({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<SignupRole>("buyer");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const account = getClientAccount();

    if (account?.role && account?.plan) {
      const nextPath = nextPathForAccount(account.role as SignupRole, account.plan);

      if (!isProfileComplete(account)) {
        window.location.replace(profileCompletionPath(nextPath));
        return;
      }

      window.location.replace(nextPath);
      return;
    }

    setCheckingSession(false);
  }, []);


  async function submit() {
    if (submitting) return;

    setError("");
    setNotice("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email to continue.");
      return;
    }

    if (mode !== "reset" && password.length < 8) {
      setError("Use at least 8 characters for production-ready password rules.");
      return;
    }

    if (mode === "signup" && !termsAccepted) {
      setError("Accept the Terms of Service and Privacy Policy to create your account.");
      return;
    }

    setSubmitting(true);

    const endpoint = mode === "signup" ? "/api/auth/signup" : mode === "reset" ? "/api/auth/password-reset" : "/api/auth/login";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, name, role, termsAccepted, marketingConsent })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Authentication request failed.");
        return;
      }

      if (mode === "reset") {
        setNotice("Password reset request accepted. Check your email for the reset link.");
        return;
      }

      if (mode === "signup" && data.emailConfirmationRequired) {
        setNotice(data.message || "Account created. Check your email and approve the verification link before signing in.");
        setMode("login");
        setPassword("");
        return;
      }

      const serverAccount = data.result?.account;
      if (mode === "login" && !serverAccount && !data.result?.user) {
        setError("Login did not return an account. Please sign up first or check your email/password.");
        return;
      }

      const serverProfile = serverAccount as Partial<ClientAccount> | null | undefined;
      const savedRole: SignupRole = serverAccount?.role === "seller" ? "seller" : role;
      saveClientAccount({
        userId: serverAccount?.userId ?? null,
        authUserId: serverAccount?.authUserId ?? data.result?.user?.id ?? null,
        email: serverAccount?.email ?? normalizedEmail,
        name: serverAccount?.name ?? (name.trim() || normalizedEmail.split("@")[0] || "ReviewIntel user"),
        plan: serverAccount?.plan ?? defaultPlanForRole(savedRole),
        role: savedRole,
        accessToken: serverAccount?.accessToken ?? data.result?.access_token,
        stripeCustomerId: serverAccount?.stripeCustomerId ?? null,
        subscriptionStatus: serverAccount?.subscriptionStatus,
        createdAt: serverProfile?.createdAt ?? new Date().toISOString(),
        profileId: serverProfile?.profileId,
        companyName: serverProfile?.companyName,
        phone: serverProfile?.phone,
        addressLine1: serverProfile?.addressLine1,
        addressLine2: serverProfile?.addressLine2,
        city: serverProfile?.city,
        region: serverProfile?.region,
        postalCode: serverProfile?.postalCode,
        country: serverProfile?.country,
        website: serverProfile?.website,
        profileNotes: serverProfile?.profileNotes,
        marketingConsent: serverProfile?.marketingConsent ?? marketingConsent
      });

      const nextRole = savedRole;
      const nextPlan = serverAccount?.plan ?? defaultPlanForRole(savedRole);

      await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
      clearLatestResult();
      saveActiveMode(canAccessSellerAnalytics(nextRole, nextPlan) ? "seller" : "buyer");

      const nextPath = nextPathForAccount(nextRole, nextPlan);

      if (!isProfileComplete(account)) {
        window.location.replace(profileCompletionPath(nextPath));
        return;
      }

      window.location.replace(nextPath);
    } finally {
      setSubmitting(false);
    }
  }

  async function googleLogin() {
    setError("");
    setNotice("");

    if (mode === "signup" && !termsAccepted) {
      setError("Accept the Terms of Service and Privacy Policy before signing up with Google.");
      return;
    }

    const nextPath = nextPathForAccount(role, defaultPlanForRole(role));

    const params = new URLSearchParams({
      intent: mode === "signup" ? "signup" : "login",
      termsAccepted: mode === "signup" && termsAccepted ? "true" : "false",
      marketingConsent: marketingConsent ? "true" : "false",
      role: mode === "signup" ? role : "buyer",
      next: profileCompletionPath(nextPath)
    });
    const response = await fetch(`/api/auth/google?${params.toString()}`);
    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    if (!response.ok) {
      setError(data.error || "Google login failed.");
      return;
    }

    setNotice(data.message || "Google login is ready once Supabase Auth environment variables are configured.");
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Secure account</p>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">
        {mode === "signup" ? "Create your ReviewIntel account" : mode === "reset" ? "Reset your password" : "Log in to ReviewIntel"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Log in with your ReviewIntel account, or create a new Shopper or Seller account to start scanning reviews.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-mist p-1 dark:bg-white/5">
        {[
          ["login", "Login"],
          ["signup", "Sign up"],
          ["reset", "Reset"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value as AuthMode)}
            className={`rounded-xl px-3 py-2 text-sm font-black transition ${
              mode === value ? "bg-white text-ink shadow-soft dark:bg-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "signup" ? (
        <label className="mt-6 block">
          <span className="text-sm font-bold text-ink dark:text-white">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="Optional"
          />
        </label>
      ) : null}

      <label className={mode === "signup" ? "mt-4 block" : "mt-6 block"}>
        <span className="text-sm font-bold text-ink dark:text-white">Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          placeholder="your@email.com"
        />
      </label>

      {mode !== "reset" ? (
        <label className="mt-4 block">
          <span className="text-sm font-bold text-ink dark:text-white">Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="8+ characters"
          />
        </label>
      ) : null}

      {mode === "signup" ? (
        <>
          <label className="mt-4 block">
            <span className="text-sm font-bold text-ink dark:text-white">Profile type</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as SignupRole)}
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              <option value="buyer">Shopper</option>
              <option value="seller">Seller / business</option>
            </select>
          </label>

          <label className="mt-4 flex gap-3 rounded-2xl border border-line bg-mist/60 p-4 text-sm font-bold leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-1 size-4 rounded border-line text-ocean"
            />
            <span>
              I accept the <Link href="/terms" className="text-ocean hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-ocean hover:underline">Privacy Policy</Link>.
            </span>
          </label>

          <label className="mt-3 flex gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-bold leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(event) => setMarketingConsent(event.target.checked)}
              className="mt-1 size-4 rounded border-line text-ocean"
            />
            <span>Email me product updates and ReviewIntel tips. Optional.</span>
          </label>
        </>
      ) : null}

      {error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">{notice}</p> : null}

      <button
        onClick={submit}
        disabled={submitting}
        className="mt-6 w-full rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-wait disabled:bg-slate-400 dark:bg-white dark:text-ink"
      >
        {submitting ? "Working..." : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Continue"}
      </button>

      <button
        type="button"
        onClick={() => void googleLogin()}
        className="mt-3 w-full rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
      >
        {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>


      <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/auth/verify-email" className="hover:text-ocean">Email verification</Link>
        <Link href="/auth/reset-password" className="hover:text-ocean">Password reset</Link>
      </div>
    </section>
  );
}
