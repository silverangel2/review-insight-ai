"use client";

import { useState } from "react";

type Receipt = {
  ok?: boolean;
  ingested?: number;
  skippedShortBodies?: number;
  skippedDuplicates?: number;
  productKey?: string;
  error?: string;
  [key: string]: unknown;
};

export function OwnerFeedIngestForm() {
  const [batchText, setBatchText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setBatchText(String(reader.result || ""));
    reader.readAsText(file);
  }

  async function ingest() {
    if (!batchText.trim() || busy) return;
    setBusy(true);
    setReceipt(null);
    try {
      const res = await fetch("/api/admin/owner-feed-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchText }),
      });
      const data = (await res.json().catch(() => ({}))) as Receipt;
      setReceipt({ ...data, ok: res.ok && data.ok !== false });
    } catch (error) {
      setReceipt({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <label className="block text-sm font-bold text-ink" htmlFor="owner-feed-file">
        Batch file (.md)
      </label>
      <input
        id="owner-feed-file"
        type="file"
        accept=".md,text/markdown,text/plain"
        className="mt-2 block text-sm"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {fileName ? <p className="mt-1 text-xs text-ink/60">Loaded: {fileName}</p> : null}
      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="owner-feed-text">
        Or paste the batch text
      </label>
      <textarea
        id="owner-feed-text"
        value={batchText}
        onChange={(e) => setBatchText(e.target.value)}
        rows={10}
        className="mt-2 w-full rounded-xl border border-line p-3 font-mono text-xs"
        placeholder="Batch markdown..."
      />
      <button
        type="button"
        onClick={ingest}
        disabled={busy || !batchText.trim()}
        className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        {busy ? "Ingesting..." : "Ingest batch"}
      </button>
      {receipt ? (
        <pre className="mt-4 overflow-auto rounded-xl bg-ink/5 p-3 text-xs">
          {JSON.stringify(receipt, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
