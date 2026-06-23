import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { escapeHtml, textToHtmlBreaks } from "@/lib/emailHtml";
import { supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";
import { SUPPORT_EMAIL } from "@/lib/trustContent";

export const runtime = "nodejs";

type ContactMessageRow = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  subject?: string | null;
};

export async function POST(request: Request): Promise<Response> {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const id = String(body.id ?? "").trim();
  const message = String(body.message ?? "").trim();
  const requestedSubject = String(body.subject ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
  }

  const rows = await supabaseSelect<ContactMessageRow>(
    "contact_messages",
    `select=id,email,name,subject&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  const savedMessage = rows[0];
  const to = String(savedMessage?.email ?? "").trim().toLowerCase();
  const customerName = String(savedMessage?.name ?? "").trim();
  const originalSubject = String(savedMessage?.subject ?? "ReviewIntel Support").trim();
  const subject =
    requestedSubject ||
    (originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject || "ReviewIntel Support"}`);

  if (!savedMessage) {
    return NextResponse.json({ error: "Customer message was not found." }, { status: 404 });
  }

  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Customer email is required." }, { status: 400 });
  }

  if (!message || message.length < 5) {
    return NextResponse.json({ error: "Reply message is required." }, { status: 400 });
  }

  try {
    const safeCustomerName = escapeHtml(customerName || "there");
    const safeMessageHtml = textToHtmlBreaks(message);
    const safeSupportEmail = escapeHtml(SUPPORT_EMAIL);

    const sendResult = await sendReviewIntelEmail({
      emailType: "admin_reply",
      to,
      replyTo: SUPPORT_EMAIL,
      subject,
      html: `
        <div style="margin:0;padding:0;background:#eef6f8;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <div style="max-width:680px;margin:0 auto;padding:34px 18px;">
            <div style="background:#07111f;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(7,17,31,0.25);">
              <div style="background:linear-gradient(135deg,#07111f 0%,#0f766e 55%,#22d3ee 120%);padding:28px;color:#ffffff;">
                <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);border-radius:999px;padding:10px 14px;">
                  <span style="display:inline-block;width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#22d3ee,#fbbf24);box-shadow:0 0 24px rgba(34,211,238,0.55);"></span>
                  <span style="font-size:15px;font-weight:900;letter-spacing:0.02em;">ReviewIntel</span>
                </div>
                <p style="margin:22px 0 0;font-size:12px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#a7f3d0;">
                  Support Reply
                </p>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.12;font-weight:900;">
                  We replied to your ReviewIntel request.
                </h1>
              </div>

              <div style="background:#ffffff;padding:28px;border-radius:28px 28px 0 0;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#101828;">
                  Hi ${safeCustomerName},
                </p>

                <div style="white-space:pre-wrap;margin:0 0 20px;font-size:16px;line-height:1.75;color:#344054;">
${safeMessageHtml}
                </div>

                <div style="background:#f8fafc;border:1px solid #e6eaf2;border-radius:20px;padding:18px;margin-top:22px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#667085;">
                    Need to add more details? Reply to this email or contact us at ${safeSupportEmail}.
                  </p>
                </div>
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
        `Hi ${customerName || "there"},`,
        "",
        message,
        "",
        `ReviewIntel Support`,
        SUPPORT_EMAIL
      ].join("\n"),
      metadata: {
        source: "admin_message_reply",
        contactMessageId: id,
        customerEmail: to,
        customerName
      }
    });

    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error || "Reply email failed to send." },
        { status: 500 }
      );
    }

    await supabaseUpdate("contact_messages", `id=eq.${encodeURIComponent(id)}`, {
      status: "replied",
      admin_notes: `Reply sent to ${to} on ${new Date().toISOString()}`,
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin reply email failed:", error);
    return NextResponse.json({ error: "Reply email failed to send." }, { status: 500 });
  }
}
