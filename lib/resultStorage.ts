import type { ClientAccount } from "@/lib/account";
import type { AnalysisAudience, AnalyzeResponse, SubscriptionPlan, UserRole } from "@/lib/types";

const RESULT_STORAGE_KEY = "reviewintel:last-result";

type StoredResultEnvelope = {
  version: 1 | 2;
  savedAt: string;
  accountEmail?: string | null;
  accountRole?: UserRole | null;
  accountPlan?: SubscriptionPlan | null;
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

function parseStoredResult(raw: string | null): StoredResultEnvelope | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredResultEnvelope> | AnalyzeResponse;
    if ("result" in parsed && parsed.result?.analysis && parsed.result?.meta) {
      return parsed as StoredResultEnvelope;
    }

    if ("analysis" in parsed && "meta" in parsed && parsed.analysis && parsed.meta) {
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
  if (!audienceMatchesRole(account?.role ?? null, envelope.result.meta.audience)) return false;

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
    result
  };
  const serialized = JSON.stringify(envelope);

  if (canUseSessionStorage()) window.sessionStorage.setItem(RESULT_STORAGE_KEY, serialized);
  if (canUseLocalStorage()) window.localStorage.setItem(RESULT_STORAGE_KEY, serialized);
}

export function readLatestResult(account: ClientAccount | null) {
  const candidates = [
    canUseSessionStorage() ? parseStoredResult(window.sessionStorage.getItem(RESULT_STORAGE_KEY)) : null,
    canUseLocalStorage() ? parseStoredResult(window.localStorage.getItem(RESULT_STORAGE_KEY)) : null
  ]
    .filter((item): item is StoredResultEnvelope => Boolean(item))
    .filter((item) => envelopeMatchesAccount(item, account))
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());

  return candidates[0]?.result ?? null;
}

export function clearLatestResult() {
  if (canUseSessionStorage()) window.sessionStorage.removeItem(RESULT_STORAGE_KEY);
  if (canUseLocalStorage()) window.localStorage.removeItem(RESULT_STORAGE_KEY);
}
