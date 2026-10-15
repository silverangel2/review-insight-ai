/**
 * Display-layer helpers for shopper-facing review quotes and evidence labels.
 *
 * Pure functions only — no scoring, no network, no storage. Used by the result
 * page to keep rendered copy clean (strip leaked markdown), unique (dedupe the
 * same quote across sections), and coherent (single evidence-strength value).
 */

const EMPHASIS_PAIRS: Array<[RegExp, string]> = [
  [/\*\*(.+?)\*\*/g, "$1"],
  [/__(.+?)__/g, "$1"],
  [/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2"],
  [/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2"],
];

/** Remove markdown emphasis markers that leak from review bodies / OCR. */
export function stripMarkdownEmphasis(text: string): string {
  let out = String(text ?? "");
  for (const [pattern, replacement] of EMPHASIS_PAIRS) out = out.replace(pattern, replacement);
  return out;
}

/** Quote text safe for rendering: no markdown markers, single-line, trimmed. */
export function sanitizeQuoteForDisplay(text: unknown): string {
  return stripMarkdownEmphasis(String(text ?? "")).replace(/\s+/g, " ").trim();
}

/**
 * Canonical key for cross-section dedupe: case-, punctuation- and
 * whitespace-insensitive so the same quote from two stores matches.
 */
export function canonicalQuoteKey(text: unknown): string {
  return sanitizeQuoteForDisplay(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First-seen wins; drops empties. Order-preserving. */
export function dedupeQuoteTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const text = sanitizeQuoteForDisplay(raw);
    const key = canonicalQuoteKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** The only evidence-strength scale ReviewIntel uses (see lib/reviewEvidence.ts). */
const EVIDENCE_STRENGTH_LEVELS = ["none", "weak", "limited", "usable", "strong"] as const;

/**
 * Coerce any raw strength value to ONE coherent scale value. Takes the first
 * token that is on the scale (e.g. "limited high" -> "Limited"); anything else
 * falls back to "Low", matching the result page's existing empty-state copy.
 * Never invents a new level.
 */
export function normalizeEvidenceStrength(raw: unknown): string {
  const tokens = String(raw ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const token of tokens) {
    if ((EVIDENCE_STRENGTH_LEVELS as readonly string[]).includes(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }
  return "Low";
}
