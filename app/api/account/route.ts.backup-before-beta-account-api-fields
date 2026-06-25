import { NextRequest, NextResponse } from "next/server";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { isSupabaseConfigured, readPersistentQuota, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";



function testAccountOverride(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

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

  if (normalizedEmail === "seller.starter@reviewintel.test") {
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
  const email = request.headers.get("x-reviewintel-email") || request.headers.get("x-user-email") || "";
  const plan = normalizePlan(request.headers.get("x-reviewintel-plan") || "free_buyer");
  const role = request.headers.get("x-reviewintel-role") || (plan.includes("seller") ? "seller" : "buyer");
  const name = request.headers.get("x-reviewintel-name") || "";
  return { email, plan, role, name };
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
    trusted: true
  };
}

export async function GET(request: NextRequest) {
  const headerAccount = readHeaderAccount(request);
  const testOverride = headerAccount.email ? testAccountOverride(headerAccount.email) : null;

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

  if (!effectiveHeaderAccount.email) {
    return NextResponse.json({
      account: null,
      source: "none"
    });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      account: {
        ...effectiveHeaderAccount,
        trusted: false
      },
      quota: await readPersistentQuota({
        email: effectiveHeaderAccount.email,
        plan: effectiveHeaderAccount.plan
      }),
      source: "local-fallback"
    });
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

    return NextResponse.json({
      account: inserted
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
          },
      quota: await readPersistentQuota({
        email: effectiveHeaderAccount.email,
        plan: newPlan
      }),
      source: "supabase"
    });
  }

  await supabaseUpsert("profiles", {
    email: effectiveHeaderAccount.email,
    last_login: new Date().toISOString()
  });

  return NextResponse.json({
    account: clientAccountFromProfile(existing, effectiveHeaderAccount),
    quota: await readPersistentQuota({
      email: effectiveHeaderAccount.email,
      plan: normalizePlan(String(existing.plan ?? effectiveHeaderAccount.plan ?? "free_buyer"))
    }),
    source: "supabase"
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const headerAccount = readHeaderAccount(request);
  const email = String(body.email || request.headers.get("x-reviewintel-email") || "").trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
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
  const preservedPlan = existing
    ? normalizePlan(String(existing.plan ?? "free_buyer"))
    : normalizePlan(String(postTestOverride?.plan ?? headerAccount.plan ?? "free_buyer"));
  const preservedRole = existing
    ? normalizeRole(String(existing.role ?? (preservedPlan === "seller_premium" || preservedPlan === "seller_pro" ? "seller" : "buyer")))
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
    marketing_consent: Boolean(body.marketingConsent ?? body.marketing_consent),
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString()
  });

  return NextResponse.json({
    ok: Boolean(profile),
    account: profile
      ? clientAccountFromProfile(profile as Record<string, unknown>, { email })
      : null,
    source: "supabase"
  });
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}