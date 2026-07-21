import { NextResponse } from "next/server";
import { setAccountSessionCookie } from "@/lib/accountSession";
import { createAdminNotification } from "@/lib/notifications";
import { forceSellerPremiumTesterAccount, normalizePlan, normalizeRole } from "@/lib/account";
import { rateLimitRequest } from "@/lib/security";
import { loginWithSupabase } from "@/lib/supabaseAuth";
import { supabaseFetch, supabaseUpsert } from "@/lib/supabaseServer";
import type { SubscriptionPlan } from "@/lib/types";

const QA_PASSWORD = "ReviewIntel123!";

const qaAccounts: Array<{
  email: string;
  name: string;
  role: "buyer" | "seller";
  plan: SubscriptionPlan;
  profileId: string;
  companyName?: string;
  addressLine1: string;
  city: string;
  country: string;
}> = [
  {
    email: "shopper.free@reviewintel.test",
    name: "Shopper Free Tester",
    role: "buyer",
    plan: "free_buyer",
    profileId: "SHOP-FREE-001",
    addressLine1: "101 Shopper Lane",
    city: "Toronto",
    country: "Canada"
  },
  {
    email: "shopper.premium@reviewintel.test",
    name: "Shopper Premium Tester",
    role: "buyer",
    plan: "buyer_pro",
    profileId: "SHOP-PRO-001",
    addressLine1: "22 Verdict Street",
    city: "Vancouver",
    country: "Canada"
  },
  {
    email: "seller.starter@reviewintel.test",
    name: "Seller Premium Tester",
    role: "seller",
    plan: "seller_premium",
    profileId: "SELL-PREM-001",
    companyName: "Starter Seller Studio",
    addressLine1: "44 Product Road",
    city: "Moncton",
    country: "Canada"
  },
  {
    email: "seller.pro@reviewintel.test",
    name: "Seller Pro Tester",
    role: "seller",
    plan: "seller_pro",
    profileId: "SELL-PRO-001",
    companyName: "Pro Seller Command",
    addressLine1: "88 Growth Avenue",
    city: "Calgary",
    country: "Canada"
  }
];

function valueAsString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forceQaLoginAccount(result: Record<string, unknown>, fallbackAccount: Record<string, unknown>) {
  const mergedAccount = result.account && typeof result.account === "object"
    ? (result.account as Record<string, unknown>)
    : fallbackAccount;
  const forcedAccount = forceSellerPremiumTesterAccount({
    ...fallbackAccount,
    ...mergedAccount,
    email: fallbackAccount.email,
    userId: fallbackAccount.userId,
    authUserId: fallbackAccount.authUserId,
    profileId: fallbackAccount.profileId,
    companyName: fallbackAccount.companyName ?? mergedAccount.companyName,
    addressLine1: fallbackAccount.addressLine1 ?? mergedAccount.addressLine1,
    city: fallbackAccount.city ?? mergedAccount.city,
    country: fallbackAccount.country ?? mergedAccount.country,
    testAccount: true,
    trusted: true
  });

  return {
    ...result,
    account: forcedAccount
  };
}

async function readProfileByEmail(email: string) {
  try {
    const response = await supabaseFetch(
      `/rest/v1/profiles?select=*&email=eq.${encodeURIComponent(email)}&limit=1`,
      { cache: "no-store" }
    );

    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
      ? (rows[0] as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function authUserStatusForEmail(email: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  const targetEmail = email.toLowerCase().trim();

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    }).catch(() => null);

    if (!response?.ok) return null;

    const data = await response.json().catch(() => null);
    const users = Array.isArray(data?.users) ? data.users : [];
    const existing = users.find((user: { email?: string }) => String(user.email || "").toLowerCase().trim() === targetEmail) as
      | { email_confirmed_at?: string | null; confirmed_at?: string | null }
      | undefined;

    if (existing) {
      return {
        exists: true,
        emailConfirmed: Boolean(existing.email_confirmed_at || existing.confirmed_at)
      };
    }

    if (users.length < 1000) return { exists: false, emailConfirmed: false };
  }

  return { exists: false, emailConfirmed: false };
}

function isBetaPlan(plan: string) {
  return plan === "buyer_beta" || plan === "seller_beta";
}

