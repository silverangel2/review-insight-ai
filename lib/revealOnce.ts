// Mount-once reveal flag for the result unlock moment (Phase 7).
//
// claimReveal(key): true the first time a result is revealed, false after.
// peekReveal(key):  same answer without consuming the claim.
//
// Persistence is per-tab via sessionStorage (survives SPA back-navigation;
// a fresh tab or reload is a fresh reveal, which is honest). Falls back to a
// module-level Set when storage is unavailable (SSR, private mode).
// A null/empty key always reveals — nothing to dedupe against.

const mem = new Set<string>();

function storageGet(k: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(`ri-reveal:${k}`);
  } catch {
    return null;
  }
}

function storageSet(k: string): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(`ri-reveal:${k}`, "1");
  } catch {
    /* private mode etc. — memory fallback below */
  }
}

export function peekReveal(key: string | null | undefined): boolean {
  const k = String(key || "").trim();
  if (!k) return true;
  if (storageGet(k)) return false;
  return !mem.has(k);
}

export function claimReveal(key: string | null | undefined): boolean {
  const k = String(key || "").trim();
  if (!k) return true;
  if (storageGet(k) || mem.has(k)) return false;
  storageSet(k);
  mem.add(k);
  return true;
}

/** easeOutCubic for the score count-up. Pure, exported for tests. */
export function easeOutCubic(p: number): number {
  const c = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - c, 3);
}
