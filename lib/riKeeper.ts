/**
 * RI Keeper v1 — ReviewIntel's internal maintenance bot.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FAMILY RESIDENCY RULE (Junel, 2026-10-16, verbatim commission):
 * "All of your bots family should live within the website."
 * Every RI bot is an in-website resident: it acts AS ReviewIntel, on
 * ReviewIntel's OWN data, through ReviewIntel's OWN configured channels
 * only. It never operates accounts on external platforms and never acts
 * outside RI's product boundary. The keeper inherits this rule; every
 * future bot must follow it.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * What the keeper is: a lane-health watcher for RI's own pipes. It was
 * commissioned because built-but-inert lanes went unnoticed — Junel's
 * hand-fed owner batches sat un-ingested for a day, and the community lane
 * has never had a confirmed end-to-end flow. The keeper watches those
 * pipes, fixes the small safe things itself, and escalates the rest with
 * a diagnosis.
 *
 * THE WALL (operationalized):
 *  - RI scope only. Reads/writes RI's own Supabase tables and RI's own
 *    server code paths. No external network calls except RI's configured
 *    service email (lib/emailDelivery) and the existing Junel alert seam
 *    (the ops ledger the admin Operations view reads).
 *  - No code changes, no deploys, no schema changes, no env changes —
 *    at RUNTIME the keeper never modifies itself or the app. (This build
 *    task is the one place where app code changes, under Junel's tap.)
 *  - Repairs are a WHITELIST of data-level, reversible, idempotent
 *    operations only. Anything not on the whitelist = diagnose +
 *    escalate, never improvise.
 *  - Every action writes to the ops ledger with before/after evidence.
 *    Repairs per run are capped; a repair that fails twice stops and
 *    escalates.
 *  - Kill switches: RI_KEEPER_ENABLED (checks; default ON),
 *    RI_KEEPER_REPAIRS_ENABLED (repairs; default OFF — repairs require
 *    explicit enable).
 *  - Zero OpenAI. "Intelligence" = diagnosis quality: every escalation
 *    names the lane, the evidence, the likely cause class, and the exact
 *    human action needed.
 */
import {
  COMMUNITY_REVIEWS_TABLE,
  feedTierAReviewsToLibrary,
  listAllCommunityReviews,
} from "@/lib/communityReviews";
import { ingestOwnerFeedBatchLive, OWNER_FEED_PROVENANCE } from "@/lib/ownerFeedIngest";
import {
  PRODUCT_REVIEW_LIBRARY_TABLE,
  loadLibraryCorpus,
} from "@/lib/productReviewLibrary";
import { listRescueQueue, RESCUE_QUEUE_TABLE } from "@/lib/rescueQueue";
import { sendReviewIntelEmail, SUPPORT_EMAIL } from "@/lib/emailDelivery";
import { isSupabaseConfigured, supabaseCount, supabaseSelect } from "@/lib/supabaseServer";
import {
  CHECK_BATCH_REGISTERED,
  CHECK_RUN_SUMMARY,
  keeperConsecutiveRepairFailures,
  keeperEvidence,
  keeperJobFinish,
  keeperJobStart,
  keeperLatestEvidence,
  repairCheckId,
  type KeeperLedgerHandle,
} from "@/lib/riKeeperLedger";

// ── Statuses & reports ───────────────────────────────────────────────────

export type LaneStatus = "healthy" | "degraded" | "down" | "unknown";

export type LaneReport = {
  lane: string;
  status: LaneStatus;
  message: string;
  evidence: Record<string, unknown>;
  repairKey?: string;
  escalation?: {
    likelyCause: string;
    humanAction: string;
  };
};

export type KeeperReport = {
  ok: boolean;
  enabled: boolean;
  repairsEnabled: boolean;
  ranAt: string;
  lanes: LaneReport[];
  repairs: Array<{
    repairKey: string;
    status: "done" | "skipped" | "failed" | "refused";
    before: unknown;
    after: unknown;
    message: string;
  }>;
  escalations: Array<{ lane: string; message: string; humanAction: string }>;
  ledger: { jobId: string | null; attemptId: string | null; ledgerAvailable: boolean };
  openAiCalls: 0;
};

// ── Whitelist ────────────────────────────────────────────────────────────

/** The ONLY repairs the keeper may ever perform. Not on this list = refused. */
export const WHITELISTED_REPAIRS = ["owner_feed_reingest", "tier_a_promote"] as const;
export type WhitelistedRepair = (typeof WHITELISTED_REPAIRS)[number];

