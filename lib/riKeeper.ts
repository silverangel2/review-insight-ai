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
  qaDefectCheckId,
  runQaInspectorLane,
  type QaInspectorStore,
  type QaLedgerWriter,
} from "@/lib/qaInspectorLane";
import {
  prepareRescuePack,
  type PrepareRescuePackResult,
  type RescuePrepStore,
  type RescueQueueItem,
} from "@/lib/rescuePrep";
import { rescuePrepStore } from "@/lib/rescuePrepStore";
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
  /** Reviews the ingest receipt said were stored (receipt.added, post-Fix-A).
   *  Seed batches still carry the old parsed count; they have no diagnostics. */
  expectedIngested: number;
  /** Ingest diagnostics from the registration row (absent for seed batches). */
  parsed?: number;
  duplicatesSkipped?: number;
  capDropped?: number;
  storedTotal?: number;
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
      parsed: typeof d.parsed === "number" ? d.parsed : undefined,
      duplicatesSkipped: typeof d.duplicatesSkipped === "number" ? d.duplicatesSkipped : undefined,
      capDropped: typeof d.capDropped === "number" ? d.capDropped : undefined,
      storedTotal: typeof d.storedTotal === "number" ? d.storedTotal : undefined,
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
      parsed: reg.parsed,
      duplicatesSkipped: reg.duplicatesSkipped,
      capDropped: reg.capDropped,
      storedTotal: reg.storedTotal,
      repairable: missing > 0 && Boolean(reg.batchText),
    });
  }
  const worst = batches.find((b) => b.missing > 0);
  // Fix-A diagnostics: per batch, parsed / added (= expectedIngested for
  // ledger rows) / duplicates-skipped / cap-dropped / stored total, so a
  // missing count reads as real loss, not the parse-vs-store gap. Seed
  // batches carry no diagnostics and are omitted from this line.
  const diagnostics = batches
    .filter((b) => b.parsed !== undefined)
    .map(
      (b) =>
        `${b.batchId}: parsed ${b.parsed}, added ${b.expectedIngested}, duplicates ${b.duplicatesSkipped ?? 0}, cap-dropped ${b.capDropped ?? 0}, stored total ${b.storedTotal ?? "?"}`
    )
    .join("; ");
  const diagnosticsSuffix = diagnostics ? ` Ingest diagnostics: ${diagnostics}.` : "";
  // Seed diagnostic: seed batches carry the old parsed counts and no
  // registration diagnostics, so print the stored owner-fed count the
  // keeper computed for each seed batch. The next keeper run's numbers
  // are what a later seed correction uses — nothing here guesses them.
  const seedIds = new Set(seedBatches.map((s) => s.batchId));
  const seedDiagnostics = batches
    .filter((b) => seedIds.has(b.batchId))
    .map(
      (b) =>
        `seed ${b.batchId}: expected ${b.expectedIngested}, stored owner-fed ${b.ownerFedInCorpus}`
    )
    .join("; ");
  const seedDiagnosticsSuffix = seedDiagnostics ? ` Seed counts: ${seedDiagnostics}.` : "";
  if (worst) {
    return {
      lane: "owner_feed",
      status: "down",
      message: `Fed but not ingested: ${batches.length} registered batch(es), ${missingTotal} review(s) missing from the library (worst: ${worst.batchId}, missing ${worst.missing}/${worst.expectedIngested}).${diagnosticsSuffix}${seedDiagnosticsSuffix}`,
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
    message: `${batches.length} registered batch(es); all expected reviews present in the library.${diagnosticsSuffix}${seedDiagnosticsSuffix}`,
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

// ── Library Guardian (v2 lane) ────────────────────────────────────────────

/**
 * (f) LIBRARY GUARDIAN — per-product_key corpus integrity.
 *
 * The Oct-16 shrink bug (DREO 54 → 7, AirPods 86 → 20) ran silently for a
 * day because nothing compared stored review counts run over run. This lane
 * keeps a per-key snapshot in the ops ledger metadata and compares it every
 * run. DETECTION ONLY — there is no repair in v1: dedupe is the separate
 * SQL lane and PR #55's union save already prevents new evictions.
 *
 * Findings:
 *  - shrink: a key's stored review count is lower than last run (DOWN).
 *  - vanished_key: a key that existed is gone (DOWN).
 *  - duplicate_rows: >1 row shares one product_key (DEGRADED — cosmetic
 *    under PR #55's freshest-first read, but still a finding).
 */
export const CHECK_LIBRARY_GUARDIAN_SNAPSHOT = "keeper.library_guardian_snapshot";

export type LibraryGuardianKeySnapshot = {
  rows: number;
  reviewCount: number;
  scanCount: number;
  updatedAt: string;
};

export type LibraryGuardianSnapshot = {
  takenAt: string;
  keys: Record<string, LibraryGuardianKeySnapshot>;
};

export type LibraryGuardianFinding = {
  kind: "shrink" | "duplicate_rows" | "vanished_key";
  productKey: string;
  before?: number;
  after?: number;
  rows?: number;
};

const LIBRARY_GUARDIAN_ROW_LIMIT = 2000;

/** Latest per-key snapshot (null on first run). Fail-soft: never throws. */
export async function readLibraryGuardianSnapshot(): Promise<LibraryGuardianSnapshot | null> {
  try {
    const rows = await keeperLatestEvidence(CHECK_LIBRARY_GUARDIAN_SNAPSHOT, 1);
    const row = rows[0];
    if (!row || !row.details) return null;
    const snap = (row.details as Record<string, unknown>).snapshot as
      | LibraryGuardianSnapshot
      | undefined;
    if (!snap || typeof snap.keys !== "object" || !snap.keys) return null;
    return snap;
  } catch {
    return null;
  }
}

export async function checkLibraryGuardian(
  ledger: KeeperLedgerHandle | null = null
): Promise<LaneReport> {
  const failSoft = (message: string): LaneReport => ({
    lane: "library_guardian",
    status: "unknown",
    message,
    evidence: {},
  });
  if (!isSupabaseConfigured()) {
    return failSoft("Store not configured; library guardian skipped (fail-soft).");
  }
  let rows: Array<Record<string, unknown>> | null = null;
  try {
    rows = await supabaseSelect<Record<string, unknown>>(
      PRODUCT_REVIEW_LIBRARY_TABLE,
      `select=product_key,review_count,scan_count,updated_at&limit=${LIBRARY_GUARDIAN_ROW_LIMIT}`
    );
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows)) {
    return failSoft("Could not read the product review library; guardian skipped (fail-soft).");
  }

  // Aggregate per product_key. The freshest row is canonical — this matches
  // loadLibraryCorpus (order=updated_at.desc&limit=1, PR #55), so the counts
  // the guardian watches are the counts the scorer actually reads.
  const perKey = new Map<string, { rows: number; snap: LibraryGuardianKeySnapshot }>();
  for (const row of rows) {
    const key = String(row.product_key || "");
    if (!key) continue;
    const entry = perKey.get(key) ?? {
      rows: 0,
      snap: { rows: 0, reviewCount: 0, scanCount: 0, updatedAt: "" },
    };
    entry.rows += 1;
    const updatedAt = String(row.updated_at || "");
    if (updatedAt >= entry.snap.updatedAt) {
      entry.snap = {
        rows: entry.rows,
        reviewCount: Number(row.review_count) || 0,
        scanCount: Number(row.scan_count) || 0,
        updatedAt,
      };
    }
    perKey.set(key, entry);
  }
  const now: LibraryGuardianSnapshot = {
    takenAt: new Date().toISOString(),
    keys: Object.fromEntries(
      [...perKey.entries()].map(([key, entry]) => [key, { ...entry.snap, rows: entry.rows }])
    ),
  };

  const previous = await readLibraryGuardianSnapshot();
  const findings: LibraryGuardianFinding[] = [];
  if (previous) {
    for (const [key, prev] of Object.entries(previous.keys)) {
      const cur = now.keys[key];
      if (!cur) {
        findings.push({ kind: "vanished_key", productKey: key, before: prev.reviewCount });
        continue;
      }
      if (cur.reviewCount < prev.reviewCount) {
        findings.push({
          kind: "shrink",
          productKey: key,
          before: prev.reviewCount,
          after: cur.reviewCount,
        });
      }
    }
  }
  for (const [key, cur] of Object.entries(now.keys)) {
    if (cur.rows > 1) {
      findings.push({ kind: "duplicate_rows", productKey: key, rows: cur.rows });
    }
  }
  const newKeys = previous
    ? Object.keys(now.keys).filter((k) => !(k in previous.keys)).slice(0, 25)
    : [];

  // Persist the snapshot for the next run (ledger metadata; no schema change).
  if (ledger) {
    await keeperEvidence(
      ledger,
      CHECK_LIBRARY_GUARDIAN_SNAPSHOT,
      "Library guardian snapshot",
      "info",
      `Snapshot: ${Object.keys(now.keys).length} product key(s), ${findings.length} finding(s).`,
      { snapshot: now }
    );
  }

  const evidence = {
    keyCount: Object.keys(now.keys).length,
    findings,
    newKeys,
    baseline: previous ? "compared" : "first run — baseline recorded",
  };

  if (findings.length === 0) {
    return {
      lane: "library_guardian",
      status: "healthy",
      message: previous
        ? `Library integrity nominal: ${Object.keys(now.keys).length} product key(s) — no shrink, no duplicate rows, none vanished.`
        : `Guardian baseline recorded: ${Object.keys(now.keys).length} product key(s). Integrity comparison starts on the next run.`,
      evidence,
    };
  }

  const describe = (f: LibraryGuardianFinding): string => {
    if (f.kind === "shrink")
      return `${f.productKey}: stored reviews shrank ${f.before} → ${f.after}`;
    if (f.kind === "vanished_key")
      return `${f.productKey}: was in the library (${f.before} reviews), now gone`;
    return `${f.productKey}: ${f.rows} duplicate rows share this product key`;
  };
  const causeFor = (f: LibraryGuardianFinding): { likelyCause: string; humanAction: string } => {
    if (f.kind === "shrink")
      return {
        likelyCause:
          "A scan's library save rewrote this product's corpus with only the current run's reviews and evicted stored ones (the Oct-16 shrink failure mode), or the read flipped between duplicate rows for this key.",
        humanAction: `Open the ${PRODUCT_REVIEW_LIBRARY_TABLE} rows for ${f.productKey}; if stored reviews were evicted, re-ingest the affected batches via /admin/owner-feed (or the community flow). If duplicate rows exist for the key, apply the idempotent dedupe migration so the unique constraint prevents recurrence.`,
      };
    if (f.kind === "vanished_key")
      return {
        likelyCause: "Every row for this product key was deleted outside the scan path.",
        humanAction: `Check Supabase logs for who deleted the ${f.productKey} rows and when; re-ingest the product's reviews if the deletion was not deliberate.`,
      };
    return {
      likelyCause:
        "product_key has no unique constraint yet, so overlapping saves created extra rows; reads flip between rows.",
      humanAction:
        "Apply the idempotent dedupe migration supabase/migrations/20261016_product_review_library_dedupe_unique.sql — it merges duplicate rows per product key and adds the unique index. Until then the scorer reads the freshest row, so this is cosmetic, not a wrong verdict.",
    };
  };
  const serious = findings.filter((f) => f.kind !== "duplicate_rows");
  const worst = serious[0] ?? findings[0];
  const cause = causeFor(worst);
  return {
    lane: "library_guardian",
    status: serious.length > 0 ? "down" : "degraded",
    message: `Library integrity: ${findings.map(describe).join("; ")}.`,
    evidence,
    escalation: cause,
  };
}

// ── Deploy Doctor (v2 lane, both keepers) ───────────────────────────────────

/**
 * (g) DEPLOY DOCTOR — watches which build is live and whether it broke lanes.
 *
 * The Oct-16 Roamly deploy failure (two layers: TS null guard + 23 eslint
 * errors) sat silent for hours until Dylan probed a route. This lane reads
 * the build stamp the keeper itself is running inside
 * (process.env.VERCEL_GIT_COMMIT_SHA — the same build serving production)
 * and records it in the ledger every run:
 *  - stamp CHANGES → ledger-log "new build live" old→new (info, not an alert).
 *  - lanes that were healthy last run and are down/degraded now, right
 *    after a stamp change → escalate "deploy suspect" (the Oct-16
 *    "Review first" comeback was exactly this shape: a merged PR re-broke
 *    a fixed lane).
 *  - optional env RI_EXPECTED_BUILD_SHA: when set and the observed stamp
 *    hasn't matched it for 2 consecutive runs → escalate "expected build
 *    not live." WITHOUT the env var this lane is observation-only: it
 *    records the stamp and watches for fresh failures, nothing more.
 */
export const CHECK_DEPLOY_STAMP = "keeper.deploy_stamp";
const EXPECTED_BUILD_SHA_ENV = "RI_EXPECTED_BUILD_SHA";

export function readDeployStamp(env: NodeJS.ProcessEnv): {
  app: "reviewintel";
  sha: string | null;
} {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return {
    app: "reviewintel",
    sha: typeof sha === "string" && sha.trim() ? sha.trim() : null,
  };
}

/** Previous stamp observations, newest first. Fail-soft: never throws. */
export async function readDeployStampHistory(
  limit = 5
): Promise<Array<{ sha: string | null; observedAt: string }>> {
  try {
    const rows = await keeperLatestEvidence(CHECK_DEPLOY_STAMP, limit);
    return rows.map((row) => {
      const d = (row.details || {}) as Record<string, unknown>;
      return {
        sha: typeof d.sha === "string" ? d.sha : null,
        observedAt: String(row.created_at || ""),
      };
    });
  } catch {
    return [];
  }
}

const shortSha = (s: string | null): string => (s ? s.slice(0, 12) : "none");

export async function checkDeployDoctor(
  env: NodeJS.ProcessEnv,
  currentLanes: LaneReport[],
  ledger: KeeperLedgerHandle | null = null
): Promise<LaneReport> {
  const failSoft = (message: string): LaneReport => ({
    lane: "deploy_doctor",
    status: "unknown",
    message,
    evidence: {},
  });
  const stamp = readDeployStamp(env);
  if (!stamp.sha) {
    return failSoft(
      "Build stamp unavailable (VERCEL_GIT_COMMIT_SHA not set — local/dev). Deploy tracking is observation-only outside Vercel."
    );
  }
  const history = await readDeployStampHistory(5);
  const previousSha = history.length > 0 ? history[0].sha : null;
  const changed = Boolean(previousSha) && previousSha !== stamp.sha;

  // Persist this run's observation (ledger metadata; no schema change).
  if (ledger) {
    await keeperEvidence(
      ledger,
      CHECK_DEPLOY_STAMP,
      "Deploy stamp observed",
      "info",
      `Observed build ${shortSha(stamp.sha)}${changed ? ` (new build live: ${shortSha(previousSha)} → ${shortSha(stamp.sha)})` : ""}.`,
      {
        app: stamp.app,
        sha: stamp.sha,
        observedAt: new Date().toISOString(),
        previousSha: previousSha ?? null,
      }
    );
  }

  // Optional expected-build enforcement. Without the env var this whole
  // branch never fires — observation-only, by design.
  const expected = (env[EXPECTED_BUILD_SHA_ENV] || "").trim() || null;
  let consecutiveMismatches = 0;
  if (expected) {
    if (stamp.sha !== expected) {
      consecutiveMismatches = 1;
      for (const h of history) {
        if (h.sha && h.sha === expected) break;
        consecutiveMismatches += 1;
      }
    }
  }

  // Fresh failures since the last run: lanes healthy before, down/degraded
  // now — only meaningful right after a stamp change. The lane runs before
  // this run's summary is written, so the latest summary is the PREVIOUS run's.
  let freshFailures: string[] = [];
  if (changed) {
    try {
      const summaries = await keeperLatestEvidence(CHECK_RUN_SUMMARY, 1);
      const prevStatuses = ((summaries[0]?.details || {}) as Record<string, unknown>)
        .laneStatuses as Record<string, string> | undefined;
      if (prevStatuses) {
        for (const lane of currentLanes) {
          if (lane.lane === "deploy_doctor") continue;
          if (
            prevStatuses[lane.lane] === "healthy" &&
            (lane.status === "down" || lane.status === "degraded")
          ) {
            freshFailures.push(lane.lane);
          }
        }
      }
    } catch {
      freshFailures = [];
    }
  }

  const evidence = {
    sha: stamp.sha,
    previousSha: previousSha ?? null,
    changed,
    expectedSha: expected,
    consecutiveMismatches,
    freshFailures,
  };

  if (expected && consecutiveMismatches >= 2) {
    return {
      lane: "deploy_doctor",
      status: "down",
      message: `Expected build ${shortSha(expected)} is not live after ${consecutiveMismatches} consecutive keeper runs (observed ${shortSha(stamp.sha)}).`,
      evidence,
      escalation: {
        likelyCause:
          "The deployment for the expected commit failed, or Vercel is still serving an older build.",
        humanAction: `Check the Vercel deployment for commit ${expected} — read its build logs; if it failed, fix and redeploy, or roll back deliberately. Until it lands, set ${EXPECTED_BUILD_SHA_ENV} to the build you actually want live.`,
      },
    };
  }
  if (changed && freshFailures.length > 0) {
    return {
      lane: "deploy_doctor",
      status: "down",
      message: `Deploy suspect: new build ${shortSha(previousSha)} → ${shortSha(stamp.sha)} went live and ${freshFailures.length} lane(s) just started failing: ${freshFailures.slice(0, 8).join(", ")}.`,
      evidence,
      escalation: {
        likelyCause:
          "The new build introduced a regression (the Oct-16 'Review first' comeback was exactly this shape: a merged PR re-broke a fixed lane).",
        humanAction: `Check the Vercel deployment logs for ${stamp.sha}; if the build is broken, roll back to the previous deployment in the Vercel dashboard and re-ship the round as one release.`,
      },
    };
  }
  if (expected && consecutiveMismatches === 1) {
    return {
      lane: "deploy_doctor",
      status: "degraded",
      message: `Observed build ${shortSha(stamp.sha)} does not match expected ${shortSha(expected)} (1st run — watching one more before escalating).`,
      evidence,
      escalation: {
        likelyCause: "A deploy may still be propagating.",
        humanAction: `If the next keeper run still shows ${shortSha(stamp.sha)}, check the Vercel deployment for ${expected}.`,
      },
    };
  }
  return {
    lane: "deploy_doctor",
    status: "healthy",
    message: changed
      ? `New build live: ${shortSha(previousSha)} → ${shortSha(stamp.sha)}; no fresh lane failures.`
      : `Build ${shortSha(stamp.sha)} still live; no drift.`,
    evidence,
  };
}

// ── Social Postman (v2 lane) ───────────────────────────────────────────────

/**
 * (h) SOCIAL POSTMAN — surfaces REAL failed social posts.
 *
 * RI's social failures (the failed FB Reels that sat in the logs Oct 7–14)
 * went unnoticed because nobody watched the publish outcomes. This lane
 * reads admin_social_posts for rows with the EXPLICIT publish outcome
 * "failed" and escalates ones it hasn't escalated before (tracked in the
 * ops ledger metadata, so re-runs don't repeat).
 *
 * Standing correction honored in code: status labels such as
 * "needs_attention" are NOT failures — this lane only matches
 * status = "failed", never labels. DETECTION ONLY — the keeper never
 * republishes; a human fixes the connector or media.
 */
export const SOCIAL_POSTS_TABLE = "admin_social_posts";
export const CHECK_POSTMAN_ESCALATED = "keeper.postman_escalated";
const POSTMAN_LOOKBACK_DAYS = 14;

export type SocialPostFailure = {
  id: string;
  platform: string;
  topic: string;
  mode: string;
  error: string;
  createdAt: string;
};

/** Post ids the keeper already escalated (union across recent rows). */
export async function readPostmanEscalatedIds(limit = 20): Promise<Set<string>> {
  try {
    const rows = await keeperLatestEvidence(CHECK_POSTMAN_ESCALATED, limit);
    const ids = new Set<string>();
    for (const row of rows) {
      const d = (row.details || {}) as Record<string, unknown>;
      const list = d.postIds;
      if (Array.isArray(list)) {
        for (const id of list) if (typeof id === "string") ids.add(id);
      }
    }
    return ids;
  } catch {
    return new Set<string>();
  }
}

export async function checkSocialPostman(
  ledger: KeeperLedgerHandle | null = null,
  nowMs?: number
): Promise<LaneReport> {
  const failSoft = (message: string): LaneReport => ({
    lane: "social_postman",
    status: "unknown",
    message,
    evidence: {},
  });
  if (!isSupabaseConfigured()) {
    return failSoft("Store not configured; social postman skipped (fail-soft).");
  }
  let rows: Array<Record<string, unknown>> | null = null;
  try {
    rows = await supabaseSelect<Record<string, unknown>>(
      SOCIAL_POSTS_TABLE,
      "select=id,platform,mode,status,topic,caption,error,posted_at,created_at,updated_at&status=eq.failed&order=created_at.desc&limit=50"
    );
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows)) {
    return failSoft(`Could not read ${SOCIAL_POSTS_TABLE}; social postman skipped (fail-soft).`);
  }

  const now = nowMs ?? Date.now();
  const cutoff = now - POSTMAN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recent: SocialPostFailure[] = rows
    .filter((r) => {
      const t = new Date(String(r.created_at || 0)).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .map((r) => ({
      id: String(r.id),
      platform: String(r.platform || "unknown"),
      topic: String(r.topic || "untitled"),
      mode: String(r.mode || ""),
      error: String(r.error || "no failure text recorded"),
      createdAt: String(r.created_at || ""),
    }));

  const alreadyEscalated = await readPostmanEscalatedIds();
  const fresh = recent.filter((p) => !alreadyEscalated.has(p.id));

  // Record the newly escalated ids so the next run doesn't repeat them.
  if (fresh.length > 0 && ledger) {
    await keeperEvidence(
      ledger,
      CHECK_POSTMAN_ESCALATED,
      "Social postman escalations",
      "fail",
      `Escalated ${fresh.length} failed social post(s).`,
      { postIds: fresh.map((p) => p.id), posts: fresh }
    );
  }

  const evidence = {
    failedPostsFound: recent.length,
    newFailures: fresh.length,
    failures: fresh.map((p) => ({
      id: p.id,
      platform: p.platform,
      topic: p.topic,
      error: p.error,
    })),
  };

  if (fresh.length === 0) {
    return {
      lane: "social_postman",
      status: "healthy",
      message: recent.length
        ? `No new failed social posts (all ${recent.length} recent failure(s) already escalated).`
        : `No failed social posts in the last ${POSTMAN_LOOKBACK_DAYS} days.`,
      evidence,
    };
  }
  const named = fresh.slice(0, 5).map((p) => `${p.platform}/${p.topic}`);
  const namedSuffix = fresh.length > 5 ? ` and ${fresh.length - 5} more` : "";
  return {
    lane: "social_postman",
    status: "down",
    message: `${fresh.length} social post(s) failed: ${named.join(", ")}${namedSuffix}.`,
    evidence,
    escalation: {
      likelyCause:
        "The social-autopost publish path failed — connector rejection, media generation/upload failure, or a platform-side error (the recorded failure text names it).",
      humanAction: `Open the admin social view for ${fresh
        .slice(0, 5)
        .map((p) => `${p.platform} (${p.id})`)
        .join(", ")}${fresh.length > 5 ? ` and ${fresh.length - 5} more` : ""}; recorded failure text: ${fresh
        .slice(0, 5)
        .map((p) => `"${p.error}"`)
        .join("; ")}. Fix the connector or media and re-publish.`,
    },
  };
}

// ── Repairs (whitelisted only) ────────────────────────────────────────────

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
/**
 * QA Inspector lane (bot round 2): reads recent stored scan results from the
 * `analyses` table's analysis_json — the same restore path as
 * loadServerResult (stored.result ?? stored, server-only account scoping
 * removed since the keeper reads as the service role) — and runs the
 * banned-defect inspector over them. ESCALATE ONLY: this lane never names a
 * repair key, so maybeRepair skips it; every defect class escalates via
 * per-class ledger rows (qa_inspector.defect.<class>) plus the generic
 * keeper.check.qa_inspector lane row.
 */
const qaObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export async function checkQaInspector(ledger: KeeperLedgerHandle | null): Promise<LaneReport> {
  const store: QaInspectorStore = {
    loadRecentStoredResults: async (limit) => {
      if (!isSupabaseConfigured()) return [];
      const n = Math.max(1, Math.min(50, limit));
      const rows = await supabaseSelect("analyses", `select=analysis_json,created_at&order=created_at.desc&limit=${n}`);
      const out: unknown[] = [];
      for (const row of rows) {
        const stored = qaObj(row.analysis_json);
        out.push(stored.result && typeof stored.result === "object" ? stored.result : stored);
      }
      return out;
    },
  };
  const writer: QaLedgerWriter | null = ledger
    ? {
        writeDefectEscalation: async (finding) =>
          keeperEvidence(
            ledger,
            qaDefectCheckId(finding.defectClass),
            `QA defect: ${finding.defectClass}`,
            "fail",
            `QA inspector — scan ${finding.scanId}: ${finding.defectClass} — "${finding.offendingString}" (field: ${finding.field})`,
            {
              scanId: finding.scanId,
              defectClass: finding.defectClass,
              offendingString: finding.offendingString,
              field: finding.field,
            }
          ),
      }
    : null;
  const report = await runQaInspectorLane(store, writer);
  return {
    lane: report.lane,
    status: report.status,
    message: report.message,
    evidence: {
      scanned: report.scanned,
      findings: report.findings,
      escalationsWritten: report.escalationsWritten,
      escalationFailures: report.escalationFailures,
      recordErrors: report.recordErrors,
    },
    escalation:
      report.findings.length > 0
        ? {
            likelyCause:
              "Stored scan results contain banned copy defects (verdict outside Buy/Wait/Skip, internal placeholders, empty/dash rows, doubled aggregate, unbacked warnings).",
            humanAction:
              "Open the flagged result pages from the admin Operations view and fix the copy path; the inspector never edits results itself.",
          }
        : undefined,
  };
}

// ── Rescue prep lane (bot round 2, release finisher) ───────────────────────

/**
 * Rescue Prep lane (bot round 2): for each pending rescue-queue item,
 * build the one-page research pack via lib/rescuePrep — Junel's personal
 * research page, in plain language. ESCALATE ONLY by construction: the lane
 * never names a repair key (maybeRepair skips it), never changes queue
 * status, never emails, never auto-rescues. Packs are capped at 3 per run;
 * when the owner has not yet applied supabase/migrations/
 * 20261016_rescue_prep_packs.sql the packs are built in memory and returned
 * unstored — reported as honest evidence, never an error.
 */
export const RESCUE_PREP_MAX_PER_RUN = 3;
export const RESCUE_PREP_MIGRATION_FILE = "supabase/migrations/20261016_rescue_prep_packs.sql";

export type RescuePrepLaneDeps = {
  /** Injected store (tests mock it). Defaults to the live Supabase adapter. */
  store?: RescuePrepStore;
  /** Injected pending-item enumeration (tests mock it). Defaults to the rescue queue. */
  listPendingItems?: () => Promise<RescueQueueItem[]>;
};

const rescuePrepNotProvisionedMarker = "not provisioned";

function rescueQueueRowToPrepItem(row: Record<string, unknown>): RescueQueueItem {
  return {
    id: String(row.id ?? ""),
    scan_ref: String(row.scan_ref ?? ""),
    account_email: row.account_email == null ? null : String(row.account_email),
    product_key: row.product_key == null ? null : String(row.product_key),
    product_name: row.product_name == null ? null : String(row.product_name),
    product_url: row.product_url == null ? null : String(row.product_url),
    reason: row.reason == null ? null : String(row.reason),
    created_at: row.created_at == null ? null : String(row.created_at),
  };
}

export async function checkRescuePrep(
  ledger: KeeperLedgerHandle | null,
  deps: RescuePrepLaneDeps = {}
): Promise<LaneReport> {
  const lane = "rescue_prep";
  const unknown = (message: string): LaneReport => ({ lane, status: "unknown", message, evidence: {} });
  const store = deps.store ?? rescuePrepStore;

  let pending: RescueQueueItem[];
  try {
    if (!isSupabaseConfigured()) {
      return unknown("Store not configured; rescue-prep check skipped (fail-soft).");
    }
    pending = deps.listPendingItems
      ? await deps.listPendingItems()
      : (await listRescueQueue("pending", 50)).map((r) =>
          rescueQueueRowToPrepItem(r as unknown as Record<string, unknown>)
        );
  } catch {
    return unknown("Could not read the rescue queue; rescue-prep check skipped (fail-soft).");
  }

  if (pending.length === 0) {
    return {
      lane,
      status: "healthy",
      message: "No pending rescue items; nothing to pre-research.",
      evidence: { pending: 0 },
    };
  }

  const worklist = pending.slice(0, RESCUE_PREP_MAX_PER_RUN);
  const deferred = pending.length - worklist.length;
  const prepared: string[] = [];
  const alreadyHad: string[] = [];
  const unstored: string[] = [];
  const failed: string[] = [];
  let storageAbsent = false;

  for (const item of worklist) {
    let result: PrepareRescuePackResult;
    try {
      result = await prepareRescuePack(item.scan_ref || item.id, store);
    } catch {
      failed.push(item.id);
      continue;
    }
    if (!result.ok || !result.pack) {
      failed.push(item.id);
      continue;
    }
    if (result.alreadyStored) {
      alreadyHad.push(item.id);
    } else if (result.stored) {
      prepared.push(item.id);
    } else {
      unstored.push(item.id);
      if (result.notes.some((n) => n.toLowerCase().includes(rescuePrepNotProvisionedMarker))) {
        storageAbsent = true;
      }
    }
  }

  const storagePresent =
    prepared.length > 0 ? true : unstored.length > 0 && storageAbsent ? false : null;
  const evidence = {
    pending: pending.length,
    capped: deferred,
    prepared,
    alreadyHadPacks: alreadyHad,
    unstored,
    failed,
    storagePresent,
  };

  if (failed.length > 0) {
    return {
      lane,
      status: "degraded",
      message: `Rescue prep failed for ${failed.length} item(s); queue rows untouched.`,
      evidence,
      escalation: {
        likelyCause: "prepareRescuePack errored on a malformed or unreadable queue row.",
        humanAction:
          "Open the admin rescue view and check the keeper logs; research the product manually — the pack is advisory, the queue is untouched.",
      },
    };
  }
  if (storagePresent === false) {
    return {
      lane,
      status: "degraded",
      message: `${unstored.length} research pack(s) built but not stored — the prep-pack table is not provisioned yet (owner has not run ${RESCUE_PREP_MIGRATION_FILE}).`,
      evidence,
      escalation: {
        likelyCause: "The rescue_prep_packs table does not exist; the migration was never applied.",
        humanAction: `Paste ${RESCUE_PREP_MIGRATION_FILE} into the Supabase SQL editor and run it once. Until then, packs are built in memory and returned unstored.`,
      },
    };
  }
  return {
    lane,
    status: "healthy",
    message: `Rescue prep: ${prepared.length} pack(s) prepared this run, ${alreadyHad.length} already had packs${
      deferred > 0 ? `, ${deferred} deferred to the next run (cap ${RESCUE_PREP_MAX_PER_RUN})` : ""
    }.`,
    evidence,
  };
}

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
  // Rescue prep: build research packs for pending items (escalate-only,
  // cap 3/run; nothing changes queue status).
  await runOne("rescue_prep", () => checkRescuePrep(ledger));
  // Library guardian: per-key integrity vs the previous run's snapshot.
  await runOne("library_guardian", () => checkLibraryGuardian(ledger));
  // Social postman: real failed posts only (never status labels).
  await runOne("social_postman", () => checkSocialPostman(ledger, nowMs));
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
  // Deploy doctor runs last: it compares this run's lanes against the
  // previous run's summary and the observed build stamp.
  await runOne("qa_inspector", () => checkQaInspector(ledger));
  await runOne("deploy_doctor", () => checkDeployDoctor(env, lanes, ledger));
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
