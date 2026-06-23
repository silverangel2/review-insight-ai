import { ACCOUNT_STORAGE_KEY } from "@/lib/account";

export type SellerComparePlan = {
  competitivePosition?: string;
  confidence?: string | number;
  executiveSummary?: string;
  marketMove?: string;
  fixFirst?: string[] | string;
  outgrowStrategy?: string[] | string;
  competitorAdvantages?: string[] | string;
  yourAdvantages?: string[] | string;
  conversionGaps?: string[] | string;
  productMoves?: string[] | string;
  listingMoves?: string[] | string;
  adAngles?: string[] | string;
  riskWarnings?: string[] | string;
  thirtyDayPlan?: string[] | string;
  ninetyDayPlan?: string[] | string;
  comparabilityWarning?: string;
  [key: string]: unknown;
};

export type SellerCompareHistoryItem = {
  id: string;
  yourLabel: string;
  competitorLabel: string;
  comparison: SellerComparePlan;
  savedAt?: string;
  createdAt: string;
  yourProduct?: unknown;
  competitorProduct?: unknown;
};

const COMPARE_HISTORY_PREFIX = "reviewintel_seller_compare_history";
const COMPARE_ACTIVE_PREFIX = "reviewintel_seller_compare_active";
const COMPARE_LATEST_PREFIX = "reviewintel_seller_compare_latest";
const MAX_COMPARE_HISTORY = 25;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeAccountKey(value: unknown) {
  return String(value || "guest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "guest";
}

function currentScopeKey() {
  if (!canUseStorage()) return "guest";

  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return "guest";

    const parsed = JSON.parse(raw) as {
      email?: string;
      userId?: string | null;
      authUserId?: string | null;
      id?: string | null;
    };

    return safeAccountKey(parsed.email || parsed.userId || parsed.authUserId || parsed.id || "guest");
  } catch {
    return "guest";
  }
}

function historyKey() {
  return `${COMPARE_HISTORY_PREFIX}:${currentScopeKey()}`;
}

function activeKey() {
  return `${COMPARE_ACTIVE_PREFIX}:${currentScopeKey()}`;
}

function latestKey() {
  return `${COMPARE_LATEST_PREFIX}:${currentScopeKey()}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `compare-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanHistoryItem(item: unknown): SellerCompareHistoryItem | null {
  if (!item || typeof item !== "object") return null;

  const entry = item as Partial<SellerCompareHistoryItem>;

  if (!entry.id || !entry.comparison) return null;

  return {
    id: String(entry.id),
    yourLabel: String(entry.yourLabel || "Your product"),
    competitorLabel: String(entry.competitorLabel || "Competitor product"),
    comparison: entry.comparison,
    savedAt: String(entry.savedAt || entry.createdAt || new Date().toISOString()),
    createdAt: String(entry.createdAt || entry.savedAt || new Date().toISOString()),
    yourProduct: entry.yourProduct,
    competitorProduct: entry.competitorProduct
  };
}

export function readSellerCompareHistory(): SellerCompareHistoryItem[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(historyKey());
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(cleanHistoryItem)
      .filter((item): item is SellerCompareHistoryItem => Boolean(item));
  } catch {
    return [];
  }
}

export function readActiveSellerCompareId() {
  if (!canUseStorage()) return null;

  try {
    return window.localStorage.getItem(activeKey());
  } catch {
    return null;
  }
}

export function setActiveSellerCompare(id: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(activeKey(), id);
  } catch {
    // Ignore storage errors.
  }
}

export function saveSellerCompareHistoryItem(input: {
  id?: string;
  yourLabel: string;
  competitorLabel: string;
  comparison: SellerComparePlan;
  savedAt?: string;
  createdAt?: string;
  yourProduct?: unknown;
  competitorProduct?: unknown;
}): SellerCompareHistoryItem | null {
  if (!canUseStorage()) return null;

  try {
    const item: SellerCompareHistoryItem = {
      ...input,
      id: input.id || makeId(),
      yourLabel: input.yourLabel || "Your product",
      competitorLabel: input.competitorLabel || "Competitor product",
      comparison: input.comparison || {},
      savedAt: input.createdAt || new Date().toISOString(),
      createdAt: input.createdAt || new Date().toISOString()
    };

    const existing = readSellerCompareHistory();
    const next = [item, ...existing.filter((entry) => entry.id !== item.id)].slice(0, MAX_COMPARE_HISTORY);

    window.localStorage.setItem(historyKey(), JSON.stringify(next));
    window.localStorage.setItem(activeKey(), item.id);
    window.localStorage.setItem(latestKey(), JSON.stringify(item));

    return item;
  } catch {
    return null;
  }
}

export function readActiveSellerCompare(): SellerCompareHistoryItem | null {
  if (!canUseStorage()) return null;

  const history = readSellerCompareHistory();
  const activeId = readActiveSellerCompareId();

  const active = history.find((item) => item.id === activeId);
  if (active) return active;

  if (history[0]) return history[0];

  try {
    const raw = window.localStorage.getItem(latestKey());
    if (!raw) return null;

    return cleanHistoryItem(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteSellerCompareHistoryItem(id: string) {
  if (!canUseStorage()) return;

  try {
    const next = readSellerCompareHistory().filter((item) => item.id !== id);
    window.localStorage.setItem(historyKey(), JSON.stringify(next));

    const activeId = readActiveSellerCompareId();
    if (activeId === id) {
      if (next[0]) {
        window.localStorage.setItem(activeKey(), next[0].id);
        window.localStorage.setItem(latestKey(), JSON.stringify(next[0]));
      } else {
        window.localStorage.removeItem(activeKey());
        window.localStorage.removeItem(latestKey());
      }
    }
  } catch {
    // Ignore storage errors.
  }
}

export const getSellerCompareHistory = readSellerCompareHistory;
export const getActiveSellerCompare = readActiveSellerCompare;
export const saveSellerCompare = saveSellerCompareHistoryItem;
