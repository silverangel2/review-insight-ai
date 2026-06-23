import { NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/supabaseServer";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  eventType?: string;
  userEmail?: string | null;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const SUSPICIOUS_INPUT_PATTERNS: Array<[RegExp, string]> = [
  [/<\s*script\b/i, "script tag"],
  [/<\?php/i, "php code"],
  [/\bpowershell\b|\bcertutil\b|\bregsvr32\b|\brundll32\b/i, "suspicious Windows command"],
  [/\b(?:curl|wget)\s+https?:\/\//i, "remote shell download command"],
  [/\beval\s*\(|\batob\s*\(|\bFunction\s*\(/i, "code execution pattern"],
  [/\b(?:DROP|ALTER|TRUNCATE)\s+TABLE\b/i, "destructive SQL pattern"],
  [/\bUNION\s+SELECT\b/i, "SQL injection pattern"],
  [/data:(?:application|text)\/(?:x-msdownload|x-sh|x-php|html)/i, "dangerous data URL"]
];

const globalForRateLimit = globalThis as unknown as {
  reviewIntelRateLimit?: Map<string, RateLimitBucket>;
};

const rateLimitStore =
  globalForRateLimit.reviewIntelRateLimit ??
  new Map<string, RateLimitBucket>();

globalForRateLimit.reviewIntelRateLimit = rateLimitStore;

export function getRequestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function getCloudflareSignals(request: Request) {
  return {
    cf_ray: request.headers.get("cf-ray"),
    cf_country: request.headers.get("cf-ipcountry"),
    cf_connecting_ip: request.headers.get("cf-connecting-ip"),
    user_agent: request.headers.get("user-agent"),
    forwarded_for: request.headers.get("x-forwarded-for")
  };
}

export function detectSuspiciousInput(value: unknown) {
  const text = String(value ?? "").slice(0, 250000);

  for (const [pattern, reason] of SUSPICIOUS_INPUT_PATTERNS) {
    if (pattern.test(text)) return reason;
  }

  return "";
}

export async function rejectSuspiciousInput(
  request: Request,
  value: unknown,
  context: string,
  userEmail?: string | null
) {
  const reason = detectSuspiciousInput(value);
  if (!reason) return null;

  await logSecurityEvent({
    event_type: "suspicious_input_blocked",
    severity: "high",
    request,
    user_email: userEmail ?? null,
    message: `Suspicious input blocked in ${context}: ${reason}.`,
    metadata: {
      context,
      reason
    }
  });

  return NextResponse.json(
    { error: "Upload blocked by ReviewIntel security checks. Please remove scripts, code, or executable content and try again." },
    { status: 400 }
  );
}

export async function logSecurityEvent(input: {
  event_type: string;
  severity?: SecuritySeverity;
  request?: Request;
  route?: string;
  user_email?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseInsert("security_events", {
      event_type: input.event_type,
      severity: input.severity ?? "low",
      ip_address: input.request ? getRequestIp(input.request) : null,
      route: input.route ?? (input.request ? new URL(input.request.url).pathname : null),
      user_email: input.user_email ?? null,
      message: input.message ?? null,
      metadata: {
        ...(input.request ? getCloudflareSignals(input.request) : {}),
        ...(input.metadata ?? {})
      },
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Security event logging failed:", error);
  }
}

export async function latestSecurityEvents(limit = 100) {
  return supabaseSelect(
    "security_events",
    `select=*&order=created_at.desc&limit=${limit}`
  );
}

export async function isIpBlocked(request: Request) {
  const ip = getRequestIp(request);

  if (!ip || ip === "local") return false;

  const rows = await supabaseSelect(
    "blocked_ips",
    `select=*&ip_address=eq.${encodeURIComponent(ip)}&active=eq.true&limit=1`
  );

  return rows.length > 0;
}

export async function blockIp(ipAddress: string, reason?: string, createdBy?: string | null) {
  if (!ipAddress || ipAddress === "local") return null;

  return supabaseInsert("blocked_ips", {
    ip_address: ipAddress,
    reason: reason ?? "Blocked from admin security center.",
    active: true,
    created_by: createdBy ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

export async function rateLimitRequest(request: Request, options: RateLimitOptions) {
  const ip = getRequestIp(request);
  const route = new URL(request.url).pathname;

  if (await isIpBlocked(request)) {
    await logSecurityEvent({
      event_type: "blocked_ip_request",
      severity: "high",
      request,
      route,
      user_email: options.userEmail ?? null,
      message: "Blocked IP attempted to access the app.",
      metadata: {
        limit_key: options.key
      }
    });

    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Access blocked." },
        { status: 403 }
      )
    };
  }

  const now = Date.now();
  const bucketKey = `${options.key}:${ip}:${route}`;
  const existing = rateLimitStore.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs
    });

    return { allowed: true, response: null };
  }

  existing.count += 1;
  rateLimitStore.set(bucketKey, existing);

  if (existing.count > options.limit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

    await supabaseInsert("rate_limit_events", {
      ip_address: ip,
      route,
      event_type: options.eventType ?? "rate_limit_block",
      limit_key: options.key,
      user_email: options.userEmail ?? null,
      message: `Rate limit exceeded. Limit ${options.limit} per ${options.windowMs}ms.`,
      metadata: {
        count: existing.count,
        limit: options.limit,
        retry_after_seconds: retryAfterSeconds,
        ...getCloudflareSignals(request)
      },
      created_at: new Date().toISOString()
    });

    await logSecurityEvent({
      event_type: options.eventType ?? "rate_limit_block",
      severity: existing.count > options.limit * 2 ? "high" : "medium",
      request,
      route,
      user_email: options.userEmail ?? null,
      message: "Rate limit exceeded.",
      metadata: {
        count: existing.count,
        limit: options.limit,
        retry_after_seconds: retryAfterSeconds
      }
    });

    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Too many requests. Please wait and try again.",
          retry_after_seconds: retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds)
          }
        }
      )
    };
  }

  return { allowed: true, response: null };
}
