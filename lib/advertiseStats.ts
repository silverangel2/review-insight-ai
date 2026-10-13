import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";

async function exactCount(path: string): Promise<number | null> {
  try {
    const res = await supabaseFetch(path, { method: "GET", headers: { Prefer: "count=exact", Range: "0-0" } });
    const total = Number((res.headers.get("content-range") || "").split("/")[1]);
    return res.ok || res.status === 206 ? (Number.isFinite(total) ? total : null) : null;
  } catch { return null; }
}

/** Real counts only; null when unavailable (the page hides the number). */
export const loadAdvertiseStats = unstable_cache(async () => {
  if (!isSupabaseConfigured()) return { scans: null, pageViews30d: null, adImpressions30d: null };
  const since = encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString());
  const [scans, pageViews30d, adImpressions30d] = await Promise.all([
    exactCount("/rest/v1/analyses?select=id"),
    exactCount(`/rest/v1/site_traffic_events?select=id&event_type=eq.page_view&created_at=gte.${since}`),
    exactCount(`/rest/v1/sponsor_ad_events?select=sponsor_id&event_type=eq.impression&created_at=gte.${since}`),
  ]);
  return { scans, pageViews30d, adImpressions30d };
}, ["reviewintel-advertise-stats-v1"], { revalidate: 3600 });
