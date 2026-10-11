import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { emailTemplates } from "@/lib/emailTemplates";
import { appOrigin } from "@/lib/emailPreferences";
import { supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";

const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "junel.abellana@gmail.com";

export async function createAdminNotification(input: {
  title: string;
  message: string;
  type?: string;
  severity?: "normal" | "info" | "warning" | "critical";
  action_url?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const severity = input.severity ?? "normal";
  const type = input.type ?? "system";
  const createdAt = new Date().toISOString();

  const notification = await supabaseInsert("admin_notifications", {
    title: input.title,
    message: input.message,
    type,
    severity,
    status: "unread",
    action_url: input.action_url ?? null,
    metadata: input.metadata ?? {},
    created_at: createdAt,
    updated_at: createdAt
  });

  // Private admin alert email.
  // Customer service/support stays support@getreviewintel.com.
  // Admin alerts go only to Junel's private email.
  try {
    await sendReviewIntelEmail({
      to: ADMIN_ALERT_EMAIL,
      emailType: "admin_notification",
      ...(() => { const t = emailTemplates.owner_notification({ title: String(input.title), message: String(input.message), link: input.action_url ? (String(input.action_url).startsWith("/") ? `${appOrigin()}${input.action_url}` : String(input.action_url)) : undefined }); return { subject: `[ReviewIntel Admin Alert] ${input.title}`, html: t.html, text: t.text }; })(),
    });
  } catch (error) {
    console.error("Admin notification saved, but admin alert email failed:", error);
  }

  return notification;
}

export async function createCustomerNotification(input: {
  profile_email: string;
  title: string;
  message: string;
  type?: string;
  severity?: "normal" | "info" | "warning" | "critical";
  action_url?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const email = input.profile_email.toLowerCase().trim();
  if (!email) return null;

  return supabaseInsert("customer_notifications", {
    profile_email: email,
    title: input.title,
    message: input.message,
    type: input.type ?? "system",
    severity: input.severity ?? "normal",
    status: "unread",
    action_url: input.action_url ?? null,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

export async function listAdminNotifications(limit = 100) {
  return supabaseSelect(
    "admin_notifications",
    `select=*&order=created_at.desc&limit=${limit}`
  );
}

export async function listCustomerNotifications(email: string, limit = 100) {
  return supabaseSelect(
    "customer_notifications",
    `select=*&profile_email=eq.${encodeURIComponent(email.toLowerCase().trim())}&order=created_at.desc&limit=${limit}`
  );
}

export async function markAdminNotification(id: string, status = "read") {
  return supabaseUpdate(
    "admin_notifications",
    `id=eq.${encodeURIComponent(id)}`,
    {
      status,
      updated_at: new Date().toISOString()
    }
  );
}

export async function markCustomerNotification(id: string, email: string, status = "read") {
  return supabaseUpdate(
    "customer_notifications",
    `id=eq.${encodeURIComponent(id)}&profile_email=eq.${encodeURIComponent(email.toLowerCase().trim())}`,
    {
      status,
      updated_at: new Date().toISOString()
    }
  );
}
