import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { isReviewIntelTestEmail, normalizePlan, normalizeRole } from "@/lib/account";
import { setAccountSessionCookie } from "@/lib/accountSession";
import { auditAccountAllowlist, isAuditAccount, AUDIT_SESSION_SECONDS } from "@/lib/auditAccess";
import { supabaseSelect } from "@/lib/supabaseServer";
import { logSecurityEvent, rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

type ProfileRow = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  plan?: unknown;
  name?: unknown;
  auth_user_id?: unknown;
};

async function findAccountProfile(email: string): Promise<ProfileRow | null> {
  const rows = await supabaseSelect<ProfileRow>(
    "profiles",
    `select=*&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * Mint a long-lived session cookie for an allowlisted TEST account so
 * automated audits can run without account passwords. Admin-only: the caller
 * must hold a valid admin session; the target email must be on the
 * REVIEWINTEL_AUDIT_ACCOUNTS allowlist and must exist as an account. No
 * password is ever accepted or needed.
 */
export async function POST(request: Request) {
  const admin = adminSessionFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }

  const limit = await rateLimitRequest(request, {
    key: "audit_session",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    eventType: "audit_session_rate_limited",
    userEmail: admin.email ?? null
  });
  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }
  if (!isReviewIntelTestEmail(email) || !isAuditAccount(email)) {
    await logSecurityEvent({
      event_type: "audit_session_denied",
      severity: "medium",
      request,
      user_email: admin.email ?? null,
      message: "Audit session refused: email not on the audit allowlist.",
      metadata: { target_email: email, allowlist_size: auditAccountAllowlist().length }
    });
    return NextResponse.json({ error: "That account is not allowlisted for audit access." }, { status: 403 });
  }

  const profile = await findAccountProfile(email);
  if (!profile) {
    return NextResponse.json({ error: "No account found for that email." }, { status: 404 });
  }

  const role = normalizeRole(String(profile.role ?? "buyer"));
  const plan = normalizePlan(String(profile.plan ?? ""));
  const name = String(profile.name ?? "") || email.split("@")[0];
  const userId = String(profile.id ?? profile.auth_user_id ?? email);

  const response = NextResponse.json({
    ok: true,
    email,
    role,
    expiresAt: new Date(Date.now() + AUDIT_SESSION_SECONDS * 1000).toISOString()
  });
  setAccountSessionCookie(response, { email, role, plan, name, userId }, AUDIT_SESSION_SECONDS);

  await logSecurityEvent({
    event_type: "audit_session_minted",
    severity: "medium",
    request,
    user_email: admin.email ?? null,
    message: `Audit session minted for ${email} (role ${role}, 90 days).`,
    metadata: { target_email: email, role, plan }
  });

  return response;
}