export class KeeperRefusedError extends Error {
  readonly code = "KEEPER_REPAIR_REFUSED";
  constructor(repairKey: string) {
    super(
      `keeper refused repair "${repairKey}": not on the v1 whitelist (${WHITELISTED_REPAIRS.join(", ")}). Diagnosis recorded; escalation required.`
    );
  }
}

export function assertWhitelisted(repairKey: string): asserts repairKey is WhitelistedRepair {
  if (!(WHITELISTED_REPAIRS as readonly string[]).includes(repairKey)) {
    throw new KeeperRefusedError(repairKey);
  }
}

// ── Config ───────────────────────────────────────────────────────────────

export type KeeperConfig = {
  enabled: boolean;
  repairsEnabled: boolean;
  maxRepairsPerRun: number;
  pendingDegradedDays: number;
  pendingDownDays: number;
  rescueDegradedHours: number;
  rescueDownDays: number;
  emailEscalations: boolean;
};

export function keeperConfig(env: NodeJS.ProcessEnv = process.env): KeeperConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
  };
  return {
    enabled: (env.RI_KEEPER_ENABLED ?? "1") !== "0",
    repairsEnabled: env.RI_KEEPER_REPAIRS_ENABLED === "1",
    maxRepairsPerRun: num(env.RI_KEEPER_MAX_REPAIRS_PER_RUN, 2),
    pendingDegradedDays: num(env.RI_KEEPER_PENDING_DEGRADED_DAYS, 7),
    pendingDownDays: num(env.RI_KEEPER_PENDING_DOWN_DAYS, 21),
    rescueDegradedHours: num(env.RI_KEEPER_RESCUE_DEGRADED_HOURS, 48),
    rescueDownDays: num(env.RI_KEEPER_RESCUE_DOWN_DAYS, 7),
    emailEscalations: (env.RI_KEEPER_EMAIL_ESCALATIONS ?? "1") !== "0",
  };
}

// ── Batch registry ───────────────────────────────────────────────────────

export type BatchRegistration = {
  batchId: string;
  batchLabel: string;
  productKey: string;
  /** Reviews the ingest receipt said were ingested (the achievable max). */
  expectedIngested: number;
  /** Stored batch text; the seed batches may lack it (see below). */
  batchText?: string;
  registeredAt?: string;
};

/**
 * The two Oct-15 batches the keeper was commissioned to catch. These are
 * registration placeholders: the real registration rows (with stored batch
 * text) are written to the ops ledger by the owner-feed ingest route on
 * every successful ingest; the ledger wins when both exist.
 */
export const KNOWN_BATCHES: BatchRegistration[] = [
  {
    batchId: "owner-feed-2026-10-15-airpods",
    batchLabel: "AirPods 4 owner-feed batch (2026-10-15 14:12)",
    productKey: "amazon.ca:B0DGJDKHRQ",
    expectedIngested: 73,
  },
  {
    batchId: "owner-feed-2026-10-15-dreo",
    batchLabel: "DREO heater owner-feed batch (2026-10-15 14:18)",
    productKey: "amazon.ca:B097RG67QB",
    expectedIngested: 49,
  },
];

function recordProvenance(record: Record<string, unknown>): string | null {
  const p = record.provenance;
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    const s = (p as Record<string, unknown>).source;
    if (typeof s === "string") return s;
  }
  return null;
}

function isOwnerFedRecord(record: Record<string, unknown>): boolean {
  return recordProvenance(record) === OWNER_FEED_PROVENANCE;
}

function isCommunityRecord(record: Record<string, unknown>, communityId: string): boolean {
  return String(record.reviewId || "") === `community-${communityId}`;
}

// ── Injected runtime (tests control env/now; routes pass nothing) ────────

export type KeeperRuntime = {
  env: NodeJS.ProcessEnv;
  now: () => number;
};

function dayMs(n: number): number {
  return n * 24 * 60 * 60 * 1000;
}
function hourMs(n: number): number {
  return n * 60 * 60 * 1000;
}

// ── Lane checks ──────────────────────────────────────────────────────────

