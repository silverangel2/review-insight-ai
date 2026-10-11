import { Resend } from "resend";
import type { EmailCategory } from "./emailTemplate";
import { unsubscribeHeaders, type OptionalCategory } from "./emailPreferences";

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
  /** Non-transactional mail respects preferences and gets List-Unsubscribe headers. */
  category?: EmailCategory;
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

export type EmailTransport = (msg: { from: string; to: string; replyTo: string; subject: string; html: string; text?: string; headers?: Record<string, string> }) => Promise<{ id?: string; error?: string; retryable?: boolean }>;

let transportOverride: EmailTransport | null = null;
let prefsOverride: ((email: string, category: OptionalCategory) => Promise<boolean>) | null = null;
/** Tests inject a mock transport / preference resolver; nothing real is sent. */
export function __setEmailTestHooks(hooks: { transport?: EmailTransport | null; prefs?: typeof prefsOverride }) {
  if ("transport" in hooks) transportOverride = hooks.transport ?? null;
  if ("prefs" in hooks) prefsOverride = hooks.prefs ?? null;
}

const resendTransport = (apiKey: string): EmailTransport => async (msg) => {
  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send(msg);
    if (result.error) {
      const name = String((result.error as { name?: string }).name || "");
      return { error: result.error.message || name || "Resend error", retryable: /rate_limit|internal|application_error/i.test(name) };
    }
    return { id: typeof result.data?.id === "string" ? result.data.id : undefined };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown email send error.", retryable: true };
  }
};

/** Per-recipient, per-type limiter (per instance): stops loops from mail-bombing anyone. */
const sendLog = new Map<string, number[]>();
export const EMAIL_RATE_LIMIT = { perHour: 6 };
export function emailRateLimited(to: string, emailType: string, now = Date.now()) {
  const key = `${to.toLowerCase()}|${emailType}`;
  const recent = (sendLog.get(key) || []).filter(t => now - t < 3600_000);
  if (recent.length >= EMAIL_RATE_LIMIT.perHour) { sendLog.set(key, recent); return true; }
  recent.push(now); sendLog.set(key, recent); return false;
}

/** Outside production, mail goes ONLY to REVIEWINTEL_EMAIL_DEV_SINK (or is skipped). */
export function resolveRecipient(to: string, env: Record<string, string | undefined> = process.env): { to: string | null; devRedirect: boolean } {
  if (env.NODE_ENV === "production" && env.REVIEWINTEL_EMAIL_FORCE_SINK !== "1") return { to, devRedirect: false };
  const sink = (env.REVIEWINTEL_EMAIL_DEV_SINK || "").trim();
  return sink ? { to: sink, devRedirect: true } : { to: null, devRedirect: true };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type SendEmailResult = { ok: boolean; skipped?: boolean; error?: string; provider?: string; providerMessageId?: string; attempts?: number; logStorageReady: boolean };

export async function sendReviewIntelEmail(input: SendReviewIntelEmailInput): Promise<SendEmailResult> {
  const category: EmailCategory = input.category || "transactional";
  const fail = async (status: "failed" | "skipped", error: string) => {
    await logEmailAttempt({ emailType: input.emailType, status, recipient: input.to, sender: EMAIL_FROM, subject: input.subject, error, metadata: { ...input.metadata, category } });
    return { ok: false, skipped: status === "skipped", error, logStorageReady: hasEmailLogStorage() };
  };
  if (!input.to || !/@/.test(input.to)) return fail("failed", "Invalid recipient.");

  if (category !== "transactional") {
    let allowed = true;
    try {
      allowed = prefsOverride ? await prefsOverride(input.to, category) : await (await import("./emailPreferencesStore")).categoryAllowed(input.to, category);
    } catch { allowed = true; }
    if (!allowed) return fail("skipped", `Recipient opted out of ${category} email.`);
  }
  if (emailRateLimited(input.to, input.emailType)) return fail("skipped", "Rate limited (per-recipient hourly cap).");

  const target = resolveRecipient(input.to);
  if (!target.to) return fail("skipped", "Not production and REVIEWINTEL_EMAIL_DEV_SINK is not set; email not sent.");

  const resendApiKey = process.env.RESEND_API_KEY;
  const transport = transportOverride || (resendApiKey ? resendTransport(resendApiKey) : null);
  if (!transport) return fail("failed", "RESEND_API_KEY is missing.");

  const headers = { ...unsubscribeHeaders(input.to, category), ...(input.headers || {}) };
  const msg = {
    from: EMAIL_FROM, to: target.to, replyTo: input.replyTo || SUPPORT_EMAIL,
    subject: target.devRedirect ? `[dev → ${input.to}] ${input.subject}` : input.subject,
    html: input.html, text: input.text, headers,
  };

  let last: { id?: string; error?: string; retryable?: boolean } = {};
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    last = await transport(msg);
    if (!last.error) {
      await logEmailAttempt({ emailType: input.emailType, status: "sent", recipient: input.to, sender: EMAIL_FROM, subject: input.subject, providerMessageId: last.id, metadata: { ...input.metadata, category, attempts: attempt, devRedirect: target.devRedirect } });
      return { ok: true, provider: "resend", providerMessageId: last.id, attempts: attempt, logStorageReady: hasEmailLogStorage() };
    }
    if (!last.retryable || attempt === 3) break;
    await sleep(transportOverride ? 1 : 400 * 2 ** (attempt - 1));
  }
  return fail("failed", last.error || "Email send failed.");
}
