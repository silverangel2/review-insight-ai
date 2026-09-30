"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center">
      <h2 className="text-2xl font-black text-ink dark:text-white">Something went wrong</h2>
      <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
        We hit an unexpected error{error?.digest ? ` (ref ${error.digest})` : ""}. Please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-2xl bg-ink px-8 py-4 text-base font-black text-white shadow-soft transition hover:-translate-y-0.5 dark:bg-white dark:text-ink"
      >
        Try again
      </button>
    </div>
  );
}
