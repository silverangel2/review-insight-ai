import { briefImageUrl, deriveReviewAnalysis } from "@/lib/reviewAnalysis";
import {
  deriveShopperAnswer,
  shopperVerdictWord,
  evidenceStrengthLabel,
  marketplaceAggregateNumbers,
} from "@/lib/shopperAnswer";
import { analyzeAiPatterns, authRowFor, authSentenceFor } from "@/lib/aiPatternForensics";
import { BriefReveal } from "@/components/BriefReveal";
import { ScoreCountUp } from "@/components/ScoreCountUp";

// The decision-brief results page, approved by Junel (mockup v2, 2026-10-15).
// ONE calm column on mobile: the answer -> why you'd buy it -> why you might
// not -> how we checked. On desktop (>=1024px) it uses the canvas: answer
// card on top with horizontal fact cells, the two factor columns side by
// side, the fold full width below.
// No verbatim buyer quotes, no AI TOOL PROOF telemetry, no second score
// card. Analysis (grouped, segregated, whole-corpus summaries) is the
// content, not pasted comments.
// Theme: aurora backdrop (foundation), glass/white cards with colored
// shadows, gradient hairline on the answer card. Phase 7 unlock choreography
// (BriefReveal + ScoreCountUp) runs on fresh reveals only.

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

