"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientAccount } from "@/lib/clientAccount";
import { saveLatestResult, setActiveScanId } from "@/lib/resultStorage";
import type { AnalyzeResponse } from "@/lib/types";

const STORAGE_KEY = "reviewintel:page-capture";

type CaptureOutcome =
  | { kind: "empty" }
  | { kind: "bad" }
  | { kind: "signin" }
  | { kind: "error"; message: string }
  | { kind: "done" };

let captureTask: { key: string; promise: Promise<CaptureOutcome> } | null = null;

function submitCapture(stored: string): Promise<CaptureOutcome> {
  if (captureTask?.key === stored) return captureTask.promise;
  const promise = (async (): Promise<CaptureOutcome> => {
    let payload: unknown;
    try { payload = decodeHash(stored); } catch { return { kind: "bad" }; }
    const response = await fetch("/api/page-capture", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null) as (AnalyzeResponse & { error?: string; code?: string }) | null;
    if (response.status === 401) return { kind: "signin" };
    if (!response.ok || !data?.scanId) {
      return { kind: "error", message: data?.error || "ReviewIntel could not score this page. Please try again." };
    }
    const account = getClientAccount();
    saveLatestResult(data, account);
    setActiveScanId(String(data.scanId));
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    window.location.replace(`/results?scanId=${encodeURIComponent(String(data.scanId))}`);
    return { kind: "done" };
  })();
  captureTask = { key: stored, promise };
  return promise;
}

function decodeHash(hash: string) {
  const body = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!body) return null;
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function CaptureClient() {
  const [message, setMessage] = useState("Reading the product page you opened.");
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      try { window.sessionStorage.setItem(STORAGE_KEY, hash); } catch { /* private mode */ }
      window.history.replaceState(null, "", window.location.pathname);
    }

    const stored = hash || window.sessionStorage.getItem(STORAGE_KEY) || "";
    if (!stored) {
      setMessage("Open a product page and choose Analyze this page again.");
      return;
    }

    void submitCapture(stored).then((outcome) => {
      if (cancelled || outcome.kind === "done") return;
      if (outcome.kind === "empty") setMessage("Open a product page and choose Analyze this page again.");
      else if (outcome.kind === "bad") setMessage("That page could not be read. Go back to the product page and try again.");
      else if (outcome.kind === "signin") {
        setRetry(true);
        setMessage("Sign in to ReviewIntel in this browser, then come back to this tab and tap Continue.");
      } else setMessage(outcome.message);
    }).catch(() => {
      if (!cancelled) setMessage("ReviewIntel could not score this page. Please try again.");
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-black text-ink dark:text-white">ReviewIntel</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300" role="status">{message}</p>
      {retry ? (
        <p className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white">Sign in</Link>
          <button type="button" className="rounded-full border border-line px-4 py-2 text-sm font-black" onClick={() => window.location.reload()}>Continue</button>
        </p>
      ) : null}
    </main>
  );
}
