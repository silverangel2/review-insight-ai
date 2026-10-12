import { NextResponse } from "next/server";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { emailActionLinks, emailLinkSecret, publicEmailSiteUrl, unsubscribeHeaders } from "@/lib/emailLinks";
import { renderBrandedEmail } from "@/lib/emailTemplate";
import { supabaseSelect } from "@/lib/supabaseServer";
import { SUPPORT_EMAIL } from "@/lib/trustContent";

export const runtime = "nodejs";

type MarketingProfile = {
  email?: string | null;
  name?: string | null;
  marketing_consent?: boolean | null;
};

function buildMarketingEmail({
  name,
  subject,
  body,
  links
}: {
  name?: string | null;
  subject: string;
  body: string;
  links: { preferencesUrl: string; unsubscribeUrl: string; oneClickUrl: string };
}) {
  const paragraphs = String(body)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rendered = renderBrandedEmail({
    preheader: subject,
    eyebrow: "Product update",
    title: subject,
    greetingName: name,
    paragraphs,
    reason: "You are receiving this because you said yes to ReviewIntel product updates. You can turn them off any time.",
    preferencesUrl: links.preferencesUrl,
    unsubscribeUrl: links.unsubscribeUrl,
    postalAddress: process.env.REVIEWINTEL_POSTAL_ADDRESS || "",
  });
  return {
    ...rendered,
    headers: unsubscribeHeaders(links.oneClickUrl),
  };
}

export async function POST(request: Request): Promise<Response> {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!subject || subject.length < 4) {
    return NextResponse.json({ error: "Campaign subject is required." }, { status: 400 });
  }

  if (!message || message.length < 10) {
    return NextResponse.json({ error: "Campaign message is required." }, { status: 400 });
  }

  const siteUrl = publicEmailSiteUrl();
  const secret = emailLinkSecret();

  const profiles = await supabaseSelect<MarketingProfile>(
    "profiles",
    "select=email,name,marketing_consent&marketing_consent=eq.true&email=not.is.null"
  );

  const recipients = profiles
    .filter((profile) => profile.marketing_consent && profile.email && profile.email.includes("@"))
    .map((profile) => ({
      email: String(profile.email).trim().toLowerCase(),
      name: profile.name ?? null
    }));

  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [recipient.email, recipient])).values()
  );

  if (!uniqueRecipients.length) {
    return NextResponse.json({ error: "No marketing-consent recipients found." }, { status: 400 });
  }

  let sent = 0;
  const failed: Array<{ email: string; error: string }> = [];

  for (const recipient of uniqueRecipients) {
    try {
      const links = emailActionLinks(recipient.email, siteUrl, secret);
      const emailContent = buildMarketingEmail({
        name: recipient.name,
        subject,
        body: message,
        links
      });

      const sendResult = await sendReviewIntelEmail({
        emailType: "marketing_campaign",
        category: "marketing",
        to: recipient.email,
        replyTo: SUPPORT_EMAIL,
        subject,
        html: emailContent.html,
        text: emailContent.text,
        headers: emailContent.headers,
        metadata: {
          source: "admin_marketing_send",
          recipientName: recipient.name,
          unsubscribeUrl: links.unsubscribeUrl
        }
      });

      if (sendResult.ok) {
        sent += 1;
      } else {
        failed.push({
          email: recipient.email,
          error: sendResult.error || "Unknown send error"
        });
      }
    } catch (error) {
      failed.push({
        email: recipient.email,
        error: error instanceof Error ? error.message : "Unknown send error"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    attempted: uniqueRecipients.length,
    sent,
    failed
  });
}