async function readRegistrations(seedBatches: BatchRegistration[]): Promise<BatchRegistration[]> {
  const rows = await keeperLatestEvidence(CHECK_BATCH_REGISTERED, 200);
  const byId = new Map<string, BatchRegistration>();
  for (const row of rows) {
    const d = (row.details || {}) as Record<string, unknown>;
    const batchId = String(d.batchId || "");
    if (!batchId || byId.has(batchId)) continue;
    byId.set(batchId, {
      batchId,
      batchLabel: String(d.batchLabel || batchId),
      productKey: String(d.productKey || ""),
      expectedIngested: Number(d.expectedIngested ?? d.ingested ?? 0) || 0,
      batchText: typeof d.batchText === "string" ? d.batchText : undefined,
      registeredAt: String(row.created_at || ""),
    });
  }
  // Seed batches fill gaps; ledger registrations win on conflict.
  for (const seed of seedBatches) {
    if (!byId.has(seed.batchId)) byId.set(seed.batchId, { ...seed });
  }
  return [...byId.values()];
}

/** (a) OWNER-FEED RECONCILIATION — the exact Oct-15 failure, surfaced. */
export async function checkOwnerFeed(
  seedBatches: BatchRegistration[] = KNOWN_BATCHES
): Promise<LaneReport> {
  if (!isSupabaseConfigured()) {
    return {
      lane: "owner_feed",
      status: "unknown",
      message: "Store not configured; reconciliation skipped (fail-soft).",
      evidence: {},
    };
  }
  const registrations = await readRegistrations(seedBatches);
  const batches = [];
  let missingTotal = 0;
  for (const reg of registrations) {
    if (!reg.productKey) continue;
    const corpus = await loadLibraryCorpus(reg.productKey);
    const ownerFed = corpus.reviews.filter((r) =>
      isOwnerFedRecord(r as Record<string, unknown>)
    ).length;
    const missing = Math.max(0, reg.expectedIngested - ownerFed);
    missingTotal += missing;
    batches.push({
      batchId: reg.batchId,
      productKey: reg.productKey,
      expectedIngested: reg.expectedIngested,
      ownerFedInCorpus: ownerFed,
      missing,
      repairable: missing > 0 && Boolean(reg.batchText),
    });
  }
  const worst = batches.find((b) => b.missing > 0);
  if (worst) {
    return {
      lane: "owner_feed",
      status: "down",
      message: `Fed but not ingested: ${batches.length} registered batch(es), ${missingTotal} review(s) missing from the library (worst: ${worst.batchId}, missing ${worst.missing}/${worst.expectedIngested}).`,
      evidence: { batches, missingTotal },
      repairKey: "owner_feed_reingest",
      escalation: {
        likelyCause:
          "A batch reached the inbox but never completed ingestion (the Oct-15 failure mode).",
        humanAction: worst.repairable
          ? "Enable RI_KEEPER_REPAIRS_ENABLED=1 so the keeper re-runs the stored batch text, or re-ingest via /admin/owner-feed."
          : "The stored registration lacks the batch text, so the keeper cannot self-repair — re-ingest the batch file via /admin/owner-feed.",
      },
    };
  }
  return {
    lane: "owner_feed",
    status: "healthy",
    message: `${batches.length} registered batch(es); all expected reviews present in the library.`,
    evidence: { batches },
  };
}

