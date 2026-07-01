import { supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";

export async function createAdminNotification(input: {
  title: string;
  message: string;
  type?: string;
  severity?: "normal" | "info" | "warning" | "critical";
  action_url?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return supabaseInsert("admin_notifications", {
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
