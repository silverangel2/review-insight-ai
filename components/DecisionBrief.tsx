import {
  aiLikeSignsFor,
  briefImageUrl,
  deriveReviewAnalysis,
} from "@/lib/reviewAnalysis";
import {
  deriveShopperAnswer,
  evidenceStrengthLabel,
  marketplaceAggregateNumbers,
} from "@/lib/shopperAnswer";

// The decision-brief results page, approved by Junel (mockup v2, 2026-10-15).
// ONE calm column: the answer -> why you'd buy it -> why you might not ->
// how we checked. No verbatim buyer quotes, no AI TOOL PROOF telemetry, no
// second score card. Analysis (grouped, segregated, whole-corpus summaries)
// is the content, not pasted comments.

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

type EvidenceState = "not_enough" | "limited" | "usable" | null;

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

  const verdict =
    answer.kind === "buy"
      ? { word: "Buy", tone: "text-emerald-700 dark:text-emerald-300" }
      : answer.kind === "skip"
        ? { word: "Avoid", tone: "text-red-700 dark:text-red-300" }
        : { word: "Review first", tone: "text-amber-600 dark:text-amber-300" };

  const confidence = answer.confidenceWords === "Unknown" ? "—" : answer.confidenceWords;
  const value = answer.value === "Unknown" ? "—" : answer.value;
  const filledStars = agg.rating !== null ? Math.max(0, Math.min(5, Math.round(agg.rating))) : 0;

  const complaintNote =
    analysis.complaintsPattern === "none"
      ? "No buyer complaints in the reviews we read."
      : analysis.complaintsPattern === "one_off"
        ? "No complaint repeats across buyers — these are one-off concerns, shown because they matter."
        : "These concerns came up across multiple buyers.";

  const singleSource = answer.sources.length === 1;
  const aiLike = aiLikeSignsFor(result);

  return (
    <div className="space-y-3.5">
      {/* 1. The answer */}
      <section className="rounded-[1.4rem] bg-white p-5 shadow-soft dark:bg-slate-900">
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
          <p className={`text-[40px] font-extrabold leading-none tracking-tight ${verdict.tone}`}>
            {verdict.word}
          </p>
          <div className="ml-auto text-right">
            <p className="text-[30px] font-extrabold leading-none text-ink dark:text-white">
              {answer.score !== null ? Math.round(answer.score) : "—"}
            </p>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Buying Score / 100</p>
          </div>
        </div>
        <dl className="mt-4 border-t border-slate-100 dark:border-white/10">
          <div className="flex items-center justify-between border-b border-slate-100 py-2.5 dark:border-white/10">
            <dt className="text-[15px] text-slate-500 dark:text-slate-400">Marketplace rating</dt>
            <dd className="text-[15px] font-semibold text-ink dark:text-white">
              <span className="mr-1.5 text-amber-500">
                {"★".repeat(filledStars)}
                <span className="text-slate-300 dark:text-slate-600">{"☆".repeat(5 - filledStars)}</span>
              </span>
              {agg.rating !== null ? `${agg.rating} / 5` : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2.5 dark:border-white/10">
            <dt className="text-[15px] text-slate-500 dark:text-slate-400">Ratings counted</dt>
            <dd className="text-[15px] font-semibold text-ink dark:text-white">
              {agg.count !== null ? agg.count.toLocaleString("en-US") : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 py-2.5 dark:border-white/10">
            <dt className="text-[15px] text-slate-500 dark:text-slate-400">How sure we are</dt>
            <dd className="text-[15px] font-semibold text-ink dark:text-white">{confidence}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-[15px] text-slate-500 dark:text-slate-400">Value for money</dt>
            <dd className="text-[15px] font-semibold text-ink dark:text-white">{value}</dd>
          </div>
        </dl>
        <p className="mt-3.5 text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
          We read the buyer reviews, grouped what buyers kept saying, and weighed the good against
          the bad. We&apos;re independent — not affiliated with or endorsed by any brand.
        </p>
      </section>

      {/* 2. Why you'd buy it */}
      <section className="rounded-[1.4rem] bg-white p-5 shadow-soft dark:bg-slate-900">
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

      {/* 3. Why you might not */}
      <section className="rounded-[1.4rem] bg-white p-5 shadow-soft dark:bg-slate-900">
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

      {/* 4. How we checked — quiet by default */}
      <details className="group rounded-[1.4rem] bg-white px-5 shadow-soft dark:bg-slate-900">
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
          {aiLike ? <p>AI-like review signs: {aiLike}.</p> : null}
          <p>
            Only real written reviews and the marketplace rating are used. The score never reads
            more than the reviews behind this brief.
          </p>
        </div>
      </details>

      <p className="px-2 text-center text-[12px] leading-6 text-slate-400 dark:text-slate-500">
        Analysis of real written buyer reviews and the marketplace rating.
      </p>
    </div>
  );
}
