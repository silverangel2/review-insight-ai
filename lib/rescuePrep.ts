/**
 * Rescue Prep — research-pack builder for the scan rescue queue.
 *
 * Commissioned 2026-10-16 (bot round, Junel): when a scan lands in the
 * rescue queue (no verdict — thin review evidence), this bot builds the
 * one-page research pack so Junel's personal research starts halfway
 * done. Junel is the human researcher: the pack NEVER auto-rescues, never
 * emails anyone, never changes the queue item's status.
 *
 * Three pure pieces:
 *  1. parseProductLink — thin adapter over the canonical identity library
 *     (lib/productIdentity.ts, bot round 2): marketplace + identifier →
 *     canonical library key. One parser in the codebase; this adapter keeps
 *     the rescue-scoped { marketplace, identifier, canonicalKey } shape the
 *     pack builder and its tests use.
 *  2. buildRescuePrep — pure pack builder from a queue item + RI evidence.
 *  3. prepareRescuePack — orchestration against an injected store; every
 *     store call is fail-soft (null/false), and the prep-pack table is
 *     used when present and skipped when the migration is not yet applied.
 *
 * Zero OpenAI. All pack prose is fixed template frames — no generated
 * language, no invented facts (unknowns stay "unknown").
 */

import { parseProductLink as parseCanonicalProductLink } from "./productIdentity";

export type ParsedProductLink = {
  marketplace: string;
  identifier: string;
  /** Canonical library key: `marketplace:identifier`. */
  canonicalKey: string;
};

/**
 * Rescue-scoped link parser — a thin adapter over the canonical
 * lib/productIdentity.ts. Returns the small { marketplace, identifier,
 * canonicalKey } shape (or null) that the pack builder consumes.
 * There is exactly ONE link parser in the codebase; this is not a second.
 */
export function parseProductLink(url: unknown): ParsedProductLink | null {
  const r = parseCanonicalProductLink(url);
  if (!r.ok) return null;
  return { marketplace: r.marketplace, identifier: r.identifier, canonicalKey: r.canonicalKey };
}

