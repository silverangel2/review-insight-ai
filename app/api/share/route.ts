import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import { sharedVerdictFromResult, signSharedVerdict } from "@/lib/shareVerdict";

export const runtime = "nodejs";

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Load the stored scan so a share always reflects the real saved result, never client-supplied data. */
async function storedResult(scanId: string): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(scanId);
  const filter = `or=(analysis_json->>scanId.eq.${id},analysis_json->meta->>scanId.eq.${id},analysis_json->result->>scanId.eq.${id})`;
  const rows = await supabaseSelect("analyses", `select=analysis_json&mode=eq.buyer&${filter}&limit=1`);
  const json = asRecord(rows[0]?.analysis_json);
  if (!Object.keys(json).length) return null;
  return asRecord(json.result && typeof json.result === "object" ? json.result : json);
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try { body = asRecord(await request.json()); } catch { return NextResponse.json({ ok: false, error: "Send JSON with a scanId." }, { status: 400 }); }
  const scanId = String(body.scanId || "").trim();
  if (!/^[a-zA-Z0-9_-]{6,160}$/.test(scanId)) return NextResponse.json({ ok: false, error: "A valid scanId is required." }, { status: 400 });

  let result: Record<string, unknown> | null;
  if (isSupabaseConfigured()) {
    result = await storedResult(scanId);
    if (!result) return NextResponse.json({ ok: false, error: "This scan isn't saved yet, so it can't be shared." }, { status: 404 });
  } else if (process.env.NODE_ENV !== "production") {
    result = asRecord(body.result); // local development without a database
  } else {
    return NextResponse.json({ ok: false, error: "Sharing is unavailable right now." }, { status: 503 });
  }

  const token = signSharedVerdict(sharedVerdictFromResult(result, scanId));
  if (!token) return NextResponse.json({ ok: false, error: "Sharing is unavailable right now." }, { status: 503 });
  return NextResponse.json({ ok: true, path: `/v/${token}` }, { headers: { "cache-control": "no-store" } });
}
