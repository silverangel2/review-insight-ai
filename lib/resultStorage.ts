import { isAdminRole, isSellerPlan, type ClientAccount } from "@/lib/account";
import type { AnalysisAudience, AnalyzeResponse, SubscriptionPlan, UserRole } from "@/lib/types";

const RESULT_STORAGE_PREFIX = "reviewintel:last-result";
const RESULT_STORAGE_KEY = RESULT_STORAGE_PREFIX;
const RESULT_PREVIEW_STORAGE_KEY = "reviewintel:last-preview";
const ACTIVE_SCAN_ID_STORAGE_KEY = "reviewintel:active-scan-id";

type StoredResultEnvelope = {
  version: 1 | 2;
  savedAt: string;
  accountEmail?: string | null;
  accountRole?: UserRole | null;
  accountPlan?: SubscriptionPlan | null;
  scanId?: string | null;
  result: AnalyzeResponse;
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function audienceMatchesRole(role: UserRole | null | undefined, audience: AnalysisAudience) {
  if (role === "seller") return audience === "seller" || audience === "both";
  if (role === "buyer" || role === "guest") return audience === "buyer" || audience === "both";
  return true;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function scopedResultKeys(accountEmail?: string | null, accountRole?: UserRole | null) {
  const keys = [RESULT_STORAGE_KEY];
  const email = normalizeEmail(accountEmail);

  if (accountRole) keys.push(`${RESULT_STORAGE_PREFIX}:role:${accountRole}`);
  if (email) keys.push(`${RESULT_STORAGE_PREFIX}:account:${email}`);

  return Array.from(new Set(keys));
}

function looksLikeResult(value: unknown) {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object") return false;

  return Boolean(
    ("analysis" in record && "meta" in record) ||
    ("product" in record && "verdict" in record) ||
    ("summary" in record && "healthScore" in record)
  );
}

function scanIdFromResult(result: AnalyzeResponse | null | undefined) {
  const record = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const meta = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : {};
  const scanId = String(record.scanId || meta.scanId || "").trim();
  return scanId || null;
}

function parseStoredResult(raw: string | null): StoredResultEnvelope | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredResultEnvelope> | AnalyzeResponse;
    if ("result" in parsed && looksLikeResult(parsed.result)) {
      return parsed as StoredResultEnvelope;
    }

    if (looksLikeResult(parsed)) {
      return {
        version: 1,
        savedAt: new Date(0).toISOString(),
        result: parsed as AnalyzeResponse
      };
    }
  } catch {
    return null;
  }

  return null;
}

function envelopeMatchesAccount(envelope: StoredResultEnvelope, account: ClientAccount | null) {
  const result = envelope.result as AnalyzeResponse & { meta?: { audience?: AnalysisAudience } };
  const audience = result.meta?.audience ?? "buyer";

  if ((audience === "seller" || audience === "both") && !isAdminRole(account?.role) && !isSellerPlan(account?.plan || "free_buyer")) {
    return false;
  }

  if (!audienceMatchesRole(account?.role ?? null, audience)) return false;

  if (!account) return !envelope.accountEmail;
  if (envelope.accountEmail && envelope.accountEmail.toLowerCase() !== account.email.toLowerCase()) return false;
  if (envelope.accountRole && envelope.accountRole !== account.role && account.role !== "admin") return false;

  return true;
}

export function saveLatestResult(result: AnalyzeResponse, account: ClientAccount | null) {
  const envelope: StoredResultEnvelope = {
    version: 2,
    savedAt: new Date().toISOString(),
    accountEmail: account?.email ?? null,
    accountRole: account?.role ?? null,
    accountPlan: account?.plan ?? null,
    scanId: scanIdFromResult(result),
    result
  };
  const serialized = JSON.stringify(envelope);
  const keys = scopedResultKeys(envelope.accountEmail, envelope.accountRole);

  if (canUseSessionStorage()) keys.forEach((key) => window.sessionStorage.setItem(key, serialized));
  if (canUseLocalStorage()) keys.forEach((key) => window.localStorage.setItem(key, serialized));
}

export function setActiveScanId(scanId: string) {
  const clean = scanId.trim();
  if (!clean) return;

  if (canUseSessionStorage()) window.sessionStorage.setItem(ACTIVE_SCAN_ID_STORAGE_KEY, clean);
  if (canUseLocalStorage()) window.localStorage.setItem(ACTIVE_SCAN_ID_STORAGE_KEY, clean);
}

export function readActiveScanId() {
  const sessionValue = canUseSessionStorage()
    ? window.sessionStorage.getItem(ACTIVE_SCAN_ID_STORAGE_KEY)
    : "";
  const localValue = canUseLocalStorage()
    ? window.localStorage.getItem(ACTIVE_SCAN_ID_STORAGE_KEY)
    : "";

  return String(sessionValue || localValue || "").trim();
}

export function clearActiveScanId() {
  if (canUseSessionStorage()) window.sessionStorage.removeItem(ACTIVE_SCAN_ID_STORAGE_KEY);
  if (canUseLocalStorage()) window.localStorage.removeItem(ACTIVE_SCAN_ID_STORAGE_KEY);
}

export function readLatestResult(
  account: ClientAccount | null,
  options: { scanId?: string | null; allowAnyScan?: boolean } = {}
) {
  const requestedScanId = String(options.scanId || "").trim();
  const keys = scopedResultKeys(account?.email, account?.role);
  const candidates = keys
    .flatMap((key) => [
      canUseSessionStorage() ? parseStoredResult(window.sessionStorage.getItem(key)) : null,
      canUseLocalStorage() ? parseStoredResult(window.localStorage.getItem(key)) : null
    ])
    .filter((item): item is StoredResultEnvelope => Boolean(item))
    .filter((item) => envelopeMatchesAccount(item, account))
    .filter((item) => {
      if (!requestedScanId || options.allowAnyScan) return true;
      const resultScanId = item.scanId || scanIdFromResult(item.result);
      return resultScanId === requestedScanId;
    })
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());

  return candidates[0]?.result ?? null;
}

export function clearLatestResult() {
  const legacyKeys = [
    "reviewintel_latest_result",
    "reviewintel_latest_result_last",
    "reviewintel_latest_result_fallback"
  ];

  const clearByPrefix = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(RESULT_STORAGE_PREFIX)) storage.removeItem(key);
    }

    legacyKeys.forEach((key) => storage.removeItem(key));
    storage.removeItem(RESULT_PREVIEW_STORAGE_KEY);
    storage.removeItem(ACTIVE_SCAN_ID_STORAGE_KEY);
  };

  if (canUseSessionStorage()) clearByPrefix(window.sessionStorage);
  if (canUseLocalStorage()) clearByPrefix(window.localStorage);
}

export function saveLatestPreview(preview: string) {
  if (!preview) return;

  try {
    if (canUseSessionStorage()) window.sessionStorage.setItem(RESULT_PREVIEW_STORAGE_KEY, preview);
  } catch {
    // Large screenshots can exceed browser storage; results should still load without the preview.
  }
}

export function readLatestPreview() {
  if (!canUseSessionStorage()) return "";
  return window.sessionStorage.getItem(RESULT_PREVIEW_STORAGE_KEY) || "";
}
