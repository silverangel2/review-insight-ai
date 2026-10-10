"use client";
import { ReviewIntelScanOverlay } from "@/components/ReviewIntelScanOverlay";
import saved from "./ringconn-accepted-quotes.json";

// Dev-only preview. Polls the real /api/scan-progress; screenshot runs mock that
// endpoint using the REAL accepted RingConn quotes exported below (no sample text).
export const PREVIEW_ACCEPTED_QUOTES = saved;

export function ScanProgressPreview() {
  return <ReviewIntelScanOverlay stage="analyzing" uploadProgress={100} scanId="preview-scan-0001" pollMs={700} />;
}
