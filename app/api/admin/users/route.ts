import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ProfileRow = {
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  created_at?: string | null;
  last_login?: string | null;
  marketing_consent?: boolean | null;
};

function planLabel(plan?: string | null) {
  if (plan === "seller_pro") return "Seller Pro";
  if (plan === "seller_starter") return "Seller Premium";
  if (plan === "buyer_pro") return "Shopper Premium";
  return "Shopper Free";
}

function roleLabel(role?: string | null) {
  if (role === "admin") return "Admin";
  if (role === "seller") return "Seller";
  return "Shopper";
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      users: [],
      source: "local",
      message: "Supabase is not configured yet."
    });
  }

  const profiles = await supabaseSelect<ProfileRow>(
    "profiles",
    "select=email,name,role,plan,created_at,last_login,marketing_consent&order=created_at.desc"
  );

  const users = profiles.map((profile, index) => ({
    id: profile.email || `profile-${index}`,
    email: profile.email,
    name: profile.name ?? "",
    role: roleLabel(profile.role),
    plan: planLabel(profile.plan),
    signupDate: profile.created_at ? profile.created_at.slice(0, 10) : "",
    lastLogin: profile.last_login ? profile.last_login.slice(0, 10) : "",
    marketingConsent: Boolean(profile.marketing_consent)
  }));

  return NextResponse.json({
    users,
    source: "supabase"
  });
}