export type RescueQueueItem = {
  id: string;
  scan_ref: string;
  account_email?: string | null;
  product_key?: string | null;
  product_name?: string | null;
  product_url?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

export type PriorScanSummary = {
  verdict: string;
  score: number | null;
  createdAt: string | null;
};

export type RescueEvidence = {
  /** Library corpus rows for the product key (null = store unavailable). */
  libraryCorpusSize: number | null;
  libraryScanCount: number | null;
  priorScans: PriorScanSummary[];
  aggregate: { rating: number | null; count: number | null } | null;
};

export type RescuePrepPack = {
  queueId: string;
  scanRef: string;
  productName: string;
  /** Best-known canonical key (parsed link → stored product_key → "unknown"). */
  productKey: string;
  parsedLink: ParsedProductLink | null;
  customerWaiting: boolean;
  accountEmail: string | null;
  reason: string;
  /** Plain-language bullets: what RI already holds for this product. */
  whatWeHold: string[];
  /** Plain-language bullets: what is missing / unknown. */
  whatsMissing: string[];
  /** Plain-language suggested first research step for Junel. */
  suggestedFirstStep: string;
  builtAt: string;
};

const emptyEvidence: RescueEvidence = {
  libraryCorpusSize: null,
  libraryScanCount: null,
  priorScans: [],
  aggregate: null,
};

function bulletCorpusSize(size: number | null, scanCount: number | null): string | null {
  if (size === null) return "Library: couldn't check what reviews are stored (storage unavailable).";
  if (size === 0) return "Library: no stored written reviews for this product yet — it will be researched from scratch.";
  return `Library: ${size} written review${size === 1 ? "" : "s"} stored${typeof scanCount === "number" ? ` from ${scanCount} earlier scan${scanCount === 1 ? "" : "s"}` : ""}.`;
}

function bulletAggregate(agg: RescueEvidence["aggregate"]): string {
  if (!agg || (agg.rating === null && agg.count === null)) {
    return "Marketplace rating: unknown — the listing page hasn't been read for this product.";
  }
  const rating = agg.rating !== null ? `${agg.rating}/5 stars` : "no rating";
  const count = agg.count !== null ? ` from ${agg.count.toLocaleString("en-US")} ratings` : "";
  return `Marketplace rating: ${rating}${count}.`;
}

function suggestedStep(item: RescueQueueItem, parsed: ParsedProductLink | null): string {
  const name = item.product_name ? ` "${item.product_name}"` : "";
  const where = parsed ? ` on ${parsed.marketplace}` : item.product_url ? " on the original product page" : "";
  if (item.reason && /image|unreadable|blank/i.test(item.reason)) {
    return `Open the original listing page${where} for${name || " this product"} in a real browser and read the written reviews by hand — the automated read came back blank.`;
  }
  return `Search${name || " the product"}${where} and read the written buyer reviews — enough real reviews is all this one needs for a verdict.`;
}

/**
 * Pure pack builder: queue item + RI evidence → the one-page research pack.
 * No I/O, no mutation — Junel's page, in plain language.
 */
export function buildRescuePrep(
  item: RescueQueueItem,
  evidence: RescueEvidence | null
): RescuePrepPack {
  const ev = evidence ?? emptyEvidence;
  const parsed = item.product_url ? parseProductLink(item.product_url) : null;
  const normalizedKey = String(item.product_key ?? "").trim();
  const productKey = parsed?.canonicalKey ?? (normalizedKey || "unknown");
  const productName = String(item.product_name ?? "").trim() || "Unnamed product";
  const reason = String(item.reason ?? "").trim() || "not enough written reviews for a verdict";
  const accountEmail = String(item.account_email ?? "").trim() || null;

  const whatWeHold: string[] = [bulletCorpusSize(ev.libraryCorpusSize, ev.libraryScanCount)!, bulletAggregate(ev.aggregate)];
  if (ev.priorScans.length > 0) {
    const latest = ev.priorScans[0];
    whatWeHold.push(
      `Earlier scans: ${ev.priorScans.length} previous scan${ev.priorScans.length === 1 ? "" : "s"} of this product${latest.verdict ? `, most recent gave ${latest.verdict}` : ""}.`
    );
  } else {
    whatWeHold.push("Earlier scans: none — this is the first time ReviewIntel has seen this product.");
  }

  const whatsMissing: string[] = [];
  if (ev.libraryCorpusSize === 0) whatsMissing.push("Written buyer reviews — the library has none for this product.");
  if (!ev.aggregate || (ev.aggregate.rating === null && ev.aggregate.count === null)) {
    whatsMissing.push("A marketplace rating snapshot — no one has read the listing page numbers yet.");
  }
  if (!item.product_url) whatsMissing.push("The original product link — research will need the link re-supplied.");
  if (whatsMissing.length === 0) whatsMissing.push("Nothing concrete — the evidence is here, the last scan just couldn't turn it into a verdict.");

  return {
    queueId: item.id,
    scanRef: item.scan_ref,
    productName,
    productKey,
    parsedLink: parsed,
    customerWaiting: Boolean(accountEmail),
    accountEmail,
    reason,
    whatWeHold,
    whatsMissing,
    suggestedFirstStep: suggestedStep(item, parsed),
    builtAt: new Date().toISOString(),
  };
}

/** Fail-soft store surface the prep runner needs. */
export type RescuePrepStore = {
  /** Load the queue row for a scan_ref or queue id. Null when missing/unavailable. */
  loadRescueQueueItem: (ref: string) => Promise<RescueQueueItem | null>;
  /** Stored library corpus size for a product key. Null when unavailable. */
  loadLibraryCorpusSize: (productKey: string) => Promise<{ size: number | null; scanCount: number | null }>;
  /** Prior scans of the same product key, newest first. Empty when none/unavailable. */
  loadPriorScans: (productKey: string) => Promise<PriorScanSummary[]>;
  /** Stored marketplace aggregate snapshot. Null when unavailable. */
  loadAggregateSnapshot: (productKey: string) => Promise<{ rating: number | null; count: number | null } | null>;
  /** Fetch an already-built pack for this queue item (idempotency). Null when absent. */
  loadPrepPack: (queueId: string) => Promise<RescuePrepPack | null>;
  /** Persist the pack; resolves false when the table is absent or the write fails. */
  savePrepPack: (pack: RescuePrepPack) => Promise<boolean>;
};

export type PrepareRescuePackResult = {
  ok: boolean;
  pack: RescuePrepPack | null;
  /** True when a pack already existed — nothing rebuilt, nothing rewritten. */
  alreadyStored: boolean;
  /** True when the pack was persisted this run. */
  stored: boolean;
  notes: string[];
};

/**
 * Build (and persist, when the storage table exists) the research pack for
 * one pending rescue item. Fail-soft throughout: store failures become
 * "unknown" pack sections and notes, never exceptions.
 */
export async function prepareRescuePack(
  queueRef: string,
  store: RescuePrepStore
): Promise<PrepareRescuePackResult> {
  const notes: string[] = [];
  const ref = String(queueRef ?? "").trim();
  if (!ref) {
    return { ok: false, pack: null, alreadyStored: false, stored: false, notes: ["Empty queue reference."] };
  }

  let item: RescueQueueItem | null = null;
  try {
    item = await store.loadRescueQueueItem(ref);
  } catch (err) {
    notes.push(`Queue read failed: ${err instanceof Error ? err.message : String(err)}.`);
  }
  if (!item) {
    return { ok: false, pack: null, alreadyStored: false, stored: false, notes: [...notes, "No rescue-queue item found for this reference."] };
  }

  try {
    const existing = await store.loadPrepPack(item.id);
    if (existing) {
      return { ok: true, pack: existing, alreadyStored: true, stored: false, notes: ["A research pack is already stored for this item — nothing rebuilt."] };
    }
  } catch {
    notes.push("Could not check for an existing pack; building a fresh one.");
  }

  const parsed = item.product_url ? parseProductLink(item.product_url) : null;
  const key = parsed?.canonicalKey ?? String(item.product_key ?? "").trim() ?? "";

  const evidence: RescueEvidence = { ...emptyEvidence };
  if (key) {
    try {
      const lib = await store.loadLibraryCorpusSize(key);
      evidence.libraryCorpusSize = lib.size;
      evidence.libraryScanCount = lib.scanCount;
    } catch {
      notes.push("Library corpus check failed; the pack marks stored reviews as unknown.");
    }
    try {
      evidence.priorScans = await store.loadPriorScans(key);
    } catch {
      notes.push("Prior-scan lookup failed; the pack marks earlier scans as unknown.");
    }
    try {
      evidence.aggregate = await store.loadAggregateSnapshot(key);
    } catch {
      notes.push("Aggregate snapshot lookup failed; the pack marks the marketplace rating as unknown.");
    }
  } else {
    notes.push("No canonical product key could be derived — the pack works off the item's own fields.");
  }

  const pack = buildRescuePrep(item, evidence);

  let stored = false;
  try {
    stored = await store.savePrepPack(pack);
    if (!stored) notes.push("Prep-pack storage is not provisioned yet (migration not applied) — the pack is returned unstored.");
  } catch (err) {
    notes.push(`Prep-pack save failed: ${err instanceof Error ? err.message : String(err)}.`);
  }

  return { ok: true, pack, alreadyStored: false, stored, notes };
}
