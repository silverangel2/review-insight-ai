"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/** The homepage hero input: paste a product link, continue on /analyze with it prefilled. */
export function HomePasteLink() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const link = value.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(link)) { setError("Paste a full product link, starting with https://"); return; }
    setError("");
    router.push(`/analyze?url=${encodeURIComponent(link)}`);
  }

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className="sr-only">Amazon product link</label>
      <div className="flex flex-col gap-2 rounded-[1.4rem] bg-white p-2 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/10 focus-within:ring-2 focus-within:ring-teal sm:flex-row">
        <input id={id} type="url" inputMode="url" autoComplete="off" spellCheck={false}
          placeholder="Paste any Amazon link" value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(""); }}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-12 w-full flex-1 rounded-2xl bg-transparent px-4 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none" />
        <button type="submit" className="ri-lift min-h-12 rounded-2xl bg-teal px-6 text-base font-semibold text-white transition hover:bg-teal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          Check reviews
        </button>
      </div>
      <p id={`${id}-error`} role="alert" className="mt-2 min-h-5 text-sm text-rose-700">{error}</p>
    </form>
  );
}
