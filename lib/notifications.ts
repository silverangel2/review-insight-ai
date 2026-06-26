import { sendReviewIntelEmail } from "@/lib/emailDelivery";
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
      subject: `[ReviewIntel Admin Alert] ${input.title}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:28px;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;">
              ReviewIntel Admin Notification
            </p>
            <h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;color:#0f172a;">
              ${input.title}
            </h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">
              ${input.message}
            </p>
            <div style="background:#f1f5f9;border-radius:18px;padding:16px;font-size:13px;line-height:1.6;color:#334155;">
              <strong>Type:</strong> ${type}<br/>
              <strong>Severity:</strong> ${severity}<br/>
              <strong>Created:</strong> ${createdAt}
            </div>
            ${
              input.action_url
                ? `<a href="${input.action_url}" style="display:inline-block;margin-top:18px;background:#07111f;color:#ffffff;text-decoration:none;font-weight:900;border-radius:14px;padding:12px 18px;">Open in ReviewIntel</a>`
                : ""
            }
          </div>
        </div>
      `,
      text: [
        "ReviewIntel Admin Notification",
        "",
        input.title,
        "",
        input.message,
        "",
        `Type: ${type}`,
        `Severity: ${severity}`,
        `Created: ${createdAt}`,
        input.action_url ? `Open: ${input.action_url}` : ""
      ].filter(Boolean).join("\n"),
      metadata: {
        source: "admin_notification",
        type,
        severity,
        action_url: input.action_url ?? null
      }
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
