"use client";

import { useState } from "react";

type Props = { path?: string; scanId?: string; result?: unknown; title: string };

/** Share a verdict: uses an existing share path, or asks /api/share to create one for a saved scan. */
export function ShareVerdictButton({ path, scanId, result, title }: Props) {
  const [status, setStatus] = useState<"idle" | "working" | "copied" | "error">("idle");
  const [message, setMessage] = useState("");

  async function share() {
    setStatus("working"); setMessage("");
    try {
      let sharePath = path;
      if (!sharePath) {
        const response = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scanId, result }) });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) throw new Error(data?.error || "Couldn't create a share link.");
        sharePath = data.path as string;
      }
      const url = new URL(sharePath!, window.location.origin).toString();
      if (navigator.share) {
        try { await navigator.share({ title, url }); setStatus("idle"); return; } catch { /* fall back to copy */ }
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied"); setMessage("Link copied");
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Couldn't share.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={share} disabled={status === "working"}
        className="ri-lift inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-teal hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {status === "working" ? "Creating link…" : "Share verdict"}
      </button>
      <span role="status" aria-live="polite" className={`text-xs ${status === "error" ? "text-rose-700" : "text-slate-500"}`}>{message}</span>
    </div>
  );
}
