/**
 * Audit access: admin-gated long-lived sessions for allowlisted TEST accounts,
 * so automated audits never need account passwords. The allowlist comes from
 * REVIEWINTEL_AUDIT_ACCOUNTS (comma-separated emails). Nothing here touches
 * real customer access: the minting route requires a valid admin session and
 * refuses any email not on the list.
 */

export const AUDIT_ACCOUNTS_ENV = "REVIEWINTEL_AUDIT_ACCOUNTS";
export const AUDIT_SESSION_DAYS = 90;
export const AUDIT_SESSION_SECONDS = AUDIT_SESSION_DAYS * 24 * 60 * 60;

/** Parse the allowlist: comma-separated, case-insensitive, whitespace-tolerant. */
export function parseAuditAccounts(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const email = part.trim().toLowerCase();
    if (email && !seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

/** The allowlist currently configured on this machine. */
export function auditAccountAllowlist(): string[] {
  return parseAuditAccounts(process.env[AUDIT_ACCOUNTS_ENV]);
}

/** True only for emails on the configured allowlist. */
export function isAuditAccount(email: string | null | undefined): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return auditAccountAllowlist().includes(normalized);
}
