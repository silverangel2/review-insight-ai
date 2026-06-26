"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getClientAccount } from "@/lib/clientAccount";
import { readLatestSellerResult, saveLatestSellerResult, sellerHistoryKey } from "@/lib/sellerResultStorage";
import { readSellerCompareHistory, saveSellerCompareHistoryItem, setActiveSellerCompare } from "@/lib/sellerCompareHistory";
import {} from "@/lib/productDisplay";
import { readStoredLocale } from "@/lib/i18n";
import { shortProductName } from "@/lib/productName";

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

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isSellerAnalysis(value: unknown) {
  const record = recordOf(value);
  return Boolean(
    record.summary ||
      record.healthScore !== undefined ||
      record.buyerSatisfaction !== undefined ||
      record.refundRisk !== undefined ||
      Array.isArray(record.topComplaints)
  );
}

function normalizeStoredSellerResult(item: SellerHistoryItem) {
  const row = item as Record<string, unknown>;
  const candidate =
    item.result ||
    row.report ||
    row.analysis ||
    row.payload ||
    row.data ||
    row.analysis_json ||
    item;
  const candidateRecord = recordOf(candidate);
  const nestedResult =
    candidateRecord.result ||
    candidateRecord.analysis ||
    candidateRecord.report ||
    candidateRecord.analysis_json;
  const result = isSellerAnalysis(nestedResult)
    ? nestedResult
    : isSellerAnalysis(candidateRecord)
      ? candidateRecord
      : null;

  if (!result) return null;

  return {
    result,
    fileName: String(
      candidateRecord.fileName ||
        row.fileName ||
        row.productName ||
        row.product_name ||
        row.title ||
        "Saved seller report"
    ),
    createdAt: String(
      candidateRecord.createdAt ||
        candidateRecord.savedAt ||
        row.createdAt ||
        row.created_at ||
        item.savedAt ||
        new Date().toISOString()
    ),
  };
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

  const shouldShow = pathname.startsWith("/dashboard/seller") || pathname === "/seller/result";

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
        const email = String(account?.email || "").trim();
        if (!email) {
          if (!cancelled) setApiHistoryItems([]);
          return;
        }

        const query = new URLSearchParams({
          email,
          plan: String(account?.plan || ""),
          role: String(account?.role || ""),
        });
        const response = await fetch(`/api/account/analyses?${query.toString()}`, {
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

            const resultPayload = (
              entry.result ||
              entry.report ||
              entry.analysis ||
              entry.payload ||
              entry.data ||
              entry ||
              {}
            ) as Record<string, unknown>;
            const mode = String(entry.mode || entry.type || (code.startsWith("CMR-") ? "seller_compare" : "seller_analyze"));
            const compareId =
              mode === "seller_compare"
                ? String(entry.compareId || resultPayload.compareId || resultPayload.id || "")
                : undefined;

            return {
              ...(entry as SellerHistoryItem),
              id: String(entry.id || code),
              displayCode:
                code.startsWith("CMR-") || code.startsWith("PRD-")
                  ? code
                  : String(entry.displayCode || entry.code || "PRD-TEST"),
              productName: shortProductName(
                entry.productName ||
                  entry.product_name ||
                  entry.title ||
                  (code.startsWith("CMR-") ? "Seller Compare" : "Seller Test")
              ),
              createdAt: String(entry.createdAt || entry.created_at || new Date().toISOString()),
              type: mode,
              mode,
              compareId,
              result: resultPayload,
              report: entry.report || resultPayload,
              analysis: entry.analysis || resultPayload,
            } as unknown as SellerHistoryItem;
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
        ...items.filter(
          (item) =>
            !apiHistoryItems.some(
              (apiItem) =>
                apiItem.id === item.id ||
                Boolean(item.compareId && apiItem.compareId === item.compareId)
            )
        ),
      ].slice(0, 10),
    [apiHistoryItems, items]
  );

  if (!shouldShow || !visibleItems.length) return null;

  function openSaved(item: SellerHistoryItem) {
    const row = item as Record<string, unknown>;
    const resultRow = (item.result || {}) as Record<string, unknown>;
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
      const compareExists =
        compareId &&
        readSellerCompareHistory().some((entry) => entry.id === compareId);

      if (compareExists) {
        setActiveSellerCompare(compareId);
      } else {
        const comparePayload =
          row.result ||
          row.report ||
          row.analysis ||
          row.payload ||
          row.data ||
          row;

        const compareRecord = comparePayload as Record<string, unknown>;
        const nestedResult = (
          compareRecord.result ||
          compareRecord.report ||
          compareRecord.analysis ||
          {}
        ) as Record<string, unknown>;

        const rebuilt = saveSellerCompareHistoryItem({
          id: compareId || String(row.compareId || resultRow.compareId || resultRow.id || nestedResult.compareId || nestedResult.id || ""),
          yourLabel: String(
            row.yourLabel ||
              row.productAName ||
              row.product_a_name ||
              resultRow.yourLabel ||
              resultRow.productAName ||
              compareRecord.yourLabel ||
              compareRecord.productAName ||
              nestedResult.yourLabel ||
              nestedResult.productAName ||
              "Your product"
          ),
          competitorLabel: String(
            row.competitorLabel ||
              row.productBName ||
              row.product_b_name ||
              resultRow.competitorLabel ||
              resultRow.productBName ||
              compareRecord.competitorLabel ||
              compareRecord.productBName ||
              nestedResult.competitorLabel ||
              nestedResult.productBName ||
              "Competitor product"
          ),
          yourProduct:
            compareRecord.yourProduct ||
            compareRecord.productA ||
            resultRow.yourProduct ||
            resultRow.productA ||
            nestedResult.yourProduct ||
            nestedResult.productA ||
            row.yourProduct ||
            row.productA ||
            {},
          competitorProduct:
            compareRecord.competitorProduct ||
            compareRecord.productB ||
            resultRow.competitorProduct ||
            resultRow.productB ||
            nestedResult.competitorProduct ||
            nestedResult.productB ||
            row.competitorProduct ||
            row.productB ||
            {},
          comparison: (
            compareRecord.comparison ||
            nestedResult.comparison ||
            compareRecord.result ||
            compareRecord.report ||
            compareRecord.analysis ||
            comparePayload ||
            ({ summary: "Saved seller comparison" } as Record<string, unknown>)
          ) as import("@/lib/sellerCompareHistory").SellerComparePlan,
        });

        if (rebuilt?.id) {
          setActiveSellerCompare(rebuilt.id);
        }
      }

      window.location.href = "/dashboard/seller/compare/result";
      return;
    }

    const sellerPayload = normalizeStoredSellerResult(item);
    if (!sellerPayload) return;

    saveLatestSellerResult(sellerPayload, getClientAccount());
    window.location.href = "/dashboard/seller/result";
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
                          shortProductName(
                            row.productName ||
                              row.product_name ||
                              row.title ||
                              "",
                            "Seller analysis"
                          )
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
