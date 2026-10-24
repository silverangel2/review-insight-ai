import type React from "react";
import Link from "next/link";
import { provisionalShopperFacing, type BuyingScoreResult } from "@/lib/buyingScore";
import { cleanQuoteText, isSpecificShopperFinding, sanitizeVerdictWord, thirdPersonFinding } from "@/lib/shopperAnswer";
import { sameDisplayedQuote } from "@/lib/evidenceConsistency";

type Card = BuyingScoreResult & { quotes?: { safety: string[]; reliability: string[]; positive: string[]; negative: string[] } };

// Inline colours so the verdict and warning tiers never depend on theme overrides.
const verdictStyle: Record<string, React.CSSProperties> = {
  Buy: { background: "#059669", color: "#fff" },
  Wait: { background: "#d97706", color: "#fff" },
  Skip: { background: "#e11d48", color: "#fff" },
};
const warningStyle: Record<string, React.CSSProperties> = {
  official_recall: { background: "#fff1f2", borderColor: "#fda4af", color: "#881337" },
  repeated_safety: { background: "#fff1f2", borderColor: "#fda4af", color: "#881337" },
  single_safety: { background: "#fffbeb", borderColor: "#fcd34d", color: "#78350f" },
  repeated_reliability: { background: "#fffbeb", borderColor: "#fcd34d", color: "#78350f" },
  too_new: { background: "#f8fafc", borderColor: "#e2e8f0", color: "#1e293b" },
  discrepancy: { background: "#fffbeb", borderColor: "#fde68a", color: "#78350f" },
};
const warningTitle: Record<string, string> = {
  official_recall: "Official recall",
  repeated_safety: "Safety warning",
  single_safety: "Safety report",
  repeated_reliability: "Reliability warning",
  too_new: "Few ratings so far",
  discrepancy: "Visible reviews disagree",
};

export function isBuyingScoreV2(value: unknown): value is Card {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).version === "buying-score-v2");
}

