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
    } catch (error) {
      console.error("Contact message saved, but email notification failed:", error);
    }
  } else {
    console.warn("Contact message saved, but RESEND_API_KEY is missing.");
  }

  return NextResponse.json({ ok: true });
}
