export type AdaptiveReviewRecord = {
  body?: string | null;
  text?: string | null;
  title?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  [key: string]: unknown;
};

export type AdaptiveResearchDiagnostic = {
  PASS_NUMBER: number;
  QUERY: string;
  NEW_RECORDS: number;
  DEDUPED_RECORDS: number;
  GROUNDED_SIGNALS: number;
  SUFFICIENCY: "SUFFICIENT" | "NOT_ENOUGH";
  STOP_REASON: string;
};

export type AdaptiveResearchResult<T extends AdaptiveReviewRecord> = {
  records: T[];
  diagnostics: AdaptiveResearchDiagnostic[];
  stopReason: string;
  providerCalls: number;
};

type AdaptiveResearchOptions<T extends AdaptiveReviewRecord> = {
  queries: string[];
  maxCalls?: number;
  stagnantPasses?: number;
  sufficient: (records: T[]) => boolean;
  search: (query: string, passNumber: number) => Promise<string[]>;
  collect: (urls: string[], query: string, passNumber: number) => Promise<T[]>;
  exactProduct: (record: T) => boolean;
  fingerprint?: (record: T) => string;
  onDiagnostic?: (diagnostic: AdaptiveResearchDiagnostic) => void;
};

function defaultFingerprint(record: AdaptiveReviewRecord) {
  return [record.body, record.text, record.title]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runAdaptiveReviewResearch<T extends AdaptiveReviewRecord>(
  options: AdaptiveResearchOptions<T>
): Promise<AdaptiveResearchResult<T>> {
  const maxCalls = Math.max(0, Math.min(Math.round(options.maxCalls ?? 5), 5));
  const stagnantLimit = Math.max(1, Math.min(Math.round(options.stagnantPasses ?? 2), 2));
  const queries = Array.from(new Set(options.queries.map((query) => query.trim()).filter(Boolean))).slice(0, maxCalls);
  const fingerprint = options.fingerprint || defaultFingerprint;
  const records: T[] = [];
  const seen = new Set<string>();
  const diagnostics: AdaptiveResearchDiagnostic[] = [];
  let stagnant = 0;
  let providerCalls = 0;
  let stopReason = "query_ladder_exhausted";

  for (let index = 0; index < queries.length; index += 1) {
    const passNumber = index + 1;
    const query = queries[index];
    if (options.sufficient(records)) {
      stopReason = "sufficient_before_next_pass";
      break;
    }

    providerCalls += 1;
    let urls: string[] = [];
    let candidates: T[] = [];
    let retrievalFailure = false;
    try {
      urls = await options.search(query, passNumber);
      candidates = await options.collect(urls, query, passNumber);
    } catch {
      // A bounded provider/network failure is an explicit retrieval failure,
      // never a reason to manufacture evidence or continue with metadata.
      retrievalFailure = true;
    }
    const accepted = candidates.filter(options.exactProduct);
    let dedupedRecords = 0;
    let newRecords = 0;

    for (const record of accepted) {
      const key = fingerprint(record);
      if (!key || seen.has(key)) {
        dedupedRecords += 1;
        continue;
      }
      seen.add(key);
      records.push(record);
      newRecords += 1;
    }

    if (newRecords === 0) stagnant += 1;
    else stagnant = 0;

    const sufficient = options.sufficient(records);
    if (retrievalFailure) stopReason = "retrieval_failure";
    else if (sufficient) stopReason = "sufficient";
    else if (stagnant >= stagnantLimit) stopReason = "stagnant_pass_limit";
    else if (passNumber >= maxCalls || passNumber >= queries.length) stopReason = "max_web_search_calls";
    else stopReason = "continue_useful_research";

    const diagnostic: AdaptiveResearchDiagnostic = {
      PASS_NUMBER: passNumber,
      QUERY: query,
      NEW_RECORDS: newRecords,
      DEDUPED_RECORDS: dedupedRecords,
      GROUNDED_SIGNALS: records.length,
      SUFFICIENCY: sufficient ? "SUFFICIENT" : "NOT_ENOUGH",
      STOP_REASON: stopReason,
    };
    diagnostics.push(diagnostic);
    options.onDiagnostic?.(diagnostic);

    if (retrievalFailure || sufficient || stagnant >= stagnantLimit || passNumber >= maxCalls || passNumber >= queries.length) break;
  }

  if (!records.length && !diagnostics.length) stopReason = "no_research_passes_available";
  return { records, diagnostics, stopReason, providerCalls };
}
