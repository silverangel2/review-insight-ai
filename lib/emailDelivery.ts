import { Resend } from "resend";

export const SUPPORT_EMAIL = "support@getreviewintel.com";
export const EMAIL_FROM = "ReviewIntel <support@getreviewintel.com>";
const EMAIL_LOGS_TABLE = "admin_email_logs";

export const EMAIL_MAX_ATTEMPTS = 3;
export const EMAIL_RETRY_DELAYS_MS = [500, 1500];

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

export type EmailSendPayload = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

export type EmailTransportResult = {
  id?: string | null;
  error?: { message?: string; statusCode?: number | null } | null;
};

export type EmailTransport = (payload: EmailSendPayload) => Promise<EmailTransportResult>;

type SendOptions = {
  transport?: EmailTransport;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
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

export function isRetryableEmailFailure(status: number | null, message: string) {
  if (status === 408 || status === 429 || (status !== null && status >= 500)) return true;
  if (status !== null && status >= 400 && status < 500) return false;
  return /timeout|timed out|network|econnreset|econnrefused|etimedout|fetch failed|socket|temporarily|rate limit/i.test(message);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resendTransport(payload: EmailSendPayload): Promise<EmailTransportResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { error: { message: "RESEND_API_KEY is missing.", statusCode: null } };
  }

  const resend = new Resend(resendApiKey);
  const result = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    headers: payload.headers,
  });

  if (result.error) {
    return {
      error: {
        message: result.error.message || "Email provider error.",
        statusCode: result.error.statusCode ?? null,
      },
    };
  }

  return { id: result.data?.id ?? null };
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

export async function sendReviewIntelEmail(input: SendReviewIntelEmailInput, options: SendOptions = {}) {
  if (process.env.REVIEWINTEL_BLOCK_OUTBOUND_EMAIL === "1" && !options.transport) {
    return {
      ok: false,
      blocked: true,
      attempts: 0,
      error: "Outbound email is blocked.",
      logStorageReady: false,
    };
  }

  const transport = options.transport ?? resendTransport;
  const pause = options.sleep ?? wait;
  const maxAttempts = Math.max(1, options.maxAttempts ?? EMAIL_MAX_ATTEMPTS);
  let lastError = "Unknown email send error.";
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      const result = await transport({
        from: EMAIL_FROM,
        to: input.to,
        replyTo: input.replyTo || SUPPORT_EMAIL,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
      });

      if (!result.error) {
        const providerMessageId = typeof result.id === "string" ? result.id : undefined;
        await logEmailAttempt({
          emailType: input.emailType,
          status: "sent",
          recipient: input.to,
          sender: EMAIL_FROM,
          subject: input.subject,
          providerMessageId,
          metadata: { ...(input.metadata || {}), attempts },
        });
        return {
          ok: true,
          provider: "resend",
          providerMessageId,
          attempts,
          logStorageReady: hasEmailLogStorage(),
        };
      }

      lastError = result.error.message || "Email provider error.";
      const status = result.error.statusCode ?? null;
      if (!isRetryableEmailFailure(status, lastError) || attempt === maxAttempts) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown email send error.";
      if (!isRetryableEmailFailure(null, lastError) || attempt === maxAttempts) break;
    }

    await pause(EMAIL_RETRY_DELAYS_MS[attempt - 1] ?? EMAIL_RETRY_DELAYS_MS[EMAIL_RETRY_DELAYS_MS.length - 1]);
  }

  await logEmailAttempt({
    emailType: input.emailType,
    status: "failed",
    recipient: input.to,
    sender: EMAIL_FROM,
    subject: input.subject,
    error: lastError,
    metadata: { ...(input.metadata || {}), attempts },
  });

  return {
    ok: false,
    attempts,
    error: lastError,
    logStorageReady: hasEmailLogStorage(),
  };
}
