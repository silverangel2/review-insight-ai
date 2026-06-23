"use client";

import {
  ACCOUNT_STORAGE_KEY,
  ACTIVE_MODE_STORAGE_KEY,
  FREE_DAILY_REVIEW_LIMIT,
  GUEST_ID_STORAGE_KEY,
  QUOTA_STORAGE_KEY,
  type ClientAccount,
  hasUnlimitedUsage,
  makeQuotaInfo,
  normalizePlan,
  normalizeRole,
  quotaLabel,
  roleForPlan, forceSellerPremiumTesterAccount } from "@/lib/account";
import type { AnalysisAudience, QuotaInfo, SubscriptionPlan, UserRole } from "@/lib/types";

const SCAN_TALLY_STORAGE_KEY = "reviewintel_scan_tally";

export const ACCOUNT_LAST_ACTIVE_KEY = "reviewintel:account-last-active";
export const ACCOUNT_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseDocument() {
  return typeof document !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  if (!canUseDocument()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function deleteCookie(name: string) {
  if (!canUseDocument()) return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function getGuestId() {
  if (!canUseStorage()) return "guest";

  let guestId = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (!guestId) {
    guestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
  }

  return guestId;
}

function getClientAccountRaw(): ClientAccount | null {
  if (!canUseStorage()) return null;

  try {
    const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!stored) return null;

    const lastActive = Number(window.localStorage.getItem(ACCOUNT_LAST_ACTIVE_KEY) ?? "0");
    if (lastActive && Date.now() - lastActive > ACCOUNT_IDLE_TIMEOUT_MS) {
      clearClientAccount();
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<ClientAccount>;
    if (!parsed.email) return null;

    return {
      userId: parsed.userId ?? null,
      authUserId: parsed.authUserId ?? null,
      email: parsed.email,
      name: parsed.name || parsed.email.split("@")[0] || "ReviewIntel user",
      plan: normalizePlan(parsed.plan),
      role: normalizeRole(parsed.role),
      accessToken: parsed.accessToken,
      stripeCustomerId: parsed.stripeCustomerId ?? null,
      subscriptionStatus: parsed.subscriptionStatus,
      createdAt: parsed.createdAt || new Date().toISOString(),
      profileId: parsed.profileId,
      companyName: parsed.companyName,
      phone: parsed.phone,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      region: parsed.region,
      postalCode: parsed.postalCode,
      country: parsed.country,
      website: parsed.website,
      profileNotes: parsed.profileNotes,
      marketingConsent: Boolean(parsed.marketingConsent),
      passwordUpdatedAt: parsed.passwordUpdatedAt
    };
  } catch {
    return null;
  }
}

export function saveClientAccount(account: ClientAccount) {
  if (!canUseStorage()) return;
  const previous = getClientAccount();
  const normalized = {
    ...account,
    role: normalizeRole(account.role),
    plan: normalizePlan(account.plan)
  };
  window.localStorage.setItem(ACCOUNT_LAST_ACTIVE_KEY, String(Date.now()));
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(normalized));
  if (!previous || previous.email !== normalized.email) {
    window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(makeQuotaInfo(normalized.plan, 0)));
  }
  setCookie("reviewintel_account_role", normalized.role);
  setCookie("reviewintel_account_plan", normalized.plan);
  setCookie("reviewintel_account_email", normalized.email);
  window.dispatchEvent(new CustomEvent("reviewintel:account", { detail: normalized }));
}

export function clearClientAccount(options: { preserveOwnerSession?: boolean } = {}) {
  if (canUseStorage()) {
    window.localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    window.localStorage.removeItem(QUOTA_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_MODE_STORAGE_KEY);
    window.localStorage.removeItem(ACCOUNT_LAST_ACTIVE_KEY);
  }

  if (!options.preserveOwnerSession && typeof window !== "undefined" && typeof window.sessionStorage !== "undefined") {
    window.sessionStorage.removeItem("reviewintel:owner-unlocked");
    window.sessionStorage.removeItem("reviewintel:owner-last-active");
  }

  deleteCookie("reviewintel_account_role");
  deleteCookie("reviewintel_account_plan");
  deleteCookie("reviewintel_account_email");
  window.dispatchEvent(new CustomEvent("reviewintel:account"));
  window.dispatchEvent(new CustomEvent("reviewintel:quota"));
}

export function touchClientAccountActivity() {
  if (!canUseStorage()) return;
  if (!getClientAccount()) return;
  window.localStorage.setItem(ACCOUNT_LAST_ACTIVE_KEY, String(Date.now()));
}

export async function logoutEverywhere(redirectPath = "/login") {
  clearClientAccount();

  await Promise.allSettled([
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }),
    fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }),
    fetch("/api/owner/logout", { method: "POST", credentials: "same-origin" })
  ]);

  window.location.href = redirectPath;
}

export function setClientPlan(plan: SubscriptionPlan) {
  const existing = getClientAccount();
  const account: ClientAccount = existing ?? {
    email: "local@reviewintel.local",
    name: "Local user",
    plan,
    role: roleForPlan(plan),
    createdAt: new Date().toISOString()
  };

  saveClientAccount({ ...account, plan, role: account.role === "admin" ? "admin" : roleForPlan(plan) });
}

export function setClientRole(role: ClientAccount["role"]) {
  const existing = getClientAccount();
  const safeRole: UserRole = role === "admin" ? "buyer" : role;
  const account: ClientAccount = existing ?? {
    email: "local@reviewintel.local",
    name: "Local user",
    plan: "free_buyer",
    role: safeRole,
    createdAt: new Date().toISOString()
  };

  saveClientAccount({ ...account, role: safeRole });
}


