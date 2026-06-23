"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/Badge";
import { FREE_DAILY_REVIEW_LIMIT, hasUnlimitedUsage, isAdminRole, isSellerPlan, planLabel, type ClientAccount } from "@/lib/account";
import {
  accountHeaders,
  clearClientAccount,
  getClientAccount,
  getStoredQuota,
  quotaText,
  saveClientAccount,
  saveQuota,
  setClientPlan
} from "@/lib/clientAccount";
import { formatPercent } from "@/lib/analysisScoring";
import { clearLatestResult } from "@/lib/resultStorage";
import type { QuotaInfo, ReviewPlatform, SubscriptionPlan } from "@/lib/types";
import { productDisplayCode } from "@/lib/productDisplay";

const planOptions: Array<{
  plan: SubscriptionPlan;
  title: string;
  detail: string;
}> = [
  {
    plan: "free_buyer",
    title: "Shopper Free",
    detail: `${FREE_DAILY_REVIEW_LIMIT} product analyses per day for shoppers and quick review checks.`
  },
  {
    plan: "buyer_pro",
    title: "Shopper Premium",
    detail: "Unlimited shopper analyses, product history, favorites, comparisons, and stronger buying decisions."
  },
  {
    plan: "seller_premium",
    title: "Seller Premium",
    detail: "Seller analytics, complaint clustering, product improvement suggestions, and export-ready insights."
  },
  {
    plan: "seller_pro",
    title: "Seller Pro",
    detail: "Unlimited seller intelligence, competitor comparisons, market gaps, exports, and priority product-insight workflows."
  }
];

type RecentAnalysis = {
  id: string;
  product_name: string | null;
  platform: ReviewPlatform;
  overall_summary: string;
  product_score: number;
  created_at: string;
};

type AccountProfileForm = {
  name: string;
  profileId: string;
  companyName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  website: string;
  preferredLanguage: string;
  preferredCurrency: string;
  profileNotes: string;
  marketingConsent: boolean;
};

const emptyProfileForm: AccountProfileForm = {
  name: "",
  profileId: "",
  companyName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  website: "",
  preferredLanguage: "en",
  preferredCurrency: "CAD",
  profileNotes: "",
  marketingConsent: false
};

function isPrivateTestAccount(account: ClientAccount | null | undefined) {
  return Boolean(account?.email?.endsWith("@reviewintel.test"));
}

function displayAccountName(account: ClientAccount | null, activePlan: SubscriptionPlan) {
  if (!account) return "ReviewIntel account";
  if (account.role === "admin") return account.name || "ReviewIntel Admin";
  if (isPrivateTestAccount(account)) return planLabel(activePlan);
  return account.name || "ReviewIntel account";
}

function displayAccountEmail(account: ClientAccount | null) {
  if (!account) return "Local account";
  if (isPrivateTestAccount(account)) return "Private owner access";
  return account.email || "Local account";
}

function profileFromAccount(account: ClientAccount | null): AccountProfileForm {
  if (!account) return emptyProfileForm;

  return {
    name: account.name ?? "",
    profileId: account.profileId ?? "",
    companyName: account.companyName ?? "",
    phone: account.phone ?? "",
    addressLine1: account.addressLine1 ?? "",
    addressLine2: account.addressLine2 ?? "",
    city: account.city ?? "",
    region: account.region ?? "",
    postalCode: account.postalCode ?? "",
    country: account.country ?? "",
    website: account.website ?? "",
    preferredLanguage: account.preferredLanguage ?? "en",
    preferredCurrency: account.preferredCurrency ?? "CAD",
    profileNotes: account.profileNotes ?? "",
    marketingConsent: Boolean(account.marketingConsent)
  };
}

function effectiveRoleLabel(account: ClientAccount | null | undefined) {
  if (!account) return "Guest";
  if (account.role === "admin") return "Admin";
  if (account.role === "seller" || isSellerPlan(account.plan)) return "Seller";
  if (account.role === "guest") return "Guest";
  return "Shopper";
}

