import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabaseServer";

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
  await supabaseUpsert("admin_audit_logs", {
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

  const users = profiles.map((profile, index) => ({
    id: profile.email || `profile-${index}`,
    email: profile.email,
    name: profile.name ?? "",
    role: roleLabel(profile.role),
    rawRole: profile.role ?? "buyer",
    plan: planLabel(profile.plan),
    rawPlan: profile.plan ?? "free_buyer",
    signupDate: profile.created_at ? profile.created_at.slice(0, 10) : "",
    lastLogin: profile.last_login ? profile.last_login.slice(0, 10) : "",
    marketingConsent: Boolean(profile.marketing_consent),
    status: profile.status || "active",
    banReason: profile.ban_reason || "",
    suspendedReason: profile.suspended_reason || "",
    adminNotes: profile.admin_notes || "",
    forceLogoutAt: profile.force_logout_at || "",
    dailyScanCount: profile.daily_scan_count ?? 0,
    monthlyScanCount: profile.monthly_scan_count ?? 0,
    lastScanAt: profile.last_scan_at || "",
    updatedAt: profile.updated_at || "",
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
  const now = new Date().toISOString();

  if (!email) {
    return NextResponse.json({ error: "Missing user email." }, { status: 400 });
  }

  const baseUpdate: Record<string, unknown> = {
    email,
    updated_at: now,
  };

  let update: Record<string, unknown> = {};

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

  await supabaseUpsert("profiles", update);
  await logAdminAction(action, email, reason || note);

  return NextResponse.json({
    ok: true,
    email,
    action,
    updatedAt: now,
  });
}
