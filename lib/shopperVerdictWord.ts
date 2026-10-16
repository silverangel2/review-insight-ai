/**
 * Canonical shopper-facing verdict vocabulary (restored 2026-10-16, round 3).
 *
 * Owner rule: every verdict label a shopper can see is exactly one of
 * "Buy" | "Wait" | "Skip" (plus "Low confidence" for the thin-evidence
 * state, which is not a verdict). Internal verdict enums ("VERIFIED BUY",
 * "DO NOT BUY YET", "REVIEW FIRST", "AVOID", "NOT_ENOUGH*", "not_enough",
 * ...) must never leak into rendered UI.
 *
 * This is the SINGLE source of truth. All render sites map through it:
 * - components/DecisionBrief.tsx (headline verdict word)
 * - components/ResultsClient.tsx (displayShopperVerdict)
 * - components/BuyingScoreV2Card.tsx (verdict badge)
 * - lib/shopperAnswer.ts (re-exports the guard)
 *
 * Display-only: no scoring computation, gates, or thresholds are touched.
 */

export type ShopperVerdictWord = "Buy" | "Wait" | "Skip" | "Low confidence";

const BUY = new Set(["BUY", "VERIFIED BUY", "LEANING BUY"]);
const WAIT = new Set([
  "WAIT",
  "REVIEW FIRST",
  "CONSIDER",
  "MAYBE",
  "DO NOT BUY YET",
  "LEANING WAIT",
  "REVIEW",
]);
const SKIP = new Set(["SKIP", "AVOID", "LEANING SKIP", "DO NOT BUY"]);
const LOW = new Set([
  "LOW CONFIDENCE",
  "NOT_ENOUGH",
  "NOT ENOUGH",
  "NOT ENOUGH EVIDENCE",
  "NOT SCORED",
  "NOT_SCORED",
  "NO SCORE",
  "NO_SCORE",
  "REVIEW EVIDENCE NOT ENOUGH",
  "NOT_ENOUGH_EVIDENCE",
]);

/** Map any internal verdict representation to the single shopper vocabulary. */
export function shopperVerdictWord(value: unknown): ShopperVerdictWord {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v) return "Low confidence";
  if (BUY.has(v)) return "Buy";
  if (SKIP.has(v)) return "Skip";
  if (WAIT.has(v)) return "Wait";
  if (LOW.has(v) || v.includes("NOT ENOUGH") || v.includes("NOT_ENOUGH") || v.includes("REVIEW EVIDENCE")) {
    return "Low confidence";
  }
  // Unknown values fail safe to "Low confidence" (never invent a new
  // vocabulary word, never pass an internal enum through to the shopper).
  return "Low confidence";
}

/**
 * Render-boundary guard for verdict WORD slots: the result page can only
 * ever display Buy / Wait / Skip. Any stored, legacy, or generated value
 * (including "Review first", "REVIEW FIRST", "Avoid", "Low confidence",
 * null, or garbage) is coerced into the canonical trio. Case-insensitive;
 * anything unrecognized is "Wait" (never hide behind a novel word).
 */
export function sanitizeVerdictWord(value: unknown): "Buy" | "Wait" | "Skip" {
  const t = String(value ?? "").trim().toUpperCase();
  if (BUY.has(t)) return "Buy";
  if (SKIP.has(t)) return "Skip";
  return "Wait";
}
