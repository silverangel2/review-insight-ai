type BadgeTone = "neutral" | "good" | "warn" | "bad" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
  good: "border-teal/25 bg-teal/10 text-teal",
  warn: "border-amber/25 bg-amber/10 text-amber",
  bad: "border-coral/25 bg-coral/10 text-coral",
  info: "border-ocean/25 bg-ocean/10 text-ocean"
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
