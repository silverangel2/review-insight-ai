import { getClientAccount } from "@/lib/clientAccount";

const SELLER_SCAN_AUDIT_PREFIX = "reviewintel_seller_scan_audit";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeAccountKey(value: unknown) {
  return String(value || "guest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "guest";
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function auditKey(account: unknown = getClientAccount(), date = new Date()) {
  return `${SELLER_SCAN_AUDIT_PREFIX}:${safeAccountKey(account)}:${monthKey(date)}`;
}

export function incrementSellerScanAudit(account: unknown = getClientAccount(), date = new Date()) {
  if (!canUseStorage()) return 0;

  try {
    const key = auditKey(account, date);
    const current = Number(window.localStorage.getItem(key) || "0");
    const next = Number.isFinite(current) ? current + 1 : 1;

    window.localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function readSellerScanAuditCount(
  fallbackCount = 0,
  account: unknown = getClientAccount(),
  date = new Date()
) {
  if (!canUseStorage()) return fallbackCount;

  try {
    const key = auditKey(account, date);
    const raw = window.localStorage.getItem(key);

    if (raw === null) {
      const normalizedFallback = Math.max(0, fallbackCount);
      if (normalizedFallback > 0) {
        window.localStorage.setItem(key, String(normalizedFallback));
      }
      return normalizedFallback;
    }

    const stored = Number(raw);
    const normalizedStored = Number.isFinite(stored) ? stored : 0;

    if (fallbackCount > normalizedStored) {
      window.localStorage.setItem(key, String(fallbackCount));
      return fallbackCount;
    }

    return normalizedStored;
  } catch {
    return fallbackCount;
  }
}
