import { createHash } from "crypto";

type ScanBudgetGroup = {
  openAiCalls: number;
  openAiInputTokens: number;
  openAiOutputTokens: number;
  openAiTotalTokens: number;
  firecrawlCalls: number;
  firecrawlPages: number;
  paidProviderCalls: number;
  retrievalRequests: number;
};

export const SCAN_BUDGET_LIMITS: {
  perScan: ScanBudgetGroup;
  accountDaily: ScanBudgetGroup;
  globalDaily: ScanBudgetGroup;
} = {
  perScan: {
    openAiCalls: 8,
    openAiInputTokens: 60_000,
    openAiOutputTokens: 60_000,
    openAiTotalTokens: 120_000,
    firecrawlCalls: 0,
    firecrawlPages: 0,
    paidProviderCalls: 24,
    retrievalRequests: 160,
  },
  accountDaily: {
    openAiCalls: 24,
    openAiInputTokens: 240_000,
    openAiOutputTokens: 240_000,
    openAiTotalTokens: 480_000,
    firecrawlCalls: 0,
    firecrawlPages: 0,
    paidProviderCalls: 48,
    retrievalRequests: 480,
  },
  globalDaily: {
    openAiCalls: 200,
    openAiInputTokens: 2_000_000,
    openAiOutputTokens: 2_000_000,
    openAiTotalTokens: 4_000_000,
    firecrawlCalls: 0,
    firecrawlPages: 0,
    paidProviderCalls: 400,
    retrievalRequests: 4_000,
  },
};

function configuredLimit(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function scanBudgetLimitsFromEnv() {
  const base = SCAN_BUDGET_LIMITS;
  const group = (prefix: string, defaults: ScanBudgetGroup): ScanBudgetGroup => ({
    openAiCalls: configuredLimit(`${prefix}_OPENAI_CALLS`, defaults.openAiCalls),
    openAiInputTokens: configuredLimit(`${prefix}_OPENAI_INPUT_TOKENS`, defaults.openAiInputTokens),
    openAiOutputTokens: configuredLimit(`${prefix}_OPENAI_OUTPUT_TOKENS`, defaults.openAiOutputTokens),
    openAiTotalTokens: configuredLimit(`${prefix}_OPENAI_TOTAL_TOKENS`, defaults.openAiTotalTokens),
    // Retained in the reservation schema for compatibility, but disabled for
    // every normal ReviewIntel scan regardless of stale environment values.
    firecrawlCalls: 0,
    firecrawlPages: 0,
    paidProviderCalls: configuredLimit(`${prefix}_PAID_PROVIDER_CALLS`, defaults.paidProviderCalls),
    retrievalRequests: configuredLimit(`${prefix}_RETRIEVAL_REQUESTS`, defaults.retrievalRequests),
  });
  return {
    perScan: group("REVIEWINTEL_PER_SCAN", base.perScan),
    accountDaily: group("REVIEWINTEL_ACCOUNT_DAILY", base.accountDaily),
    globalDaily: group("REVIEWINTEL_GLOBAL_DAILY", base.globalDaily),
  };
}

export function scanOperationKey(accountKey: string, clientScanId: string, requestFingerprint: string) {
  return createHash("sha256")
    .update(`${accountKey}\n${clientScanId}\n${requestFingerprint}`)
    .digest("hex");
}

export function requestFingerprint(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function budgetAccountKey(accountKey: string) {
  return createHash("sha256").update(accountKey).digest("hex");
}

type OperationResult = {
  status: "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED";
  scan_id?: string | null;
  result_json?: Record<string, unknown> | null;
  error_code?: string | null;
  created?: boolean;
};

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) return null;
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as T | null;
}

async function operationRest<T>(path: string, init: RequestInit): Promise<T | null> {
  const url = supabaseUrl();
  const key = serviceKey();
  if (!url || !key) return null;
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json().catch(() => null)) as T | null;
}

export async function beginDurableScanOperation(input: {
  operationKey: string;
  accountKey: string;
  scanId: string;
}) {
  const encodedKey = encodeURIComponent(input.operationKey);
  const existing = await operationRest<OperationResult[]>(
    `reviewintel_scan_operations?select=status,scan_id,result_json,error_code&operation_key=eq.${encodedKey}&limit=1`,
    { method: "GET" },
  );
  const prior = Array.isArray(existing) ? existing[0] : null;
  if (prior) {
    // Only resume the retired telemetry-budget block. Infrastructure/security
    // blocks stay blocked; analyze still checks the real free-user quota before AI.
    if (prior.status === "BLOCKED" && prior.error_code === "DAILY_BUDGET_EXHAUSTED") {
      const reopened = await operationRest<OperationResult[]>(
        `reviewintel_scan_operations?operation_key=eq.${encodedKey}&status=eq.BLOCKED&error_code=eq.DAILY_BUDGET_EXHAUSTED`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "RUNNING", error_code: null, reservation_json: null, updated_at: new Date().toISOString() }),
        },
      );
      if (Array.isArray(reopened) && reopened.length > 0) {
        return { status: "RUNNING" as const, created: true, scanId: prior.scan_id || input.scanId, result: null };
      }
    }
    return { status: prior.status, created: false, scanId: prior.scan_id || input.scanId, result: prior.result_json || null, errorCode: prior.error_code || null };
  }

  // The durable row remains the idempotency/concurrency primitive. Resource
  // budgets are observational; no daily reservation or allow/deny decision is
  // made for a legitimate scan.
  const created = await operationRest<OperationResult[]>("reviewintel_scan_operations", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      operation_key: input.operationKey,
      account_key: input.accountKey,
      scan_id: input.scanId,
      status: "RUNNING",
      reservation_json: null,
    }),
  });
  if (Array.isArray(created) && created[0]) {
    return { status: "RUNNING" as const, created: true, scanId: input.scanId, result: null };
  }

  const raced = await operationRest<OperationResult[]>(
    `reviewintel_scan_operations?select=status,scan_id,result_json,error_code&operation_key=eq.${encodedKey}&limit=1`,
    { method: "GET" },
  );
  const winner = Array.isArray(raced) ? raced[0] : null;
  if (!winner) return { status: "BLOCKED" as const, errorCode: "IDEMPOTENCY_STORE_UNAVAILABLE" };
  return { status: winner.status, created: false, scanId: winner.scan_id || input.scanId, result: winner.result_json || null, errorCode: winner.error_code || null };
}

export async function finishDurableScanOperation(input: {
  operationKey: string;
  status: "COMPLETED" | "FAILED";
  result?: Record<string, unknown> | null;
  errorCode?: string | null;
}) {
  const result = await rpc<{ ok?: boolean }>("reviewintel_finish_scan_operation", {
    p_operation_key: input.operationKey,
    p_status: input.status,
    p_result_json: input.result || null,
    p_error_code: input.errorCode || null,
  });
  if (result?.ok !== true || input.status !== "COMPLETED") return result;
  const rows = await operationRest<OperationResult[]>(
    `reviewintel_scan_operations?select=status,scan_id,result_json&operation_key=eq.${encodeURIComponent(input.operationKey)}&limit=1`,
    { method: "GET" },
  );
  const completed = rows?.[0];
  return completed?.status === "COMPLETED" && completed.scan_id === input.result?.scanId
    && completed.result_json?.scanId === input.result?.scanId
    && completed.result_json?.analysisId === input.result?.analysisId ? { ok: true } : null;
}
