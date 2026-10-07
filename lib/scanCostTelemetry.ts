import { captureStage } from "./devScanCapture";
export const SCAN_COST_LIMITS = {
  maxOpenAiCalls: 8,
  maxOpenAiTotalTokens: 120_000,
  // Firecrawl is disabled for normal ReviewIntel product scans.
  maxFirecrawlCalls: 0,
  maxRetrievalRequests: 160,
  maxDurationMs: 180_000,
  maxAcceptedReviews: 240,
} as const;

function boundedEnvLimit(name: string, fallback: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(Math.floor(parsed), max)) : fallback;
}

export const IDENTITY_STAGE_LIMITS = {
  maxSearchRequests: boundedEnvLimit("REVIEWINTEL_IDENTITY_SEARCH_LIMIT", 8, 12),
  maxOpenAiCalls: boundedEnvLimit("REVIEWINTEL_IDENTITY_OPENAI_CALL_LIMIT", 2, 3),
  maxOpenAiTokens: boundedEnvLimit("REVIEWINTEL_IDENTITY_TOKEN_LIMIT", 18_000, 24_000),
  maxCandidateAttempts: boundedEnvLimit("REVIEWINTEL_IDENTITY_CANDIDATE_LIMIT", 8, 12),
} as const;

export type ScanCostSnapshot = {
  openAiCalls: number;
  openAiInputTokens: number | null;
  openAiOutputTokens: number | null;
  openAiTotalTokens: number | null;
  firecrawlCalls: number;
  firecrawlPages: number;
  firecrawlCreditsUsed: number | null;
  searchProviderCalls: number;
  otherPaidProviderCalls: number;
  totalRetrievalRequests: number;
  totalScanDurationMs: number;
  estimatedScanCostUsd: number | null;
  ceilings: typeof SCAN_COST_LIMITS;
  blockedReasons: string[];
  tokenUsageHigh: boolean;
  providerUsageHigh: boolean;
  scanCostHigh: boolean;
  identityStage: {
    searchRequests: number;
    openAiCalls: number;
    openAiTokens: number | null;
    candidateAttempts: number;
    ceilings: typeof IDENTITY_STAGE_LIMITS;
  };
};

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function envRate(name: string): number | null {
  return finiteNonNegative(process.env[name]);
}

export class ScanCostTelemetry {
  private readonly startedAt = Date.now();
  private readonly blocked = new Set<string>();
  private openAiCalls = 0;
  private unreportedOpenAiCalls = 0;
  private identitySearchUrls = new Set<string>();
  private openAiInputTokens = 0;
  private openAiOutputTokens = 0;
  private openAiTokenUsageKnown = true;
  private firecrawlCalls = 0;
  private firecrawlPages = 0;
  private firecrawlCreditsUsed = 0;
  private firecrawlCreditsKnown = true;
  private searchProviderCalls = 0;
  private otherPaidProviderCalls = 0;
  private totalRetrievalRequests = 0;
  private identitySearchRequests = 0;
  private identityOpenAiCalls = 0;
  private identityOpenAiTokens = 0;
  private identityTokenUsageKnown = true;
  private identityCandidateAttempts = 0;

  canStartOpenAiCall() {
    return true;
  }

  recordOpenAiCall(usage?: { inputTokens?: unknown; outputTokens?: unknown }) {
    this.openAiCalls += 1;
    this.unreportedOpenAiCalls += 1;
    if (usage) this.recordOpenAiUsage(usage);
    captureStage("telemetry", () => this.snapshot());
  }

  reserveIdentitySearchUrl(url: string) {
    if (this.identitySearchUrls.has(url)) return false;
    this.identitySearchUrls.add(url);
    return true;
  }

  canStartIdentitySearchRequest() {
    return true;
  }

  recordIdentitySearchRequest(kind: "search" | "other" = "search") {
    this.identitySearchRequests += 1;
    this.recordRetrievalRequest(kind);
  }

  canStartIdentityOpenAiCall() {
    return true;
  }

  recordIdentityOpenAiCall() {
    this.identityOpenAiCalls += 1;
    this.recordOpenAiCall();
  }

  recordIdentityOpenAiUsage(usage?: { inputTokens?: unknown; outputTokens?: unknown }) {
    const inputValue = finiteNonNegative(usage?.inputTokens);
    const outputValue = finiteNonNegative(usage?.outputTokens);
    if (inputValue === null || outputValue === null) {
      this.identityTokenUsageKnown = false;
      this.identityOpenAiTokens = IDENTITY_STAGE_LIMITS.maxOpenAiTokens;
    }
    const input = inputValue ?? 0;
    const output = outputValue ?? 0;
    this.identityOpenAiTokens += input + output;
    this.recordOpenAiUsage(usage);
  }

