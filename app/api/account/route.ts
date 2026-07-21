import { NextRequest, NextResponse } from "next/server";
import { forceSellerPremiumTesterAccount, normalizePlan, normalizeRole } from "@/lib/account";
import { readAccountSession, setAccountSessionCookie } from "@/lib/accountSession";
import { isSupabaseConfigured, readPersistentQuota, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";



function testAccountOverride(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === "shopper.free@reviewintel.test") {
    return {
      email: normalizedEmail,
      name: "Shopper Free Test",
      role: "buyer",
      plan: "free_buyer",
      subscriptionStatus: "free",
      trusted: true,
      testAccount: true
    };
  }

  if (normalizedEmail === "shopper.premium@reviewintel.test") {
    return {
      email: normalizedEmail,
      name: "Shopper Premium Test",
      role: "buyer",
      plan: "buyer_pro",
      subscriptionStatus: "active",
      trusted: true,
      testAccount: true
    };
  }

  if (normalizedEmail === "seller.starter@reviewintel.test" || normalizedEmail === "seller.premium@reviewintel.test") {
    return {
      email: normalizedEmail,
      name: "Seller Premium Test",
      role: "seller",
      plan: "seller_premium",
      subscriptionStatus: "active",
      trusted: true,
      testAccount: true
    };
  }

  if (normalizedEmail === "seller.pro@reviewintel.test") {
    return {
      email: normalizedEmail,
      name: "Seller Pro Test",
      role: "seller",
      plan: "seller_pro",
      subscriptionStatus: "active",
      trusted: true,
      testAccount: true
    };
  }

  return null;
}


function readHeaderAccount(request: NextRequest) {
  const email = normalizeEmail(request.headers.get("x-reviewintel-email") || request.headers.get("x-user-email") || "");
  const plan = normalizePlan(request.headers.get("x-reviewintel-plan") || "free_buyer");
  const role = request.headers.get("x-reviewintel-role") || (plan.includes("seller") ? "seller" : "buyer");
  const name = request.headers.get("x-reviewintel-name") || "";
  return { email, plan, role, name };
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").toLowerCase().trim();
  return email === "guest" ? "" : email;
}

