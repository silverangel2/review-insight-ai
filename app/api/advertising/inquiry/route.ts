import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { sendReviewIntelEmail, SUPPORT_EMAIL } from "@/lib/emailDelivery";
import { rateLimited, validateInquiry } from "@/lib/advertiserFlow";
import { emailTemplates } from "@/lib/emailTemplates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (rateLimited(`inquiry:${ip}`)) return NextResponse.json({ error: "Too many inquiries. Please try again later." }, { status: 429 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const checked = validateInquiry(body);
  if (!checked.ok) return NextResponse.json(checked.spam ? { ok: true } : { error: checked.error }, { status: checked.spam ? 200 : 400 });
  const v = checked.value;
  let saved = false;
  if (isSupabaseConfigured()) {
    const res = await supabaseFetch("/rest/v1/advertiser_applications", { method: "POST", body: JSON.stringify({
      source: "inquiry", brand_name: v.company, contact_name: v.name, contact_email: v.email, website_url: v.website || null,
      preferred_placement: v.placement || null, budget_range: v.budget || null, inquiry_message: v.message || null,
      campaign_goal: v.message ? v.message.slice(0, 300) : "Inquiry", status: "pending", payment_status: "unpaid",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }) }).catch(() => null);
    saved = Boolean(res?.ok);
  }
  const owner = process.env.REVIEWINTEL_OWNER_EMAIL || SUPPORT_EMAIL;
  const lines = [`Name: ${v.name}`, `Email: ${v.email}`, `Company: ${v.company}`, `Website: ${v.website || "-"}`, `Budget: ${v.budget || "-"}`, `Placement: ${v.placement || "-"}`, `Message: ${v.message || "-"}`, `Saved to DB: ${saved ? "yes" : "no"}`];
  const ownerMail = emailTemplates.advertiser_inquiry_owner({ lines, company: v.company });
  await sendReviewIntelEmail({ emailType: "advertiser_inquiry_owner", to: owner, replyTo: v.email, subject: ownerMail.subject, html: ownerMail.html, text: ownerMail.text, metadata: { company: v.company } }).catch(() => null);
  const reply = emailTemplates.advertiser_autoreply({ name: v.name });
  await sendReviewIntelEmail({ emailType: "advertiser_inquiry_autoreply", to: v.email, subject: reply.subject, html: reply.html, text: reply.text }).catch(() => null);
  return NextResponse.json({ ok: true, message: "Thanks! We'll reply within 2 business days." });
}
