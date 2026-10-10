// A calm, compact verdict summary built only from real scan data.
// Used by the homepage sample and shareable verdict pages.
type Point = { claim: string; quote: string | null; sourceUrl: string | null; sourceHost?: string | null };
export type VerdictSummary = {
  product: string;
  label: string;
  kind: string;
  why: string;
  score: number | null;
  confidencePercent: number | null;
  confidenceWords: string;
  reviewCount: number;
  sources: string[];
  loves: Point[];
  complaints: Point[];
};

import { CountUp } from "./motion/CountUp";

const LABEL_STYLE: Record<string, string> = {
  buy: "bg-emerald-700 text-white",
  wait: "bg-[#fdf0d5] text-[#7a4a06]",
  skip: "bg-rose-700 text-white",
};

function host(url: string | null) {
  try { return url ? new URL(url).hostname.replace(/^www\./, "") : null; } catch { return null; }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Quote({ point, tone, delay = 0 }: { point: Point; tone: "love" | "complaint"; delay?: number }) {
  const source = point.sourceHost || host(point.sourceUrl);
  return (
    <li className="ri-fade-in min-w-0" style={{ ["--ri-delay" as string]: `${delay}ms` }}>
      <p className="text-sm font-semibold text-slate-900">
        <span aria-hidden="true" className={tone === "love" ? "text-teal" : "text-rose-700"}>{tone === "love" ? "+ " : "– "}</span>
        {cap(point.claim)}
      </p>
      {point.quote ? (
        <blockquote className="mt-1 border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-600">
          <p className="line-clamp-3">&ldquo;{point.quote}&rdquo;</p>
          {source ? (
            <footer className="mt-1 text-xs text-slate-500">
              {point.sourceUrl ? <a className="underline-offset-2 hover:underline focus-visible:underline" href={point.sourceUrl} target="_blank" rel="noopener noreferrer">{source}</a> : source}
            </footer>
          ) : null}
        </blockquote>
      ) : null}
    </li>
  );
}

export function VerdictSummaryCard({ summary, eyebrow, headingLevel = "h2" }: { summary: VerdictSummary; eyebrow?: string; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  const confidence = summary.confidencePercent !== null ? `${summary.confidencePercent}% · ${summary.confidenceWords}` : "Unknown";
  return (
    <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 sm:p-8">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">{eyebrow}</p> : null}
      <Heading className="mt-2 text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{summary.product}</Heading>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 text-base font-semibold ${LABEL_STYLE[summary.kind] || "bg-slate-100 text-slate-900"}`}>{summary.label}</span>
        {summary.score !== null ? <span className="text-sm text-slate-600">Score <CountUp value={summary.score} /> / 10</span> : null}
      </div>
      <p className="mt-4 text-base leading-7 text-slate-700">{summary.why}</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
        <div><dt className="text-slate-500">How sure we are</dt><dd className="mt-0.5 font-semibold text-slate-900">{confidence}</dd></div>
        <div><dt className="text-slate-500">Based on</dt><dd className="mt-0.5 font-semibold text-slate-900">{summary.reviewCount} real buyer review{summary.reviewCount === 1 ? "" : "s"}</dd></div>
      </dl>
      {summary.loves.length || summary.complaints.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {summary.loves.length ? <ul className="space-y-4" aria-label="What buyers love">{summary.loves.map((p, n) => <Quote key={p.claim} point={p} tone="love" delay={n * 120} />)}</ul> : null}
          {summary.complaints.length ? <ul className="space-y-4" aria-label="What buyers complain about">{summary.complaints.map((p, n) => <Quote key={p.claim} point={p} tone="complaint" delay={360 + n * 120} />)}</ul> : null}
        </div>
      ) : null}
      {summary.sources.length ? <p className="mt-5 text-xs text-slate-500">Based on {summary.reviewCount} real buyer reviews from {summary.sources.join(", ")}.</p> : null}
    </article>
  );
}