  canTryIdentityCandidate() {
    return true;
  }

  recordIdentityCandidateAttempt() {
    this.identityCandidateAttempts += 1;
  }

  recordOpenAiUsage(usage?: { inputTokens?: unknown; outputTokens?: unknown }) {
    this.unreportedOpenAiCalls = Math.max(0, this.unreportedOpenAiCalls - 1);
    const input = finiteNonNegative(usage?.inputTokens);
    const output = finiteNonNegative(usage?.outputTokens);
    if (input === null || output === null) this.openAiTokenUsageKnown = false;
    if (input !== null) this.openAiInputTokens += input;
    if (output !== null) this.openAiOutputTokens += output;
    captureStage("telemetry", () => this.snapshot());
  }

  canStartFirecrawlCall() {
    this.blocked.add("firecrawl_disabled_for_review_scan");
    return false;
  }

  recordFirecrawlCall(pages = 1, credits?: unknown) {
    void pages;
    void credits;
    this.blocked.add("firecrawl_disabled_for_review_scan");
  }

  canStartRetrievalRequest() {
    return true;
  }

  recordRetrievalRequest(kind: "search" | "paid" | "other" = "other") {
    this.totalRetrievalRequests += 1;
    if (kind === "search") this.searchProviderCalls += 1;
    if (kind === "paid") this.otherPaidProviderCalls += 1;
    captureStage("telemetry", () => this.snapshot());
  }

  snapshot(): ScanCostSnapshot {
    const input = this.openAiTokenUsageKnown && this.unreportedOpenAiCalls === 0 ? this.openAiInputTokens : null;
    const output = this.openAiTokenUsageKnown && this.unreportedOpenAiCalls === 0 ? this.openAiOutputTokens : null;
    const total = input !== null && output !== null ? input + output : null;
    const inputRate = envRate("REVIEWINTEL_OPENAI_INPUT_COST_PER_1K_USD");
    const outputRate = envRate("REVIEWINTEL_OPENAI_OUTPUT_COST_PER_1K_USD");
    const estimatedScanCostUsd =
      total !== null && inputRate !== null && outputRate !== null
        ? (this.openAiInputTokens / 1000) * inputRate +
          (this.openAiOutputTokens / 1000) * outputRate
        : null;
    const tokenUsageHigh = total !== null && total >= SCAN_COST_LIMITS.maxOpenAiTotalTokens * 0.8;
    const providerUsageHigh = this.totalRetrievalRequests >= SCAN_COST_LIMITS.maxRetrievalRequests * 0.8;
    const scanCostHigh = estimatedScanCostUsd !== null && estimatedScanCostUsd >= Number(process.env.REVIEWINTEL_SCAN_COST_WARNING_USD || 1);

    return {
      openAiCalls: this.openAiCalls,
      openAiInputTokens: input,
      openAiOutputTokens: output,
      openAiTotalTokens: total,
      firecrawlCalls: this.firecrawlCalls,
      firecrawlPages: this.firecrawlPages,
      firecrawlCreditsUsed: this.firecrawlCreditsKnown ? this.firecrawlCreditsUsed : null,
      searchProviderCalls: this.searchProviderCalls,
      otherPaidProviderCalls: this.otherPaidProviderCalls,
      totalRetrievalRequests: this.totalRetrievalRequests,
      totalScanDurationMs: Date.now() - this.startedAt,
      estimatedScanCostUsd,
      ceilings: SCAN_COST_LIMITS,
      blockedReasons: Array.from(this.blocked),
      tokenUsageHigh,
      providerUsageHigh,
      scanCostHigh,
      identityStage: {
        searchRequests: this.identitySearchRequests,
        openAiCalls: this.identityOpenAiCalls,
        openAiTokens: this.identityTokenUsageKnown ? this.identityOpenAiTokens : null,
        candidateAttempts: this.identityCandidateAttempts,
        ceilings: IDENTITY_STAGE_LIMITS,
      },
    };
  }
}

export function extractOpenAiUsage(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const usage = record.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>) : {};
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens,
    outputTokens: usage.output_tokens ?? usage.completion_tokens,
  };
}
