/**
 * Verdict-weighted evidence composition — iteration 4 of RI's native
 * findings engine (2026-10-17, Junel: "A buy signal should [say] why you
 * must [more] than the NOT, a skip should explain more in why you must
 * not. While must say why to wait, and what's the wait for.").
 *
 * Deterministic, zero external AI. The page must ARGUE THE VERDICT's case:
 * BUY pages lead with more reasons to buy than reasons to hesitate, SKIP
 * pages the reverse, WAIT pages stay balanced and name what the wait is
 * for. COMPOSITION ONLY — scoring and verdict computation are untouched;
 * this module only ever READS the verdict.
 */

import { themeFindingAudit, type FindingsInput } from "./themeFindings";
import { severityRank } from "./themeSpecifics";

export type VerdictKind = "buy" | "wait" | "skip";

/** The minimal theme surface the slot applier needs. Structural: callers
 *  pass their own richer theme objects (e.g. reviewAnalysis ThemeSignal)
 *  directly. */
export type SafetyProbe = {
  key: string;
  severityRed: boolean;
};

/** Full theme surface for the wait line (render title included). */
export type SlotTheme = SafetyProbe & {
  /** Render title of the factor (as the page shows it). */
  title: string;
  claim: string;
  side: "for" | "against";
  count: number;
  reviewCount: number;
  texts: string[];
  stars: (number | null)[];
  productTitle?: string;
  opposingCount: number;
  opposingEvident: boolean;
};

/** Slot caps per verdict. Never padded: fewer earned themes render fewer. */
export function slotCaps(verdict: VerdictKind): { for: number; against: number } {
  return verdict === "buy"
    ? { for: 5, against: 2 }
    : verdict === "skip"
      ? { for: 2, against: 5 }
      : { for: 3, against: 3 };
}

/** A safety finding: severity-0 theme (safety) or a curated red-flag.
 *  Junel's never-hide rule outranks every slot cap: these ALWAYS render. */
export function isSafetyTheme(t: SafetyProbe): boolean {
  return t.severityRed || severityRank(t.key) === 0;
}

/**
 * Apply the verdict's slot caps to the two (already sorted) theme lists.
 * Within a side the input order is kept. Never pads: fewer earned themes
 * than the cap renders fewer. Never drops an earned safety item to fit
 * the against cap — the overflow renders after the capped list, in the
 * caller's order.
 */
export function applyVerdictSlots<T extends SafetyProbe>(
  verdict: VerdictKind,
  forThemes: T[],
  againstThemes: T[]
): { forThemes: T[]; againstThemes: T[] } {
  const caps = slotCaps(verdict);
  const forOut = forThemes.slice(0, caps.for);
  const againstOut = againstThemes.slice(0, caps.against);
  // Never-hide overflow: safety/red-flag items always render.
  for (const t of againstThemes) {
    if (!againstOut.includes(t) && isSafetyTheme(t)) againstOut.push(t);
  }
  return { forThemes: forOut, againstThemes: againstOut };
}

/**
 * The verdict kind for composition. Mirrors the field precedence the
 * shopper answer uses (result.verdict || finalVerdict || customerVerdict,
 * then the score card). NEVER computes or alters the verdict — unknown or
 * provisional states default to "wait" (balanced).
 */
export function compositionVerdict(result: unknown): VerdictKind {
  const rec = (result ?? {}) as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const v = String(
    rec.verdict ?? rec.finalVerdict ?? rec.customerVerdict ?? obj(rec.deterministic).customerVerdict ?? ""
  )
    .toUpperCase()
    .trim();
  if (v === "SKIP" || v === "AVOID" || /\bSKIP\b/.test(v)) return "skip";
  // Exact BUY only: "DO NOT BUY YET" contains BUY but is a wait state.
  if (v === "BUY") return "buy";
  const card = obj(rec.buyingScoreV2);
  const cv = String(card.verdict ?? "").toLowerCase().trim();
  if (cv === "buy") return "buy";
  if (cv === "skip" || cv === "avoid") return "skip";
  return "wait";
}

// ---------------------------------------------------------------------------
// The wait line (WAIT verdicts only): WHY wait + WHAT the wait is for,
// derived ONLY from real signals in the scan. Present-tense evidence
// language — never a prediction, never a generic template that could
// print on any product.
// ---------------------------------------------------------------------------

export type WaitCtx = {
  /** Buying score (rounded by the caller), null when unknown. */
  score: number | null;
  reviewCount: number;
  buyThreshold: number;
  waitThreshold: number;
  /** The RENDERED (post-slot) themes — the wait line explains the page. */
  forThemes: SlotTheme[];
  againstThemes: SlotTheme[];
};

