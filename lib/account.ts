import type { QuotaInfo, SubscriptionPlan, UserRole } from "@/lib/types";

export const FREE_DAILY_REVIEW_LIMIT = 3;
export const GUEST_TOTAL_REVIEW_LIMIT = 3;
export const BUYER_PRO_DAILY_REVIEW_LIMIT = null;
export const SELLER_DAILY_REVIEW_LIMIT = null;
export const ACCOUNT_STORAGE_KEY = "reviewintel:account";
export const QUOTA_STORAGE_KEY = "reviewintel:quota";
export const GUEST_ID_STORAGE_KEY = "reviewintel:guest-id";
export const ACTIVE_MODE_STORAGE_KEY = "reviewintel:active-mode";

export type ClientAccount = {
  userId?: string | null;
  authUserId?: string | null;
  email: string;
  name: string;
  plan: SubscriptionPlan;
  role: UserRole;
  accessToken?: string;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string;
  createdAt: string;
  profileId?: string;
  companyName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  profileNotes?: string;
  marketingConsent?: boolean;
  betaStartedAt?: string;
  betaExpiresAt?: string;
  betaOriginalPlan?: string;
  betaOriginalStatus?: string;
  passwordUpdatedAt?: string;
};

export function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  const value = String(plan || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (value === "buyer_pro" || value === "pro" || value === "premium" || value === "shopper_premium") return "buyer_pro";
  if (value === "buyer_beta" || value === "beta_buyer" || value === "shopper_beta" || value === "beta_shopper" || value === "shopper_premium_beta") return "buyer_beta";
  if (value === "seller_starter" || value === "seller_premium" || value === "seller") return "seller_premium";
  if (value === "seller_beta" || value === "beta_seller" || value === "seller_premium_beta") return "seller_beta";
  if (value === "seller_pro" || value === "team") return "seller_pro";
  return "free_buyer";
}

export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === "buyer" || role === "seller" || role === "admin" || role === "guest") return role;
  return "guest";
}

export function planLabel(plan: SubscriptionPlan) {
  if (plan === "buyer_pro") return "Shopper Premium";
  if (plan === "buyer_beta") return "Beta Shopper Premium";
  if (plan === "seller_premium") return "Seller Premium";
  if (plan === "seller_beta") return "Beta Seller Premium";
  if (plan === "seller_pro") return "Seller Pro";
  return "Shopper Free";
}

export function planPrice(plan: SubscriptionPlan) {
  if (plan === "buyer_pro") return "$9.99 CAD";
  if (plan === "buyer_beta") return "Beta";
  if (plan === "seller_premium") return "$29.99 CAD";
  if (plan === "seller_beta") return "Beta";
  if (plan === "seller_pro") return "$59.99 CAD";
  return "$0";
}

export function planLimit(plan: SubscriptionPlan) {
  return plan === "free_buyer" ? FREE_DAILY_REVIEW_LIMIT : null;
}

export function isPaidPlan(plan: SubscriptionPlan) {
  return plan !== "free_buyer";
}

export function isSellerPlan(plan: unknown) {
  const value = String(plan || "").toLowerCase();
  return value === "seller_premium" || value === "seller_beta" || value === "seller_pro";
}

export function roleForPlan(plan: SubscriptionPlan): UserRole {
  if (isSellerPlan(plan)) return "seller";
  return "buyer";
}

export function isAdminRole(role: UserRole | string | null | undefined) {
  return role === "admin";
}

export function hasUnlimitedUsage(role: UserRole, plan: SubscriptionPlan) {
  return isAdminRole(role) || planLimit(plan) === null;
}

export function canAccessSellerAnalytics(role: UserRole, plan: SubscriptionPlan) {
  return isAdminRole(role) || isSellerPlan(plan);
}

export function quotaLabel(role: UserRole, quota: QuotaInfo) {
  if (quota.limit === null) return "Unlimited product scans";
  if (role === "guest") return `${quota.remaining ?? 0} of ${quota.limit} free guest analyses left`;
  return `${quota.remaining ?? 0} of ${quota.limit} free scans left today`;
}

export function nextUtcResetIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();
}

export function makeQuotaInfo(plan: SubscriptionPlan, used: number, now = new Date()): QuotaInfo {
  const limit = planLimit(plan);
  return {
    plan,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resets_at: nextUtcResetIso(now)
  };
}


export function forceSellerPremiumTesterAccount<T extends Record<string, unknown> | null | undefined>(account: T): T {
  if (!account || typeof account !== "object") return account;

  const record = account as Record<string, unknown>;
  const email = String(record.email || record.profile_email || "").toLowerCase();
  const testPlans: Record<string, { role: UserRole; plan: SubscriptionPlan; name: string }> = {
    "shopper.free@reviewintel.test": {
      role: "buyer",
      plan: "free_buyer",
      name: "Shopper Free Tester"
    },
    "shopper.premium@reviewintel.test": {
      role: "buyer",
      plan: "buyer_pro",
      name: "Shopper Premium Tester"
    },
    "seller.starter@reviewintel.test": {
      role: "seller",
      plan: "seller_premium",
      name: "Seller Premium Tester"
    },
    "seller.premium@reviewintel.test": {
      role: "seller",
      plan: "seller_premium",
      name: "Seller Premium Tester"
    },
    "seller.pro@reviewintel.test": {
      role: "seller",
      plan: "seller_pro",
      name: "Seller Pro Tester"
    }
  };

  const override = testPlans[email];
  if (override) {
    const existingPlan = normalizePlan(String(record.plan || record.activePlan || record.subscriptionPlan || ""));
    const isBetaPlan = existingPlan === "buyer_beta" || existingPlan === "seller_beta";
    const finalPlan = isBetaPlan ? existingPlan : override.plan;

    return {
      ...record,
      name: record.name || override.name,
      role: isBetaPlan ? roleForPlan(finalPlan) : override.role,
      plan: finalPlan,
      activePlan: finalPlan,
      subscriptionPlan: finalPlan,
      subscriptionStatus: record.subscriptionStatus || record.subscription_status || (isBetaPlan ? "beta" : "active"),
      trusted: true,
      testAccount: true,
    } as unknown as T;
  }

  return account;
}



export function hasCloudHistoryAccess(plan: string | null | undefined) {
  const normalized = String(plan || "").trim();

  return (
    normalized === "buyer_pro" ||
    normalized === "buyer_beta" ||
    normalized === "seller_pro" ||
    normalized === "seller_premium" ||
    normalized === "seller_beta"
  );
}
