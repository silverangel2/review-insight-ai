import Link from "next/link";
import type { BuyingScoreResult } from "@/lib/buyingScore";

type Card = BuyingScoreResult & { quotes?: { safety: string[]; reliability: string[]; positive: string[]; negative: string[] } };

const verdictTone: Record<string, string> = {
  Buy: "bg-emerald-600 text-white",
  Wait: "bg-amber-500 text-white",
  Skip: "bg-rose-600 text-white",
};
const warningTone: Record<string, string> = {
  official_recall: "border-rose-300 bg-rose-50 text-rose-900",
  repeated_safety: "border-rose-300 bg-rose-50 text-rose-900",
  single_safety: "border-amber-300 bg-amber-50 text-amber-900",
  repeated_reliability: "border-amber-300 bg-amber-50 text-amber-900",
  too_new: "border-slate-200 bg-slate-50 text-slate-800",
  discrepancy: "border-amber-200 bg-amber-50 text-amber-900",
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

export function BuyingScoreV2Card({ score, compact = false }: { score: Card; compact?: boolean }) {
  const isProvisional = score.mode === "provisional_marketplace";
  const isNoScore = score.mode === "no_score";
  const verdictText = isProvisional && score.leaning ? `Leaning ${score.leaning}` : score.verdict || "";
  const toneKey = score.verdict || score.leaning || "Wait";
  const quotes = score.quotes;
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
          <p data-testid="evidence-line" className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{score.evidenceLine}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Confidence: {score.confidenceReason}</p>
        </div>
        {!isNoScore ? (
          <div className="flex items-center gap-3">
            <div className={`grid place-items-center rounded-full border-4 ${isProvisional ? "border-dashed border-slate-300" : "border-slate-200"} ${compact ? "size-16" : "size-20"}`}>
              <span className={`${compact ? "text-2xl" : "text-3xl"} font-black text-ink dark:text-white`}>{score.score}</span>
              <span className="-mt-2 text-[10px] font-bold text-slate-400">/100</span>
            </div>
            <span data-testid="verdict" className={`rounded-full px-3 py-1.5 text-sm font-black ${isProvisional ? "border border-slate-300 bg-white text-slate-800" : verdictTone[toneKey]}`}>
              {verdictText}
            </span>
          </div>
        ) : null}
      </div>

      {score.warnings.length ? (
        <div className="mt-4 grid gap-2">
          {score.warnings.map((w, i) => (
            <div key={i} data-testid={`warning-${w.tier}`} className={`rounded-xl border px-3 py-2 text-sm ${warningTone[w.tier]}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-80">{warningTitle[w.tier]}</p>
              <p className="font-semibold">{w.text}</p>
              {w.quotes.map((q, j) => (
                <blockquote key={j} className="mt-1 border-l-2 border-current/30 pl-2 text-xs italic opacity-90">“{q}”</blockquote>
              ))}
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

      {!isProvisional && !isNoScore && quotes && (quotes.positive.length || quotes.negative.length) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {quotes.positive.length ? (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">What buyers like</p>
              {quotes.positive.slice(0, compact ? 2 : 3).map((q, i) => <blockquote key={i} className="mt-1 text-xs italic text-slate-700 dark:text-slate-300">“{q}”</blockquote>)}
            </div>
          ) : null}
          {quotes.negative.length ? (
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-rose-700">Complaints</p>
              {quotes.negative.slice(0, compact ? 2 : 3).map((q, i) => <blockquote key={i} className="mt-1 text-xs italic text-slate-700 dark:text-slate-300">“{q}”</blockquote>)}
            </div>
          ) : null}
        </div>
      ) : null}

      {score.primaryAction ? (
        <Link href="/analyze?mode=link" data-testid="paste-link-cta"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-black text-white sm:w-auto">
          {score.primaryAction}
        </Link>
      ) : null}
      <p className="mt-3 text-[11px] text-slate-400">Only real written reviews and the marketplace rating are used. The score never reads more than the reviews shown above.</p>
    </section>
  );
}
