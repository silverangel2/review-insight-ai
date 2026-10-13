import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Owner hard rule: ReviewIntel runs with ZERO OpenAI calls by default.
 * Every OpenAI path has its own flag, OFF unless set to "on". REVIEWINTEL_DISABLE_OPENAI=1
 * forces everything off. A global fetch guard throws on ANY request to api.openai.com that
 * did not go through guardedOpenAiFetch with its flag on, so a forgotten code path fails loudly.
 */
export const OPENAI_FEATURE_FLAGS = {
  analyze_screenshot: "REVIEWINTEL_OPENAI_ANALYZE_SCREENSHOT",
  seller_analyze: "REVIEWINTEL_OPENAI_SELLER_ANALYZE",
  shopper_compare: "REVIEWINTEL_OPENAI_SHOPPER_COMPARE",
  review_evidence: "REVIEWINTEL_OPENAI_REVIEW_EVIDENCE",
  followup: "REVIEWINTEL_FOLLOWUP_OPENAI",
  seller_compare: "REVIEWINTEL_SELLER_COMPARE_OPENAI",
  admin_tools: "REVIEWINTEL_OPENAI_ADMIN_TOOLS",
} as const;
export type OpenAiFeature = keyof typeof OPENAI_FEATURE_FLAGS;

export class OpenAiDisabledError extends Error {
  code = "OPENAI_DISABLED";
  constructor(public feature: string) { super(`OpenAI is disabled for "${feature}" (zero-OpenAI rule). Set ${OPENAI_FEATURE_FLAGS[feature as OpenAiFeature] ?? "its flag"}=on to allow.`); }
}

type Counters = { calls: number; blocked: number; installed: boolean; realFetch?: typeof fetch };
const g = globalThis as typeof globalThis & { __riOpenAiGuard?: Counters };
const counters: Counters = (g.__riOpenAiGuard ??= { calls: 0, blocked: 0, installed: false });
const allowed = new AsyncLocalStorage<OpenAiFeature>();
const zeroRun = new AsyncLocalStorage<boolean>();

const isOn = (v: string | undefined) => ["on", "1", "true", "yes"].includes(String(v || "").trim().toLowerCase());
export function isOpenAiGloballyDisabled() { return isOn(process.env.REVIEWINTEL_DISABLE_OPENAI); }
export function isOpenAiFeatureEnabled(feature: OpenAiFeature) {
  return !isOpenAiGloballyDisabled() && isOn(process.env[OPENAI_FEATURE_FLAGS[feature]]);
}
export function openAiCallCount() { return counters.calls; }
export function openAiBlockedCount() { return counters.blocked; }
/**
 * Run fn as a zero-OpenAI scraping/analysis run: inside it, ANY unguarded request to api.openai.com throws.
 * (Outside runs, enforcement is global only with REVIEWINTEL_OPENAI_GUARD_STRICT=1, so unrelated
 * non-analysis features such as social posting keep their own behaviour.)
 */
export async function runZeroOpenAi<T>(fn: () => Promise<T>): Promise<{ value: T; openAiCalls: number; openAiBlocked: number }> {
  const done = startOpenAiRun();
  const value = await zeroRun.run(true, fn);
  return { value, ...done() };
}
/** Per-run accounting: const done = startOpenAiRun(); ...; done() -> { openAiCalls, openAiBlocked } */
export function startOpenAiRun() {
  const c0 = counters.calls, b0 = counters.blocked;
  return () => ({ openAiCalls: counters.calls - c0, openAiBlocked: counters.blocked - b0 });
}
export function assertOpenAiCallsZero(run: { openAiCalls: number }) {
  if (run.openAiCalls > 0) throw new Error(`OpenAI guard: ${run.openAiCalls} OpenAI call(s) made in a zero-OpenAI run.`);
}

const isOpenAiUrl = (input: unknown) => {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as { url?: string })?.url;
    return /(^|\.)api\.openai\.com$/i.test(new URL(String(raw)).hostname);
  } catch { return false; }
};

export function installGlobalOpenAiGuard() {
  if (counters.installed || typeof globalThis.fetch !== "function") return;
  const real = globalThis.fetch.bind(globalThis);
  counters.realFetch = real;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isOpenAiUrl(input)) {
      const feature = allowed.getStore();
      const enforce = Boolean(zeroRun.getStore()) || isOn(process.env.REVIEWINTEL_OPENAI_GUARD_STRICT) || Boolean(feature);
      if (enforce && (!feature || !isOpenAiFeatureEnabled(feature))) { counters.blocked += 1; throw new OpenAiDisabledError(feature || "unguarded"); }
      counters.calls += 1;
    }
    return real(input, init);
  }) as typeof fetch;
  counters.installed = true;
}

/** The only sanctioned way to call OpenAI. Throws OpenAiDisabledError when the feature flag is off. */
export async function guardedOpenAiFetch(feature: OpenAiFeature, url: string, init: RequestInit) {
  installGlobalOpenAiGuard();
  if (!isOpenAiFeatureEnabled(feature)) { counters.blocked += 1; throw new OpenAiDisabledError(feature); }
  return allowed.run(feature, () => globalThis.fetch(url, init));
}

installGlobalOpenAiGuard();
