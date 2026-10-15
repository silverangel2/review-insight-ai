/**
 * Flag hook for the analyze route: when a finished scan has insufficient
 * review evidence, record a rescue-queue candidate — fire-and-forget and
 * fail-soft, so the shopper response is byte-identical and never delayed.
 *
 * Never flags: test accounts (@reviewintel.test / @reviewintel.local —
 * the weekly audits run as those and must not page the owner), and scans
 * where the analyze route never resolved the shopper email.
 */

import { isReviewIntelTestEmail } from "@/lib/account";
import { libraryProductKeyFor } from "@/lib/productReviewLibrary";
import { recordRescueCandidate } from "@/lib/rescueQueue";

type ScanResultLike = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/** Exact server-side insufficient-evidence signal (never shopper-visible). */
export function isInsufficientEvidenceResult(result: ScanResultLike): boolean {
  if (result.scanState === "INSUFFICIENT_EVIDENCE") return true;
  const verdict = text(result.verdict).toUpperCase();
  if (verdict === "REVIEW EVIDENCE NOT ENOUGH" || verdict === "NOT_ENOUGH") return true;
  if (result.buyScore === null && result.decisionStatus !== "evidence_based") {
    const source = text(result.finalDecisionSource);
    if (source === "reviewEvidenceNotEnough" || source === "reviewEvidenceRecoveryFailed") return true;
  }
  return false;
}

function reasonFor(result: ScanResultLike): string {
  const source = text(result.finalDecisionSource);
  if (source === "reviewEvidenceRecoveryFailed" || text(result.decisionStatus) === "review_evidence_not_found") {
    return "Review evidence could not be fetched for this product.";
  }
  return "Not enough written reviews to score this product fairly.";
}

/**
 * Flag a finished scan for the rescue queue. Resolves void; swallows every
 * failure. The analyze route calls it with `void` and no await — it must
 * never change scan responses, timing, or errors.
 */
export async function flagRescueCandidateFromScanResult(
  input: {
    result: ScanResultLike;
    scanId?: string | null;
    email?: string | null;
    productLink?: string | null;
  },
  deps: Parameters<typeof recordRescueCandidate>[1] = {}
): Promise<void> {
  try {
    const result = input.result ?? {};
    if (!isInsufficientEvidenceResult(result)) return;

    const email = text(input.email).toLowerCase();
    // Audits run as test accounts; the operator's own admin scans never need rescue.
    if (!email || isReviewIntelTestEmail(email)) return;

    const productUrl = text(result.url) || text(result.exactListingUrl) || text(input.productLink) || null;
    const productName =
      text(result.productName) || text(result.name) || text(result.title) || null;
    if (!productName && !productUrl) return;

    const scanRef =
      text(input.scanId) || text(result.analysisId) || text(result.scanId) || null;
    if (!scanRef) return;

    await recordRescueCandidate(
      {
        scanRef,
        accountEmail: email,
        productKey: productUrl ? libraryProductKeyFor({ listingUrl: productUrl }) : null,
        productName,
        productUrl,
        reason: reasonFor(result),
      },
      deps
    );
  } catch {
    // Never let rescue flagging disturb the scan path.
  }
}
