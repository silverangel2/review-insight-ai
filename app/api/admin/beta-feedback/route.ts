import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [messages, betaProfiles] = await Promise.all([
    supabaseSelect("beta_feedback", "select=*&order=created_at.desc&limit=200"),
    supabaseSelect(
      "profiles",
      "select=email,name,role,plan,subscription_status,beta_started_at,beta_expires_at,beta_original_plan,beta_original_status,updated_at&subscription_status=eq.beta&order=beta_expires_at.asc&limit=200"
    )
  ]);

  return NextResponse.json({ messages, betaProfiles });
}

export async function PATCH(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Feedback ID is required." }, { status: 400 });
  }

  const status = String(body.status ?? "").trim();
  const admin_reply = typeof body.admin_reply === "string" ? body.admin_reply : undefined;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (["open", "reviewing", "replied", "resolved", "archived"].includes(status)) {
    patch.status = status;
  }

  if (admin_reply !== undefined) {
    patch.admin_reply = admin_reply;
    patch.replied_at = new Date().toISOString();
    patch.status = status || "replied";
  }

  await supabaseUpdate("beta_feedback", `id=eq.${encodeURIComponent(id)}`, patch);

  if (admin_reply !== undefined) {
    const rows = await supabaseSelect("beta_feedback", `select=email,message,admin_reply,plan&id=eq.${encodeURIComponent(id)}&limit=1`);
    const feedback = Array.isArray(rows) ? rows[0] : null;

    if (feedback?.email) {
      await sendReviewIntelEmail({
        emailType: "beta_admin_reply",
        to: String(feedback.email),
        subject: "ReviewIntel beta feedback reply",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2>ReviewIntel beta reply</h2>
            <p>Thank you for sending beta feedback. Here is the admin reply:</p>
            <div style="padding:14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0">
              ${String(admin_reply || "").replace(/\n/g, "<br />")}
            </div>
            <p style="margin-top:18px">You can continue sending beta observations from your Account page.</p>
          </div>
        `,
        text: `ReviewIntel beta reply:\n\n${admin_reply || ""}`,
        metadata: {
          feedbackId: id,
          plan: feedback.plan || null
        }
      });
    }
  }

  return NextResponse.json({ ok: true });
}