type EvidenceState = "not_enough" | "limited" | "usable" | null;

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function DecisionBrief({
  result,
  productName,
  previewImage,
  evidenceState,
}: {
  result: unknown;
  productName: string;
  previewImage?: string;
  evidenceState: EvidenceState;
}) {
  const answer = deriveShopperAnswer(result);
  const analysis = deriveReviewAnalysis(result);
  const agg = marketplaceAggregateNumbers(result);
  const record = obj(result);
  const store = String(obj(record.product).store || record.store || "").trim();
  const image = briefImageUrl(result, previewImage);
  const aiProfile = analyzeAiPatterns(result);
  const authRow = authRowFor(aiProfile);
  const authSentence = authSentenceFor(aiProfile);

  const revealKey =
    [record.scanId, record.id, productName].map((v) => String(v || "").trim()).find(Boolean) || null;

  // Round 2 defect 1: the headline verdict word comes from the same single
  // derivation (shopperVerdictWord) as the cards and the page headline.
  const verdictWord = shopperVerdictWord(result) ?? "Review first";
  const verdict =
    verdictWord === "Avoid"
      ? { word: verdictWord, tone: "text-red-700 dark:text-red-300" }
      : verdictWord === "Buy"
        ? { word: verdictWord, tone: "text-emerald-700 dark:text-emerald-300" }
        : { word: "Review first", tone: "text-amber-600 dark:text-amber-300" };

  const confidence = answer.confidenceWords === "Unknown" ? "—" : answer.confidenceWords;
  const value = answer.value === "Unknown" ? "—" : answer.value;
  const filledStars = agg.rating !== null ? Math.max(0, Math.min(5, Math.round(agg.rating))) : 0;

  // Hard rule: the "no complaints" empty state renders ONLY when the entire
  // segregated corpus holds zero negative signals. Any negative anywhere ->
  // an against-factor, a red-flag sentence, a caveat, or a named suppressed
  // theme. Never hidden.
  const complaintNote = (() => {
    if (analysis.againstFactors.length > 0) {
      return analysis.complaintsPattern === "one_off"
        ? "No complaint repeats across buyers — these are one-off concerns, shown because they matter."
        : "These concerns came up across multiple buyers.";
    }
    if (analysis.hasNegatives) {
      const names = analysis.suppressedThemes.slice(0, 3);
      const about = names.length ? ` about ${joinList(names)}` : "";
      return (
        `Buyers raised isolated concerns${about} — each is weighed against the praise ` +
        `above, where it's noted.`
      );
    }
    return "No buyer complaints in the reviews we read.";
  })();

  const singleSource = answer.sources.length === 1;

  const factCell =
    "flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 " +
    "dark:border-white/10 lg:flex-col lg:items-start lg:justify-start lg:gap-1 " +
    "lg:rounded-2xl lg:border lg:border-slate-100 lg:p-4 dark:lg:border-white/10";
  const factTerm = "text-[15px] text-slate-500 dark:text-slate-400 lg:text-[13px]";
  const factValue = "text-[15px] font-semibold text-ink dark:text-white lg:text-[14px]";

  return (
    <BriefReveal revealKey={revealKey} className="mx-auto w-full max-w-[1040px]">
      <div className="space-y-3.5">
        {/* 1. The answer */}
        <section className="ri-card ri-hairline ri-unlock p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] text-slate-500 dark:text-slate-400">
              {productName}
              {store ? ` · ${store}` : ""}
            </p>
            {image ? (
              <img
                src={image}
                alt={productName}
                className="size-16 shrink-0 rounded-xl border border-slate-100 object-cover dark:border-white/10"
                loading="lazy"
              />
            ) : null}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink dark:text-white">
            Should you buy it?
          </h1>
          <div className="mt-3 flex items-center gap-4">
            <p
              className={`ri-glimmer inline-block text-[40px] font-extrabold leading-none tracking-tight ${verdict.tone}`}
            >
              {verdict.word}
            </p>
            <div className="ml-auto text-right">
              <p className="text-[30px] font-extrabold leading-none text-ink dark:text-white">
                {answer.score !== null ? (
                  <ScoreCountUp value={Math.round(answer.score)} revealKey={revealKey} />
                ) : (
                  "—"
                )}
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Buying Score / 100</p>
            </div>
          </div>
          <dl className="ri-unlock-child ri-d1 mt-4 grid grid-cols-1 border-t border-slate-100 dark:border-white/10 lg:grid-cols-5 lg:gap-3 lg:border-t-0">
            <div className={factCell}>
              <dt className={factTerm}>Marketplace rating</dt>
              <dd className={factValue}>
                <span className="mr-1.5 text-amber-500">
                  {"★".repeat(filledStars)}
                  <span className="text-slate-300 dark:text-slate-600">{"☆".repeat(5 - filledStars)}</span>
                </span>
                {agg.rating !== null ? `${agg.rating} / 5` : "—"}
              </dd>
            </div>
            <div className={factCell}>
              <dt className={factTerm}>Ratings counted</dt>
              <dd className={factValue}>
                {agg.count !== null ? agg.count.toLocaleString("en-US") : "—"}
              </dd>
            </div>
            <div className={factCell}>
              <dt className={factTerm}>How sure we are</dt>
              <dd className={factValue}>{confidence}</dd>
            </div>
            <div className={factCell}>
              <dt className={factTerm}>Value for money</dt>
              <dd className={factValue}>{value}</dd>
            </div>
            <div className={factCell}>
              <dt className={factTerm}>Review authenticity</dt>
              <dd className={factValue}>{authRow}</dd>
            </div>
          </dl>
          <p className="mt-3.5 text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
            We read the buyer reviews, grouped what buyers kept saying, and weighed the good against
            the bad. We&apos;re independent — not affiliated with or endorsed by any brand.
          </p>
        </section>

        {/* 2 + 3. The two factor columns: stacked on mobile, side by side on desktop */}
        <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-4">
          <section className="ri-card ri-lift ri-unlock-child ri-d2 p-5">
            <h2 className="text-[17px] font-bold text-ink dark:text-white">Why you&apos;d buy it</h2>
            <div className="mt-1">
              {analysis.forFactors.map((factor, index) => (
                <div
                  key={`for-${index}`}
                  className="border-b border-slate-100 py-3 last:border-0 last:pb-0 dark:border-white/10"
                >
                  <p className="text-[15.5px] font-bold text-ink dark:text-white">
                    <span className="mr-2">✓</span>
                    {factor.title}
                  </p>
                  <p className="mt-1.5 text-[14.5px] leading-6 text-slate-700 dark:text-slate-200">
                    {factor.summary}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-400 dark:text-slate-500">{factor.basis}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ri-card ri-lift ri-unlock-child ri-d3 p-5">
            <h2 className="text-[17px] font-bold text-ink dark:text-white">Why you might not</h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">{complaintNote}</p>
            <div className="mt-1">
              {analysis.againstFactors.map((factor, index) => (
                <div
                  key={`against-${index}`}
                  className="border-b border-slate-100 py-3 last:border-0 last:pb-0 dark:border-white/10"
                >
                  <p className="text-[15.5px] font-bold text-ink dark:text-white">
                    <span className="mr-2">!</span>
                    {factor.title}
                  </p>
                  <p className="mt-1.5 text-[14.5px] leading-6 text-slate-700 dark:text-slate-200">
                    {factor.summary}
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-400 dark:text-slate-500">{factor.basis}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 4. How we checked — quiet by default */}
        <details className="ri-card ri-unlock-child ri-d4 group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-semibold text-slate-700 dark:text-slate-200">
            How we checked
            <span className="text-slate-400 transition group-open:rotate-180" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div className="space-y-2 pb-5 text-[14px] leading-6 text-slate-600 dark:text-slate-300">
            <p>
              <span className="font-semibold text-slate-700 dark:text-slate-200">Evidence strength:</span>{" "}
              {evidenceStrengthLabel(evidenceState)}
            </p>
            {singleSource ? (
              <p>Single-source evidence; other sources did not corroborate these reviews.</p>
            ) : null}
            {authSentence ? <p>{authSentence}</p> : null}
            <p>Only real written reviews and the marketplace rating feed the score.</p>
          </div>
        </details>

        <p className="ri-unlock-child ri-d5 px-2 text-center text-[12px] leading-6 text-slate-400 dark:text-slate-500">
          Analysis of real written buyer reviews and the marketplace rating.
        </p>
      </div>
    </BriefReveal>
  );
}
