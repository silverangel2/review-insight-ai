import { NextResponse } from "next/server";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { escapeHtml, escapeHtmlAttribute, textToHtmlParagraphs } from "@/lib/emailHtml";
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
  unsubscribeUrl
}: {
  name?: string | null;
  subject: string;
  body: string;
  unsubscribeUrl: string;
}) {
  const textName = name?.trim() || "there";
  const safeName = escapeHtml(textName);
  const safeSubject = escapeHtml(subject);
  const safeUnsubscribeUrl = escapeHtmlAttribute(unsubscribeUrl);
  const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);
  const paragraphs = textToHtmlParagraphs(body);

  return {
    html: `
      <div style="margin:0;padding:0;background:#eef6f8;font-family:Arial,Helvetica,sans-serif;color:#101828;">
        <div style="max-width:680px;margin:0 auto;padding:34px 18px;">
          <div style="background:#07111f;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(7,17,31,0.25);">
            <div style="background:linear-gradient(135deg,#07111f 0%,#0f766e 55%,#22d3ee 120%);padding:30px 28px;color:#ffffff;">
              <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);border-radius:999px;padding:10px 14px;">
                <span style="display:inline-block;width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#22d3ee,#fbbf24);box-shadow:0 0 24px rgba(34,211,238,0.55);"></span>
                <span style="font-size:15px;font-weight:900;letter-spacing:0.02em;">ReviewIntel</span>
              </div>
              <p style="margin:22px 0 0;font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#a7f3d0;">
                ReviewIntel Update
              </p>
              <h1 style="margin:12px 0 0;font-size:32px;line-height:1.12;font-weight:900;">
                ${safeSubject}
              </h1>
            </div>

            <div style="background:#ffffff;padding:28px;border-radius:28px 28px 0 0;">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#101828;">
                Hi ${safeName},
              </p>
              ${paragraphs}

              <div style="background:#f8fafc;border:1px solid #e6eaf2;border-radius:20px;padding:18px;margin-top:24px;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#667085;">
                  You are receiving this because you said yes to ReviewIntel marketing or product updates.
                  You can unsubscribe anytime.
                </p>
              </div>

              <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#667085;">
                <a href="${safeUnsubscribeUrl}" style="color:#0f766e;font-weight:800;">Unsubscribe from ReviewIntel marketing emails</a>
              </p>
            </div>
          </div>

          <p style="text-align:center;margin:22px 0 0;font-size:12px;line-height:1.7;color:#667085;">
            ReviewIntel · AI product review intelligence<br/>
            ${safeSupportEmail}
          </p>
        </div>
      </div>
    `,
    text: [
      subject,
      "",
      `Hi ${textName},`,
      "",
      body,
      "",
      "You are receiving this because you said yes to ReviewIntel marketing or product updates.",
      `Unsubscribe: ${unsubscribeUrl}`,
      "",
      `ReviewIntel Support: ${SUPPORT_EMAIL}`
    ].join("\n")
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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ||
    "https://getreviewintel.com";

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
      const unsubscribeUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
      const emailContent = buildMarketingEmail({
        name: recipient.name,
        subject,
        body: message,
        unsubscribeUrl
      });

      const sendResult = await sendReviewIntelEmail({
        emailType: "marketing_campaign",
        to: recipient.email,
        replyTo: SUPPORT_EMAIL,
        subject,
        html: emailContent.html,
        text: emailContent.text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        },
        metadata: {
          source: "admin_marketing_send",
          recipientName: recipient.name,
          unsubscribeUrl
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
