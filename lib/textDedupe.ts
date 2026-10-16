/**
 * Round 5 — display-layer duplicate-line guard.
 *
 * The decision brief renders each analysis factor as title (bold) + summary
 * (dark) + basis (lighter, smaller) on adjacent lines. The one-off echo-guard
 * fallback in lib/reviewAnalysis.ts composes the summary as the bare basis
 * label ("One buyer reported this.") while the basis field carries the
 * identical text — printing both shows the same sentence twice in a row
 * (live defect: Sony scan_cbc41785, 2026-10-16).
 *
 * sameSentence answers whether two rendered strings are the same sentence,
 * ignoring case, surrounding whitespace, and trailing sentence punctuation,
 * so the render layer can keep one and suppress the duplicate. Factors whose
 * summary and basis genuinely differ render exactly as before.
 *
 * Display layer only: no scoring, no verdict, no copy-library changes.
 */
export function sameSentence(a: string, b: string): boolean {
  const norm = (s: string): string =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.?!…]+$/u, "")
      .toLowerCase();
  const x = norm(a);
  return x.length > 0 && x === norm(b);
}
