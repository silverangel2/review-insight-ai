import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { attachScanAccess } from "@/lib/scanAccess";
import { rateLimitRequest, rejectSuspiciousInput } from "@/lib/security";
import { completeAccountScan } from "@/lib/scanCompletion";
import { consumePersistentQuota, isSupabaseConfigured, saveAnalysisRecord, supabaseSelect } from "@/lib/supabaseServer";
import { scorePageCaptureWithLibrary, validatePageCapture } from "@/lib/pageCapture";
import { claimShopperScan, releaseShopperScan, resolveShopperScanAccount } from "@/lib/shopperScanAllowance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function scanId() {
  return `scan_${Date.now().toString(36)}_${randomUUID().slice(0, 12)}`;
}

export async function POST(request: Request): Promise<Response> {
  const id = scanId();
  const limit = await rateLimitRequest(request, {
    key: "page_capture_api",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    eventType: "page_capture_rate_limited",
  });
  if (!limit.allowed) return limit.response ?? NextResponse.json({ error: "Too many analysis requests." }, { status: 429 });

  const account = await resolveShopperScanAccount(request);
  if (!account.ok) return NextResponse.json({ ...account.body, scanId: id }, { status: account.status });

  let payload: unknown;
  try {
    const text = await request.text();
    if (text.length > 180_000) {
      return NextResponse.json({ error: "That page is too large to analyze. Stay on the product page you are viewing and try again.", code: "PAYLOAD_TOO_LARGE", scanId: id }, { status: 413 });
    }
    payload = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json({ error: "Send the product page you are viewing.", code: "INVALID_CAPTURE", scanId: id }, { status: 400 });
  }

  const url = payload && typeof payload === "object" ? String((payload as { url?: unknown }).url || "") : "";
  const blocked = await rejectSuspiciousInput(request, url, "shopper page capture", account.email);
  if (blocked) return blocked;

  const validated = validatePageCapture(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error, code: validated.code, scanId: id }, { status: validated.status });
  }

  const allowance = await claimShopperScan({
    email: account.email,
    role: account.role,
    plan: account.plan,
    scanId: id,
    kind: "authenticated",
  });
  if (!allowance.ok) return NextResponse.json(allowance.body, { status: allowance.status });

  let result;
  try {
    result = await scorePageCaptureWithLibrary(validated.capture, id);
  } catch {
    await releaseShopperScan(allowance.subject);
    return NextResponse.json({ error: "ReviewIntel could not score this page. Please try again.", code: "SCORE_FAILED", scanId: id }, { status: 500 });
  }

  const withQuota = { ...result, quota: allowance.claim };
  try {
    if (!isSupabaseConfigured()) return attachScanAccess(request, NextResponse.json(withQuota));
    const completed = await completeAccountScan({
      email: account.email,
      scanId: id,
      result: withQuota,
      save: () => saveAnalysisRecord({
        profile_email: account.email,
        mode: "buyer",
        product_name: validated.capture.title,
        platform: validated.capture.store,
        product_score: withQuota.productScore,
        recommendation: withQuota.verdict,
        summary: withQuota.bottomLine,
        analysis_json: withQuota,
        account: { email: account.email, plan: account.plan, role: account.role },
      }),
      read: async (analysisId) => {
        const rows = await supabaseSelect("analyses", `select=id,profile_email,analysis_json,created_at&id=eq.${encodeURIComponent(analysisId)}&profile_email=eq.${encodeURIComponent(account.email)}&limit=1`);
        return rows[0];
      },
      consume: (analysisId) => consumePersistentQuota(
        { email: account.email, plan: account.plan },
        {
          analysis_id: analysisId,
          scan_id: id,
          audience: "buyer",
          product_name: validated.capture.title,
          verdict: withQuota.verdict,
        },
      ),
      finish: async () => ({ ok: true }),
    });
    return attachScanAccess(request, NextResponse.json({ ...completed, quota: allowance.claim ?? completed.quota ?? null }));
  } catch {
    if (process.env.NODE_ENV === "production") {
      await releaseShopperScan(allowance.subject);
      return NextResponse.json({ error: "ReviewIntel could not save this scan. Please try again.", code: "SAVE_FAILED", scanId: id }, { status: 503 });
    }
    return attachScanAccess(request, NextResponse.json(withQuota));
  }
}
