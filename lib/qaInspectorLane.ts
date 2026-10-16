/**
 * QA Inspector lane — keeper-lane-shaped runner for the QA Inspector.
 *
 * Follows the RI Keeper v1 lane pattern (lib/riKeeper.ts): a status +
 * message + evidence report, with every finding escalated as a
 * ledger-shaped record. Read-only against the product: the inspector
 * never edits scan results, and this lane never edits anything either —
 * it only reads stored results and writes escalation evidence.
 *
 * Integration point for Dylan's central release: hand this runner a
 * store that can load recent stored results (the same payload /results
 * renders) and a writer that persists ledger evidence rows
 * (ri_ops_evidence, check_id "qa_inspector.defect.<class>", status "fail").
 * Both are injected; when either is unavailable the lane reports
 * "unknown" instead of throwing.
 */

import {
  inspectStoredResults,
  type QaBatchReport,
  type QaFinding,
} from "./qaInspector";

export type QaInspectorStore = {
  /** Load the N most recent stored scan results (render payload shape). */
  loadRecentStoredResults: (limit: number) => Promise<unknown[]>;
};

export type QaLedgerWriter = {
  /** Persist one ledger-shaped escalation record; resolves false when unavailable. */
  writeDefectEscalation: (finding: QaFinding) => Promise<boolean>;
};

export type QaLaneStatus = "healthy" | "degraded" | "down" | "unknown";

export type QaLaneReport = {
  lane: "qa_inspector";
  status: QaLaneStatus;
  message: string;
  scanned: number;
  findings: QaFinding[];
  escalationsWritten: number;
  escalationFailures: number;
  recordErrors: QaBatchReport["recordErrors"];
  ranAt: string;
};

const DEFAULT_LIMIT = 25;

/**
 * Run the inspector lane over recent stored results. Fail-soft throughout:
 * store or ledger failures become statuses, never exceptions.
 */
export async function runQaInspectorLane(
  store: QaInspectorStore | null,
  ledger: QaLedgerWriter | null,
  opts: { limit?: number } = {}
): Promise<QaLaneReport> {
  const ranAt = new Date().toISOString();
  if (!store) {
    return {
      lane: "qa_inspector",
      status: "unknown",
      message: "QA inspector lane skipped: no result store available.",
      scanned: 0,
      findings: [],
      escalationsWritten: 0,
      escalationFailures: 0,
      recordErrors: [],
      ranAt,
    };
  }

  let records: unknown[];
  try {
    records = await store.loadRecentStoredResults(opts.limit ?? DEFAULT_LIMIT);
  } catch (err) {
    return {
      lane: "qa_inspector",
      status: "down",
      message: `QA inspector could not load stored results: ${err instanceof Error ? err.message : String(err)}`,
      scanned: 0,
      findings: [],
      escalationsWritten: 0,
      escalationFailures: 0,
      recordErrors: [],
      ranAt,
    };
  }
  if (!Array.isArray(records)) records = [];

  const batch = inspectStoredResults(records);
  const findings = batch.findings;

  let escalationsWritten = 0;
  let escalationFailures = 0;
  if (findings.length > 0 && ledger) {
    for (const finding of findings) {
      try {
        const ok = await ledger.writeDefectEscalation(finding);
        if (ok) escalationsWritten += 1;
        else escalationFailures += 1;
      } catch {
        escalationFailures += 1;
      }
    }
  }
  if (findings.length > 0 && !ledger) {
    escalationFailures = findings.length;
  }

  const status: QaLaneStatus =
    batch.recordErrors.length > 0 && findings.length === 0 ? "degraded"
    : findings.length > 0 ? "degraded"
    : "healthy";

  return {
    lane: "qa_inspector",
    status,
    message:
      findings.length === 0
        ? `QA inspector passed: ${batch.inspected} stored results checked, no banned defects found.`
        : `QA inspector found ${findings.length} banned defect(s) across ${batch.inspected} stored results; escalations written: ${escalationsWritten}, failed: ${escalationFailures}.`,
    scanned: batch.inspected,
    findings,
    escalationsWritten,
    escalationFailures,
    recordErrors: batch.recordErrors,
    ranAt,
  };
}

/** Ledger check_id for one defect class (mirrors riKeeper's check_id convention). */
export const qaDefectCheckId = (defectClass: QaFinding["defectClass"]): string =>
  `qa_inspector.defect.${defectClass}`;