function effectiveAccountPlan(account: ClientAccount | null | undefined): SubscriptionPlan {
  const email = String(account?.email || "").toLowerCase();

  if (email === "shopper.free@reviewintel.test") return "free_buyer";
  if (email === "shopper.premium@reviewintel.test") return "buyer_pro";
  if (email === "seller.starter@reviewintel.test") return "seller_premium";
  if (email === "seller.pro@reviewintel.test") return "seller_pro";
  if (email === "seller.premium@reviewintel.test") return "seller_premium";

  return (account?.plan || "free_buyer") as SubscriptionPlan;
}

function displayPlanBadge(account: ClientAccount | null, activePlan: SubscriptionPlan) {
  if (account?.role === "admin") return "Admin";
  return planLabel(activePlan);
}

export function AccountDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState<AccountProfileForm>(emptyProfileForm);
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const checkoutStatus = params.get("checkout");
    const existing = getClientAccount();

    if (!existing) {
      setAccount(null);
      setQuota(getStoredQuota());
      return;
    }

    if (checkoutStatus === "success") {
      setProfileNotice("Payment received. Your account access will update as soon as billing syncs.");
    }

    setAccount(getClientAccount());
    setQuota(getStoredQuota());
    void refreshAccount();
  }, [params]);

  useEffect(() => {
    if (account) {
      const correctedPlan = effectiveAccountPlan(account);
      if (account.plan !== correctedPlan) {
        const nextAccount = { ...account, plan: correctedPlan };
        saveClientAccount(nextAccount);
        setAccount(nextAccount);
        return;
      }
    }

    setProfileForm(profileFromAccount(account));
  }, [account]);

  const activePlan = effectiveAccountPlan(account);
  const developerMode = isAdminRole(account?.role);
  const accountBlobText = JSON.stringify({ account, activePlan }).toLowerCase();
  const accountEmailText = String(account?.email || "").toLowerCase();
  const accountRoleText = String(account?.role || "").toLowerCase();
  const accountPlanText = String(account?.plan || activePlan || "").toLowerCase();

  const isSellerDashboardAccount =
    accountEmailText === "seller.starter@reviewintel.test" ||
    accountRoleText === "seller" ||
    accountPlanText === "seller_premium" ||
    accountPlanText === "seller_pro" ||
    accountBlobText.includes("seller.starter@reviewintel.test") ||
    accountBlobText.includes("seller_premium") ||
    accountBlobText.includes("seller_pro") ||
    accountBlobText.includes('"role":"seller"') ||
    accountBlobText.includes('"role": "seller"');

  const accountProfileReady = Boolean(account?.email || activePlan);

  const accountDashboardHref =
    isSellerDashboardAccount
      ? "/dashboard/seller"
      : account?.role === "admin"
        ? "/admin"
        : "/analyze";

  const accountPrimaryActionLabel = isSellerDashboardAccount ? "Seller Dashboard" : "Analyze Reviews";

  const planTone = useMemo(() => (account?.role === "admin" || activePlan !== "free_buyer" ? "good" : "warn"), [account?.role, activePlan]);
  const visiblePlanOptions = useMemo(() => {
    if (developerMode) return planOptions;
    if (account?.role === "seller" || isSellerPlan(activePlan)) return planOptions.filter((option) => option.plan === "seller_premium" || option.plan === "seller_pro");
    return planOptions.filter((option) => option.plan === "free_buyer" || option.plan === "buyer_pro");
  }, [account?.role, activePlan, developerMode]);

  async function refreshAccount() {
    const response = await fetch("/api/account", {
      headers: accountHeaders()
    }).catch(() => null);

    if (!response?.ok) return;
    const data = await response.json();
    if (data.account?.email) {
      const existing = getClientAccount();
      const serverAccount = data.account as Partial<ClientAccount> & { trusted?: boolean };
      const serverTrusted = Boolean(serverAccount.trusted);
      const sameAccount =
        Boolean(existing?.email && serverAccount.email) &&
        String(existing?.email).toLowerCase() === String(serverAccount.email).toLowerCase();

      const preferServerAccount = serverTrusted || sameAccount;

      const nextAccount: ClientAccount = {
        userId: preferServerAccount ? (serverAccount.userId ?? existing?.userId ?? null) : (existing?.userId ?? serverAccount.userId ?? null),
        authUserId: preferServerAccount ? (serverAccount.authUserId ?? existing?.authUserId ?? null) : (existing?.authUserId ?? serverAccount.authUserId ?? null),
        email: preferServerAccount ? (serverAccount.email ?? existing?.email ?? "local@reviewintel.local") : (existing?.email ?? serverAccount.email ?? "local@reviewintel.local"),
        name: preferServerAccount ? (serverAccount.name ?? existing?.name ?? "ReviewIntel user") : (existing?.name ?? serverAccount.name ?? "ReviewIntel user"),
        plan: preferServerAccount ? (serverAccount.plan ?? existing?.plan ?? "free_buyer") : (existing?.plan ?? serverAccount.plan ?? "free_buyer"),
        role: preferServerAccount ? (serverAccount.role ?? existing?.role ?? "buyer") : (existing?.role ?? serverAccount.role ?? "buyer"),
        accessToken: existing?.accessToken ?? serverAccount.accessToken,
        stripeCustomerId: serverTrusted ? (serverAccount.stripeCustomerId ?? existing?.stripeCustomerId ?? null) : (existing?.stripeCustomerId ?? serverAccount.stripeCustomerId ?? null),
        subscriptionStatus: preferServerAccount ? (serverAccount.subscriptionStatus ?? existing?.subscriptionStatus) : (existing?.subscriptionStatus ?? serverAccount.subscriptionStatus),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        profileId: serverTrusted ? (serverAccount.profileId ?? existing?.profileId) : existing?.profileId,
        companyName: serverTrusted ? (serverAccount.companyName ?? existing?.companyName) : existing?.companyName,
        phone: serverTrusted ? (serverAccount.phone ?? existing?.phone) : existing?.phone,
        addressLine1: serverTrusted ? (serverAccount.addressLine1 ?? existing?.addressLine1) : existing?.addressLine1,
        addressLine2: serverTrusted ? (serverAccount.addressLine2 ?? existing?.addressLine2) : existing?.addressLine2,
        city: serverTrusted ? (serverAccount.city ?? existing?.city) : existing?.city,
        region: serverTrusted ? (serverAccount.region ?? existing?.region) : existing?.region,
        postalCode: serverTrusted ? (serverAccount.postalCode ?? existing?.postalCode) : existing?.postalCode,
        country: serverTrusted ? (serverAccount.country ?? existing?.country) : existing?.country,
        website: serverTrusted ? (serverAccount.website ?? existing?.website) : existing?.website,
        preferredLanguage: serverTrusted ? (serverAccount.preferredLanguage ?? existing?.preferredLanguage ?? "en") : (existing?.preferredLanguage ?? "en"),
        preferredCurrency: serverTrusted ? (serverAccount.preferredCurrency ?? existing?.preferredCurrency ?? "CAD") : (existing?.preferredCurrency ?? "CAD"),
        profileNotes: serverTrusted ? (serverAccount.profileNotes ?? existing?.profileNotes) : existing?.profileNotes,
        marketingConsent: serverTrusted ? (serverAccount.marketingConsent ?? existing?.marketingConsent) : existing?.marketingConsent,
        passwordUpdatedAt: existing?.passwordUpdatedAt
      };
      saveClientAccount(nextAccount);
      setAccount(nextAccount);
      setProfileForm(profileFromAccount(nextAccount));
    }
    if (data.quota) {
      saveQuota(data.quota);
      setQuota(data.quota);
    }
    if (Array.isArray(data.analyses)) {
      setRecentAnalyses(data.analyses);
    }
  }

  async function choosePlan(plan: SubscriptionPlan) {
    setError("");

    if (!account) {
      router.push("/login?next=/account");
      return;
    }

    if (developerMode) {
      router.push("/admin");
      return;
    }

    if (plan !== "free_buyer") {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...accountHeaders() },
        body: JSON.stringify({
          plan,
          email: account?.email,
          userId: account.profileId || account.authUserId || account.userId || account.email,
          customerId: account.stripeCustomerId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Checkout failed.");
        return;
      }
      if (data.mode === "developer-simulated") {
        setClientPlan(plan);
        setAccount(getClientAccount());
        setQuota(getStoredQuota());
      }
      window.location.href = data.url;
      return;
    }

    setClientPlan(plan);
    setAccount(getClientAccount());
    setQuota(getStoredQuota());
  }

  async function openBillingPortal() {
    setError("");
    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...accountHeaders() },
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Billing portal failed.");
      return;
    }
    window.location.href = data.url;
  }

  async function signOut() {
    clearClientAccount();
    window.localStorage.removeItem("reviewintel:active-mode");
    window.localStorage.removeItem("reviewintel:quota");
    window.localStorage.removeItem("reviewintel:account-last-active");
    window.sessionStorage.removeItem("reviewintel:owner-unlocked");
    window.sessionStorage.removeItem("reviewintel:owner-last-active");
    clearLatestResult();
    await Promise.allSettled([
      fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }),
      fetch("/api/owner/logout", { method: "POST", credentials: "same-origin" })
    ]);
    router.push("/login");
  }

  useEffect(() => {
    if (!profileNotice || !/(saved|updated|success)/i.test(profileNotice)) return;

    const timer = window.setTimeout(() => {
      setIsEditingProfile(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profileNotice]);


  async function saveProfile() {
    if (!account) return;

    setError("");
    setProfileNotice("");

    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...accountHeaders()
      },
      body: JSON.stringify({
        name: profileForm.name.trim(),
        companyName: profileForm.companyName,
        phone: profileForm.phone,
        addressLine1: profileForm.addressLine1,
        addressLine2: profileForm.addressLine2,
        city: profileForm.city,
        region: profileForm.region,
        postalCode: profileForm.postalCode,
        country: profileForm.country,
        website: profileForm.website,
        preferredLanguage: profileForm.preferredLanguage,
        preferredCurrency: profileForm.preferredCurrency,
        profileNotes: profileForm.profileNotes,
        marketingConsent: profileForm.marketingConsent
      })
    }).catch(() => null);

    if (!response) {
      setError("Profile save failed. Please try again.");
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.error ?? "Profile save failed.");
      return;
    }

    const savedAccount = data.account as Partial<ClientAccount> | undefined;

    const nextAccount: ClientAccount = {
      ...account,
      ...profileForm,
      ...savedAccount,
      name:
        savedAccount?.name ??
        profileForm.name.trim() ??
        (isPrivateTestAccount(account) ? planLabel(account.plan) : account.name),
      marketingConsent:
        savedAccount?.marketingConsent ?? profileForm.marketingConsent
    };

    saveClientAccount(nextAccount);
    setAccount(nextAccount);
    setProfileForm(profileFromAccount(nextAccount));
    setIsEditingProfile(false);
    setProfileNotice("Profile changes saved.");
  }

  async function sendPasswordResetEmail() {
    setPasswordNotice("");

    if (!account?.email) {
      setPasswordNotice("No account email found. Please log in again.");
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: account.email })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Password reset request failed.");
      }

      setPasswordNotice("Password reset email sent. Check the inbox for this account.");
    } catch (error) {
      setPasswordNotice(error instanceof Error ? error.message : "Password reset request failed.");
    }
  }

  return (
    <section className="space-y-8">
      {!account ? (
        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <Badge tone="warn">Account required</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">Log in to open your workspace</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Guest users can try 3 analyses total, but dashboards, saved history, billing, and advanced analytics require a Shopper or Seller account.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
              Log in
            </Link>
            <Link href="/signup" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
              Create account
            </Link>
          </div>
        </article>
      ) : null}

      {account ? (
      <>
      <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={planTone}>{displayPlanBadge(account, activePlan)}</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink dark:text-white">{displayAccountName(account, activePlan)}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {displayAccountEmail(account)} · {effectiveRoleLabel(account)}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Daily usage</p>
            <p className="mt-2 text-sm font-black text-ink dark:text-white">
              {hasUnlimitedUsage(account.role, activePlan) ? "Unlimited product analyses" : quota ? quotaText(quota) : `${FREE_DAILY_REVIEW_LIMIT} free shopper analyses today`}
            </p>
          </div>
        </div>
      </article>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">Account profile</p>
              <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Identity, address, and account details</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={account.role === "admin" ? "good" : account.role === "seller" || isSellerPlan(account.plan) ? "info" : "good"}>{effectiveRoleLabel(account)} profile</Badge>
              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (account) {
                      setProfileForm(profileFromAccount(account));
                    }
                    setProfileNotice("");
                    setIsEditingProfile(true);
                  }}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Edit profile
                </button>
              ) : null}
            </div>
          </div>

          {!isEditingProfile ? (
            <div className="mt-5 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-lg font-black text-ink dark:text-white">
                {profileForm.name || displayAccountName(account, activePlan)}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {profileForm.companyName || effectiveRoleLabel(account)}
              </p>
              {profileForm.profileId ? (
                <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  Profile ID: {profileForm.profileId}
                </p>
              ) : null}
              <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {profileForm.phone ? <p>{profileForm.phone}</p> : null}
                {profileForm.city || profileForm.region ? (
                  <p>{[profileForm.city, profileForm.region].filter(Boolean).join(", ")}</p>
                ) : null}
                {profileForm.country ? <p>{profileForm.country}</p> : null}
                {profileForm.website ? <p className="truncate">{profileForm.website}</p> : null}
              </div>
              <p className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                Click Edit profile to update your information.
              </p>
            </div>
          ) : null}

          <div
            className={
              isEditingProfile
                ? "mt-5 overflow-hidden opacity-100 transition-all duration-300"
                : "pointer-events-none max-h-0 overflow-hidden opacity-0 transition-all duration-300"
            }
          >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["name", "Display name", "Your name"],
              ["companyName", "Company / store", "Optional"],
              ["phone", "Phone", "Optional"],
              ["addressLine1", "Address line 1", "Street address"],
              ["addressLine2", "Address line 2", "Apartment, suite, unit"],
              ["city", "City", "City"],
              ["region", "State / Province", "State or province"],
              ["postalCode", "Postal code", "Postal / ZIP"],
              ["country", "Country", "Country"],
              ["website", "Website / product store", "https://..."]
            ].map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="text-sm font-bold text-ink dark:text-white">{label}</span>
                <input
                  value={String(profileForm[key as keyof AccountProfileForm] ?? "")}
                  onChange={(event) => setProfileForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  placeholder={placeholder}
                />
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-ink dark:text-white">Language</span>
              <select
                value={profileForm.preferredLanguage}
                onChange={(event) => setProfileForm((current) => ({ ...current, preferredLanguage: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="zh">Chinese</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-ink dark:text-white">Preferred currency</span>
              <select
                value={profileForm.preferredCurrency}
                onChange={(event) => setProfileForm((current) => ({ ...current, preferredCurrency: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="PHP">PHP — Philippine Peso</option>
                <option value="AUD">AUD — Australian Dollar</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-bold text-ink dark:text-white">Notes / preferences</span>
            <textarea
              value={profileForm.profileNotes}
              onChange={(event) => setProfileForm((current) => ({ ...current, profileNotes: event.target.value }))}
              className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              placeholder="Saved products, support notes, seller workflow notes, or account preferences."
            />
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={profileForm.marketingConsent}
              onChange={(event) => setProfileForm((current) => ({ ...current, marketingConsent: event.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-black text-ink dark:text-white">Marketing email consent</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Store whether this customer wants launch updates, reports, and product emails.</span>
            </span>
          </label>

          {profileNotice ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm font-bold text-teal">{profileNotice}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveProfile}
              className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Save profile
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileNotice("");
                setIsEditingProfile(false);
              }}
              className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              Cancel
            </button>
          </div>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Security</p>
          <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Password and access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Send a secure password reset email for this account. Passwords are handled by the real auth flow, not local profile data.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={sendPasswordResetEmail}
              className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Send password reset email
            </button>
            <Link href="/auth/reset-password" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
              Open reset page
            </Link>
          </div>

          {passwordNotice ? <p className="mt-4 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-bold text-amber">{passwordNotice}</p> : null}
        </article>
      </section>

      {developerMode ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Control Center", "Main admin dashboard, QA, diagnostics, and launch checks.", "/admin"],
            ["Signed Customers", "Users, plans, scan counters, account reset, bans, and notes.", "/admin/customers"],
            ["Advertising", "Sponsor applications, ad switches, AdSense, and house ads.", "/admin/advertising"],
            ["Email System", "Admin email tools and customer messages.", "/admin/email"],
            ["Finance / Tax", "Track income, expenses, tax notes, and billing operations.", "/admin/finance"],
            ["Security", "Security logs, IP blocking, and admin security tests.", "/admin/security"],
            ["SEO Manager", "SEO pages, metadata, robots, sitemap, and landing pages.", "/admin/seo"],
            ["Marketing", "Marketing campaigns and outbound launch tools.", "/admin/marketing"],
          ].map(([title, detail, href]) => (
            <Link key={href} href={href} className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-ocean dark:border-white/10 dark:bg-slate-950">
              <Badge tone="good">Admin</Badge>
              <h2 className="mt-5 text-xl font-black text-ink dark:text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
            </Link>
          ))}
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {visiblePlanOptions.map((option) => (
            <article key={option.plan} className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
              <Badge tone={option.plan === activePlan ? "good" : "neutral"}>{option.plan === activePlan ? "Active" : "Available"}</Badge>
              <h2 className="mt-5 text-xl font-black text-ink dark:text-white">{option.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{option.detail}</p>
              <button
                onClick={() => choosePlan(option.plan)}
                className="mt-6 w-full rounded-xl bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
              >
                {option.plan === activePlan ? "Current plan" : `Use ${option.title}`}
              </button>
            </article>
          ))}
        </section>
      )}

      {error ? <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-xl font-black tracking-tight text-ink dark:text-white">Saved analysis history</h2>
        <div className="mt-4 grid gap-3">
          {recentAnalyses.length ? recentAnalyses.map((item) => (
            <article key={item.id} className="rounded-xl border border-line p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black text-ink dark:text-white">{productDisplayCode(item.product_name || "Untitled product")}</p>
                <Badge tone={item.product_score >= 70 ? "good" : item.product_score >= 45 ? "warn" : "bad"}>{formatPercent(item.product_score)}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.overall_summary}</p>
            </article>
          )) : (
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Your saved analyses appear here after you run ReviewIntel while logged in.</p>
          )}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          ["Manage Subscription", "Cancel, downgrade, open billing portal, or get billing help.", "/manage-subscription"],
          ["Customer Service", "Contact ReviewIntel support with product, account, or report questions.", "/contact"],
          ["Delete Account / Data", "Request account deletion, analysis deletion, export, or correction.", "/delete-account"]
        ].map(([title, detail, href]) => (
          <Link key={`${title}-${href}`} href={href} className="rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-ocean dark:border-white/10 dark:bg-slate-950">
            <p className="text-lg font-black text-ink dark:text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
          </Link>
        ))}
      </section>
<div className="flex flex-wrap gap-3">
        {accountProfileReady ? (
          <Link
            href={isSellerDashboardAccount ? "/dashboard/seller" : accountDashboardHref}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            {isSellerDashboardAccount ? "Seller Dashboard" : accountPrimaryActionLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-xl bg-slate-300 px-5 py-3 text-sm font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            Loading account…
          </button>
        )}
        <Link href="/compare" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
          Compare Products
        </Link>
        {activePlan !== "free_buyer" && !developerMode ? (
          <button onClick={() => void openBillingPortal()} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
            Manage billing
          </button>
        ) : null}
        <Link href="/manage-subscription" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white">
          Manage subscription
        </Link>
        <button onClick={() => void signOut()} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-coral hover:text-coral dark:border-white/10 dark:bg-white/5 dark:text-white">
          Sign out
        </button>
      </div>
      </>
      ) : null}
    </section>
  );
}
