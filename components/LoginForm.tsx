"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeQuotaInfo, type ClientAccount } from "@/lib/account";
import { recordLocalLogin } from "@/lib/adminLocalTelemetry";
import { clearClientAccount, saveActiveMode, saveClientAccount, saveQuota } from "@/lib/clientAccount";
import type { SubscriptionPlan, UserRole } from "@/lib/types";

type AuthMode = "login" | "signup" | "reset";
type SignupRole = Extract<UserRole, "buyer" | "seller">;

const TEST_ACCOUNTS: Array<{
  label: string;
  email: string;
  password: string;
  name: string;
  role: "buyer" | "seller";
  plan: SubscriptionPlan;
  route: string;
  profileId: string;
  companyName?: string;
  addressLine1: string;
  city: string;
  country: string;
  detail: string;
}> = [
  {
    label: "Shopper Free",
    email: "shopper.free@reviewintel.test",
    password: "ReviewIntel123!",
    name: "Shopper Free Tester",
    role: "buyer",
    plan: "free_buyer",
    route: "/dashboard/customer",
    profileId: "SHOP-FREE-001",
    addressLine1: "101 Shopper Lane",
    city: "Toronto",
    country: "Canada",
    detail: "Free shopper flow, daily scan limit, no seller report."
  },
  {
    label: "Shopper Premium",
    email: "shopper.premium@reviewintel.test",
    password: "ReviewIntel123!",
    name: "Shopper Premium Tester",
    role: "buyer",
    plan: "buyer_pro",
    route: "/dashboard/customer",
    profileId: "SHOP-PRO-001",
    addressLine1: "22 Verdict Street",
    city: "Vancouver",
    country: "Canada",
    detail: "Paid shopper flow with unlimited shopper decisions."
  },
  {
    label: "Seller Starter",
    email: "seller.starter@reviewintel.test",
    password: "ReviewIntel123!",
    name: "Seller Starter Tester",
    role: "seller",
    plan: "seller_starter",
    route: "/dashboard/seller",
    profileId: "SELL-START-001",
    companyName: "Starter Seller Studio",
    addressLine1: "44 Product Road",
    city: "Moncton",
    country: "Canada",
    detail: "Seller-only analytics with starter product monitoring."
  },
  {
    label: "Seller Pro",
    email: "seller.pro@reviewintel.test",
    password: "ReviewIntel123!",
    name: "Seller Pro Tester",
    role: "seller",
    plan: "seller_pro",
    route: "/dashboard/seller",
    profileId: "SELL-PRO-001",
    companyName: "Pro Seller Command",
    addressLine1: "88 Growth Avenue",
    city: "Calgary",
    country: "Canada",
    detail: "Full Seller Pro dashboard, product health, calendar, and BI report."
  }
];

function defaultPlanForRole(role: SignupRole) {
  if (role === "seller") return "seller_starter";
  return "free_buyer";
}

export function LoginForm({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<SignupRole>("buyer");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function activateTestAccount(testAccount: (typeof TEST_ACCOUNTS)[number]) {
    setError("");
    setNotice("");
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    sessionStorage.removeItem("reviewintel:last-result");

    saveClientAccount({
      userId: `test-${testAccount.email}`,
      authUserId: `test-auth-${testAccount.email}`,
      email: testAccount.email,
      name: testAccount.name,
      plan: testAccount.plan,
      role: testAccount.role,
      subscriptionStatus: testAccount.plan === "free_buyer" ? "free" : "active",
      createdAt: new Date().toISOString(),
      profileId: testAccount.profileId,
      companyName: testAccount.companyName,
      addressLine1: testAccount.addressLine1,
      city: testAccount.city,
      country: testAccount.country,
      marketingConsent: true
    });
    saveActiveMode(testAccount.role === "seller" ? "seller" : "buyer");
    saveQuota(makeQuotaInfo(testAccount.plan, 0));
    recordLocalLogin(testAccount.email, testAccount.role, testAccount.plan);
    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    router.push(testAccount.route);
  }

  function fillTestAccount(testAccount: (typeof TEST_ACCOUNTS)[number]) {
    setMode("login");
    setEmail(testAccount.email);
    setPassword(testAccount.password);
    setNotice(`${testAccount.label} credentials loaded. Press Continue or use Open account.`);
  }

  async function submit() {
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

    const requestedTestAccount = mode === "login"
      ? TEST_ACCOUNTS.find((account) => account.email === normalizedEmail)
      : null;
    if (requestedTestAccount) {
      if (password !== requestedTestAccount.password) {
        setError("Use the exact QA password for this test account: ReviewIntel123!");
        return;
      }
      await activateTestAccount(requestedTestAccount);
      return;
    }

    const endpoint = mode === "signup" ? "/api/auth/signup" : mode === "reset" ? "/api/auth/password-reset" : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password, name, role })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Authentication request failed.");
      return;
    }

    if (mode === "reset") {
      setNotice("Password reset request accepted. Check your email when Supabase Auth is connected.");
      return;
    }

    const serverAccount = data.result?.account;
    if (mode === "login" && !serverAccount) {
      setError("Login did not return a valid account. Use a QA account or check authentication setup.");
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
      marketingConsent: serverProfile?.marketingConsent
    });

    const nextRole = savedRole;
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    sessionStorage.removeItem("reviewintel:last-result");
    saveActiveMode(nextRole === "seller" ? "seller" : "buyer");
    recordLocalLogin(serverAccount?.email ?? normalizedEmail, nextRole, serverAccount?.plan ?? defaultPlanForRole(savedRole));
    window.dispatchEvent(new CustomEvent("reviewintel:account"));
    window.dispatchEvent(new CustomEvent("reviewintel:active-mode"));
    router.push(nextRole === "seller" ? "/dashboard/seller" : "/dashboard/customer");
  }

  async function googleLogin() {
    setError("");
    const response = await fetch("/api/auth/google");
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
        Choose Shopper for shopping recommendations or Seller for business review analytics. Your account type controls the dashboard and analysis experience.
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
          placeholder="you@example.com"
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
      ) : null}

      {error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">{notice}</p> : null}

      <button onClick={submit} className="mt-6 w-full rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
        {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Continue"}
      </button>

      <button
        type="button"
        onClick={() => void googleLogin()}
        className="mt-3 w-full rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
      >
        Continue with Google
      </button>

      {mode === "login" ? (
        <section className="mt-6 rounded-2xl border border-ocean/20 bg-ocean/5 p-4 dark:border-cyan-300/15 dark:bg-cyan-300/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">Launch QA logins</p>
              <h2 className="mt-1 text-lg font-black text-ink dark:text-white">Real customer-mode test accounts</h2>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Password: ReviewIntel123!</p>
          </div>
          <div className="mt-4 grid gap-3">
            {TEST_ACCOUNTS.map((testAccount) => (
              <article key={testAccount.email} className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-ink dark:text-white">{testAccount.label}</p>
                    <p className="mt-1 break-all text-xs font-bold text-slate-500 dark:text-slate-400">{testAccount.email}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{testAccount.detail}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => fillTestAccount(testAccount)}
                      className="rounded-xl border border-line px-3 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white"
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => void activateTestAccount(testAccount)}
                      className="rounded-xl bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
                    >
                      Open account
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/auth/verify-email" className="hover:text-ocean">Email verification</Link>
        <Link href="/auth/reset-password" className="hover:text-ocean">Password reset</Link>
      </div>
    </section>
  );
}
