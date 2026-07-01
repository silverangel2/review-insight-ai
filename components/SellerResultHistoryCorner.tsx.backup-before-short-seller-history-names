"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getClientAccount } from "@/lib/clientAccount";
import { openSellerResult, readLatestSellerResult, sellerHistoryKey } from "@/lib/sellerResultStorage";
import { setActiveSellerCompare } from "@/lib/sellerCompareHistory";
import {} from "@/lib/productDisplay";
import { readStoredLocale } from "@/lib/i18n";

const MAX_PER_WEEK = 10;
const MAX_AGE_DAYS = 30;

type SellerHistoryItem = {
  type?: string;
  compareId?: string;
  id: string;
  fileName?: string;
  savedAt?: string;
  createdAt?: string;
  result: {
    type?: string;
    compareId?: string;
    [key: string]: unknown;
  };
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
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function readHistory(account: unknown): SellerHistoryItem[] {
  try {
    const raw = localStorage.getItem(sellerHistoryKey(account));
    const parsed = raw ? (JSON.parse(raw) as SellerHistoryItem[]) : [];
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    return parsed
      .filter((item): item is SellerHistoryItem & { savedAt: string } =>
        Boolean(item?.savedAt && new Date(item.savedAt).getTime() >= cutoff)
      )
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

function writeHistory(items: SellerHistoryItem[], account: unknown) {
  localStorage.setItem(sellerHistoryKey(account), JSON.stringify(items));
}

function limitPerWeek(items: SellerHistoryItem[]) {
  const counts = new Map<string, number>();
  const kept: SellerHistoryItem[] = [];

  for (const item of items) {
    if (!item.savedAt) continue;

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
    productName?: string;
    summary?: string;
    result?: { analysisId?: string; summary?: string };
  };
  return (
    payload?.id ||
    payload?.analysisId ||
    payload?.result?.analysisId ||
    `${payload?.productName || "seller-report"}-${payload?.createdAt || Date.now()}`
  );
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


function sellerHistoryCopy(locale: string) {
  switch (locale) {
    case "fr":
      return { history: "Historique", savedTests: "Tests vendeur enregistrés", delete: "Supprimer", retention: "Garde 10 tests vendeur par semaine. Les éléments de plus de 30 jours sont effacés automatiquement." };
    case "es":
      return { history: "Historial", savedTests: "Pruebas de vendedor guardadas", delete: "Eliminar", retention: "Conserva 10 pruebas de vendedor por semana. Los elementos de más de 30 días se borran automáticamente." };
    case "zh":
      return { history: "历史记录", savedTests: "已保存卖家测试", delete: "删除", retention: "每周保留 10 个卖家测试。超过 30 天的内容会自动清除。" };
    case "de":
      return { history: "Verlauf", savedTests: "Gespeicherte Verkäufer-Tests", delete: "Löschen", retention: "Speichert 10 Verkäufer-Tests pro Woche. Älter als 30 Tage wird automatisch gelöscht." };
    case "hi":
      return { history: "इतिहास", savedTests: "सहेजे गए seller tests", delete: "हटाएं", retention: "हर सप्ताह 10 seller tests रखता है। 30 दिनों से पुराने अपने आप साफ हो जाते हैं।" };
    default:
      return { history: "History", savedTests: "Saved seller tests", delete: "Delete", retention: "Keeps 10 seller tests per week. Older than 30 days auto-clears." };
  }
}

export function SellerResultHistoryCorner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [apiHistoryItems, setApiHistoryItems] = useState<SellerHistoryItem[]>([]);
  const [items, setItems] = useState<SellerHistoryItem[]>([]);

  const shouldShow = pathname === "/dashboard/seller/result" || pathname === "/seller/result";

  useEffect(() => {
    if (!shouldShow) return;

    const account = getClientAccount();
    const current = readHistory(account);
    const latest = readLatestSellerResult();

    if (!latest) {
      writeHistory(current, account);
      setItems(current);
      return;
    }

    const now = new Date().toISOString();
    const id = makeId(latest);

    const next = limitPerWeek([
      { id, savedAt: now, result: latest },
      ...current.filter((item) => item.id !== id),
    ]);

    writeHistory(next, account);
    setItems(next);
  }, [shouldShow, pathname]);


  useEffect(() => {
    let cancelled = false;

    async function loadApiHistory() {
      try {
        const accountRaw =
          localStorage.getItem("reviewintel:account") ||
          localStorage.getItem("reviewintel-account") ||
          localStorage.getItem("reviewintel_account") ||
          "";

        const account = accountRaw ? JSON.parse(accountRaw) : null;
        const email = account?.email || "seller.pro@reviewintel.test";

        const response = await fetch(`/api/account/analyses?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
          credentials: "include",
        });

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.analyses)
            ? payload.analyses
            : Array.isArray(payload.history)
              ? payload.history
              : Array.isArray(payload.items)
                ? payload.items
                : [];

        const normalized = (list as Record<string, unknown>[])
          .filter((entry) => {
            const blob = JSON.stringify(entry || {}).toLowerCase();
            const code = String(
              entry.displayCode ||
                entry.code ||
                entry.refCode ||
                entry.id ||
                ""
            ).toUpperCase();

            return (
              code.startsWith("PRD-") ||
              code.startsWith("CMR-") ||
              blob.includes("seller_analyze") ||
              blob.includes("seller_compare")
            );
          })
          .map((entry) => {
            const code = String(
              entry.displayCode ||
                entry.code ||
                entry.refCode ||
                entry.id ||
                ""
            ).toUpperCase();

            return {
              ...(entry as SellerHistoryItem),
              id: String(entry.id || code),
              displayCode:
                code.startsWith("CMR-") || code.startsWith("PRD-")
                  ? code
                  : String(entry.displayCode || entry.code || "PRD-TEST"),
              productName: String(
                entry.productName ||
                  entry.product_name ||
                  entry.title ||
                  (code.startsWith("CMR-") ? "Seller Compare" : "Seller Test")
              ),
              createdAt: String(entry.createdAt || entry.created_at || new Date().toISOString()),
              type: String(entry.type || entry.mode || (code.startsWith("CMR-") ? "seller_compare" : "seller_analyze")),
              mode: String(entry.mode || entry.type || (code.startsWith("CMR-") ? "seller_compare" : "seller_analyze")),
            } as SellerHistoryItem;
          })
          .slice(0, 10);

        if (!cancelled) {
          setApiHistoryItems(normalized);
        }
      } catch (error) {
        console.warn("SELLER_RESULT_LEFT_HISTORY_API_FETCH failed", error);
        if (!cancelled) setApiHistoryItems([]);
      }
    }

    loadApiHistory();

    return () => {
      cancelled = true;
    };
  }, []);


  const visibleItems = useMemo(
    () =>
      [
        ...apiHistoryItems,
        ...items.filter((item) => !apiHistoryItems.some((apiItem) => apiItem.id === item.id)),
      ].slice(0, 10),
    [apiHistoryItems, items]
  );

  if (!shouldShow || !visibleItems.length) return null;

  function openSaved(item: SellerHistoryItem) {
    const compareId = item.compareId || item.result?.compareId;

    if (
      item.type === "compare" ||
      item.type === "seller_compare" ||
      String((item as { mode?: string }).mode || "") === "seller_compare" ||
      item.result?.type === "compare" ||
      item.result?.type === "seller_compare" ||
      String((item.result as { mode?: string } | undefined)?.mode || "") === "seller_compare" ||
      compareId
    ) {
      if (compareId) {
        setActiveSellerCompare(compareId);
      }
      window.location.href = "/dashboard/seller/compare/result";
      return;
    }

    openSellerResult(item.result, getClientAccount());
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

  return (
    <div className="reviewintel-result-history-anchor fixed left-5 top-28 z-50 w-[280px] max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-lg hover:border-teal-300 hover:text-teal-700"
      >
        🕘 {sellerHistoryCopy(readStoredLocale()).history} · {visibleItems.length}
      </button>

      {open ? (
        <div className="reviewintel-history-popup-panel mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              {sellerHistoryCopy(readStoredLocale()).savedTests}
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
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => openSaved(item)}
                  className="text-left text-xs font-black text-slate-700 hover:text-teal-700"
                >
                  <span className="block truncate">
                    {(() => {
                      const row = item as Record<string, unknown>;
                      const rawCode = String(
                        row.displayCode ||
                          row.code ||
                          row.refCode ||
                          row.productName ||
                          row.product_name ||
                          row.title ||
                          ""
                      ).toUpperCase();

                      const fullRow = JSON.stringify(row || {}).toUpperCase();
                      const codeMatch =
                        rawCode.match(/(?:PRD|CMR)-[A-Z0-9]{4,}/) ||
                        fullRow.match(/(?:PRD|CMR)-[A-Z0-9]{4,}/);

                      if (codeMatch?.[0]) return codeMatch[0];

                      const shortId = String(item.id || "")
                        .replace(/[^a-z0-9]/gi, "")
                        .slice(0, 4)
                        .toUpperCase();

                      return `PRD-${shortId || "TEST"}`;
                    })()}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-400">{formatDate(item.savedAt || item.createdAt || new Date().toISOString())}</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteOne(item.id)}
                  className="text-[11px] font-black text-red-500 hover:underline"
                >
                  {sellerHistoryCopy(readStoredLocale()).delete}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-bold leading-4 text-slate-400">
            {sellerHistoryCopy(readStoredLocale()).retention}
          </p>
        </div>
      ) : null}
    </div>
  );
}
