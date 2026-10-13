"use client";
// Keeps seller products, journal and notes in the database per account, with
// localStorage as the offline/fallback copy. On first login with an empty database
// row, existing browser data is uploaded (one-time migration).
import { sellerProductsStorageKey } from "./sellerProducts";
import { sellerJournalStorageKeys } from "./sellerJournal";

type Workspace = { products: unknown[]; journal: unknown[]; notes: Record<string, unknown> };
let started = false;
let timer: number | null = null;
let databaseAvailable = false;

function readJson<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function localWorkspace(): Workspace {
  const keys = sellerJournalStorageKeys();
  return { products: readJson(sellerProductsStorageKey(), []), journal: readJson(keys.journal, []), notes: readJson(keys.notes, {}) };
}
const isEmpty = (w: Partial<Workspace> | null | undefined) =>
  !w || ((!w.products || !w.products.length) && (!w.journal || !w.journal.length) && (!w.notes || !Object.keys(w.notes).length));

async function push() {
  if (!databaseAvailable) return;
  try {
    await fetch("/api/seller-workspace", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(localWorkspace()) });
  } catch { /* offline: localStorage still has it */ }
}

/** Call once on seller pages. Returns where data lives: "database" or "local". */
export async function startSellerWorkspaceSync(onPulled?: () => void): Promise<"database" | "local"> {
  if (typeof window === "undefined") return "local";
  if (!started) {
    started = true;
    window.addEventListener("reviewintel:seller-workspace-changed", () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void push(); }, 1200);
    });
  }
  try {
    const response = await fetch("/api/seller-workspace", { credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || data.storage !== "database") { databaseAvailable = false; return "local"; }
    databaseAvailable = true;
    const remote = data.workspace as Workspace | null;
    if (isEmpty(remote)) {
      if (!isEmpty(localWorkspace())) await push(); // first login: migrate browser data up
    } else {
      const keys = sellerJournalStorageKeys();
      window.localStorage.setItem(sellerProductsStorageKey(), JSON.stringify(remote!.products || []));
      window.localStorage.setItem(keys.journal, JSON.stringify(remote!.journal || []));
      window.localStorage.setItem(keys.notes, JSON.stringify(remote!.notes || {}));
      onPulled?.();
    }
    return "database";
  } catch {
    databaseAvailable = false;
    return "local";
  }
}
