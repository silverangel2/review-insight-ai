export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/10" />
      <div className="mt-6 h-4 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-4 w-5/6 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/10" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/10" />
        <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/10" />
      </div>
    </div>
  );
}
