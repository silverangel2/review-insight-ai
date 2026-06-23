import { NextResponse } from "next/server";
import { normalizePlan, normalizeRole } from "@/lib/account";
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

async function mergeProfileIntoLoginResult(result: Record<string, unknown>) {
  const account = result.account && typeof result.account === "object"
    ? (result.account as Record<string, unknown>)
    : null;
  const email = valueAsString(account?.email).toLowerCase();

  if (!account || !email) return result;

  const profile = await readProfileByEmail(email);
  if (!profile) return result;

  const role = normalizeRole(valueAsString(profile.role) || valueAsString(account.role));
  const plan = normalizePlan(valueAsString(profile.plan) || valueAsString(account.plan));
  const now = new Date().toISOString();

  await supabaseUpsert("profiles", {
    email,
    last_login: now,
    updated_at: now
  }).catch(() => null);

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
      subscriptionStatus: valueAsString(profile.subscription_status) || valueAsString(account.subscriptionStatus),
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
      return NextResponse.json({
        ok: true,
        result: {
          mode: "qa-customer-account",
          account: {
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
          }
        }
      });
    }

    const result = await mergeProfileIntoLoginResult(
      await loginWithSupabase(body) as Record<string, unknown>
    );
    const account = result.account as { role?: string } | undefined;
    if (account?.role === "admin") {
      return NextResponse.json({ error: "Use the private admin access route for developer accounts." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 401 });
  }
}
