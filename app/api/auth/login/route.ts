import { NextResponse } from "next/server";
import { loginWithSupabase } from "@/lib/supabaseAuth";
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
    name: "Seller Starter Tester",
    role: "seller",
    plan: "seller_starter",
    profileId: "SELL-START-001",
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

export async function POST(request: Request) {
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
            marketingConsent: true
          }
        }
      });
    }

    const result = await loginWithSupabase(body);
    if ("account" in result && result.account?.role === "admin") {
      return NextResponse.json({ error: "Use the private admin access route for developer accounts." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 401 });
  }
}
