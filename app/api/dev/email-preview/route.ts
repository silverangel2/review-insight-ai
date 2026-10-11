import { emailTemplates, previewEmail, type EmailTemplateName } from "@/lib/emailTemplates";

// Development-only: renders any email template as HTML (or ?format=text). 404 in production.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const name = url.searchParams.get("template") as EmailTemplateName;
  if (!name || !(name in emailTemplates)) return Response.json({ templates: Object.keys(emailTemplates) });
  const mail = previewEmail(name);
  return url.searchParams.get("format") === "text"
    ? new Response(`Subject: ${mail.subject}\n\n${mail.text}`, { headers: { "content-type": "text/plain; charset=utf-8" } })
    : new Response(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
