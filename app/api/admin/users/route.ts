import { NextResponse } from "next/server";
import { normalizePlan } from "@/lib/account";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
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
  subscription_status?: string | null;
  beta_started_at?: string | null;
  beta_expires_at?: string | null;
  beta_original_plan?: string | null;
  beta_original_status?: string | null;
};

function planLabel(plan?: string | null) {
  if (plan === "seller_pro") return "Seller Pro";
  if (plan === "seller_starter" || plan === "seller_premium") return "Seller Premium";
  if (plan === "seller_beta") return "Beta Seller Premium";
  if (plan === "buyer_pro") return "Shopper Premium";
  if (plan === "buyer_beta") return "Beta Shopper Premium";
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

async function logAdminAction(adminEmail: string, action: string, targetEmail: string, reason?: string) {
  await supabaseInsert("admin_audit_logs", {
    admin_email: adminEmail || "owner",
    target_email: targetEmail,
    action,
    reason: reason || "",
    created_at: new Date().toISOString(),
  }).catch((error) => {
    console.error("Admin audit log failed:", error);
  });
}

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      users: [],
      source: "local",
      message: "Supabase is not configured yet.",
    });
  }

  const profiles = await supabaseSelect<ProfileRow>(
    "profiles",
    "select=email,name,role,plan,created_at,last_login,marketing_consent,status,ban_reason,suspended_reason,admin_notes,force_logout_at,daily_scan_count,monthly_scan_count,last_scan_at,updated_at,subscription_status,beta_started_at,beta_expires_at,beta_original_plan,beta_original_status&order=created_at.desc"
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
      betaStartedAt: profile.beta_started_at || "",
      betaExpiresAt: profile.beta_expires_at || "",
    };
  }));

  return NextResponse.json({
    users,
    source: "supabase",
  });
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

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

  const profileRows = await supabaseSelect<ProfileRow>(
    "profiles",
    `select=role,plan,subscription_status,beta_original_plan,beta_original_status&email=eq.${encodeURIComponent(email)}&limit=1`
  ).catch(() => []);
  const currentProfile = profileRows[0];
  const storedPlan = normalizePlan(String(currentProfile?.plan || plan || "free_buyer"));
  const storedStatus = String(currentProfile?.subscription_status || "active");

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
  } else if (action === "make_beta_shopper" || action === "make_beta_seller" || action === "remove_beta") {
    const nowDate = new Date();
    const betaExpiresAt = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const isRemovingBeta = action === "remove_beta";
    const rawOriginalPlan = String(currentProfile?.beta_original_plan || "").trim();
    const originalPlan = rawOriginalPlan ? normalizePlan(rawOriginalPlan) : "";
    const originalStatus = String(currentProfile?.beta_original_status || storedStatus || "active");
    const fallbackPlan = storedPlan.startsWith("seller") ? "seller_premium" : "free_buyer";
    const restorePlan = originalPlan && originalPlan !== "buyer_beta" && originalPlan !== "seller_beta"
      ? originalPlan
      : fallbackPlan;
    const betaOriginalPlan = storedPlan === "buyer_beta" || storedPlan === "seller_beta"
      ? originalPlan || fallbackPlan
      : storedPlan;
    const betaPlan =
      action === "make_beta_shopper"
        ? "buyer_beta"
        : action === "make_beta_seller"
          ? "seller_beta"
          : restorePlan;

    update = {
      ...baseUpdate,
      plan: betaPlan,
      subscription_plan: betaPlan,
      subscription_status: isRemovingBeta ? originalStatus || "active" : "beta",
      beta_started_at: isRemovingBeta ? null : nowDate.toISOString(),
      beta_expires_at: isRemovingBeta ? null : betaExpiresAt,
      beta_original_plan: isRemovingBeta ? null : betaOriginalPlan,
      beta_original_status: isRemovingBeta ? null : storedStatus || "active",
      beta_last_notified_at: null,
      beta_last_survey_sent_at: isRemovingBeta ? null : null,
      beta_survey_count: isRemovingBeta ? 0 : 0,
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
  await logAdminAction(adminSession.email, action, email, reason || note);

  if (action === "make_beta_shopper" || action === "make_beta_seller") {
    const betaPlanName = action === "make_beta_shopper" ? "Beta Shopper Premium" : "Beta Seller Premium";
    const betaExpiry = update.beta_expires_at ? new Date(String(update.beta_expires_at)).toLocaleDateString() : "in 30 days";

    await sendReviewIntelEmail({
      emailType: "beta_welcome",
      to: email,
      subject: `Welcome to ReviewIntel ${betaPlanName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Welcome to ReviewIntel ${betaPlanName}</h2>
          <p>Your beta access is now active.</p>
          <p><strong>Beta expiry:</strong> ${betaExpiry}</p>
          <p>During beta, please send observations, bugs, confusing parts, wrong results, or feature requests from your Account page.</p>
          <p>Weekly beta surveys may also be sent so we can improve ReviewIntel based on your testing.</p>
          <p>Thank you for helping improve ReviewIntel.</p>
        </div>
      `,
      text: `Welcome to ReviewIntel ${betaPlanName}. Your beta access is active until ${betaExpiry}. Please send beta observations from your Account page.`,
      metadata: {
        action,
        betaPlanName,
        betaExpiresAt: update.beta_expires_at || null
      }
    });
  }

  const messages: Record<string, string> = {
    refresh: "Profile refreshed. Live scan counts were recalculated from usage events.",
    force_logout: "Force logout timestamp saved. The user will be pushed out on their next account check.",
    reset_quota: "Quota reset complete. Shopper Free can scan again now.",
    suspend: "Account suspended.",
    ban: "Account banned.",
    unban: "Account restored to active.",
    note: "Admin note saved.",
    make_beta_shopper: "Beta Shopper Premium started. Welcome email sent if email delivery is configured.",
    make_beta_seller: "Beta Seller Premium started. Welcome email sent if email delivery is configured.",
    remove_beta: "Beta access removed."
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
