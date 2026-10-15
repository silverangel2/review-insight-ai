// Scan-stage progress model (Phase 4). Pure module — no JSX, unit-testable.
//
// Honesty contract: the progress fraction is derived ONLY from real pipeline
// milestones (upload XHR events, /api/scan-progress stage events). It is
// never timer-based, never invents percentages, and no stage is marked done
// before its real signal. When no live event has arrived yet the fraction is
// null (indeterminate) rather than faked.

export type ScanStage = "uploading" | "analyzing" | "done";

export type LiveScanProgress = {
  stage: "starting" | "identifying" | "searching" | "reading" | "checking" | "scoring" | "done" | "failed";
  productIdentified: boolean;
  productName: string | null;
  sourcesChecked: number;
  sourceHosts: string[];
  // Present on the API contract but NEVER rendered: the owner forbids showing
  // review counts read during scanning (aggregate marketplace counts in
  // results are fine; "read 12 reviews" here is not).
  reviewsFound: number | null;
  reviewsAccepted: number | null;
  snippets: Array<{ text: string; host: string | null }>;
};

/** Owner-language stage labels, in pipeline order. */
export const SCAN_STEPS: Array<{ id: LiveScanProgress["stage"]; label: string }> = [
  { id: "identifying", label: "Identifying the product" },
  { id: "searching", label: "Checking review sources" },
  { id: "reading", label: "Reading buyer reviews" },
  { id: "checking", label: "Grouping what buyers said" },
  { id: "scoring", label: "Weighing the good against the bad" },
  { id: "done", label: "Your answer" },
];

export const SCAN_ORDER = ["starting", "identifying", "searching", "reading", "checking", "scoring", "done"];

/** Stage-based fraction (real stage reached), not elapsed time. */
export function progressFraction(
  stage: ScanStage,
  uploadProgress: number,
  live: LiveScanProgress | null
): number | null {
  if (stage === "done") return 1;
  if (stage === "uploading") return Math.max(0, Math.min(1, uploadProgress / 100)) * 0.1;
  if (!live) return null;
  const index = Math.max(0, SCAN_ORDER.indexOf(live.stage));
  return Math.min(0.95, 0.1 + (index / (SCAN_ORDER.length - 1)) * 0.85);
}