export function getClientAccount(): ClientAccount | null {
  return forceSellerPremiumTesterAccount(getClientAccountRaw());
}

export function accountHeaders() {
  const account = getClientAccount();
  if (account?.email) {
    setCookie("reviewintel_account_role", account.role);
    setCookie("reviewintel_account_plan", account.plan);
    setCookie("reviewintel_account_email", account.email);
  } else {
    deleteCookie("reviewintel_account_role");
    deleteCookie("reviewintel_account_plan");
    deleteCookie("reviewintel_account_email");
  }

  const headers: Record<string, string> = {
    "x-reviewintel-user": account?.email || "guest",
    "x-reviewintel-email": account?.email || "guest",
    "x-reviewintel-plan": account?.plan || "free_buyer",
    "x-reviewintel-role": account?.role || "guest",
    "x-reviewintel-profile-id": account?.profileId || "",
    "x-reviewintel-auth-user-id": account?.authUserId || "",
    "x-reviewintel-stripe-customer": account?.stripeCustomerId || "",
    "x-reviewintel-guest-id": getGuestId()
  };

  if (account?.accessToken) {
    headers.Authorization = `Bearer ${account.accessToken}`;
  }

  return headers;
}

export function getStoredQuota(): QuotaInfo {
  const account = getClientAccount();
  const accountPlan = account?.plan || "free_buyer";
  const accountRole = account?.role || "guest";
  if (!canUseStorage()) return makeQuotaInfo(accountPlan, 0);

  try {
    const stored = window.localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!stored) return makeQuotaInfo(accountPlan, 0);

    const quota = JSON.parse(stored) as QuotaInfo;
    const normalizedPlan = normalizePlan(quota.plan);

    if (normalizedPlan !== accountPlan) return makeQuotaInfo(accountPlan, 0);
    if (hasUnlimitedUsage(accountRole, accountPlan)) return makeQuotaInfo(accountPlan, 0);

    if (normalizedPlan === "free_buyer") {
      const used = Math.max(0, Math.min(FREE_DAILY_REVIEW_LIMIT, Number(quota.used ?? 0)));
      return makeQuotaInfo("free_buyer", used);
    }

    return makeQuotaInfo(accountPlan, 0);
  } catch {
    return makeQuotaInfo(accountPlan, 0);
  }
}

export function saveQuota(quota: QuotaInfo) {
  if (!canUseStorage()) return;

  const account = getClientAccount();
  const accountPlan = account?.plan || "free_buyer";
  const accountRole = account?.role || "guest";

  let normalizedQuota = quota;

  if (hasUnlimitedUsage(accountRole, accountPlan)) {
    normalizedQuota = makeQuotaInfo(accountPlan, 0);
  } else if (accountPlan === "free_buyer") {
    const used = Math.max(0, Math.min(FREE_DAILY_REVIEW_LIMIT, Number(quota.used ?? 0)));
    normalizedQuota = makeQuotaInfo("free_buyer", used);
  }

  window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(normalizedQuota));
  window.dispatchEvent(new CustomEvent("reviewintel:quota", { detail: normalizedQuota }));
}

export type ScanTallyInfo = {
  total: number;
  updatedAt?: string;
};

export function getStoredScanTally(): ScanTallyInfo {
  if (!canUseStorage()) return { total: 0 };

  try {
    const stored = window.localStorage.getItem(SCAN_TALLY_STORAGE_KEY);
    if (!stored) return { total: 0 };

    const tally = JSON.parse(stored) as ScanTallyInfo;
    const total = Math.max(0, Number(tally.total ?? 0));

    return {
      total,
      updatedAt: typeof tally.updatedAt === "string" ? tally.updatedAt : undefined
    };
  } catch {
    return { total: 0 };
  }
}

export function saveStoredScanTally(tally: ScanTallyInfo) {
  if (!canUseStorage()) return;

  const normalizedTally: ScanTallyInfo = {
    total: Math.max(0, Number(tally.total ?? 0)),
    updatedAt: tally.updatedAt || new Date().toISOString()
  };

  window.localStorage.setItem(SCAN_TALLY_STORAGE_KEY, JSON.stringify(normalizedTally));
  window.dispatchEvent(new CustomEvent("reviewintel:scan-tally", { detail: normalizedTally }));
}

export function incrementStoredScanTally(amount = 1): ScanTallyInfo {
  const current = getStoredScanTally();
  const next: ScanTallyInfo = {
    total: current.total + Math.max(1, Number(amount || 1)),
    updatedAt: new Date().toISOString()
  };

  saveStoredScanTally(next);
  return next;
}

export function clearStoredScanTally(): ScanTallyInfo {
  const cleared: ScanTallyInfo = {
    total: 0,
    updatedAt: new Date().toISOString()
  };

  saveStoredScanTally(cleared);
  return cleared;
}

export function quotaText(quota: QuotaInfo) {
  return quotaLabel(getClientAccount()?.role ?? "guest", quota);
}

export function getStoredActiveMode(): AnalysisAudience {
  if (!canUseStorage()) return "buyer";
  const stored = window.localStorage.getItem(ACTIVE_MODE_STORAGE_KEY);
  if (stored === "seller" || stored === "both") return stored;
  return "buyer";
}

export function saveActiveMode(mode: AnalysisAudience) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACTIVE_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent("reviewintel:active-mode", { detail: mode }));
}