export function BuyingScoreV2Card({ score, compact = false, store, quoteKeys, attributionOf }: {
  score: Card;
  compact?: boolean;
  store?: string | null;
  /**
   * Normalized quote keys already shown in the primary quotes section
   * (ShopperAnswerCard). Quotes matching these are not repeated here.
   */
  quoteKeys?: string[];
  /**
   * Canonical attribution for a displayed quote (same label everywhere).
   * Receives the quote text, returns the source host or null.
   */
  attributionOf?: (quote: string) => string | null;
}) {
  const isProvisional = score.mode === "provisional_marketplace";
  const isNoScore = score.mode === "no_score";
  const facing = isProvisional ? provisionalShopperFacing(score, store) : null;
  // Round 3: render-boundary guard — the stored card verdict is
  // canonicalized so only Buy / Wait / Skip can ever display, no matter
  // which pipeline wrote the record.
  const verdictText = facing
    ? (facing.firmBuy ? "Buy" : sanitizeVerdictWord(`Leaning ${facing.leaning}`))
    : isProvisional && score.leaning
      ? sanitizeVerdictWord(`Leaning ${score.leaning}`)
      : sanitizeVerdictWord(score.verdict || "");
  const toneKey = facing?.verdict || facing?.leaning || score.verdict || score.leaning || "Wait";
  const quotes = score.quotes;
  // Display-layer quote hygiene (defect batches 1+2): clean markdown artifacts,
  // never repeat a quote already shown in the primary quotes section or
  // earlier on this card, and use one canonical attribution per quote.
  // Truncation-aware matching: the same review body truncated at different
  // lengths on different sections still counts as the same quote. No stored
  // data is changed.
  const excludeKeys = quoteKeys ?? [];
  const visibleQuotes = (list: string[]): Array<{ text: string; host: string | null }> => {
    const out: Array<{ text: string; host: string | null }> = [];
    const cardKeys: string[] = [];
    for (const raw of list) {
      const text = cleanQuoteText(raw);
      if (!text) continue;
      if (excludeKeys.some((key) => sameDisplayedQuote(key, text))) continue;
      if (cardKeys.some((key) => sameDisplayedQuote(key, text))) continue;
      cardKeys.push(text);
      out.push({ text, host: attributionOf ? attributionOf(raw) : null });
    }
    return out;
  };
  const visiblePositive = visibleQuotes(quotes?.positive ?? []);
  const visibleNegative = visibleQuotes(quotes?.negative ?? []);
  return (
    <section data-testid="buying-score-v2" data-mode={score.mode}
      className={`rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-slate-900 ${compact ? "p-4" : "p-6"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{score.label}</p>
          {score.provisionalLabel ? (
            <p data-testid="provisional-label" className="mt-1 inline-flex rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700">
              {score.provisionalLabel}
            </p>
          ) : null}
          <p data-testid="evidence-line" className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{facing?.line || score.evidenceLine}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Confidence: {facing ? `${facing.confidence} confidence` : `${score.confidence} confidence`}</p>
        </div>
        {!isNoScore ? (
          <div className="flex items-center gap-3">
            <div className={`grid place-items-center rounded-full border-4 ${isProvisional ? "border-dashed border-slate-300" : "border-slate-200"} ${compact ? "size-16" : "size-20"}`}>
              <span className={`${compact ? "text-2xl" : "text-3xl"} font-black text-ink dark:text-white`}>{score.score}</span>
              <span className="-mt-2 text-[10px] font-bold text-slate-400">/100</span>
            </div>
            <span data-testid="verdict" style={facing?.firmBuy ? verdictStyle.Buy : isProvisional ? undefined : verdictStyle[toneKey]}
              className={`rounded-full px-3 py-1.5 text-sm font-black ${facing?.firmBuy ? "" : isProvisional ? "border border-slate-300 bg-white text-slate-800" : ""}`}>
              {verdictText}
            </span>
          </div>
        ) : null}
      </div>

      {score.warnings.length ? (
        <div className="mt-4 grid gap-2">
          {score.warnings.map((w, i) => (
            <div key={i} data-testid={`warning-${w.tier}`} style={warningStyle[w.tier]} className="rounded-xl border px-3 py-2 text-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-80">{warningTitle[w.tier]}</p>
              <p className="font-semibold">{w.text}</p>
              {w.sourceUrl ? <a href={w.sourceUrl} className="mt-1 inline-block text-xs font-bold underline" rel="noopener noreferrer" target="_blank">Source</a> : null}
            </div>
          ))}
        </div>
      ) : null}

      {score.notes.length ? (
        <ul className="mt-3 grid gap-1 text-sm text-slate-700 dark:text-slate-300">
          {score.notes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      ) : null}

      {!isProvisional && !isNoScore && (visiblePositive.length || visibleNegative.length) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(() => {
            const lines = Array.from(new Set(visiblePositive.slice(0, compact ? 2 : 3).map((q) => thirdPersonFinding(q.text, "strength", q.text)))).filter((line): line is string => Boolean(line && isSpecificShopperFinding(line)));
            return lines.length ? (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">What buyers like</p>
              {lines.map((line) => (
                <p key={line} className="mt-1 text-xs text-slate-700 dark:text-slate-300">{line}</p>
              ))}
            </div>
            ) : null;
          })()}
          {(() => {
            const lines = Array.from(new Set(visibleNegative.slice(0, compact ? 2 : 3).map((q) => thirdPersonFinding(q.text, "complaint", q.text)))).filter((line): line is string => Boolean(line && isSpecificShopperFinding(line)));
            return lines.length ? (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-rose-700">Complaints</p>
              {lines.map((line) => (
                <p key={line} className="mt-1 text-xs text-slate-700 dark:text-slate-300">{line}</p>
              ))}
            </div>
            ) : null;
          })()}
        </div>
      ) : null}

      {score.primaryAction ? (
        <Link href="/analyze?mode=link" data-testid="paste-link-cta"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-black text-white sm:w-auto">
          {score.primaryAction}
        </Link>
      ) : null}
      <p className="mt-3 text-[11px] text-slate-400">Only real written reviews and the marketplace rating are used.</p>
    </section>
  );
}
