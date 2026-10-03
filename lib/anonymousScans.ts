import crypto from "crypto";
import {
  hasSupabaseServiceEnv,
  supabaseSelect,
  supabaseUpsert,
} from "@/lib/supabaseServer";

/**
 * Anonymous shopper scan allowance: 3 free scans without signing in.
 *
 * Honest layering — read this before "improving" it:
 * - The localStorage counter (`ri_anon_scans`, client-side) is UX sugar only.
 *   It is trivially bypassable and is NEVER trusted for enforcement.
 * - The real gate is the IP-hash count below, enforced server-side in
 *   app/api/analyze/route.ts. Raw IPs are never stored — only an
 *   HMAC-SHA256 hash (same pattern as traffic analytics visitor keys).
 * - When Supabase is unavailable, a per-instance in-memory Map is the
 *   best-effort fallback. Supabase is the source of truth.
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
const memoryCounts = new Map<string, number>();

type AnonScanRow = {
  ip_hash: string;
  scan_count: number;
};

export async function getAnonymousScanCount(request: Request): Promise<number> {
  const ipHash = hashAnonymousIp(clientIp(request));

  if (hasSupabaseServiceEnv()) {
    try {
      const rows = await supabaseSelect<AnonScanRow>(
        "anonymous_scan_usage",
        `select=scan_count&ip_hash=eq.${encodeURIComponent(ipHash)}&limit=1`
      );
      if (rows.length > 0) {
        const count = Number(rows[0].scan_count) || 0;
        memoryCounts.set(ipHash, count);
        return count;
      }
    } catch {
      // Fall through to the in-memory fallback below.
    }
  }

  return memoryCounts.get(ipHash) ?? 0;
}

export async function incrementAnonymousScanCount(request: Request): Promise<number> {
  const ipHash = hashAnonymousIp(clientIp(request));
  const next = (await getAnonymousScanCount(request)) + 1;

  memoryCounts.set(ipHash, next);

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
