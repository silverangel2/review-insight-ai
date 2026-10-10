// Fresh, polite rescan for a watched product: the same native retrieval (robots on,
// pacing, host hard-stops, Firecrawl 0, OpenAI 0) + adjudication + deterministic verdict.
// Budget-capped by the caller. Never invents a result: a failed/blocked rescan returns null.
import type { WatchSnapshot } from "./productWatches";

export type WatchTarget = { listingUrl: string; productName: string; brand?: string | null; model?: string | null };
export type RescanDeps = {
  retrieve: (input: { productTitle: string; brand?: string | null; model?: string | null; listingUrl: string; politeDelayMs: number }) => Promise<{ reviews?: unknown[] }>;
  adjudicate: (reviews: unknown[], opts: Record<string, unknown>) => { acceptedRecords: unknown[] };
  derive: (input: Record<string, unknown>) => { verdict?: string | null; acceptedCorpusHash?: string | null };
};

export function watchRescanBudget(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.REVIEWINTEL_WATCH_RESCAN_BUDGET ?? 5);
  return Number.isFinite(n) ? Math.max(0, Math.min(25, Math.floor(n))) : 5;
}

async function defaultDeps(): Promise<RescanDeps> {
  const [nat, adj, det] = await Promise.all([import("./nativeReviewRetrieval"), import("./reviewEvidenceAdjudication"), import("./reviewEvidenceDeterminism")]);
  return {
    retrieve: (i) => nat.runNativeReviewRetrieval(i as Parameters<typeof nat.runNativeReviewRetrieval>[0]) as Promise<{ reviews?: unknown[] }>,
    adjudicate: (r, o) => adj.adjudicateReviewEvidence(r as never, o as never) as unknown as { acceptedRecords: unknown[] },
    derive: (i) => det.deriveDeterministicEvidenceResult(i as never) as unknown as { verdict?: string | null; acceptedCorpusHash?: string | null },
  };
}

export async function rescanWatchedProduct(target: WatchTarget, deps?: RescanDeps): Promise<WatchSnapshot | null> {
  const d = deps || await defaultDeps();
  try {
    const retrieved = await d.retrieve({ productTitle: target.productName, brand: target.brand ?? null, model: target.model ?? null, listingUrl: target.listingUrl, politeDelayMs: 600 });
    const opts = { productName: target.productName, brand: target.brand ?? null, model: target.model ?? null, exactListingAccepted: true, exactListingUrl: target.listingUrl, exactListingTitle: target.productName };
    const corpus = d.adjudicate(retrieved.reviews || [], opts);
    const result = d.derive({ exactProductAccepted: true, rating: null, marketplaceReviewCount: 0, price: null, acceptedRecords: corpus.acceptedRecords });
    if (!result?.acceptedCorpusHash) return null;
    return { verdict: result.verdict ?? null, acceptedCount: corpus.acceptedRecords.length, resultHash: result.acceptedCorpusHash };
  } catch {
    return null; // blocked/failed: no alert, try again next run
  }
}
