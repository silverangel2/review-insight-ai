// One branded, responsive email layout (table-based, inline styles, dark-mode safe colours)
// plus a matching plain-text version. Every ReviewIntel email goes through this.
export type EmailCategory = "transactional" | "tips" | "upgrade" | "watch_alerts" | "marketing";
export type BrandedEmailInput = {
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string };
  note?: string;
  category: EmailCategory;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
};

const TEAL = "#0b7c78";
export const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function renderBrandedEmail(i: BrandedEmailInput): { html: string; text: string } {
  const optional = i.category !== "transactional";
  const footerLinks = [
    i.preferencesUrl ? `<a href="${esc(i.preferencesUrl)}" style="color:#475569">Email preferences</a>` : "",
    optional && i.unsubscribeUrl ? `<a href="${esc(i.unsubscribeUrl)}" style="color:#475569">Unsubscribe</a>` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(i.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f7f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(i.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<tr><td style="background:linear-gradient(135deg,#e6f7f1,#fff6d6);background-color:#e6f7f1;padding:20px 28px;"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:${TEAL};color:#fff;font-weight:700;font-size:13px;line-height:28px;text-align:center;">RI</span> <span style="font-weight:700;font-size:16px;color:#0f172a;vertical-align:middle;">&nbsp;ReviewIntel</span></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:650;color:#0f172a;">${esc(i.heading)}</h1>
${i.paragraphs.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${esc(p)}</p>`).join("\n")}
${i.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr><td style="border-radius:999px;background:${TEAL};"><a href="${esc(i.cta.url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(i.cta.label)}</a></td></tr></table>` : ""}
${i.secondary ? `<p style="margin:8px 0 0;font-size:14px;"><a href="${esc(i.secondary.url)}" style="color:${TEAL};">${esc(i.secondary.label)}</a></p>` : ""}
${i.note ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${esc(i.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;font-size:12px;line-height:1.6;color:#64748b;">ReviewIntel · Real buyer reviews, read for you.<br>Questions? Just reply to this email.${footerLinks ? `<br>${footerLinks}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    i.heading, "", ...i.paragraphs.flatMap(p => [p, ""]),
    i.cta ? `${i.cta.label}: ${i.cta.url}\n` : "",
    i.secondary ? `${i.secondary.label}: ${i.secondary.url}\n` : "",
    i.note ? `${i.note}\n` : "",
    "--", "ReviewIntel · Real buyer reviews, read for you. Reply to this email with any questions.",
    i.preferencesUrl ? `Email preferences: ${i.preferencesUrl}` : "",
    optional && i.unsubscribeUrl ? `Unsubscribe: ${i.unsubscribeUrl}` : "",
  ].filter(l => l !== "").join("\n");
  return { html, text };
}
