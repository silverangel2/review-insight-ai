export const OPENAI_WEB_SEARCH_TOOL = "web_search";
export const OPENAI_WEB_SEARCH_PREVIEW_TOOL = "web_search_preview";

export type OpenAiWebSearchToolType =
  | typeof OPENAI_WEB_SEARCH_TOOL
  | typeof OPENAI_WEB_SEARCH_PREVIEW_TOOL;

export type OpenAiWebSearchDiagnostics = {
  calls: number;
  skippedDuplicates: number;
  skippedDisabled: number;
  skippedEvidenceSatisfied: number;
  skippedLimitReached: number;
  skippedMissingApiKey: number;
  failed: number;
};

export type OpenAiWebSearchSkipReason =
  | "duplicate"
  | "disabled"
  | "evidence_satisfied"
  | "limit_reached"
  | "missing_api_key";

export type OpenAiWebSearchResult<T = unknown> = {
  ok: boolean;
  status: number | null;
  data?: T;
  outputText: string;
  error?: string;
  skipped: boolean;
  skipReason?: OpenAiWebSearchSkipReason;
  usedWebSearch: boolean;
  model: string;
  diagnostics: OpenAiWebSearchDiagnostics;
};

export type OpenAiWebSearchContext = {
  maxCalls: number;
  diagnostics: OpenAiWebSearchDiagnostics;
  requests: Map<string, Promise<OpenAiWebSearchResult>>;
};

type OpenAiWebSearchInput = {
  input: string;
  model?: string | null;
  toolType?: OpenAiWebSearchToolType;
  searchContextSize?: "low" | "medium" | "high";
  temperature?: number;
  signal?: AbortSignal;
  context?: OpenAiWebSearchContext;
  maxCalls?: number;
  purpose?: string;
  dedupeKey?: string;
  evidenceSatisfied?: () => boolean;
  allowWithoutWebSearch?: boolean;
};

type OpenAiPlainResponseInput = {
  input: string;
  model?: string | null;
  temperature?: number;
  signal?: AbortSignal;
  context?: OpenAiWebSearchContext;
  maxCalls?: number;
};

const DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS = 1;

function createDiagnostics(): OpenAiWebSearchDiagnostics {
  return {
    calls: 0,
    skippedDuplicates: 0,
    skippedDisabled: 0,
    skippedEvidenceSatisfied: 0,
    skippedLimitReached: 0,
    skippedMissingApiKey: 0,
    failed: 0,
  };
}

function clampMaxCalls(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS;
  return Math.max(0, Math.min(Math.round(parsed), DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS));
}

function normalizeDedupeKey(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 6000);
}

function enabledFlagValue() {
  return String(process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED || "")
    .trim()
    .toLowerCase();
}

function skippedResult<T>(
  context: OpenAiWebSearchContext,
  model: string,
  skipReason: OpenAiWebSearchSkipReason,
  error?: string
): OpenAiWebSearchResult<T> {
  return {
    ok: false,
    status: null,
    outputText: "",
    error,
    skipped: true,
    skipReason,
    usedWebSearch: false,
    model,
    diagnostics: getOpenAiWebSearchDiagnostics(context),
  };
}

function outputTextFromResponse(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const direct = typeof record.output_text === "string" ? record.output_text : "";
  if (direct) return direct;

  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .flatMap((item) => {
      const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return Array.isArray(itemRecord.content) ? itemRecord.content : [];
    })
    .map((content) => {
      const contentRecord = content && typeof content === "object" ? (content as Record<string, unknown>) : {};
      return typeof contentRecord.text === "string" ? contentRecord.text : "";
    })
    .join("\n");
}

export function createOpenAiWebSearchContext(options: { maxCalls?: number } = {}): OpenAiWebSearchContext {
  return {
    maxCalls: clampMaxCalls(options.maxCalls ?? DEFAULT_MAX_OPENAI_WEB_SEARCH_CALLS),
    diagnostics: createDiagnostics(),
    requests: new Map(),
  };
}

export function getOpenAiWebSearchDiagnostics(
  context?: OpenAiWebSearchContext | null
): OpenAiWebSearchDiagnostics {
  return {
    ...(context?.diagnostics || createDiagnostics()),
  };
}

