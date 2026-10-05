import crypto from "crypto";
import {
  hasSupabaseServiceEnv,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabaseServer";

/**
 * Anonymous shopper scan allowance: 3 free scans per day without signing in.
 *
 * Honest layering — read this before "improving" it:
 * - The localStorage counter (`ri_anon_scans`, client-side) is UX sugar only.
 *   It is trivially bypassable and is NEVER trusted for enforcement.
 * - The real gate is the IP-hash count below, enforced server-side in
 *   app/api/analyze/route.ts. Raw IPs are never stored — only an
 *   HMAC-SHA256 hash (same pattern as traffic analytics visitor keys).
 * - The allowance resets every UTC calendar day. The window is derived from
 *   `last_scan_at`, so no schema change is needed for the daily reset.
 * - This legacy counter is no longer an entitlement source. The analyze route
 *   uses the atomic claim RPC in lib/freeScanQuota.ts and fails closed when it
 *   cannot reach durable quota state.
 */

export const ANON_SCAN_LIMIT = 3;
export const ANON_SCAN_STORAGE_KEY = "ri_anon_scans";

function clientIp(request: Request): string {
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

export function hashAnonymousIp(ip: string): string {
  const salt =
    process.env.TRAFFIC_HASH_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "reviewintel-traffic";
  return crypto.createHmac("sha256", salt).update(`anon-scan:${ip}`).digest("hex");
}

// Best-effort per-instance fallback when Supabase is not configured.
const memoryCounts = new Map<string, { day: string; count: number }>();

type AnonScanRow = {
  ip_hash: string;
  scan_count: number;
  last_scan_at: string | null;
};

/** UTC calendar day, YYYY-MM-DD. The allowance window resets at midnight UTC. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAnonymousScanCount(request: Request): Promise<number> {
  const ipHash = hashAnonymousIp(clientIp(request));
  const today = todayKey();

  if (!hasSupabaseServiceEnv()) return ANON_SCAN_LIMIT;

  try {
    const rows = await supabaseSelect<AnonScanRow>(
      "anonymous_scan_usage",
      `select=scan_count,last_scan_at&ip_hash=eq.${encodeURIComponent(ipHash)}&limit=1`
    );
    if (rows.length > 0) {
      const rowDay = String(rows[0].last_scan_at || "").slice(0, 10);
      // A row from a previous day means today's count starts at zero.
      const count = rowDay === today ? Number(rows[0].scan_count) || 0 : 0;
      memoryCounts.set(ipHash, { day: today, count });
      return count;
    }
  } catch {
    return ANON_SCAN_LIMIT;
  }

  return 0;
}

export async function incrementAnonymousScanCount(request: Request): Promise<number> {
  const ipHash = hashAnonymousIp(clientIp(request));
  const today = todayKey();
  const next = (await getAnonymousScanCount(request)) + 1;

  memoryCounts.set(ipHash, { day: today, count: next });

  if (hasSupabaseServiceEnv()) {
    try {
      await supabaseUpsert(
        "anonymous_scan_usage",
        {
          ip_hash: ipHash,
          scan_count: next,
          last_scan_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        "ip_hash"
      );
    } catch {
      // In-memory fallback already updated; Supabase stays best-effort.
    }
  }

  return next;
}

export async function anonymousScansRemaining(request: Request): Promise<number> {
  const used = await getAnonymousScanCount(request);
  return Math.max(0, ANON_SCAN_LIMIT - used);
}
