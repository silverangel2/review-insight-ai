// Once-only lifecycle emails. They need the email_preferences table to remember they were sent;
// without it they are skipped (never repeated). Opt-out is respected by sendReviewIntelEmail.
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { emailTemplates } from "@/lib/emailTemplates";
import { readPreferenceRow, savePreferences } from "@/lib/emailPreferencesStore";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";

async function tableReady() {
  if (!isSupabaseConfigured()) return false;
  const res = await supabaseFetch("/rest/v1/email_preferences?select=email&limit=1", { method: "GET" }).catch(() => null);
  return Boolean(res?.ok);
}

export async function sendWelcomeOnce(email: string, name?: string) {
  if (!(await tableReady())) return { ok: false, skipped: "email_preferences table missing" };
  const row = await readPreferenceRow(email);
  if (row?.welcome_sent_at) return { ok: false, skipped: "already sent" };
  const mail = emailTemplates.welcome({ to: email, name });
  const sent = await sendReviewIntelEmail({ emailType: "welcome", category: mail.category, to: email, subject: mail.subject, html: mail.html, text: mail.text });
  if (sent.ok) await savePreferences(email, { welcome_sent_at: new Date().toISOString() });
  return sent;
}

/** After a FREE shopper's first saved scan only. */
export async function sendUpgradeAfterFirstScanOnce(email: string, plan: string, productName?: string) {
  if (plan !== "free_buyer") return { ok: false, skipped: "not free" };
  if (!(await tableReady())) return { ok: false, skipped: "email_preferences table missing" };
  const row = await readPreferenceRow(email);
  if (row?.upgrade_email_sent_at) return { ok: false, skipped: "already sent" };
  const countRes = await supabaseFetch(`/rest/v1/analyses?profile_email=eq.${encodeURIComponent(email)}&select=id`, { method: "GET", headers: { Prefer: "count=exact", Range: "0-0" } }).catch(() => null);
  const total = Number((countRes?.headers.get("content-range") || "").split("/")[1]);
  if (!Number.isFinite(total) || total !== 1) return { ok: false, skipped: "not the first scan" };
  const mail = emailTemplates.upgrade_after_first_scan({ to: email, productName });
  const sent = await sendReviewIntelEmail({ emailType: "upgrade_after_first_scan", category: mail.category, to: email, subject: mail.subject, html: mail.html, text: mail.text });
  // Mark as handled even when opted out, so it is never retried later.
  if (sent.ok || sent.skipped) await savePreferences(email, { upgrade_email_sent_at: new Date().toISOString() });
  return sent;
}
