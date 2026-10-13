import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { sendReviewIntelEmail, SUPPORT_EMAIL } from "@/lib/emailDelivery";
import { emailActionLinks, emailLinkSecret, publicEmailSiteUrl, unsubscribeHeaders } from "@/lib/emailLinks";
import { renderBrandedEmail } from "@/lib/emailTemplate";
import { rateLimited, validateInquiry } from "@/lib/advertiserFlow";

export const runtime = "nodejs";
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

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
      source: "inquiry", brand_name: v.company, contact_name: v.name, contact_email: v.email, website_url: v.website || "",
      preferred_placement: v.placement || null, budget_range: v.budget || null, inquiry_message: v.message || null,
      campaign_goal: v.message ? v.message.slice(0, 300) : "Inquiry", status: "pending", payment_status: "unpaid",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }) }).catch(() => null);
    saved = Boolean(res?.ok);
  }
  const owner = process.env.REVIEWINTEL_OWNER_EMAIL || SUPPORT_EMAIL;
  const lines = [`Name: ${v.name}`, `Email: ${v.email}`, `Company: ${v.company}`, `Website: ${v.website || "-"}`, `Budget: ${v.budget || "-"}`, `Placement: ${v.placement || "-"}`, `Message: ${v.message || "-"}`, `Saved to DB: ${saved ? "yes" : "no"}`];
  await sendReviewIntelEmail({ emailType: "advertiser_inquiry_owner", to: owner, replyTo: v.email, subject: `New advertiser inquiry: ${v.company}`,
    text: lines.join("\n"), html: `<p>${lines.map(esc).join("<br>")}</p>`, metadata: { company: v.company } }).catch(() => null);
  const replyLinks = emailActionLinks(v.email, publicEmailSiteUrl(), emailLinkSecret());
  const reply = renderBrandedEmail({
    preheader: "We review every advertising inquiry by hand.",
    eyebrow: "Advertising",
    title: "Thanks for your interest",
    greetingName: v.name,
    paragraphs: [
      "Thanks for asking about advertising on ReviewIntel. We review every inquiry by hand and will reply within 2 business days.",
      "Please read the ad content policy before sending artwork.",
    ],
    cta: { label: "Read the ad policy", href: `${publicEmailSiteUrl()}/ad-policy` },
    reason: "You are receiving this because you asked about advertising on ReviewIntel.",
    preferencesUrl: replyLinks.preferencesUrl,
    unsubscribeUrl: replyLinks.unsubscribeUrl,
    postalAddress: process.env.REVIEWINTEL_POSTAL_ADDRESS || "",
  });
  await sendReviewIntelEmail({ emailType: "advertiser_inquiry_autoreply", to: v.email, subject: "Thanks for your interest in advertising on ReviewIntel",
    text: reply.text, html: reply.html, headers: unsubscribeHeaders(replyLinks.oneClickUrl) }).catch(() => null);
  return NextResponse.json({ ok: true, message: "Thanks! We'll reply within 2 business days." });
}