/** (b) COMMUNITY FLOW — stuck pendings + Tier-A-to-library gaps. */
export async function checkCommunity(cfg: KeeperConfig, nowMs: number): Promise<LaneReport> {
  if (!isSupabaseConfigured()) {
    return {
      lane: "community",
      status: "unknown",
      message: "Store not configured; community check skipped (fail-soft).",
      evidence: {},
    };
  }
  const reviews = await listAllCommunityReviews(500);
  const pending = reviews.filter((r) => r.status === "pending");
  const oldestPendingMs = pending.length
    ? Math.min(...pending.map((r) => new Date(String(r.created_at || 0)).getTime()).filter(Number.isFinite))
    : 0;
  const oldestAgeDays = oldestPendingMs ? (nowMs - oldestPendingMs) / dayMs(1) : 0;

  // Tier-A gap: approved + purchase-verified rows whose community-<id>
  // reviewId is not yet in the product corpus.
  const tierA = reviews.filter((r) => r.status === "approved" && r.verified_purchase);
  const tierAGaps: Array<{ productKey: string; communityId: string }> = [];
  const keysChecked = new Set<string>();
  for (const row of tierA) {
    if (keysChecked.has(row.product_key)) continue;
    keysChecked.add(row.product_key);
    const corpus = await loadLibraryCorpus(row.product_key);
    for (const r2 of tierA.filter((x) => x.product_key === row.product_key)) {
      const fed = corpus.reviews.some((rec) =>
        isCommunityRecord(rec as Record<string, unknown>, r2.id)
      );
      if (!fed) tierAGaps.push({ productKey: row.product_key, communityId: r2.id });
    }
  }

  const evidence = {
    total: reviews.length,
    pending: pending.length,
    oldestPendingDays: Math.round(oldestAgeDays * 10) / 10,
    approved: reviews.filter((r) => r.status === "approved").length,
    tierAGapCount: tierAGaps.length,
    tierAGaps: tierAGaps.slice(0, 25),
  };

  if (pending.length > 0 && oldestAgeDays >= cfg.pendingDownDays) {
    return {
      lane: "community",
      status: "down",
      message: `${pending.length} submission(s) stuck in pending; oldest is ${Math.round(oldestAgeDays)} days old (down threshold ${cfg.pendingDownDays}d).`,
      evidence,
      escalation: {
        likelyCause: "Moderation never ran on these submissions.",
        humanAction: "Moderate the pending reviews at the admin community view.",
      },
    };
  }
  if (tierAGaps.length > 0 || (pending.length > 0 && oldestAgeDays >= cfg.pendingDegradedDays)) {
    return {
      lane: "community",
      status: "degraded",
      message:
        tierAGaps.length > 0
          ? `${tierAGaps.length} Tier-A review(s) approved but not yet in the library corpus.`
          : `${pending.length} submission(s) pending; oldest ${Math.round(oldestAgeDays)} days (degraded threshold ${cfg.pendingDegradedDays}d).`,
      evidence,
      repairKey: tierAGaps.length > 0 ? "tier_a_promote" : undefined,
      escalation: {
        likelyCause:
          tierAGaps.length > 0
            ? "Tier-A promotion did not run after approval."
            : "Moderation is slow.",
        humanAction:
          tierAGaps.length > 0
            ? "Enable RI_KEEPER_REPAIRS_ENABLED=1 so the keeper re-runs Tier-A promotion, or approve/promote via the admin view."
            : "Moderate the pending reviews at the admin community view.",
      },
    };
  }
  return {
    lane: "community",
    status: "healthy",
    message: `Community flow nominal: ${pending.length} pending, ${tierA.length} Tier-A approved and fed.`,
    evidence,
  };
}

export type LibraryTotals = {
  corpora: number;
  reviews: number;
  scanCount: number;
  recentlySeen24h: number;
};

export async function readLibraryTotals(nowMs: number): Promise<LibraryTotals | null> {
  if (!isSupabaseConfigured()) return null;
  const rows = await supabaseSelect<Record<string, unknown>>(
    PRODUCT_REVIEW_LIBRARY_TABLE,
    "select=review_count,scan_count,last_seen_at,updated_at&limit=2000"
  );
  if (!Array.isArray(rows)) return null;
  let reviews = 0;
  let scanCount = 0;
  let recent = 0;
  for (const row of rows) {
    reviews += Number(row.review_count) || 0;
    scanCount += Number(row.scan_count) || 0;
    const seen = new Date(String(row.last_seen_at || row.updated_at || 0)).getTime();
    if (Number.isFinite(seen) && nowMs - seen <= dayMs(1)) recent += 1;
  }
  return { corpora: rows.length, reviews, scanCount, recentlySeen24h: recent };
}

/** (c) LIBRARY GROWTH + (e) SCAN ACTIVITY share one totals read. */
export function checkLibraryGrowth(
  totals: LibraryTotals | null,
  previous: Record<string, unknown> | null
): LaneReport {
  const evidence = { totals, previous };
  if (!totals) {
    return {
      lane: "library_growth",
      status: "unknown",
      message: "Library totals unreadable; growth check skipped (fail-soft).",
      evidence,
    };
  }
  if (!previous || typeof previous.reviews !== "number") {
    return {
      lane: "library_growth",
      status: "healthy",
      message: `Baseline recorded: ${totals.corpora} corpora, ${totals.reviews} reviews, ${totals.scanCount} scans.`,
      evidence,
    };
  }
  const prevReviews = Number(previous.reviews);
  const prevScans = Number(previous.scanCount) || 0;
  if (totals.reviews <= prevReviews && totals.scanCount > prevScans) {
    return {
      lane: "library_growth",
      status: "degraded",
      message: `Library flat at ${totals.reviews} reviews while scans ran (${prevScans} → ${totals.scanCount}) — scans are not feeding the library.`,
      evidence,
      escalation: {
        likelyCause: "The scan path's library save is failing or being skipped.",
        humanAction: "Check the analyze path's saveLibraryCorpus write (logs + a live scan payload).",
      },
    };
  }
  return {
    lane: "library_growth",
    status: "healthy",
    message: `Library growing: ${prevReviews} → ${totals.reviews} reviews across ${totals.corpora} corpora.`,
    evidence,
  };
}

