import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  EMAIL_FROM,
  SUPPORT_EMAIL,
  hasEmailLogStorage,
  hasEmailProvider,
  sendReviewIntelEmail,
} from "@/lib/emailDelivery";
import { emailActionLinks, emailLinkSecret, publicEmailSiteUrl, unsubscribeHeaders } from "@/lib/emailLinks";
import { renderBrandedEmail } from "@/lib/emailTemplate";

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

  const links = emailActionLinks(to, publicEmailSiteUrl(), emailLinkSecret());
  const message = renderBrandedEmail({
    preheader: "A ReviewIntel email test. No customer was emailed by this check.",
    eyebrow: "Email test",
    title: "ReviewIntel email test",
    paragraphs: [
      "This is a branded test of the ReviewIntel email layout.",
      `Sender: ${EMAIL_FROM}`,
    ],
    reason: "You asked for this test from the admin email check.",
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    postalAddress: process.env.REVIEWINTEL_POSTAL_ADDRESS || "",
  });
  const result = await sendReviewIntelEmail({
    emailType: "admin_test",
    to,
    subject: "ReviewIntel email test",
    html: message.html,
    text: message.text,
    headers: unsubscribeHeaders(links.oneClickUrl),
    metadata: {
      source: "admin_email_test",
    },
  });

  return NextResponse.json({
    ...result,
    deploymentReady: hasEmailProvider() && hasEmailLogStorage(),
  }, { status: result.ok ? 200 : 500 });
}
