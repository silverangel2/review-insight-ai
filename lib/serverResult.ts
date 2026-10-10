// Server-side load of a persisted scan for the signed-in account, so /results can
// render the real result in the first HTML response (no client fetch waterfall).
import "server-only";
import { cookies } from "next/headers";
import { ACCOUNT_SESSION_COOKIE, verifyAccountSessionToken } from "@/lib/accountSession";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

export async function loadServerResult(scanId: string | null | undefined): Promise<Rec | null> {
  const id = String(scanId || "").trim();
  if (!id || !/^[a-zA-Z0-9_-]{1,160}$/.test(id) || !isSupabaseConfigured()) return null;
  const token = (await cookies()).get(ACCOUNT_SESSION_COOKIE)?.value;
  const session = token ? verifyAccountSessionToken(decodeURIComponent(token)) : null;
  const email = String(session?.email || "").toLowerCase().trim();
  if (!email) return null;
  const filter = `or=(analysis_json->>scanId.eq.${id},analysis_json->>scan_id.eq.${id},analysis_json->meta->>scanId.eq.${id},analysis_json->result->>scanId.eq.${id})`;
  try {
    const rows = await Promise.race([
      supabaseSelect("analyses", `select=id,profile_email,analysis_json,created_at&profile_email=eq.${encodeURIComponent(email)}&${filter}&limit=2`),
      new Promise<Rec[]>((resolve) => setTimeout(() => resolve([]), 2500)),
    ]);
    for (const row of rows) {
      if (String(row.profile_email || "").toLowerCase().trim() !== email) continue;
      const stored = obj(row.analysis_json);
      const restored = obj(stored.result && typeof stored.result === "object" ? stored.result : stored);
      const persisted = String(restored.scanId || obj(restored.meta).scanId || stored.scanId || stored.scan_id || "").trim();
      if (persisted !== id) continue; // identity must match exactly; never substitute another scan
      if (!restored.meta) continue;
      return { ...restored, scanId: id, resultSource: "history", analysisId: row.id, createdAt: row.created_at };
    }
  } catch { /* fall back to the client loader */ }
  return null;
}