/** (d) RESCUE QUEUE — pending age. The keeper never repairs; Junel is the researcher. */
export async function checkRescueQueue(
  cfg: KeeperConfig,
  nowMs: number
): Promise<LaneReport> {
  if (!isSupabaseConfigured()) {
    return {
      lane: "rescue_queue",
      status: "unknown",
      message: "Store not configured; rescue check skipped (fail-soft).",
      evidence: {},
    };
  }
  let pending: Array<{ id: string; createdAt: string }> = [];
  try {
    const rows = await listRescueQueue("pending", 200);
    pending = rows.map((r) => ({ id: String(r.id), createdAt: String(r.created_at || "") }));
  } catch {
    return {
      lane: "rescue_queue",
      status: "unknown",
      message: `Could not read ${RESCUE_QUEUE_TABLE}; rescue check skipped (fail-soft).`,
      evidence: {},
    };
  }
  const ages = pending
    .map((p) => (nowMs - new Date(p.createdAt).getTime()) / hourMs(1))
    .filter(Number.isFinite);
  const oldestHours = ages.length ? Math.max(...ages) : 0;
  const evidence = { pending: pending.length, oldestHours: Math.round(oldestHours * 10) / 10 };
  if (pending.length > 0 && oldestHours >= cfg.rescueDownDays * 24) {
    return {
      lane: "rescue_queue",
      status: "down",
      message: `${pending.length} rescue(s) pending; oldest ${Math.round(oldestHours / 24)} days old — a shopper is waiting on Junel's research.`,
      evidence,
      escalation: {
        likelyCause: "Junel has not researched the queued product(s).",
        humanAction: "Open the admin rescue view, research the product, paste reviews, rescore.",
      },
    };
  }
  if (pending.length > 0 && oldestHours >= cfg.rescueDegradedHours) {
    return {
      lane: "rescue_queue",
      status: "degraded",
      message: `${pending.length} rescue(s) pending; oldest ${Math.round(oldestHours)}h (degraded threshold ${cfg.rescueDegradedHours}h).`,
      evidence,
      escalation: {
        likelyCause: "Junel has not researched the queued product(s) yet.",
        humanAction: "The existing 2h rescue alert cron already pings Junel; this is the keeper's corroboration.",
      },
    };
  }
  return {
    lane: "rescue_queue",
    status: "healthy",
    message: pending.length ? `${pending.length} pending, all fresh.` : "Rescue queue empty.",
    evidence,
  };
}

// ── Repairs (whitelisted only) ───────────────────────────────────────────

export type RepairOutcome = {
  repairKey: string;
  status: "done" | "skipped" | "failed" | "refused";
  before: unknown;
  after: unknown;
  message: string;
};

async function repairOwnerFeedReingest(lane: LaneReport, cfg: KeeperConfig): Promise<RepairOutcome> {
  assertWhitelisted("owner_feed_reingest");
  const batches = (lane.evidence.batches || []) as Array<Record<string, unknown>>;
  const registrations = await readRegistrations(KNOWN_BATCHES);
  const regById = new Map(registrations.map((r) => [r.batchId, r]));
  const results: Array<Record<string, unknown>> = [];
  let repaired = 0;
  for (const batch of batches.filter((b) => Number(b.missing) > 0)) {
    if (repaired >= cfg.maxRepairsPerRun) break;
    const reg = regById.get(String(batch.batchId));
    const before = { missing: batch.missing, ownerFedInCorpus: batch.ownerFedInCorpus };
    if (!reg || !reg.batchText) {
      results.push({ batchId: batch.batchId, status: "skipped", reason: "no stored batch text; cannot self-repair" });
      continue;
    }
    try {
      const receipt = await ingestOwnerFeedBatchLive(reg.batchText);
      const corpus = await loadLibraryCorpus(reg.productKey);
      const ownerFed = corpus.reviews.filter((r) =>
        isOwnerFedRecord(r as Record<string, unknown>)
      ).length;
      const after = { ingested: receipt.ingested, ownerFedInCorpus: ownerFed, missing: Math.max(0, reg.expectedIngested - ownerFed) };
      results.push({ batchId: batch.batchId, status: "done", before, after });
      if (Number(after.missing) === 0) repaired += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ batchId: batch.batchId, status: "failed", before, error: message });
    }
  }
  const failed = results.filter((r) => r.status === "failed").length;
  const done = results.filter((r) => r.status === "done").length;
  return {
    repairKey: "owner_feed_reingest",
    status: failed > 0 && done === 0 ? "failed" : done > 0 ? "done" : "skipped",
    before: { missingBatches: batches.filter((b) => Number(b.missing) > 0).length },
    after: { results },
    message:
      done > 0
        ? `Re-ingested ${done} batch(es).`
        : failed > 0
          ? `Repair failed on ${failed} batch(es); escalated.`
          : "Nothing repairable (no stored batch text).",
  };
}