export function isOpenAiWebSearchEnabled() {
  const value = enabledFlagValue();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function getOpenAiWebSearchModel(model?: string | null) {
  return (
    String(model || "").trim() ||
    String(process.env.OPENAI_SEARCH_MODEL || "").trim() ||
    "gpt-4.1-mini"
  );
}

export function describeOpenAiWebSearchSkip(result: OpenAiWebSearchResult) {
  if (!result.skipped) return result.error || "";

  if (result.skipReason === "disabled") {
    return "OpenAI Web Search is disabled by REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED.";
  }
  if (result.skipReason === "evidence_satisfied") {
    return "OpenAI Web Search skipped because enough evidence was already collected.";
  }
  if (result.skipReason === "limit_reached") {
    return "OpenAI Web Search skipped because the per-scan request limit was reached.";
  }
  if (result.skipReason === "duplicate") {
    return "OpenAI Web Search skipped because the same search was already requested in this scan.";
  }
  if (result.skipReason === "missing_api_key") {
    return "OPENAI_API_KEY is missing.";
  }

  return result.error || "OpenAI Web Search skipped.";
}

async function postOpenAiResponse<T>({
  apiKey,
  body,
  signal,
  context,
  model,
  usedWebSearch,
}: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  context: OpenAiWebSearchContext;
  model: string;
  usedWebSearch: boolean;
}): Promise<OpenAiWebSearchResult<T>> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (usedWebSearch) context.diagnostics.failed += 1;
      return {
        ok: false,
        status: response.status,
        outputText: "",
        error: text.slice(0, 1000),
        skipped: false,
        usedWebSearch,
        model,
        diagnostics: getOpenAiWebSearchDiagnostics(context),
      };
    }

    const data = (await response.json()) as T;
    return {
      ok: true,
      status: response.status,
      data,
      outputText: outputTextFromResponse(data),
      skipped: false,
      usedWebSearch,
      model,
      diagnostics: getOpenAiWebSearchDiagnostics(context),
    };
  } catch (error: unknown) {
    if (usedWebSearch) context.diagnostics.failed += 1;
    return {
      ok: false,
      status: null,
      outputText: "",
      error: error instanceof Error ? error.message : "OpenAI request failed.",
      skipped: false,
      usedWebSearch,
      model,
      diagnostics: getOpenAiWebSearchDiagnostics(context),
    };
  }
}

export async function callOpenAiWebSearchResponse<T = unknown>(
  options: OpenAiWebSearchInput
): Promise<OpenAiWebSearchResult<T>> {
  const context = options.context || createOpenAiWebSearchContext({ maxCalls: options.maxCalls });
  const model = getOpenAiWebSearchModel(options.model);
  const toolType = options.toolType || OPENAI_WEB_SEARCH_TOOL;
  const purpose = options.purpose || "openai-web-search";
  const dedupeKey = normalizeDedupeKey(
    options.dedupeKey || `${purpose}:${toolType}:${model}:${options.input}`
  );

  let useWebSearch = true;
  let skipReason: OpenAiWebSearchSkipReason | null = null;

  if (options.evidenceSatisfied?.()) {
    context.diagnostics.skippedEvidenceSatisfied += 1;
    useWebSearch = false;
    skipReason = "evidence_satisfied";
  } else if (!isOpenAiWebSearchEnabled()) {
    context.diagnostics.skippedDisabled += 1;
    useWebSearch = false;
    skipReason = "disabled";
  } else if (context.requests.has(dedupeKey)) {
    context.diagnostics.skippedDuplicates += 1;
    const cached = (await context.requests.get(dedupeKey)!) as OpenAiWebSearchResult<T>;
    return {
      ...cached,
      skipped: true,
      skipReason: "duplicate",
      usedWebSearch: false,
      diagnostics: getOpenAiWebSearchDiagnostics(context),
    };
  } else if (context.diagnostics.calls >= context.maxCalls) {
    context.diagnostics.skippedLimitReached += 1;
    useWebSearch = false;
    skipReason = "limit_reached";
  }

  if (!useWebSearch && !options.allowWithoutWebSearch) {
    return skippedResult<T>(
      context,
      model,
      skipReason || "disabled",
      describeOpenAiWebSearchSkip({
        ok: false,
        status: null,
        outputText: "",
        skipped: true,
        skipReason: skipReason || "disabled",
        usedWebSearch: false,
        model,
        diagnostics: getOpenAiWebSearchDiagnostics(context),
      })
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    context.diagnostics.skippedMissingApiKey += 1;
    return skippedResult<T>(context, model, "missing_api_key", "OPENAI_API_KEY is missing.");
  }

  const requestKey = useWebSearch ? dedupeKey : normalizeDedupeKey(`plain:${skipReason}:${dedupeKey}`);
  if (context.requests.has(requestKey)) {
    context.diagnostics.skippedDuplicates += 1;
    const cached = (await context.requests.get(requestKey)!) as OpenAiWebSearchResult<T>;
    return {
      ...cached,
      skipped: true,
      skipReason: "duplicate",
      usedWebSearch: false,
      diagnostics: getOpenAiWebSearchDiagnostics(context),
    };
  }

  const body: Record<string, unknown> = {
    model,
    input: options.input,
    temperature: options.temperature ?? 0.1,
  };

  if (useWebSearch) {
    context.diagnostics.calls += 1;
    body.tools = [
      {
        type: toolType,
        ...(options.searchContextSize ? { search_context_size: options.searchContextSize } : {}),
      },
    ];
  }

  const request = postOpenAiResponse<T>({
    apiKey,
    body,
    signal: options.signal,
    context,
    model,
    usedWebSearch: useWebSearch,
  });

  context.requests.set(requestKey, request);
  return request;
}

export async function callOpenAiResponseWithoutWebSearch<T = unknown>(
  options: OpenAiPlainResponseInput
): Promise<OpenAiWebSearchResult<T>> {
  const context = options.context || createOpenAiWebSearchContext({ maxCalls: options.maxCalls });
  const model = getOpenAiWebSearchModel(options.model);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      status: null,
      outputText: "",
      error: "OPENAI_API_KEY is missing.",
      skipped: false,
      usedWebSearch: false,
      model,
      diagnostics: getOpenAiWebSearchDiagnostics(context),
    };
  }

  return postOpenAiResponse<T>({
    apiKey,
    body: {
      model,
      input: options.input,
      temperature: options.temperature ?? 0.1,
    },
    signal: options.signal,
    context,
    model,
    usedWebSearch: false,
  });
}
