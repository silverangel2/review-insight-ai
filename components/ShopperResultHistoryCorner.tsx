"use client";

import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";
import { readLatestResult, saveLatestResult } from "@/lib/resultStorage";
import { buildProductMemoryBrain } from "@/lib/productMemoryBrain";
import { displayCodeForResult } from "@/lib/productDisplay";
import { readStoredLocale } from "@/lib/i18n";
import { shortProductName } from "@/lib/productName";

const HISTORY_KEY = "reviewintel_shopper_result_history";

function accountHistoryKey(account: unknown) {
  const value = account as {
    email?: string;
    id?: string;
    accountId?: string;
    plan?: string;
  } | null;

  const identity = (
    value?.email ||
    value?.id ||
    value?.accountId ||
    "guest"
  )
    .trim()
    .toLowerCase();

  const plan = (
    value?.plan ||
    "buyer_pro"
  )
    .trim()
    .toLowerCase();

  return `${HISTORY_KEY}:${plan}:${identity}`;
}
const MAX_PER_WEEK = 10;
const MAX_AGE_DAYS = 30;

type HistoryItem = {
  id: string;
  savedAt: string;
  result: unknown;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekKey(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function readHistory(account: unknown): HistoryItem[] {
  try {
    const raw = localStorage.getItem(accountHistoryKey(account));
    const parsed = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    return parsed
      .filter((item) => item?.savedAt && new Date(item.savedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[], account: unknown) {
  localStorage.setItem(accountHistoryKey(account), JSON.stringify(items));
}

function planForAccount(account: unknown) {
  const value = account as { plan?: string } | null;
  return String(value?.plan || "free_buyer").toLowerCase();
}

function limitForAccount(items: HistoryItem[], account: unknown) {
  const plan = planForAccount(account);

  if (plan === "free_buyer") {
    return [];
  }

  // Shopper Premium / Buyer Pro should show the server-backed history list.
  // Do not cap it to 10 per week; that was hiding newly saved scans.
  if (["buyer_pro", "buyer_beta", "shopper_beta"].includes(plan)) {
    return items.slice(0, 50);
  }

  const counts = new Map<string, number>();
  const kept: HistoryItem[] = [];

  for (const item of items) {
    const key = weekKey(new Date(item.savedAt));
    const count = counts.get(key) || 0;

    if (count < MAX_PER_WEEK) {
      kept.push(item);
      counts.set(key, count + 1);
    }
  }

  return kept;
}

function makeId(result: unknown) {
  const payload = result as {
    id?: string;
    analysisId?: string;
    createdAt?: string;
    meta?: { analysis_id?: string; analysisId?: string };
    product?: { name?: string; title?: string; brand?: string };
    verdict?: string;
    productScore?: number;
    bottomLine?: string;
  };

  return (
    payload?.id ||
    payload?.analysisId ||
    payload?.meta?.analysis_id ||
    payload?.meta?.analysisId ||
    [
      payload?.product?.brand,
      payload?.product?.name || payload?.product?.title || "scan",
      payload?.verdict,
      payload?.productScore,
      payload?.bottomLine
    ].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 180) ||
    `shopper-scan-${payload?.createdAt || Date.now()}`
  );
}

function resultTitle(result: unknown) {
  const payload = result as {
    product?: { name?: string; title?: string; brand?: string };
    analysis?: { verdict?: string; summary?: string };
    verdict?: string;
  };

  return shortProductName(displayCodeForResult(payload, payload.product?.name || payload.product?.title || payload.analysis?.summary || payload.verdict || "Product scan"), "Product scan");
}

function retentionLabel() {
  return "Keeps 10 tests per week. Older than 30 days auto-clears.";
}

async function deleteServerHistory(account: unknown, id: string | null, all = false) {
  const value = account as { email?: string } | null;
  if (!value?.email) return;

  await fetch("/api/account/analyses", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: value.email, id, all })
  }).catch(() => null);
}


function shopperHistoryCopy(locale: string) {
  switch (locale) {
    case "fr": return { history: "Historique", savedTests: "Tests enregistrés", delete: "Supprimer" };
    case "es": return { history: "Historial", savedTests: "Pruebas guardadas", delete: "Eliminar" };
    case "zh": return { history: "历史记录", savedTests: "已保存测试", delete: "删除" };
    case "de": return { history: "Verlauf", savedTests: "Gespeicherte Tests", delete: "Löschen" };
    case "hi": return { history: "इतिहास", savedTests: "सहेजे गए परीक्षण", delete: "हटाएं" };
    default: return { history: "History", savedTests: "Saved tests", delete: "Delete" };
  }
}

export function ShopperResultHistoryCorner() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const account = getClientAccount();
      if (planForAccount(account) === "free_buyer") {
        writeHistory([], account);
        if (!cancelled) setItems([]);
        return;
      }

      const current = readHistory(account);
      let serverItems: HistoryItem[] = [];

      if (account?.email) {
        const params = new URLSearchParams({
          email: account.email,
          plan: planForAccount(account),
          role: "buyer"
        });

        const response = await fetch(`/api/account/analyses?${params.toString()}`, {
          cache: "no-store"
        }).catch(() => null);

        if (response?.ok) {
          const data = await response.json().catch(() => null);
          const analyses = Array.isArray(data?.analyses) ? data.analyses : [];

          serverItems = analyses
            .map((record: Record<string, unknown>) => {
              const analysisJson = record.analysis_json;
              const result =
                analysisJson && typeof analysisJson === "object"
                  ? { ...(analysisJson as Record<string, unknown>), analysisId: record.id, serverId: record.id }
                  : { ...record, analysisId: record.id, serverId: record.id };

              const resultRecord = result as Record<string, unknown>;
              const savedAt = String(
                record.created_at ||
                resultRecord.savedAt ||
                resultRecord.createdAt ||
                new Date().toISOString()
              );

              return {
                id: String(record.id || makeId(resultRecord)),
                savedAt,
                result: {
                  ...resultRecord,
                  savedAt,
                  createdAt: String(resultRecord.createdAt || savedAt)
                }
              } as HistoryItem;
            })
            .filter((item: HistoryItem) => item.result && typeof item.result === "object");
        }
      }

      const latest = readLatestResult(account);
      let localLatestItem: HistoryItem[] = [];

      if (latest && typeof latest === "object") {
        const latestRecord = latest as Record<string, unknown>;
        const now = new Date().toISOString();
        const savedAt = String(latestRecord.savedAt || latestRecord.createdAt || now);
        const latestWithTimestamp = {
          ...latestRecord,
          savedAt,
          createdAt: String(latestRecord.createdAt || savedAt),
        };
        const latestWithMemory = {
          ...latestWithTimestamp,
          productMemory: buildProductMemoryBrain(latestWithTimestamp, current.map((item) => item.result)),
        };
        const id = makeId(latestWithMemory);
        localLatestItem = [{ id, savedAt, result: latestWithMemory }];
      }

      const mergedMap = new Map<string, HistoryItem>();
      const sourceItems = serverItems.length ? serverItems : [...localLatestItem, ...current];

      sourceItems.forEach((item) => {
        if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
      });

      const next = limitForAccount(
        Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        ),
        account
      );

      writeHistory(next, account);
      if (!cancelled) setItems(next);
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(() => items.slice(0, 30), [items]);

  if (planForAccount(getClientAccount()) === "free_buyer") return null;

  function openSaved(item: HistoryItem) {
    const account = getClientAccount();
    saveLatestResult(item.result as never, account);

    window.localStorage.setItem("reviewintel_selected_history_id", item.id);
    window.localStorage.setItem("reviewintel_selected_history_result", JSON.stringify(item.result));
    window.location.href = `/results?history=${encodeURIComponent(item.id)}`;
    return;
  }

  function deleteOne(id: string) {
    const account = getClientAccount();
    const next = items.filter((item) => item.id !== id);
    writeHistory(next, account);
    setItems(next);
    void deleteServerHistory(account, id);
  }

  function clearAll() {
    const account = getClientAccount();
    writeHistory([], account);
    setItems([]);
    setOpen(false);
    void deleteServerHistory(account, null, true);
  }

  if (!items.length) return null;

  return (
    <div className="reviewintel-result-history-anchor fixed left-3 right-3 top-24 z-50 w-auto max-w-[calc(100vw-1.5rem)] sm:left-5 sm:right-auto sm:top-28 sm:w-[280px] sm:max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-lg hover:border-teal-300 hover:text-teal-700 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-slate-200"
      >
        🕘 {shopperHistoryCopy(readStoredLocale()).history} · {items.length}
      </button>

      {open ? (
        <div className="reviewintel-history-popup-panel mt-2 max-w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              {shopperHistoryCopy(readStoredLocale()).savedTests}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-black text-red-600 hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => openSaved(item)}
                  className="min-w-0 flex-1 text-left text-xs font-black text-slate-700 hover:text-teal-700 dark:text-slate-200"
                >
                  <span className="block truncate">{resultTitle(item.result)}</span>
                  <span className="mt-1 block text-[10px] text-slate-400">{formatDate(item.savedAt)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteOne(item.id)}
                  className="text-[11px] font-black text-red-500 hover:underline"
                >
                  {shopperHistoryCopy(readStoredLocale()).delete}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-bold leading-4 text-slate-400">
            {retentionLabel()}
          </p>
        </div>
      ) : null}
    </div>
  );
}
