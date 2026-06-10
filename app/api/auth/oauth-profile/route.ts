import { NextResponse } from "next/server";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { accountFromOAuthAccessToken } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = String(body?.accessToken || "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Google login did not return a usable session token." }, { status: 400 });
  }

  const account = await accountFromOAuthAccessToken(accessToken);
  if (!account?.email) {
    return NextResponse.json({ error: "Could not read the Google account from Supabase Auth." }, { status: 401 });
  }

  const role = normalizeRole(account.role);
  const plan = normalizePlan(account.plan);

  return NextResponse.json({
    ok: true,
    account: {
      ...account,
      role: role === "guest" ? "buyer" : role,
      plan,
      name: account.name || account.email.split("@")[0] || "ReviewIntel user",
      createdAt: new Date().toISOString(),
      subscriptionStatus: plan === "free_buyer" ? "free" : "active"
    }
  });
}
