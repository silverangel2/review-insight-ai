import { escapeHtml, escapeHtmlAttribute } from "@/lib/emailHtml";

export const EMAIL_SUPPORT_ADDRESS = "support@getreviewintel.com";

export type BrandedEmailContent = {
  preheader: string;
  eyebrow: string;
  title: string;
  greetingName?: string | null;
  paragraphs: string[];
  bullets?: string[];
  cta?: { label: string; href: string } | null;
  reason: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
  supportEmail?: string;
  postalAddress?: string | null;
};

function paragraph(text: string) {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#172033;">${escapeHtml(text)}</p>`;
}

function bulletList(items: string[]) {
  if (!items.length) return "";
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:0 0 8px 0;font-size:15px;line-height:1.55;color:#172033;">• ${escapeHtml(item)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;">${rows}</table>`;
}

export function renderBrandedEmail(input: BrandedEmailContent) {
  const name = input.greetingName?.trim() || "there";
  const support = input.supportEmail?.trim() || EMAIL_SUPPORT_ADDRESS;
  const postal = input.postalAddress?.trim() || "";
  const preheader = escapeHtml(input.preheader);
  const title = escapeHtml(input.title);
  const eyebrow = escapeHtml(input.eyebrow);
  const reason = escapeHtml(input.reason);
  const safeName = escapeHtml(name);
  const preferencesUrl = escapeHtmlAttribute(input.preferencesUrl);
  const unsubscribeUrl = escapeHtmlAttribute(input.unsubscribeUrl);
  const supportHtml = escapeHtml(support);
  const cta = input.cta?.href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="border-radius:12px;background:#172033;"><a href="${escapeHtmlAttribute(input.cta.href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(input.cta.label)}</a></td></tr></table>`
    : "";
  const paragraphs = input.paragraphs.filter((line) => line.trim()).map(paragraph).join("");
  const bullets = bulletList((input.bullets || []).filter((line) => line.trim()));
  const postalHtml = postal
    ? `<br/>${escapeHtml(postal)}`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8e0eb;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:#172033;padding:22px 28px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.01em;color:#ffffff;">ReviewIntel</p>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#b7d4ff;">${eyebrow}</p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:#2356a3;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:700;color:#172033;">${title}</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#172033;">Hi ${safeName},</p>
              ${paragraphs}
              ${bullets}
              ${cta}
              <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#3d4a63;">${reason}</p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;">
                <a href="${preferencesUrl}" style="color:#2356a3;font-weight:700;">Email preferences</a>
                <span style="color:#3d4a63;"> · </span>
                <a href="${unsubscribeUrl}" style="color:#2356a3;font-weight:700;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="max-width:560px;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3d4a63;">
          ReviewIntel · <a href="mailto:${escapeHtmlAttribute(support)}" style="color:#2356a3;text-decoration:none;">${supportHtml}</a>${postalHtml}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.preheader,
    "",
    input.title,
    "",
    `Hi ${name},`,
    "",
    ...input.paragraphs.filter((line) => line.trim()),
    ...(input.bullets || []).filter((line) => line.trim()).map((line) => `- ${line}`),
    "",
    input.cta ? `${input.cta.label}: ${input.cta.href}` : "",
    "",
    input.reason,
    `Email preferences: ${input.preferencesUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
    "",
    `ReviewIntel · ${support}`,
    postal
  ].filter((line) => line !== "").join("\n");

  return { html, text };
}
