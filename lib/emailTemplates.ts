// Every ReviewIntel email template, rendered through the one branded layout.
// Used by senders AND by the dev preview route, so previews always match what's sent.
import { renderBrandedEmail, type EmailCategory } from "./emailTemplate";
import { appOrigin, preferencesUrl, unsubscribeUrl, type OptionalCategory } from "./emailPreferences";
import { pricingLabelForPlan } from "./pricing";
import { FREE_DAILY_REVIEW_LIMIT } from "./account";

export type RenderedEmail = { subject: string; html: string; text: string; category: EmailCategory };
const opt = (to: string, c: OptionalCategory) => ({ unsubscribeUrl: unsubscribeUrl(to, c), preferencesUrl: preferencesUrl(to) });

export const emailTemplates = {
  welcome(p: { to: string; name?: string }): RenderedEmail {
    const o = appOrigin();
    const r = renderBrandedEmail({
      category: "tips", ...opt(p.to, "tips"),
      preheader: "Paste any product link and get a plain answer in seconds.",
      heading: `Welcome${p.name ? `, ${p.name}` : ""}! Let's check your first product.`,
      paragraphs: [
        "ReviewIntel reads real written buyer reviews and tells you plainly: Buy, Wait or Skip.",
        "First-scan tip: copy the link of a product you're thinking about, straight from the store page, and paste it in. Exact product pages give the clearest answer.",
        `You get ${FREE_DAILY_REVIEW_LIMIT} free scans every day.`,
      ],
      cta: { label: "Scan your first product", url: `${o}/analyze` },
      note: "We never invent reviews. If there aren't enough real ones, we'll say so.",
    });
    return { subject: "Welcome to ReviewIntel: your first scan tip", category: "tips", ...r };
  },
  upgrade_after_first_scan(p: { to: string; productName?: string }): RenderedEmail {
    const o = appOrigin();
    const r = renderBrandedEmail({
      category: "upgrade", ...opt(p.to, "upgrade"),
      preheader: "Your first scan is done. Here's what Premium adds.",
      heading: "Nice first scan!",
      paragraphs: [
        p.productName ? `You checked ${p.productName}. Your verdict stays free, always.` : "Your verdict stays free, always.",
        `If you shop often, Premium (${pricingLabelForPlan("buyer_pro", "CAD")}/month) adds unlimited scans, your saved history, an avoid list and side-by-side compare.`,
      ],
      cta: { label: "See Premium", url: `${o}/pricing?plan=buyer_pro` },
      note: "This is the only upgrade email we send after a first scan. Cancel anytime.",
    });
    return { subject: "Your first ReviewIntel scan is done", category: "upgrade", ...r };
  },
  watch_alert(p: { to: string; productName: string; why: string; resultUrl: string; unwatchUrl: string }): RenderedEmail {
    const r = renderBrandedEmail({
      category: "watch_alerts", ...opt(p.to, "watch_alerts"),
      preheader: p.why, heading: `Update on ${p.productName}`, paragraphs: [p.why],
      cta: { label: "See the full result", url: p.resultUrl }, secondary: { label: "Stop watching this product", url: p.unwatchUrl },
    });
    return { subject: `Update on ${p.productName}`, category: "watch_alerts", ...r };
  },
  advertiser_inquiry_owner(p: { lines: string[]; company: string }): RenderedEmail {
    const r = renderBrandedEmail({ category: "transactional", preheader: `New inquiry from ${p.company}`, heading: "New advertiser inquiry", paragraphs: p.lines, note: "Reply to this email to answer the advertiser directly." });
    return { subject: `New advertiser inquiry: ${p.company}`, category: "transactional", ...r };
  },
  advertiser_autoreply(p: { name: string }): RenderedEmail {
    const o = appOrigin();
    const r = renderBrandedEmail({ category: "transactional", preheader: "We'll reply within 2 business days.", heading: `Thanks, ${p.name}!`,
      paragraphs: ["Thanks for reaching out about advertising on ReviewIntel. We review every inquiry by hand and will reply within 2 business days."],
      secondary: { label: "Read our ad content policy", url: `${o}/ad-policy` } });
    return { subject: "Thanks for your interest in advertising on ReviewIntel", category: "transactional", ...r };
  },
  advertiser_payment_link(p: { when: string; payUrl: string; reportUrl: string }): RenderedEmail {
    const r = renderBrandedEmail({ category: "transactional", preheader: "Your campaign is approved.", heading: "Your campaign is approved",
      paragraphs: [`Your campaign is approved${p.when}. Pay securely to schedule it. It starts automatically on the start date once payment is received.`],
      cta: { label: "Pay to schedule your campaign", url: p.payUrl }, secondary: { label: "Your private campaign report", url: p.reportUrl } });
    return { subject: "Your ReviewIntel campaign is approved", category: "transactional", ...r };
  },
  owner_notification(p: { title: string; message: string; link?: string }): RenderedEmail {
    const r = renderBrandedEmail({ category: "transactional", preheader: p.title, heading: p.title, paragraphs: [p.message], cta: p.link ? { label: "Open in admin", url: p.link } : undefined });
    return { subject: `ReviewIntel admin: ${p.title}`, category: "transactional", ...r };
  },
} as const;

export type EmailTemplateName = keyof typeof emailTemplates;

/** Sample data for the dev preview (illustrative; no real people or brands). */
export function previewEmail(name: EmailTemplateName): RenderedEmail {
  const to = "preview@example.com";
  const o = appOrigin();
  switch (name) {
    case "welcome": return emailTemplates.welcome({ to, name: "Sam" });
    case "upgrade_after_first_scan": return emailTemplates.upgrade_after_first_scan({ to, productName: "Example smart ring" });
    case "watch_alert": return emailTemplates.watch_alert({ to, productName: "Example smart ring", why: "The verdict changed from Wait to Buy.", resultUrl: `${o}/results`, unwatchUrl: `${o}/api/product-watches?token=example` });
    case "advertiser_inquiry_owner": return emailTemplates.advertiser_inquiry_owner({ company: "Example Co", lines: ["Name: Sam", "Email: sam@example.com", "Company: Example Co", "Budget: Not sure yet"] });
    case "advertiser_autoreply": return emailTemplates.advertiser_autoreply({ name: "Sam" });
    case "advertiser_payment_link": return emailTemplates.advertiser_payment_link({ when: " from 2026-11-01 to 2026-11-30", payUrl: `${o}/api/advertising/checkout?t=example`, reportUrl: `${o}/advertise/report/example` });
    case "owner_notification": return emailTemplates.owner_notification({ title: "New contact message", message: "Someone sent a message through the contact form.", link: `${o}/admin/notifications` });
  }
}
