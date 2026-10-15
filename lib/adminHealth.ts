import { supabaseSelect } from "@/lib/supabaseServer";

/**
 * App Health snapshot reader + view helpers.
 * Snapshots are written daily by /api/cron/health-snapshot (service role).
 * This reader is used by the admin health page; auth gating comes from
 * app/admin/layout.tsx.
 */

export interface WindowCounts {
  pageViews: number;
  uniqueVisitors: number;
  signIns: number;
  signUps: number;
  affiliateClicks: number;
  affiliateImpressions: number;
  checkoutsStarted: number;
  scans: number;
  scansBuyer: number;
  scansSeller: number;
  linkScans: number;
  screenshotScans: number;
  aggregatePresent: number;
  aggregateMissing: number;
  paidCount: number;
  revenueByCurrency: Record<string, number>;
  emailsSent: number;
  emailsFailed: number;
}

export interface HealthAlert {
  code: string;
  severity: "warn" | "info";
  message: string;
  count: number;
  detail?: string;
}

export interface HealthSnapshot {
  snapshot_date: string;
  metrics: {
    generatedAt?: string;
    today?: WindowCounts;
    yesterday?: WindowCounts;
    last7d?: WindowCounts;
    verdictMix?: Array<{ verdict: string; count: number }>;
    topProducts?: Array<{ title: string; scans: number }>;
    topPages?: Array<{ label: string; count: number }>;
    library?: {
      products: number;
      storedReviews: number;
      consolidatedScans: number;
    } | null;
    security?: {
      severityTally?: Record<string, number>;
      criticalHigh7d?: number;
    };
    emails?: { newestError?: string | null };
    support?: { unresolvedMessages?: number | null };
    money?: {
      paidCount7d?: number;
      revenueByCurrency7d?: Record<string, number>;
    };
    services?: {
      supabaseConfigured?: boolean;
      stripeConfigured?: boolean;
    };
  };
  alerts: HealthAlert[];
  created_at?: string;
}

const emptyWindow = (): WindowCounts => ({
  pageViews: 0,
  uniqueVisitors: 0,
  signIns: 0,
  signUps: 0,
  affiliateClicks: 0,
  affiliateImpressions: 0,
  checkoutsStarted: 0,
  scans: 0,
  scansBuyer: 0,
  scansSeller: 0,
  linkScans: 0,
  screenshotScans: 0,
  aggregatePresent: 0,
  aggregateMissing: 0,
  paidCount: 0,
  revenueByCurrency: {},
  emailsSent: 0,
  emailsFailed: 0,
});

export function windowOf(
  snapshot: HealthSnapshot,
  which: "today" | "yesterday" | "last7d"
): WindowCounts {
  const w = snapshot.metrics[which];
  return w ? { ...emptyWindow(), ...w } : emptyWindow();
}

/** Latest snapshots, newest first. Returns [] when the table is missing. */
export async function readHealthSnapshots(
  limit = 8
): Promise<HealthSnapshot[]> {
  try {
    const rows = await supabaseSelect<HealthSnapshot>(
      "admin_health_snapshots",
      `select=snapshot_date,metrics,alerts,created_at&order=snapshot_date.desc&limit=${limit}`
    );
    if (!rows) return [];
    return rows.map((r) => ({
      snapshot_date: String(r.snapshot_date ?? ""),
      metrics:
        r.metrics && typeof r.metrics === "object"
          ? (r.metrics as HealthSnapshot["metrics"])
          : {},
      alerts: Array.isArray(r.alerts) ? (r.alerts as HealthAlert[]) : [],
      created_at: typeof r.created_at === "string" ? r.created_at : undefined,
    }));
  } catch {
    return [];
  }
}

export function formatDelta(today: number, yesterday: number): string {
  const d = today - yesterday;
  if (d === 0) return "±0";
  return `${d > 0 ? "+" : ""}${d}`;
}

export function formatRevenue(byCurrency?: Record<string, number>): string {
  if (!byCurrency) return "—";
  const parts = Object.entries(byCurrency).filter(([, v]) => v > 0);
  if (!parts.length) return "—";
  // Amounts are stored raw from the payments table; label honestly.
  return parts
    .map(([cur, v]) => `${cur} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} (raw)`)
    .join(", ");
}