function lowerTitle(t: string): string {
  const s = String(t ?? "").trim();
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function capTitle(t: string): string {
  const s = String(t ?? "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The findings-engine tier of a rendered theme (for thin-evidence detection). */
function auditTier(t: SlotTheme): string {
  try {
    const input: FindingsInput = {
      key: t.key,
      title: t.title,
      claim: t.claim,
      side: t.side,
      count: t.count,
      reviewCount: t.reviewCount,
      texts: t.texts,
      productTitle: t.productTitle,
      stars: t.stars,
    };
    return themeFindingAudit(input).tier;
  } catch {
    return "none";
  }
}

export function buildWaitLine(verdict: VerdictKind, ctx: WaitCtx): string | null {
  if (verdict !== "wait") return null;
  const { forThemes, againstThemes, reviewCount } = ctx;
  const byCount = <T extends SlotTheme>(arr: T[]): T[] => [...arr].sort((a, b) => b.count - a.count);
  const topFor = byCount(forThemes)[0] ?? null;
  const topAgainst = byCount(againstThemes)[0] ?? null;
  const tally = (t: SlotTheme) => `${t.count} of ${reviewCount} buyers`;

  // 1. Contested specific: buyers are split on a real, evidenced point.
  const contested = byCount([...forThemes, ...againstThemes]).find(
    (t) => t.opposingCount >= 1 && t.opposingEvident
  );
  if (contested) {
    return (
      `Buyers are split on ${lowerTitle(contested.title)} — ` +
      `${contested.count} of ${reviewCount} buyers report it, ${contested.opposingCount} report the opposite. ` +
      `That's the point to watch before buying.`
    );
  }

  // 2. Severe blocker: a safety/failure complaint coexists with real strengths.
  const severe = againstThemes.find(isSafetyTheme);
  if (severe && forThemes.length > 0) {
    return (
      `The ${lowerTitle(severe.title)} reports are the hard stop here — ` +
      `${tally(severe)} mention them — against real strengths like ${lowerTitle(topFor!.title)}. ` +
      `That's what's holding it at Wait.`
    );
  }

  // 3. Near-threshold score: just under the Buy bar, or just above Skip.
  const s = typeof ctx.score === "number" && isFinite(ctx.score) ? Math.round(ctx.score) : null;
  if (s !== null && topFor) {
    if (s >= ctx.buyThreshold - 5 && s < ctx.buyThreshold) {
      const againstBit = topAgainst ? `, and ${lowerTitle(topAgainst.title)} the case against` : "";
      return (
        `The score (${s}) sits just under our Buy bar (${ctx.buyThreshold}) — ` +
        `${lowerTitle(topFor.title)} is the case for${againstBit}. ` +
        `The wait is for more evidence on that split.`
      );
    }
    if (s >= ctx.waitThreshold && s <= ctx.waitThreshold + 5) {
      return (
        `The score (${s}) sits just above our Skip line (${ctx.waitThreshold}) — ` +
        `the evidence leans positive (${lowerTitle(topFor.title)}, ${tally(topFor)}) but it's too thin to buy yet.`
      );
    }
  }

  // 4. Thin evidence: small corpus or mostly fallback findings.
  const rendered = [...forThemes, ...againstThemes];
  const fallbackCount = rendered.filter((t) => auditTier(t) === "fallback").length;
  if (reviewCount < 12 || fallbackCount >= 2) {
    const thinBit =
      fallbackCount >= 2 ? ` — ${fallbackCount} of the findings are thin mentions` : "";
    return `Only ${reviewCount} reviews read so far${thinBit}. The picture could change as more buyers weigh in.`;
  }

  // 5. Split-summary fallback: the actual top themes, stated plainly. A
  // wait line is impossible without a qualifying signal EXCEPT through
  // this branch — and this branch always names the scan's real themes.
  if (topFor && topAgainst) {
    return `${capTitle(topFor.title)} — ${tally(topFor)} — set against ${lowerTitle(topAgainst.title)} (${tally(topAgainst)}).`;
  }
  if (topFor) {
    return `${capTitle(topFor.title)} — ${tally(topFor)} — and no recurring complaints in the reviews we read.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Wart fix: title/canonical stutter ("Leak-proof — leak-proof — toss it in
// a bag without spills"). When the bullet opens with the theme title's own
// word(s), the title already carries it — strip the duplicate from the
// bullet. Case-insensitive; never strips partial-word matches.
// ---------------------------------------------------------------------------

const LEAD_PUNCT = /^[—–\-:;,.]+$/;

export function dedupeTitleCollision(summary: string, title: string): string {
  const titleWords = String(title ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 0);
  if (!titleWords.length) return summary;
  const words = String(summary ?? "").split(/\s+/).filter(Boolean);
  let i = 0;
  let ti = 0;
  while (i < words.length && ti < titleWords.length) {
    // Same normalization as the title words: all non-alphanumerics
    // stripped, so "leak-proof" matches "Leak-proof".
    const w = words[i].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (w.length > 0 && w === titleWords[ti]) {
      i++;
      ti++;
    } else {
      break;
    }
  }
  // Strip when the bullet opens with the full title word sequence, OR when
  // the matched word(s) are followed by a label separator (em-dash/colon):
  // the Owala wart is "Leak-proof — leak-proof — toss it in a bag", where
  // the canonical's first segment IS the title restated. A sentence that
  // merely shares the title's verb ("Heats quickly — heats a room up in
  // minutes") is natural parallelism, not a stutter, and is kept. A partial
  // match with no separator ("easy" in "easy cleanup…" under "Easy clean")
  // is never stripped.
  if (i === 0) return summary;
  const fullTitle = ti === titleWords.length;
  const labelAfter = i < words.length && LEAD_PUNCT.test(words[i]);
  if (!fullTitle && !labelAfter) return summary;
  while (i < words.length && LEAD_PUNCT.test(words[i])) i++;
  return words.slice(i).join(" ");
}
