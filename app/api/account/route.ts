import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function readHeaderAccount(request: NextRequest) {
  const email = request.headers.get("x-reviewintel-email") || request.headers.get("x-user-email") || "";
  const plan = request.headers.get("x-reviewintel-plan") || "free_buyer";
  const role = request.headers.get("x-reviewintel-role") || (plan.includes("seller") ? "seller" : "buyer");
  const name = request.headers.get("x-reviewintel-name") || "";
  return { email, plan, role, name };
}

export async function GET(request: NextRequest) {
  const headerAccount = readHeaderAccount(request);

  if (!headerAccount.email) {
    return NextResponse.json({
      account: null,
      source: "none"
    });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      account: {
        ...headerAccount,
        trusted: false
      },
      source: "local"
    });
  }

  const rows = await supabaseSelect(
    "profiles",
    `select=*&email=eq.${encodeURIComponent(headerAccount.email)}&limit=1`
  );

  const existing = rows[0] as Record<string, unknown> | undefined;

  if (!existing) {
    const inserted = await supabaseUpsert("profiles", {
      email: headerAccount.email,
      name: headerAccount.name || null,
      role: headerAccount.role,
      plan: headerAccount.plan,
      last_login: new Date().toISOString()
    });

    return NextResponse.json({
      account: {
        ...headerAccount,
        ...(inserted ?? {}),
        trusted: true
      },
      source: "supabase"
    });
  }

  await supabaseUpsert("profiles", {
    email: headerAccount.email,
    last_login: new Date().toISOString()
  });

  return NextResponse.json({
    account: {
      ...headerAccount,
      ...existing,
      trusted: true
    },
    source: "supabase"
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || request.headers.get("x-reviewintel-email") || "").trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const profile = await supabaseUpsert("profiles", {
    email,
    name: body.name ?? null,
    role: body.role ?? "buyer",
    plan: body.plan ?? "free_buyer",
    profile_id: body.profileId ?? body.profile_id ?? null,
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
    account: profile,
    source: "supabase"
  });
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