function safeRestoredPlan(currentPlan: string, originalPlan: string) {
  const rawOriginal = valueAsString(originalPlan);

  if (rawOriginal) {
    const normalizedOriginal = normalizePlan(rawOriginal);
    if (!isBetaPlan(normalizedOriginal)) {
      return normalizedOriginal;
    }
  }

  if (currentPlan === "seller_beta") {
    return "seller_premium";
  }

  return "free_buyer";
}

function roleForRestoredPlan(plan: string, fallbackRole: string) {
  if (plan === "seller_premium" || plan === "seller_beta" || plan === "seller_pro") return "seller";
  if (fallbackRole === "admin") return "admin";
  return "buyer";
}

function isExpiredBetaProfile(profile: Record<string, unknown>, plan: string) {
  if (!isBetaPlan(plan)) return false;

  const expiresAt = valueAsString(profile.beta_expires_at);
  if (!expiresAt) return false;

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;

  return expiry.getTime() <= Date.now();
}

function isActiveBetaProfile(profile: Record<string, unknown>, plan: string) {
  if (!isBetaPlan(plan)) return false;

  const expiresAt = valueAsString(profile.beta_expires_at);
  if (!expiresAt) {
    return valueAsString(profile.subscription_status) === "beta";
  }

  const expiry = new Date(expiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

async function mergeProfileIntoLoginResult(result: Record<string, unknown>) {
  const account = result.account && typeof result.account === "object"
    ? (result.account as Record<string, unknown>)
    : null;
  const email = valueAsString(account?.email).toLowerCase();

  if (!account || !email) return result;

  const profile = await readProfileByEmail(email);
  if (!profile) return result;

  const profileRole = normalizeRole(valueAsString(profile.role) || valueAsString(account.role));
  const profilePlan = normalizePlan(valueAsString(profile.plan) || valueAsString(account.plan));
  const now = new Date().toISOString();

  let role = profileRole;
  let plan = profilePlan;
  let subscriptionStatus = valueAsString(profile.subscription_status) || valueAsString(account.subscriptionStatus);

  if (isExpiredBetaProfile(profile, profilePlan)) {
    const restoredPlan = safeRestoredPlan(profilePlan, valueAsString(profile.beta_original_plan));
    const restoredStatus = valueAsString(profile.beta_original_status) || "active";
    const restoredRole = roleForRestoredPlan(restoredPlan, profileRole);

    await supabaseUpsert("profiles", {
      email,
      role: restoredRole,
      plan: restoredPlan,
      subscription_plan: restoredPlan,
      subscription_status: restoredStatus,
      beta_started_at: null,
      beta_expires_at: null,
      beta_original_plan: null,
      beta_original_status: null,
      beta_last_notified_at: now,
      beta_last_survey_sent_at: null,
      beta_survey_count: 0,
      last_login: now,
      updated_at: now
    }).catch(() => null);

    await createAdminNotification({
      title: "Beta access expired",
      message: `${email} beta access expired and was restored to ${restoredPlan}.`,
      type: "beta_expired",
      severity: "info",
      action_url: "/admin/beta",
      metadata: {
        email,
        expiredPlan: profilePlan,
        restoredPlan,
        expiredAt: valueAsString(profile.beta_expires_at)
      }
    }).catch(() => null);

    role = restoredRole;
    plan = restoredPlan;
    subscriptionStatus = restoredStatus;
  } else if (isActiveBetaProfile(profile, profilePlan) && subscriptionStatus !== "beta") {
    await supabaseUpsert("profiles", {
      email,
      subscription_status: "beta",
      subscription_plan: profilePlan,
      last_login: now,
      updated_at: now
    }).catch(() => null);

    subscriptionStatus = "beta";
  } else {
    await supabaseUpsert("profiles", {
      email,
      last_login: now,
      updated_at: now
    }).catch(() => null);
  }

  return {
    ...result,
    account: {
      ...account,
      email,
      userId: valueAsString(profile.id) || valueAsString(account.userId) || email,
      authUserId: valueAsString(profile.auth_user_id) || valueAsString(account.authUserId) || null,
      profileId: valueAsString(profile.id) || valueAsString(account.profileId),
      name: valueAsString(profile.name) || valueAsString(account.name) || email.split("@")[0],
      role: role === "guest" ? "buyer" : role,
      plan,
      subscriptionStatus,
      stripeCustomerId: valueAsString(profile.stripe_customer_id) || valueAsString(account.stripeCustomerId) || null,
      companyName: valueAsString(profile.company_name) || valueAsString(account.companyName),
      phone: valueAsString(profile.phone) || valueAsString(account.phone),
      addressLine1: valueAsString(profile.address_line1) || valueAsString(account.addressLine1),
      addressLine2: valueAsString(profile.address_line2) || valueAsString(account.addressLine2),
      city: valueAsString(profile.city) || valueAsString(account.city),
      region: valueAsString(profile.region) || valueAsString(account.region),
      postalCode: valueAsString(profile.postal_code) || valueAsString(account.postalCode),
      country: valueAsString(profile.country) || valueAsString(account.country),
      website: valueAsString(profile.website) || valueAsString(account.website),
      profileNotes: valueAsString(profile.profile_notes) || valueAsString(account.profileNotes),
      marketingConsent: Boolean(profile.marketing_consent),
      betaStartedAt: isBetaPlan(plan) ? valueAsString(profile.beta_started_at) : "",
      betaExpiresAt: isBetaPlan(plan) ? valueAsString(profile.beta_expires_at) : "",
      betaOriginalPlan: isBetaPlan(plan) ? valueAsString(profile.beta_original_plan) : "",
      betaOriginalStatus: isBetaPlan(plan) ? valueAsString(profile.beta_original_status) : "",
      createdAt: valueAsString(profile.created_at) || valueAsString(account.createdAt) || now
    }
  };
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "auth_login",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    eventType: "login_rate_limited"
  });


  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const email = String(body.email).trim().toLowerCase();
    const qaAccount = qaAccounts.find((account) => account.email === email && body.password === QA_PASSWORD);
    if (qaAccount) {
      const account = {
        userId: `test-${qaAccount.email}`,
        authUserId: `test-auth-${qaAccount.email}`,
        email: qaAccount.email,
        name: qaAccount.name,
        role: qaAccount.role,
        plan: qaAccount.plan,
        subscriptionStatus: qaAccount.plan === "free_buyer" ? "free" : "active",
        createdAt: new Date().toISOString(),
        profileId: qaAccount.profileId,
        companyName: qaAccount.companyName,
        addressLine1: qaAccount.addressLine1,
        city: qaAccount.city,
        country: qaAccount.country,
        marketingConsent: false
      };
      const mergedResult = await mergeProfileIntoLoginResult({
        mode: "qa-customer-account",
        account
      });
      const result = forceQaLoginAccount(mergedResult, account);
      const finalAccount = result.account && typeof result.account === "object"
        ? (result.account as Record<string, unknown>)
        : account;

      const response = NextResponse.json({
        ok: true,
        result
      });

      setAccountSessionCookie(response, finalAccount);
      return response;
    }

    const preLoginProfile = await readProfileByEmail(email);
    if (preLoginProfile && preLoginProfile.email_verified === false) {
      const authStatus = await authUserStatusForEmail(email);
      if (authStatus?.exists && !authStatus.emailConfirmed) {
        return NextResponse.json(
          {
            error: "Please verify your email before logging in. ReviewIntel already sent the verification link, so check your inbox or spam folder first.",
            code: "email_verification_required"
          },
          { status: 403 }
        );
      }
    }

    const authResult = await loginWithSupabase({ ...body, email }) as Record<string, unknown>;
    const result = await mergeProfileIntoLoginResult(authResult);
    const account = result.account as { role?: string } | undefined;
    if (account?.role === "admin") {
      return NextResponse.json({ error: "Use the private admin access route for developer accounts." }, { status: 403 });
    }

    const authUser = authResult.user && typeof authResult.user === "object"
      ? (authResult.user as Record<string, unknown>)
      : null;
    const authEmailConfirmed = Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at || valueAsString(authResult.access_token));
    if (authEmailConfirmed) {
      await supabaseUpsert("profiles", {
        email,
        email_verified: true,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).catch(() => null);
    }

    const response = NextResponse.json({ ok: true, result });
    setAccountSessionCookie(response, result.account as Record<string, unknown>);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 401 });
  }
}
