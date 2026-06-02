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
  roleForPlan
} from "@/lib/account";
import type { AnalysisAudience, QuotaInfo, SubscriptionPlan, UserRole } from "@/lib/types";

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

export function getClientAccount(): ClientAccount | null {
  if (!canUseStorage()) return null;

  try {
    const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!stored) return null;

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
  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(normalized));
  if (!previous || previous.email !== normalized.email || previous.plan !== normalized.plan || previous.role !== normalized.role) {
    window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(makeQuotaInfo(normalized.plan, 0)));
  }
  setCookie("reviewintel_account_role", normalized.role);
  setCookie("reviewintel_account_plan", normalized.plan);
  window.dispatchEvent(new CustomEvent("reviewintel:account", { detail: normalized }));
}

export function clearClientAccount() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  window.localStorage.removeItem(QUOTA_STORAGE_KEY);
  deleteCookie("reviewintel_account_role");
  deleteCookie("reviewintel_account_plan");
  window.dispatchEvent(new CustomEvent("reviewintel:account"));
  window.dispatchEvent(new CustomEvent("reviewintel:quota"));
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
    plan: safeRole === "seller" ? "seller_starter" : "free_buyer",
    role: safeRole,
    createdAt: new Date().toISOString()
  };

  saveClientAccount({ ...account, role: safeRole });
}

export function accountHeaders() {
  const account = getClientAccount();
  const headers: Record<string, string> = {
    "x-reviewintel-user": account?.email || "guest",
    "x-reviewintel-plan": account?.plan || "free_buyer",
    "x-reviewintel-role": account?.role || "guest",
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
    if (hasUnlimitedUsage(accountRole, accountPlan) && quota.limit !== null) return makeQuotaInfo(accountPlan, 0);
    if (normalizedPlan === "free_buyer" && quota.limit !== FREE_DAILY_REVIEW_LIMIT) return makeQuotaInfo("free_buyer", 0);
    return { ...quota, plan: normalizedPlan };
  } catch {
    return makeQuotaInfo(accountPlan, 0);
  }
}

export function saveQuota(quota: QuotaInfo) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(quota));
  window.dispatchEvent(new CustomEvent("reviewintel:quota", { detail: quota }));
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
