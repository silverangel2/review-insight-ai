import { deriveShopperAnswer } from "@/lib/shopperAnswer";

/**
 * Rescue-lane capture gate (Phase 6).
 *
 * The "Want a personal verdict?" capture says "We couldn't score this
 * product from the reviews available." It must render ONLY on results with
 * no customer-facing verdict — never on a scored Buy/Wait/Skip page.
 *
 * Aligned with the decision brief's verdict gate: deriveShopperAnswer().kind
 * is exactly what decides whether the brief (and the customer-facing
 * verdict) renders. If it yields buy/wait/skip, there IS a verdict and the
 * capture stays hidden. Otherwise the legacy insufficient-evidence signals
 * apply unchanged.
 */
export function shouldShowRescueCapture(result: unknown): boolean {
  if (!result) return false;
  const kind = deriveShopperAnswer(result).kind;
  if (kind === "buy" || kind === "wait" || kind === "skip") return false;
  const record = result as Record<string, unknown>;
  if (record.scanState === "INSUFFICIENT_EVIDENCE") return true;
  const verdict = String(record.verdict ?? "").toUpperCase();
  return verdict === "REVIEW EVIDENCE NOT ENOUGH" || verdict === "NOT_ENOUGH";
}
