import { NextResponse } from "next/server";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { escapeHtml } from "@/lib/emailHtml";
import { emailActionLinks, emailLinkSecret, publicEmailSiteUrl, unsubscribeHeaders } from "@/lib/emailLinks";
import { renderBrandedEmail } from "@/lib/emailTemplate";
import { rateLimitRequest } from "@/lib/security";
import { supabaseInsert } from "@/lib/supabaseServer";
import { SUPPORT_EMAIL } from "@/lib/trustContent";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimitRequest(request, {
    key: "contact_form_submit",
    limit: 5,
    windowMs: 10 * 60 * 1000,
    eventType: "contact_form_rate_limited",
  });

  if (!limit.allowed) {
    return (
      limit.response ??
      NextResponse.json(
        { error: "Daily request limit reached. Please try again tomorrow." },
        { status: 429 }
      )
    );
  }

  const body = await request.json().catch(() => ({}));

  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const topic = String(body.topic ?? "Product question").trim();
  const message = String(body.message ?? "").trim();
  const page = String(body.page ?? "").trim();
  const subject = `ReviewIntel support: ${topic}`;

  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const row = await supabaseInsert("contact_messages", {
    name: name || null,
    email: email || null,
    subject,
    message,
    status: "unread",
    priority: topic.toLowerCase().includes("bug") ? "high" : "normal",
    source: page || "website",
    admin_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (!row) {
    return NextResponse.json(
      { error: "Message could not be saved. Please email support directly." },
      { status: 500 }
    );
  }

  const contactMessageId =
    typeof (row as Record<string, unknown>).id === "string"
      ? String((row as Record<string, unknown>).id)
      : "";

  const safeTopic = escapeHtml(topic);
  const safePage = escapeHtml(page || "website");

  try {
    await sendReviewIntelEmail({
      emailType: "contact_admin_notification",
      to: SUPPORT_EMAIL,
      replyTo: email || SUPPORT_EMAIL,
      subject,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:28px;color:#101828;">
          <div style="max-width:680px;margin:auto;background:#ffffff;border:1px solid #e6eaf2;border-radius:20px;padding:24px;">
            <h1 style="margin:0 0 14px;font-size:24px;">New ReviewIntel support message</h1>
            <p><strong>Name:</strong> ${escapeHtml(name || "Not provided")}</p>
            <p><strong>Email:</strong> ${escapeHtml(email || "Not provided")}</p>
            <p><strong>Topic:</strong> ${safeTopic}</p>
            <p><strong>Page:</strong> ${safePage}</p>
            <hr style="border:none;border-top:1px solid #e6eaf2;margin:20px 0;" />
            <p style="white-space:pre-wrap;line-height:1.7;">${escapeHtml(message)}</p>
          </div>
        </div>
      `,
      text: [
        "New ReviewIntel support message",
        "",
        `Name: ${name || "Not provided"}`,
        `Email: ${email || "Not provided"}`,
        `Topic: ${topic}`,
        `Page: ${page || "website"}`,
        "",
        "Message:",
        message,
      ].join("\n"),
      metadata: {
        source: "contact_form",
        contactMessageId,
        contactEmail: email,
        contactName: name,
        topic,
        page,
      },
    });

    if (email) {
      const links = emailActionLinks(email, publicEmailSiteUrl(), emailLinkSecret());
      const confirmation = renderBrandedEmail({
        preheader: "We saved your message. You do not need to send it again.",
        eyebrow: "Support",
        title: "We received your message",
        greetingName: name,
        paragraphs: [
          "We saved your message. You do not need to send it again.",
          `Topic: ${topic}`,
          `Page: ${page || "website"}`,
          "If this is about a scan, account access, billing, or advertising, we will reply with the next step.",
        ],
        cta: { label: "Email ReviewIntel support", href: `mailto:${SUPPORT_EMAIL}` },
        reason: "You are receiving this because you contacted ReviewIntel.",
        preferencesUrl: links.preferencesUrl,
        unsubscribeUrl: links.unsubscribeUrl,
        postalAddress: process.env.REVIEWINTEL_POSTAL_ADDRESS || "",
      });
      await sendReviewIntelEmail({
        emailType: "contact_auto_reply",
        to: email,
        replyTo: SUPPORT_EMAIL,
        subject: "We received your ReviewIntel message",
        html: confirmation.html,
        text: confirmation.text,
        headers: unsubscribeHeaders(links.oneClickUrl),
        metadata: {
          source: "contact_form_auto_reply",
          contactMessageId,
          topic,
          page,
        },
      });
    }
  } catch (error) {
    console.error("Contact message saved, but email notification failed:", error);
  }

  return NextResponse.json({ ok: true });
}
