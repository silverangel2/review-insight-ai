import { notFound } from "next/navigation";
import { emailTemplates, previewEmail, type EmailTemplateName } from "@/lib/emailTemplates";

// Development-only gallery of every email template (HTML + plain text). 404 in production.
export default function EmailPreviewIndex() {
  if (process.env.NODE_ENV === "production") notFound();
  const names = Object.keys(emailTemplates) as EmailTemplateName[];
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Email templates (dev preview)</h1>
      <div className="mt-6 grid gap-8">
        {names.map(n => {
          const m = previewEmail(n);
          return (
            <section key={n} id={n} data-testid={`email-${n}`} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <p className="text-sm font-semibold text-slate-900">{n} <span className="font-normal text-slate-500">· {m.category} · &ldquo;{m.subject}&rdquo;</span></p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[600px_1fr]">
                <iframe title={`${n} HTML`} srcDoc={m.html} className="h-[620px] w-full rounded-xl border border-slate-200" />
                <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{m.text}</pre>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