async function repairTierAPromote(lane: LaneReport, cfg: KeeperConfig): Promise<RepairOutcome> {
  assertWhitelisted("tier_a_promote");
  const gaps = (lane.evidence.tierAGaps || []) as Array<{ productKey: string }>;
  const keys = [...new Set(gaps.map((g) => g.productKey))].slice(0, cfg.maxRepairsPerRun);
  // The community module's own promotion is the repair — the keeper never
  // reimplements lane logic; it reuses the lane's own idempotent function.
  const results: Array<Record<string, unknown>> = [];
  for (const key of keys) {
    try {
      const before = (await loadLibraryCorpus(key)).reviews.length;
      const { fed, fedCount } = await feedTierAReviewsToLibrary(key);
      const after = (await loadLibraryCorpus(key)).reviews.length;
      results.push({ productKey: key, fed, fedCount, before, after });
    } catch (error) {
      results.push({ productKey: key, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const fedTotal = results.reduce((n, r) => n + (Number(r.fedCount) || 0), 0);
  const failed = results.filter((r) => r.status === "failed").length;
  return {
    repairKey: "tier_a_promote",
    status: failed > 0 && fedTotal === 0 ? "failed" : fedTotal > 0 ? "done" : "skipped",
    before: { gapKeys: keys.length },
    after: { results, fedTotal },
    message: `Tier-A promotion ran for ${keys.length} product key(s); ${fedTotal} review(s) fed.`,
  };
}

async function maybeRepair(
  lane: LaneReport,
  cfg: KeeperConfig,
  nowMs: number,
  ledger: KeeperLedgerHandle | null,
  repairsDone: number
): Promise<{ outcome: RepairOutcome | null; repairsDone: number }> {
  if (!lane.repairKey) return { outcome: null, repairsDone };
  const repairKey = lane.repairKey;
  // Whitelist: a lane naming a non-whitelisted repair is refused, loudly.
  try {
    assertWhitelisted(repairKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ledger) {
      await keeperEvidence(ledger, repairCheckId(repairKey), "Repair refused (not whitelisted)", "fail", message, {
        lane: lane.lane,
      });
    }
    return {
      outcome: { repairKey, status: "refused", before: null, after: null, message },
      repairsDone,
    };
  }
  if (!cfg.repairsEnabled) {
    return {
      outcome: {
        repairKey,
        status: "skipped",
        before: null,
        after: null,
        message: "Repairs disabled (RI_KEEPER_REPAIRS_ENABLED is not 1); escalation recorded.",
      },
      repairsDone,
    };
  }
  if (repairsDone >= cfg.maxRepairsPerRun) {
    return {
      outcome: {
        repairKey,
        status: "skipped",
        before: null,
        after: null,
        message: `Per-run repair cap reached (${cfg.maxRepairsPerRun}); escalation recorded.`,
      },
      repairsDone,
    };
  }
  const consecutiveFailures = await keeperConsecutiveRepairFailures(repairKey);
  if (consecutiveFailures >= 2) {
    const message = `Repair "${repairKey}" failed ${consecutiveFailures} consecutive time(s); stopped. Human must intervene.`;
    if (ledger) {
      await keeperEvidence(ledger, repairCheckId(repairKey), "Repair stopped (fail-twice rule)", "fail", message, {
        lane: lane.lane,
        consecutiveFailures,
      });
    }
    return { outcome: { repairKey, status: "skipped", before: null, after: null, message }, repairsDone };
  }
  let outcome: RepairOutcome;
  try {
    outcome =
      repairKey === "owner_feed_reingest"
        ? await repairOwnerFeedReingest(lane, cfg)
        : await repairTierAPromote(lane, cfg);
  } catch (error) {
    outcome = {
      repairKey,
      status: "failed",
      before: null,
      after: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (ledger) {
    await keeperEvidence(
      ledger,
      repairCheckId(repairKey),
      `Repair ${repairKey}`,
      outcome.status === "done" ? "pass" : outcome.status === "skipped" ? "warning" : "fail",
      outcome.message,
      { lane: lane.lane, before: outcome.before ?? null, after: outcome.after ?? null }
    );
  }
  return { outcome, repairsDone: repairsDone + (outcome.status === "done" ? 1 : 0) };
}

// ── Escalation ───────────────────────────────────────────────────────────

function escalationFor(lane: LaneReport, repairOutcome: RepairOutcome | null): { message: string; humanAction: string } | null {
  if (lane.status !== "down" && lane.status !== "degraded") return null;
  const esc = lane.escalation;
  const repairNote = repairOutcome
    ? ` Repair "${repairOutcome.repairKey}": ${repairOutcome.status} — ${repairOutcome.message}`
    : lane.repairKey
      ? ` No whitelisted repair applies automatically.`
      : ``;
  return {
    message: `${lane.lane}: ${lane.message}${repairNote}`,
    humanAction: esc?.humanAction || "Investigate via the admin Operations view.",
  };
}

async function sendEscalationEmail(
  cfg: KeeperConfig,
  escalations: Array<{ lane: string; message: string; humanAction: string }>,
  ranAt: string
): Promise<boolean> {
  if (!cfg.emailEscalations || escalations.length === 0) return false;
  try {
    const items = escalations
      .map(
        (e) =>
          `<li><strong>${escapeHtml(e.lane)}</strong>: ${escapeHtml(e.message)}<br/>Human action: ${escapeHtml(e.humanAction)}</li>`
      )
      .join("");
    const result = await sendReviewIntelEmail({
      emailType: "keeper_escalation",
      to: SUPPORT_EMAIL,
      subject: `ReviewIntel Keeper: ${escalations.length} escalation(s) need you`,
      html: `<p>The RI Keeper found ${escalations.length} issue(s) at ${escapeHtml(ranAt)}:</p><ul>${items}</ul><p>Details are in the admin Operations view (ops ledger, job type keeper_run). This email was sent by ReviewIntel's own maintenance bot — it never acts outside RI.</p>`,
      text: `ReviewIntel Keeper escalations (${ranAt}):\n${escalations.map((e) => `- ${e.lane}: ${e.message}\n  Human action: ${e.humanAction}`).join("\n")}`,
    });
    return Boolean(result && (result as { ok?: boolean }).ok);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Orchestration ────────────────────────────────────────────────────────

/**
 * Run one keeper pass. Never throws — every failure mode degrades into
 * the report (the wall demands a watcher that cannot itself break the
 * site: it only reads tables, writes ledger rows, and (if enabled) runs
 * whitelisted idempotent repairs).
 */
export async function runKeeper(runtime: Partial<KeeperRuntime> = {}): Promise<KeeperReport> {
  const env = runtime.env ?? process.env;
  const nowMs = runtime.now ? runtime.now() : Date.now();
  const ranAt = new Date(nowMs).toISOString();
  const cfg = keeperConfig(env);

  const empty: KeeperReport = {
    ok: true,
    enabled: cfg.enabled,
    repairsEnabled: cfg.repairsEnabled,
    ranAt,
    lanes: [],
    repairs: [],
    escalations: [],
    ledger: { jobId: null, attemptId: null, ledgerAvailable: false },
    openAiCalls: 0,
  };
  if (!cfg.enabled) return empty;

  let ledger: KeeperLedgerHandle | null = null;
  try {
    ledger = await keeperJobStart();
  } catch {
    ledger = null;
  }
  empty.ledger.ledgerAvailable = Boolean(ledger);
  if (ledger) {
    empty.ledger.jobId = ledger.jobId;
    empty.ledger.attemptId = ledger.attemptId;
  }

  const lanes: LaneReport[] = [];
  const runOne = async (name: string, fn: () => Promise<LaneReport>): Promise<void> => {
    try {
      lanes.push(await fn());
    } catch (error) {
      lanes.push({
        lane: name,
        status: "unknown",
        message: `Check crashed safely: ${error instanceof Error ? error.message : String(error)}`,
        evidence: {},
      });
    }
  };

  await runOne("owner_feed", checkOwnerFeed);
  await runOne("community", () => checkCommunity(cfg, nowMs));
  const totals = await readLibraryTotals(nowMs).catch(() => null);
  let previous: Record<string, unknown> | null = null;
  if (ledger) {
    const rows = await keeperLatestEvidence(CHECK_RUN_SUMMARY, 5);
    const latest = rows.find((r) => r.details && typeof (r.details as Record<string, unknown>).totals === "object");
    if (latest) previous = (latest.details as Record<string, unknown>).totals as Record<string, unknown>;
  }
  lanes.push(checkLibraryGrowth(totals, previous));
  await runOne("rescue_queue", () => checkRescueQueue(cfg, nowMs));
  // Scan activity rides the same totals read (recentlySeen24h).
  lanes.push({
    lane: "scan_activity",
    status: !totals ? "unknown" : totals.recentlySeen24h > 0 ? "healthy" : "degraded",
    message: !totals
      ? "Library totals unreadable; scan activity unknown (fail-soft)."
      : totals.recentlySeen24h > 0
        ? `${totals.recentlySeen24h} product(s) scanned in the last 24h.`
        : "No product scanned in the last 24h.",
    evidence: { totals },
    escalation:
      totals && totals.recentlySeen24h === 0
        ? {
            likelyCause: "No scans are reaching the site, or the collector is blocked.",
            humanAction: "Check the scan page and run one live scan.",
          }
        : undefined,
  });
  empty.lanes = lanes;

  // Repairs (whitelisted only, capped, fail-twice stopped).
  let repairsDone = 0;
  for (const lane of lanes) {
    const { outcome, repairsDone: next } = await maybeRepair(lane, cfg, nowMs, ledger, repairsDone);
    repairsDone = next;
    if (outcome) empty.repairs.push(outcome);
  }

  // Escalations: every down/degraded lane.
  for (const lane of lanes) {
    const repairOutcome = empty.repairs.find((r) => r.repairKey === lane.repairKey) || null;
    const esc = escalationFor(lane, repairOutcome);
    if (esc) empty.escalations.push({ lane: lane.lane, message: esc.message, humanAction: esc.humanAction });
  }

  // Ledger: check rows, repair rows (written inline), escalation rows, summary.
  if (ledger) {
    for (const lane of lanes) {
      const status =
        lane.status === "healthy" ? "pass" : lane.status === "unknown" ? "info" : lane.status === "degraded" ? "warning" : "fail";
      await keeperEvidence(ledger, `keeper.check.${lane.lane}`, `Keeper check: ${lane.lane}`, status, lane.message, lane.evidence);
    }
    for (const esc of empty.escalations) {
      await keeperEvidence(ledger, "keeper.escalation", `Escalation: ${esc.lane}`, "fail", esc.message, {
        lane: esc.lane,
        humanAction: esc.humanAction,
      });
    }
    await keeperEvidence(ledger, CHECK_RUN_SUMMARY, "Keeper run summary", "info", `Keeper run: ${lanes.length} lanes checked, ${empty.repairs.length} repair(s), ${empty.escalations.length} escalation(s).`, {
      totals: totals ?? null,
      laneStatuses: Object.fromEntries(lanes.map((l) => [l.lane, l.status])),
      repairs: empty.repairs.map((r) => ({ repairKey: r.repairKey, status: r.status })),
    });
  }

  // Email: one consolidated escalation email (the keeper's Junel alert
  // seam alongside the ledger; the 2h rescue cron pattern already proves
  // email-to-Junel works on this site).
  const emailSent = await sendEscalationEmail(cfg, empty.escalations, ranAt).catch(() => false);
  if (ledger && emailSent) {
    await keeperEvidence(ledger, "keeper.email", "Escalation email sent", "info", `Sent ${empty.escalations.length} escalation(s) to ${SUPPORT_EMAIL}.`, {});
  }

  if (ledger) {
    const failed = lanes.filter((l) => l.status === "down").length;
    await keeperJobFinish(
      ledger,
      failed > 0 ? "FAILED" : "COMPLETED",
      lanes.length,
      lanes.filter((l) => l.status === "healthy").length,
      `Keeper run: ${lanes.length} lanes, ${empty.repairs.filter((r) => r.status === "done").length} repair(s) done, ${empty.escalations.length} escalation(s).`
    );
  }
  return empty;
}

/** Used by tests and the route's self-check: refuses anything off-whitelist. */
export function keeperRepairWhitelist(): readonly string[] {
  return WHITELISTED_REPAIRS;
}

// Re-export for the route's import surface.
export { COMMUNITY_REVIEWS_TABLE, RESCUE_QUEUE_TABLE, PRODUCT_REVIEW_LIBRARY_TABLE };
