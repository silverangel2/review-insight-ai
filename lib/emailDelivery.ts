import { Resend } from "resend";

export const SUPPORT_EMAIL = "support@getreviewintel.com";
export const EMAIL_FROM = "ReviewIntel <support@getreviewintel.com>";
const EMAIL_LOGS_TABLE = "admin_email_logs";

type EmailLogStatus = "sent" | "failed" | "skipped";

type EmailLogInput = {
  emailType: string;
  status: EmailLogStatus;
  recipient?: string;
  sender?: string;
  subject?: string;
  providerMessageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

type SendReviewIntelEmailInput = {
  emailType: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

export function hasEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function hasEmailLogStorage() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

function supabaseHeaders() {
  const key = supabaseServiceKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export async function logEmailAttempt(input: EmailLogInput) {
  if (!hasEmailLogStorage()) {
    return {
      ok: false,
      source: "none" as const,
      error: "Supabase service role env is missing. Email log was not persisted.",
    };
  }

  const payload = {
    email_type: input.emailType,
    provider: "resend",
    status: input.status,
    recipient: input.recipient || null,
    sender: input.sender || EMAIL_FROM,
    subject: input.subject || null,
    provider_message_id: input.providerMessageId || null,
    error: input.error || null,
    metadata: input.metadata || {},
  };

  const response = await fetch(`${supabaseUrl()}/rest/v1/${EMAIL_LOGS_TABLE}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return {
      ok: false,
      source: "supabase" as const,
      error: `Email log save failed: ${response.status} ${message}`,
    };
  }

  return {
    ok: true,
    source: "supabase" as const,
  };
}

export async function sendReviewIntelEmail(input: SendReviewIntelEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    await logEmailAttempt({
      emailType: input.emailType,
      status: "failed",
      recipient: input.to,
      sender: EMAIL_FROM,
      subject: input.subject,
      error: "RESEND_API_KEY is missing.",
      metadata: input.metadata,
    });

    return {
      ok: false,
      error: "RESEND_API_KEY is missing.",
      logStorageReady: hasEmailLogStorage(),
    };
  }

  const resend = new Resend(resendApiKey);

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      replyTo: input.replyTo || SUPPORT_EMAIL,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
    });

    const providerMessageId =
      typeof result.data?.id === "string" ? result.data.id : undefined;

    await logEmailAttempt({
      emailType: input.emailType,
      status: "sent",
      recipient: input.to,
      sender: EMAIL_FROM,
      subject: input.subject,
      providerMessageId,
      metadata: input.metadata,
    });

    return {
      ok: true,
      provider: "resend",
      providerMessageId,
      logStorageReady: hasEmailLogStorage(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email send error.";

    await logEmailAttempt({
      emailType: input.emailType,
      status: "failed",
      recipient: input.to,
      sender: EMAIL_FROM,
      subject: input.subject,
      error: message,
      metadata: input.metadata,
    });

    return {
      ok: false,
      error: message,
      logStorageReady: hasEmailLogStorage(),
    };
  }
}