function sessionBackedAccount(request: NextRequest) {
  const session = readAccountSession(request);
  const headerAccount = readHeaderAccount(request);
  const sessionEmail = normalizeEmail(session?.email);
  const headerEmail = normalizeEmail(headerAccount.email);

  if (!sessionEmail) {
    return {
      error: headerEmail
        ? NextResponse.json({ error: "Signed account session required." }, { status: 401 })
        : null,
      account: null as null | { email: string; plan: string; role: string; name: string }
    };
  }

  if (headerEmail && headerEmail !== sessionEmail) {
    return {
      error: NextResponse.json({ error: "You are not allowed to access another account." }, { status: 403 }),
      account: null as null | { email: string; plan: string; role: string; name: string }
    };
  }

  return {
    error: null,
    account: {
      email: sessionEmail,
      plan: normalizePlan(session?.plan || headerAccount.plan || "free_buyer"),
      role: normalizeRole(session?.role || headerAccount.role || "buyer"),
      name: session?.name || headerAccount.name || ""
    }
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clientAccountFromProfile(profile: Record<string, unknown>, fallback: { email: string; name?: string; role?: string; plan?: string }) {
  const email = asString(profile.email) || fallback.email;
  const plan = normalizePlan(asString(profile.plan) || fallback.plan);
  const role = normalizeRole(asString(profile.role) || fallback.role || (plan.includes("seller") ? "seller" : "buyer"));

  return {
    ...fallback,
    ...profile,
    userId: asString(profile.id) || email,
    profileId: asString(profile.id),
    authUserId: asString(profile.auth_user_id),
    email,
    name: asString(profile.name) || fallback.name || email.split("@")[0],
    role: role === "guest" ? "buyer" : role,
    plan,
    subscriptionStatus: asString(profile.subscription_status) || asString((fallback as Record<string, unknown>).subscriptionStatus),
    stripeCustomerId: asString(profile.stripe_customer_id) || null,
    companyName: asString(profile.company_name),
    phone: asString(profile.phone),
    addressLine1: asString(profile.address_line1),
    addressLine2: asString(profile.address_line2),
    city: asString(profile.city),
    region: asString(profile.region),
    postalCode: asString(profile.postal_code),
    country: asString(profile.country),
    website: asString(profile.website),
    preferredLanguage: asString(profile.preferred_language) || "en",
    preferredCurrency: asString(profile.preferred_currency) || "CAD",
    profileNotes: asString(profile.profile_notes),
    marketingConsent: Boolean(profile.marketing_consent),
    betaStartedAt: asString(profile.beta_started_at),
    betaExpiresAt: asString(profile.beta_expires_at),
    betaOriginalPlan: asString(profile.beta_original_plan),
    betaOriginalStatus: asString(profile.beta_original_status),
    trusted: true
  };
}

function jsonWithFreshAccountSession(body: Record<string, unknown>, account?: Record<string, unknown> | null, status = 200) {
  const response = NextResponse.json(body, { status });

  if (account?.email) {
    setAccountSessionCookie(response, account);
  }

  return response;
}

export async function GET(request: NextRequest) {
  const sessionAccount = sessionBackedAccount(request);
  if (sessionAccount.error) return sessionAccount.error;

  if (!sessionAccount.account?.email) {
    return NextResponse.json({
      account: null,
      source: "none"
    });
  }

  const headerAccount = sessionAccount.account;
  const testOverride = testAccountOverride(headerAccount.email);

  const effectiveHeaderAccount = testOverride
    ? {
        ...headerAccount,
        ...testOverride,
        email: headerAccount.email,
        plan: testOverride.plan,
        role: testOverride.role,
        trusted: true,
        testAccount: true
      }
    : headerAccount;

  if (!isSupabaseConfigured()) {
    const account = {
      ...effectiveHeaderAccount,
      trusted: false
    };

    return jsonWithFreshAccountSession({
      account,
      quota: await readPersistentQuota({
        email: effectiveHeaderAccount.email,
        plan: effectiveHeaderAccount.plan
      }),
      source: "local-fallback"
    }, account);
  }

  const rows = await supabaseSelect(
    "profiles",
    `select=*&email=eq.${encodeURIComponent(effectiveHeaderAccount.email)}&limit=1`
  );

  const existing = rows[0] as Record<string, unknown> | undefined;

  if (!existing) {
    const newRole = normalizeRole(effectiveHeaderAccount.role) === "seller" ? "seller" : "buyer";
    const newPlan = normalizePlan(String(effectiveHeaderAccount.plan ?? "free_buyer"));

    const inserted = await supabaseUpsert("profiles", {
      email: effectiveHeaderAccount.email,
      name: effectiveHeaderAccount.name || null,
      role: newRole,
      plan: newPlan,
      last_login: new Date().toISOString()
    });

    const account = inserted
      ? clientAccountFromProfile(inserted as Record<string, unknown>, {
          ...effectiveHeaderAccount,
          role: newRole,
          plan: newPlan
        })
      : {
          ...effectiveHeaderAccount,
          role: newRole,
          plan: newPlan,
          trusted: true
        };

    return jsonWithFreshAccountSession({
      account,
      quota: await readPersistentQuota({
        email: effectiveHeaderAccount.email,
        plan: newPlan
      }),
      source: "supabase"
    }, account);
  }

  await supabaseUpsert("profiles", {
    email: effectiveHeaderAccount.email,
    last_login: new Date().toISOString()
  });

  const account = forceSellerPremiumTesterAccount(clientAccountFromProfile(existing, effectiveHeaderAccount));

  return jsonWithFreshAccountSession({
    account,
    quota: await readPersistentQuota({
      email: effectiveHeaderAccount.email,
      plan: normalizePlan(String(account.plan ?? effectiveHeaderAccount.plan ?? "free_buyer"))
    }),
    source: "supabase"
  }, account);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionAccount = sessionBackedAccount(request);
  if (sessionAccount.error) return sessionAccount.error;

  const headerAccount = sessionAccount.account ?? readHeaderAccount(request);
  const requestedEmail = normalizeEmail(body.email || request.headers.get("x-reviewintel-email") || "");
  const email = headerAccount.email;

  if (!email) {
    return NextResponse.json({ error: "Signed account session required." }, { status: 401 });
  }

  if (requestedEmail && requestedEmail !== email) {
    return NextResponse.json({ error: "You are not allowed to update another account." }, { status: 403 });
  }

  const postTestOverride = testAccountOverride(email);

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const existingRows = await supabaseSelect(
    "profiles",
    `select=role,plan&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  const existing = existingRows[0] as Record<string, unknown> | undefined;
  const requestedRole = normalizeRole(String(postTestOverride?.role ?? headerAccount.role ?? "buyer"));
  const preservedPlan = postTestOverride
    ? normalizePlan(String(postTestOverride.plan))
    : existing
      ? normalizePlan(String(existing.plan ?? "free_buyer"))
      : normalizePlan(String(headerAccount.plan ?? "free_buyer"));
  const preservedRole = postTestOverride
    ? normalizeRole(String(postTestOverride.role))
    : existing
      ? normalizeRole(String(existing.role ?? (preservedPlan === "seller_premium" || preservedPlan === "seller_beta" || preservedPlan === "seller_pro" ? "seller" : "buyer")))
      : requestedRole === "seller" ? "seller" : "buyer";

  const profile = await supabaseUpsert("profiles", {
    email,
    name: body.name ?? null,
    role: preservedRole,
    plan: preservedPlan,
    company_name: body.companyName ?? body.company_name ?? null,
    phone: body.phone ?? null,
    address_line1: body.addressLine1 ?? body.address_line1 ?? null,
    address_line2: body.addressLine2 ?? body.address_line2 ?? null,
    city: body.city ?? null,
    region: body.region ?? null,
    postal_code: body.postalCode ?? body.postal_code ?? null,
    country: body.country ?? null,
    website: body.website ?? null,
    preferred_language: body.preferredLanguage ?? body.preferred_language ?? "en",
    preferred_currency: body.preferredCurrency ?? body.preferred_currency ?? "CAD",
    profile_notes: body.profileNotes ?? body.profile_notes ?? null,
    marketing_consent: Boolean(body.marketingConsent ?? body.marketing_consent),
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString()
  });

  const account = profile
    ? forceSellerPremiumTesterAccount(clientAccountFromProfile(profile as Record<string, unknown>, { email }))
    : null;

  return jsonWithFreshAccountSession({
    ok: Boolean(profile),
    account,
    source: "supabase"
  }, account);
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
