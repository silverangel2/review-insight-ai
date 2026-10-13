import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  EMAIL_FROM,
  SUPPORT_EMAIL,
  hasEmailLogStorage,
  hasEmailProvider,
  sendReviewIntelEmail,
} from "@/lib/emailDelivery";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "resend",
    hasResendApiKey: hasEmailProvider(),
    hasEmailLogStorage: hasEmailLogStorage(),
    from: EMAIL_FROM,
    supportEmail: SUPPORT_EMAIL,
    deploymentReady: hasEmailProvider() && hasEmailLogStorage(),
  });
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const to = String(body.to || SUPPORT_EMAIL).trim();

  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Valid test recipient is required." }, { status: 400 });
  }

  const result = await sendReviewIntelEmail({
    emailType: "admin_test",
    to,
    subject: "ReviewIntel Email Test",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px;">
        <div style="max-width:640px;margin:auto;background:#ffffff;border:1px solid #e6eaf2;border-radius:20px;padding:28px;">
          <h1 style="margin:0 0 12px;color:#101828;">ReviewIntel Email Test</h1>
          <p style="font-size:16px;line-height:1.7;color:#344054;">
            This is a real deployment-ready email test from ReviewIntel using Resend.
          </p>
          <p style="font-size:13px;line-height:1.7;color:#667085;">
            Sender: ${EMAIL_FROM}<br/>
            Support: ${SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    `,
    text: "ReviewIntel Email Test\n\nThis is a real deployment-ready email test from ReviewIntel using Resend.",
    metadata: {
      source: "admin_email_test",
    },
  });

  return NextResponse.json({
    ...result,
    deploymentReady: hasEmailProvider() && hasEmailLogStorage(),
  }, { status: result.ok ? 200 : 500 });
}
