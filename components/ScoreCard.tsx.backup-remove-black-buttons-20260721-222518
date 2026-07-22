export function ScoreCard({
  label,
  value,
  detail,
  tone = "info"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "info" | "good" | "warn" | "bad";
}) {
  const color = {
    info: "text-ocean",
    good: "text-teal",
    warn: "text-amber",
    bad: "text-coral"
  }[tone];

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-4 text-4xl font-black tracking-tight ${color}`}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
    </article>
  );
}
