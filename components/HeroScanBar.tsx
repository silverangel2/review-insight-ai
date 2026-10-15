"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * HeroScanBar — the hero's glass paste-bar with gradient "Check it" button.
 * Presentation only: wires into the EXISTING scan flow (/analyze?url=), with
 * the same validation rules the homepage paste-link has always used.
 */
export function HeroScanBar() {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Paste a product link to check it.");
      return;
    }
    try {
      const u = new URL(trimmed);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad protocol");
      setError(null);
      router.push(`/analyze?url=${encodeURIComponent(trimmed)}`);
    } catch {
      setError("That doesn't look like a product link. Copy the full URL and try again.");
    }
  };

  return (
    <div>
      <form onSubmit={submit} noValidate className="ri-ask mx-auto w-full max-w-[600px] rounded-full p-1.5 sm:p-2">
        <div className="flex items-center">
          <label htmlFor={inputId} className="sr-only">
            Product link
          </label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste any product link"
            aria-label="Product link"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="min-h-12 flex-1 bg-transparent px-5 text-base text-ink placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="ri-btn-gradient min-h-12 shrink-0 rounded-full px-6 text-base font-semibold sm:px-7"
          >
            Check it
          </button>
        </div>
      </form>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
