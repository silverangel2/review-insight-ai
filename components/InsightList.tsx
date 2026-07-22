import { sanitizeInsightList } from "@/lib/insightSanitizer";

export function InsightList({
  title,
  items,
  tone = "neutral"
}: {
  title: string;
  items: string[];
  tone?: "neutral" | "good" | "bad" | "warn" | "info";
}) {
  const cleanItems = sanitizeInsightList(items, [], 8);
  const dot = {
    neutral: "bg-slate-400",
    good: "bg-teal",
    bad: "bg-coral",
    warn: "bg-amber",
    info: "bg-ocean"
  }[tone];

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</h3>
      <ul className="mt-4 space-y-3">
        {cleanItems.length === 0 ? (
          <li className="text-sm leading-6 text-slate-500 dark:text-slate-400">No strong pattern detected.</li>
        ) : (
          cleanItems.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              <span className={`mt-2 size-2 shrink-0 rounded-full ${dot}`} />
              <span>{item}</span>
            </li>
          ))
        )}
      </ul>
    </article>
  );
}
