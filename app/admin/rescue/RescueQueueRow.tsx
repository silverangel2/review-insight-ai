"use client";

import { useState } from "react";
import type { RescueQueueRow as QueueRow } from "@/lib/rescueQueue";

function ageText(createdAt: string): string {
  const ms = Date.now() - Date.parse(createdAt);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RescueQueueRow({ row, readonly }: { row: QueueRow; readonly?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "load" | "rescore">(null);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{
    verdict?: string;
    buyingScore?: number | null;
    emailSent?: boolean;
    emailSkipped?: string | null;
    saved?: number;
  } | null>(null);

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function saveToLibrary() {
    setBusy("load");
    setNotice("");
    setResult(null);
    const { res, data } = await post("/api/admin/rescue-queue/load-reviews", { id: row.id, text });
    setBusy(null);
    if (!res.ok) {
      setNotice(typeof data?.error === "string" ? data.error : "Could not save those reviews.");
      return;
    }
    setResult({ saved: data.saved });
    setNotice(
      `Saved ${data.saved ?? 0} new reviews to the library under ${data.productKey ?? "the product"}.`
    );
    setText("");
  }

  async function rescoreAndEmail() {
    setBusy("rescore");
    setNotice("");
    setResult(null);
    const { res, data } = await post("/api/admin/rescue-queue/rescore-email", { id: row.id });
    setBusy(null);
    if (!res.ok) {
      setNotice(typeof data?.error === "string" ? data.error : "Could not rescore this product.");
      return;
    }
    setResult({
      verdict: data.verdict,
      buyingScore: data.buyingScore,
      emailSent: data.emailSent,
      emailSkipped: data.emailSkipped,
    });
  }

  const done = row.status === "emailed" || row.status === "closed";

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-ink">{row.product_name || "Unnamed product"}</p>
          <p className="mt-1 text-xs text-ink/60">
            {row.account_email || "guest"} · {row.reason || "insufficient evidence"} · {ageText(row.created_at)}
            {row.product_url ? (
              <>
                {" · "}
                <a href={row.product_url} target="_blank" rel="noreferrer" className="underline">
                  product link
                </a>
              </>
            ) : null}
          </p>
          {row.verdict ? (
            <p className="mt-2 text-sm font-bold text-ink">
              Verdict: {row.verdict}
              {typeof row.buying_score === "number" ? ` · ${row.buying_score}/100` : ""}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
          {row.status}
        </span>
      </div>

      {!readonly && !done ? (
        <>
          <label htmlFor={`rescue-text-${row.id}`} className="mt-4 block text-xs font-black uppercase tracking-wide text-ink/60">
            Paste the reviews you found
          </label>
          <textarea
            id={`rescue-text-${row.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"One review per paragraph. A star rating at the start (e.g. \"5 stars\") is picked up automatically."}
            rows={5}
            className="mt-2 w-full rounded-xl border border-line bg-slate-50 p-3 text-sm text-ink placeholder:text-slate-400"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy !== null || !text.trim()}
              onClick={() => void saveToLibrary()}
              className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {busy === "load" ? "Saving…" : "Save to library"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void rescoreAndEmail()}
              className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink disabled:opacity-50"
            >
              {busy === "rescore" ? "Rescoring…" : "Rescore & email"}
            </button>
          </div>
        </>
      ) : null}

      {notice ? <p className="mt-3 text-sm font-bold text-ink">{notice}</p> : null}
      {result?.verdict ? (
        <p className="mt-3 text-sm text-ink/70">
          New verdict: <strong>{result.verdict}</strong>
          {typeof result.buyingScore === "number" ? ` (${result.buyingScore}/100)` : ""}
          {result.emailSent ? " — emailed to the customer." : ""}
          {result.emailSkipped ? ` — ${result.emailSkipped}` : ""}
        </p>
      ) : null}
    </section>
  );
}
