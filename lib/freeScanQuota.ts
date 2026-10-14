import crypto from "crypto";
import { isSupabaseConfigured, supabaseRpc } from "@/lib/supabaseServer";

export const FREE_SCAN_LIMIT = 3;

export type FreeScanIdentityKind = "anonymous" | "authenticated";

export type FreeScanClaim = {
  allowed: boolean;
  code: "claimed" | "idempotent" | "released" | "limit_reached" | "unavailable";
  used: number;
  remaining: number;
  resetAt: string | null;
};

type ClaimInput = {
  kind: FreeScanIdentityKind;
  identity: string;
  scanId: string;
  now?: Date;
};

type LocalClaim = {
  identityKey: string;
  day: string;
  scanId: string;
};

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resetAtForDay(day: string) {
  return `${day}T23:59:59.999Z`;
}

function quotaSecret() {
  return process.env.TRAFFIC_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function hashFreeScanIdentity(kind: FreeScanIdentityKind, identity: string) {
  const normalizedIdentity = identity.trim().toLowerCase();

  // Authenticated quota is already keyed by the server-resolved account email
  // in the existing usage_events schema. Keep that durable identity stable so
  // the migration can preserve today's claims. Anonymous identity retains the
  // existing HMAC IP-hash representation.
  if (kind === "authenticated") return normalizedIdentity;

  const secret = quotaSecret();
  if (!secret) return "";

  return crypto
    .createHmac("sha256", secret)
    .update(`anon-scan:${normalizedIdentity}`)
    .digest("hex");
}

export class InMemoryFreeScanClaims {
  private claims: LocalClaim[] = [];

  claim(input: ClaimInput): FreeScanClaim {
    const now = input.now || new Date();
    const day = utcDay(now);
    const identityKey = hashFreeScanIdentity(input.kind, input.identity) || input.identity;
    const sameDay = this.claims.filter((claim) => claim.identityKey === identityKey && claim.day === day);
    const existing = sameDay.find((claim) => claim.scanId === input.scanId);

    if (existing) {
      return {
        allowed: true,
        code: "idempotent",
        used: sameDay.length,
        remaining: Math.max(0, FREE_SCAN_LIMIT - sameDay.length),
        resetAt: resetAtForDay(day),
      };
    }

    if (sameDay.length >= FREE_SCAN_LIMIT) {
      return {
        allowed: false,
        code: "limit_reached",
        used: sameDay.length,
        remaining: 0,
        resetAt: resetAtForDay(day),
      };
    }

    this.claims.push({ identityKey, day, scanId: input.scanId });
    return {
      allowed: true,
      code: "claimed",
      used: sameDay.length + 1,
      remaining: Math.max(0, FREE_SCAN_LIMIT - sameDay.length - 1),
      resetAt: resetAtForDay(day),
    };
  }

  /** Drop one scan's claim. A second call, or an unknown scan, leaves the count unchanged. */
  release(input: ClaimInput): FreeScanClaim {
    const now = input.now || new Date();
    const day = utcDay(now);
    const identityKey = hashFreeScanIdentity(input.kind, input.identity) || input.identity;
    const index = this.claims.findIndex((claim) => claim.identityKey === identityKey && claim.scanId === input.scanId);
    const removed = index >= 0;
    if (removed) this.claims.splice(index, 1);
    const sameDay = this.claims.filter((claim) => claim.identityKey === identityKey && claim.day === day);
    return {
      allowed: true,
      code: removed ? "released" : "idempotent",
      used: sameDay.length,
      remaining: Math.max(0, FREE_SCAN_LIMIT - sameDay.length),
      resetAt: resetAtForDay(day),
    };
  }

  clear() {
    this.claims = [];
  }
}

const localDevelopmentClaims = new InMemoryFreeScanClaims();

function unavailableClaim(): FreeScanClaim {
  return {
    allowed: false,
    code: "unavailable",
    used: 0,
    remaining: 0,
    resetAt: null,
  };
}

export function resetLocalFreeScanClaimsForTests() {
  localDevelopmentClaims.clear();
}

function localQuotaTestMode() {
  return process.env.NODE_ENV !== "production" && process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE === "true";
}

export async function claimFreeScan(input: ClaimInput): Promise<FreeScanClaim> {
  const localTestMode = localQuotaTestMode();
  const identityKey =
    hashFreeScanIdentity(input.kind, input.identity) ||
    (localTestMode ? `local:${input.kind}:${input.identity.trim().toLowerCase()}` : "");
  if (!identityKey || !input.scanId) return unavailableClaim();

  // The test flag is an offline stand-in. It must not call Supabase.
  if (localTestMode) {
    return localDevelopmentClaims.claim(input);
  }

  if (isSupabaseConfigured()) {
    const result = await supabaseRpc<FreeScanClaim>("claim_reviewintel_free_scan", {
      p_identity_kind: input.kind,
      p_identity_key: identityKey,
      p_scan_id: input.scanId,
      p_claimed_at: (input.now || new Date()).toISOString(),
    });

    if (!result) return unavailableClaim();
    return {
      allowed: Boolean(result.allowed),
      code: result.code || "unavailable",
      used: Number(result.used || 0),
      remaining: Number(result.remaining || 0),
      resetAt: result.resetAt || null,
    };
  }

  return unavailableClaim();
}

function nothingStoredRelease(now = new Date()): FreeScanClaim {
  const day = utcDay(now);
  return {
    allowed: true,
    code: "idempotent",
    used: 0,
    remaining: FREE_SCAN_LIMIT,
    resetAt: resetAtForDay(day),
  };
}

/** Give one scan's free claim back. Safe to call again for the same scan id. */
export async function releaseFreeScan(input: ClaimInput): Promise<FreeScanClaim> {
  const localTestMode = localQuotaTestMode();
  const identityKey =
    hashFreeScanIdentity(input.kind, input.identity) ||
    (localTestMode ? `local:${input.kind}:${input.identity.trim().toLowerCase()}` : "");
  if (!identityKey || !input.scanId) return nothingStoredRelease(input.now);

  if (localTestMode) {
    return localDevelopmentClaims.release(input);
  }

  if (isSupabaseConfigured()) {
    // The release function may not be migrated yet. A missing function must not
    // log or fail the scan; the claim simply stays where it is.
    const result = await supabaseRpc<FreeScanClaim>("release_reviewintel_free_scan", {
      p_identity_kind: input.kind,
      p_identity_key: identityKey,
      p_scan_id: input.scanId,
      p_released_at: (input.now || new Date()).toISOString(),
    }, { quiet: true }).catch(() => null);
    if (!result) return unavailableClaim();
    return {
      allowed: result.allowed !== false,
      code: result.code === "released" ? "released" : result.code === "idempotent" ? "idempotent" : "unavailable",
      used: Number(result.used || 0),
      remaining: Number(result.remaining || 0),
      resetAt: result.resetAt || null,
    };
  }

  return nothingStoredRelease(input.now);
}
