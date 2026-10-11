import { NextResponse } from "next/server";
import { supabaseInsert } from "@/lib/supabaseServer";
import { getRequestIp } from "@/lib/security";
import type { SponsorEventType } from "@/lib/sponsors";

const allowedEvents: SponsorEventType[] = ["impression", "click"];
const BOT_UA = /bot|crawler|spider|slurp|headless|preview|facebookexternalhit|curl|wget|python-requests|lighthouse/i;
// Advertiser reports are built from these counts, so: server timestamps only, bots ignored,
// and one impression per visitor per ad per 30 minutes (per instance).
const seen = new Map<string, number>();
const ipHits = new Map<string, number[]>();
const DEDUPE_MS = 30 * 60 * 1000;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);

export async function POST(request: Request) {
  // Cheap in-memory limiter (no DB round trip per event): 120 events / 10 min / IP.
  const ip = getRequestIp(request), t0 = Date.now();
  const hits = (ipHits.get(ip) || []).filter(t => t > t0 - 600_000); hits.push(t0); ipHits.set(ip, hits);
  if (hits.length > 120) return NextResponse.json({ ok: true, ignored: "rate_limited" });
  const body = await request.json().catch(() => null);
  const type = body?.type as SponsorEventType | undefined;
  const sponsorId = typeof body?.sponsorId === "string" ? body.sponsorId.slice(0, 120) : "";
  if (!type || !allowedEvents.includes(type) || !sponsorId) return NextResponse.json({ error: "Invalid sponsor event." }, { status: 400 });
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return NextResponse.json({ ok: true, ignored: "bot" });
  const key = `${type}|${sponsorId}|${getRequestIp(request)}|${ua.slice(0, 80)}`;
  const now = Date.now();
  if ((seen.get(key) || 0) > now - DEDUPE_MS) return NextResponse.json({ ok: true, ignored: "duplicate" });
  seen.set(key, now);
  if (seen.size > 50_000) for (const [k, t] of seen) if (t < now - DEDUPE_MS) seen.delete(k);

  const at = new Date().toISOString();
  await supabaseInsert("sponsor_ad_events", {
    sponsor_id: sponsorId, event_type: type,
    placement: clip(body?.placement, 60), path: clip(body?.path, 300),
    occurred_at: at, user_agent: ua.slice(0, 300), created_at: at,
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
