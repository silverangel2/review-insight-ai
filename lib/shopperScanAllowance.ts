/**
 * The same free-scan and plan rules as /api/analyze, for a signed-in shopper
 * who submits a page their own browser already loaded.
 */

import { normalizePlan, normalizeRole } from "@/lib/account";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { readAccountSession } from "@/lib/accountSession";
import {
  claimFreeScan,
  InMemoryFreeScanClaims,
  releaseFreeScan,
  type FreeScanClaim,
  type FreeScanIdentityKind,
} from "@/lib/freeScanQuota";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import type { SubscriptionPlan, UserRole } from "@/lib/types";

type ProfileAccessRow = {
  role?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  status?: string | null;
  beta_expires_at?: string | null;
};

export type ShopperScanSubject = {
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
  scanId: string;
  kind: FreeScanIdentityKind;
};

const devClaims = new InMemoryFreeScanClaims();

function hasActivePaidAccess(profile: ProfileAccessRow, plan: SubscriptionPlan) {
  const accountStatus = String(profile.status ?? "active").toLowerCase();
  const subscriptionStatus = String(profile.subscription_status ?? "").toLowerCase();
  if (["banned", "suspended", "disabled"].includes(accountStatus)) return false;
  if (plan === "free_buyer") return true;
  if (plan === "buyer_beta" || plan === "seller_beta") {
    const expiresAt = String(profile.beta_expires_at ?? "").trim();
    if (!expiresAt) return subscriptionStatus === "beta";
    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now()) return true;
  }
  return ["active", "trialing", "developer"].includes(subscriptionStatus);
}

export async function resolveShopperScanAccount(request: Request): Promise<
  | { ok: true; email: string; role: UserRole; plan: SubscriptionPlan }
  | { ok: false; status: number; body: { error: string; code: string } }
> {
  const accountSession = readAccountSession(request);
  const adminSession = adminSessionFromRequest(request);
  const email = String(accountSession?.email || adminSession?.email || "").toLowerCase().trim();
  if (!email) {
    return { ok: false, status: 401, body: { error: "Sign in to ReviewIntel, then analyze this page.", code: "SIGN_IN_REQUIRED" } };
  }

  const requestedRole = adminSession && !accountSession ? "admin" : normalizeRole(accountSession?.role || "");
  const requestedPlan = adminSession && !accountSession ? "seller_pro" : normalizePlan(accountSession?.plan || "");
  if (requestedRole === "admin") return { ok: true, email, role: requestedRole, plan: requestedPlan };
  if (requestedRole === "guest" || email === "guest") {
    return { ok: false, status: 401, body: { error: "Sign in to ReviewIntel, then analyze this page.", code: "SIGN_IN_REQUIRED" } };
  }
  if (!isSupabaseConfigured()) return { ok: true, email, role: requestedRole, plan: requestedPlan };

  let profile: ProfileAccessRow | null = null;
  let lookupFailed = false;
  try {
    const rows = await supabaseSelect<ProfileAccessRow>(
      "profiles",
      `select=role,plan,subscription_status,status,beta_expires_at&email=eq.${encodeURIComponent(email)}&limit=1`,
    );
    profile = rows[0] || null;
  } catch {
    lookupFailed = true;
  }

  if (lookupFailed) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 503, body: { error: "We could not verify your account. Please try again.", code: "ACCOUNT_UNAVAILABLE" } };
    }
    return { ok: true, email, role: requestedRole, plan: requestedPlan };
  }

  if (!profile) {
    if (email === "shopper.premium@reviewintel.test") return { ok: true, email, role: "buyer", plan: "buyer_pro" };
    return { ok: true, email, role: "buyer", plan: "free_buyer" };
  }

  const plan = normalizePlan(String(profile.plan ?? "free_buyer"));
  const role = normalizeRole(String(profile.role ?? "buyer"));
  if (!hasActivePaidAccess(profile, plan)) {
    return { ok: true, email, role: role === "seller" ? "seller" : "buyer", plan: "free_buyer" };
  }
  return { ok: true, email, role, plan };
}

function quotaError(claim: FreeScanClaim, scanId: string) {
  if (claim.code === "unavailable") {
    return {
      status: 503,
      body: {
        error: "We could not verify your daily scan allowance. Please try again.",
        code: "QUOTA_UNAVAILABLE",
        scanId,
        resultSource: "analyze",
      },
    };
  }
  return {
    status: 429,
    body: {
      error: "You have used all 3 free scans for today. Upgrade to Premium for more scans and the fuller buying-confidence report.",
      code: "DAILY_SCAN_LIMIT_REACHED",
      upgradeRequired: true,
      upgradeUrl: "/pricing?plan=shopper_premium",
      cta: "Try Premium",
      quota: claim,
      scanId,
      resultSource: "analyze",
    },
  };
}

/** Free shoppers spend one of the same 3 daily scans. Paid plans are not capped here. */
export async function claimShopperScan(input: ShopperScanSubject): Promise<
  | { ok: true; claim: FreeScanClaim | null; subject: ShopperScanSubject | null }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const plan = String(input.plan || "");
  const isBeta = plan === "buyer_beta" || plan === "seller_beta";
  const isShopperFree = input.role !== "admin" && input.role !== "guest" && !isBeta && plan === "free_buyer";
  if (!isShopperFree) return { ok: true, claim: null, subject: null };

  const claimInput = { kind: input.kind, identity: input.email, scanId: input.scanId };
  let claim = await claimFreeScan(claimInput);
  if (claim.code === "unavailable" && process.env.NODE_ENV !== "production") {
    claim = devClaims.claim(claimInput);
  }
  if (!claim.allowed) {
    const error = quotaError(claim, input.scanId);
    return { ok: false, status: error.status, body: error.body };
  }
  return { ok: true, claim, subject: input };
}

export async function releaseShopperScan(subject: ShopperScanSubject | null) {
  if (!subject) return;
  const claimInput = { kind: subject.kind, identity: subject.email, scanId: subject.scanId };
  const released = await releaseFreeScan(claimInput);
  if (released.code === "unavailable" && process.env.NODE_ENV !== "production") devClaims.release(claimInput);
}
