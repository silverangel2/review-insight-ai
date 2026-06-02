import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { planLabel, normalizePlan } from "@/lib/account";
import { adminCustomerRows } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const demoUsers = [
  {
    id: "demo-shopper-1",
    email: "mia.shopper@example.com",
    plan: "Shopper Free",
    role: "shopper",
    signupDate: "2026-05-18",
    lastLogin: "2026-05-30",
    marketingConsent: true
  },
  {
    id: "demo-shopper-premium",
    email: "alex.pro@example.com",
    plan: "Shopper Premium",
    role: "shopper",
    signupDate: "2026-05-21",
    lastLogin: "2026-05-31",
    marketingConsent: true
  },
  {
    id: "demo-seller-pro",
    email: "ops@solarasupply.example",
    plan: "Seller Pro",
    role: "seller",
    signupDate: "2026-05-23",
    lastLogin: "2026-05-31",
    marketingConsent: false
  }
];

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const users = await adminCustomerRows();
    if (!users.length) return NextResponse.json({ source: "demo", users: demoUsers });

    return NextResponse.json({
      source: "supabase",
      users: users.map((user) => ({
        ...user,
        plan: planLabel(normalizePlan(user.plan))
      }))
    });
  } catch {
    return NextResponse.json({ source: "demo", users: demoUsers });
  }
}
