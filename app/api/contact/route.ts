import { NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimitRequest } from "@/lib/security";
import { supabaseInsert } from "@/lib/supabaseServer";
import { SUPPORT_EMAIL } from "@/lib/trustContent";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimitRequest(request, {
    key: "contact_form_submit",
    limit: 5,
    windowMs: 10 * 60 * 1000,
    eventType: "contact_form_rate_limited"
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
    updated_at: new Date().toISOString()
  });

  if (!row) {
    return NextResponse.json(
      { error: "Message could not be saved. Please email support directly." },
      { status: 500 }
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);

      await resend.emails.send({
        from: "ReviewIntel <onboarding@resend.dev>",
        to: SUPPORT_EMAIL,
        replyTo: email || undefined,
        subject,
        text: [
          "New ReviewIntel support message",
          "",
          `Name: ${name || "Not provided"}`,
          `Email: ${email || "Not provided"}`,
          `Topic: ${topic}`,
          `Page: ${page || "website"}`,
          "",
          "Message:",
          message
        ].join("\n")
      });

      if (email) {
        await resend.emails.send({
          from: "ReviewIntel <onboarding@resend.dev>",
          to: email,
          replyTo: SUPPORT_EMAIL,
          subject: "We received your ReviewIntel message",
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
                      Support Confirmation
                    </p>

                    <h1 style="margin:12px 0 0;font-size:34px;line-height:1.08;font-weight:900;">
                      We received your message.
                    </h1>

                    <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#e6fffb;">
                      Thanks for contacting ReviewIntel. Your request is saved in our support inbox and our team will review it.
                    </p>
                  </div>

                  <div style="background:#ffffff;padding:28px;border-radius:28px 28px 0 0;">
                    <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#101828;">
                      Hi ${name || "there"},
                    </p>

                    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344054;">
                      We got your message. You do not need to send it again. If your request is about a product scan, account access, billing, or advertising, we’ll reply with the next steps.
                    </p>

                    <div style="background:#f8fafc;border:1px solid #e6eaf2;border-radius:22px;padding:20px;margin:22px 0;">
                      <div style="font-size:12px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;margin-bottom:10px;">
                        Request Summary
                      </div>
                      <table style="width:100%;border-collapse:collapse;">
                        <tr>
                          <td style="padding:7px 0;font-size:14px;color:#667085;font-weight:700;">Topic</td>
                          <td style="padding:7px 0;font-size:14px;color:#101828;font-weight:900;text-align:right;">${topic}</td>
                        </tr>
                        <tr>
                          <td style="padding:7px 0;font-size:14px;color:#667085;font-weight:700;">Page</td>
                          <td style="padding:7px 0;font-size:14px;color:#101828;font-weight:900;text-align:right;">${page || "website"}</td>
                        </tr>
                      </table>
                    </div>

                    <a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block;background:#07111f;color:#ffffff;text-decoration:none;font-weight:900;border-radius:16px;padding:14px 20px;">
                      Email ReviewIntel Support
                    </a>

                    <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#667085;">
                      This is an automatic confirmation from ReviewIntel. A support reply will come from our team when available.
                    </p>
                  </div>
                </div>

                <p style="text-align:center;margin:22px 0 0;font-size:12px;line-height:1.7;color:#667085;">
                  ReviewIntel · AI product review intelligence<br/>
                  ${SUPPORT_EMAIL}
                </p>
              </div>
            </div>
          `,
          text: [
            "We received your ReviewIntel message",
            "",
            `Hi ${name || "there"},`,
            "",
            "Thanks for contacting ReviewIntel. Your request is saved in our support inbox.",
            "You do not need to send it again. Our team will review it and reply when available.",
            "",
            `Topic: ${topic}`,
            `Page: ${page || "website"}`,
            "",
            `Support: ${SUPPORT_EMAIL}`
          ].join("\n")
        });
      }
    } catch (error) {
      console.error("Contact message saved, but email notification failed:", error);
    }
  } else {
    console.warn("Contact message saved, but RESEND_API_KEY is missing.");
  }

  return NextResponse.json({ ok: true });
}
