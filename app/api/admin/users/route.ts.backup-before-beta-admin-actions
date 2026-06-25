import { NextResponse } from "next/server";
import { normalizePlan } from "@/lib/account";
import {isSupabaseConfigured,
  scanUsageForEmail,
  supabaseInsert,
  supabaseSelect,
  supabaseUpsert,
  resetPersistentQuota} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ProfileRow = {
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  created_at?: string | null;
  last_login?: string | null;
  marketing_consent?: boolean | null;
  status?: string | null;
  ban_reason?: string | null;
  suspended_reason?: string | null;
  admin_notes?: string | null;
  force_logout_at?: string | null;
  daily_scan_count?: number | null;
  monthly_scan_count?: number | null;
  last_scan_at?: string | null;
  updated_at?: string | null;
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

function normalizeEmail(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

async function logAdminAction(action: string, targetEmail: string, reason?: string) {
  await supabaseInsert("admin_audit_logs", {
    admin_email: "owner",
    target_email: targetEmail,
    action,
    reason: reason || "",
    created_at: new Date().toISOString(),
  }).catch((error) => {
    console.error("Admin audit log failed:", error);
  });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      users: [],
      source: "local",
      message: "Supabase is not configured yet.",
    });
  }

  const profiles = await supabaseSelect<ProfileRow>(
    "profiles",
    "select=email,name,role,plan,created_at,last_login,marketing_consent,status,ban_reason,suspended_reason,admin_notes,force_logout_at,daily_scan_count,monthly_scan_count,last_scan_at,updated_at&order=created_at.desc"
  );

  const users = await Promise.all(profiles.map(async (profile, index) => {
    const rawPlan = profile.plan ?? "free_buyer";
    const liveUsage = await scanUsageForEmail(profile.email, rawPlan);

    return {
      id: profile.email || `profile-${index}`,
      email: profile.email,
      name: profile.name ?? "",
      role: roleLabel(profile.role),
      rawRole: profile.role ?? "buyer",
      plan: planLabel(rawPlan),
      rawPlan,
      signupDate: profile.created_at ? profile.created_at.slice(0, 10) : "",
      lastLogin: profile.last_login ? profile.last_login.slice(0, 10) : "",
      marketingConsent: Boolean(profile.marketing_consent),
      status: profile.status || "active",
      banReason: profile.ban_reason || "",
      suspendedReason: profile.suspended_reason || "",
      adminNotes: profile.admin_notes || "",
      forceLogoutAt: profile.force_logout_at || "",
      dailyScanCount: liveUsage.dailyScanCount,
      monthlyScanCount: liveUsage.monthlyScanCount,
      totalScanCount: liveUsage.totalScanCount,
      lastScanAt: liveUsage.lastScanAt || profile.last_scan_at || "",
      updatedAt: profile.updated_at || "",
    };
  }));

  return NextResponse.json({
    users,
    source: "supabase",
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const action = String(body?.action || "").trim();
  const reason = String(body?.reason || "").trim();
  const note = String(body?.note || "").trim();
  const plan = normalizePlan(String(body?.plan || "free_buyer"));
  const now = new Date().toISOString();

  if (!email) {
    return NextResponse.json({ error: "Missing user email." }, { status: 400 });
  }

  const baseUpdate: Record<string, unknown> = {
    email,
    updated_at: now,
  };

  let update: Record<string, unknown> = {};
  let actionQuota: unknown = null;

  if (action === "refresh") {
    update = {
      ...baseUpdate,
      updated_at: now,
    };
  } else if (action === "force_logout") {
    update = {
      ...baseUpdate,
      force_logout_at: now,
    };
  } else if (action === "reset_quota") {
    update = {
      ...baseUpdate,
      daily_scan_count: 0,
      monthly_scan_count: 0,
      last_scan_at: null,
    };
  } else if (action === "suspend") {
    update = {
      ...baseUpdate,
      status: "suspended",
      suspended_reason: reason || "Suspended by admin.",
    };
  } else if (action === "ban") {
    update = {
      ...baseUpdate,
      status: "banned",
      ban_reason: reason || "Banned by admin.",
    };
  } else if (action === "unban") {
    update = {
      ...baseUpdate,
      status: "active",
      ban_reason: "",
      suspended_reason: "",
    };
  } else if (action === "note") {
    update = {
      ...baseUpdate,
      admin_notes: note || reason,
    };
  } else {
    return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
  }

  if (action === "reset_quota") {
    const resetResult = await resetPersistentQuota({ email, plan });
    actionQuota = resetResult.quota;

    if (!resetResult.ok) {
      return NextResponse.json(
        {
          error: "Quota reset could not clear the server usage events. Check Supabase permissions and try again.",
          quota: resetResult.quota
        },
        { status: 500 }
      );
    }
  }

  await supabaseUpsert("profiles", update);
  await logAdminAction(action, email, reason || note);

  const messages: Record<string, string> = {
    refresh: "Profile refreshed. Live scan counts were recalculated from usage events.",
    force_logout: "Force logout timestamp saved. The user will be pushed out on their next account check.",
    reset_quota: "Quota reset complete. Shopper Free can scan again now.",
    suspend: "Account suspended.",
    ban: "Account banned.",
    unban: "Account restored to active.",
    note: "Admin note saved."
  };

  return NextResponse.json({
    ok: true,
    email,
    action,
    message: messages[action] || "Admin action completed.",
    quota: actionQuota,
    updatedAt: now,
  });
}
