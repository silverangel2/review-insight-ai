import { forceSellerPremiumTesterAccount, hasCloudHistoryAccess, normalizePlan, normalizeRole } from "@/lib/account";
import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { deleteAnalysisHistory, saveAnalysisRecord, supabaseDelete, supabaseSelect } from "@/lib/supabaseServer";


function readDashboardScore(...sources: Record<string, unknown>[]) {
  const keys = [
    "productScore",
    "product_score",
    "healthScore",
    "buyingConfidence",
    "score",
    "confidenceScore",
    "confidence_score",
    "buyerSatisfaction",
    "customer_satisfaction_score"
  ];

  for (const source of sources) {
    for (const key of keys) {
      const raw = source[key];
      const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
      if (!Number.isFinite(value)) continue;

      if (/confidence|satisfaction/i.test(key) && value > 0 && value <= 1) {
        return Math.round(value * 100);
      }

      return Math.round(value);
    }
  }

  return null;
}

function normalizeAnalysisForDashboard(item: Record<string, unknown>) {
  if (!item || typeof item !== "object") return item;

  const row = item as Record<string, unknown>;
  const analysisJson = recordOf(row.analysis_json);

  const mode = row.mode || row.type || row.analysisType || row.reportType || "";
  const isSellerCompare =
    String(mode).toLowerCase() === "seller_compare" ||
    String(row.product_name || row.productName || "").toLowerCase().includes("seller compare");

  if (!isSellerCompare) {
    const result = row.result || row.analysis || row.report || row.analysis_json;
    const resultRecord = recordOf(result);
    const nestedAnalysis = recordOf(resultRecord.analysis);
    const nestedSeller = recordOf(resultRecord.seller_insights);
    const productScore = readDashboardScore(row, resultRecord, nestedAnalysis, nestedSeller);
    const normalizedResult =
      result && typeof result === "object"
        ? {
            ...(result as Record<string, unknown>),
            productScore: resultRecord.productScore ?? productScore ?? undefined,
            product_score: resultRecord.product_score ?? productScore ?? undefined
          }
        : result;

    return {
      ...row,
      productScore: row.productScore ?? productScore ?? undefined,
      product_score: row.product_score ?? productScore ?? undefined,
      score: row.score ?? productScore ?? undefined,
      result: normalizedResult,
      analysis: row.analysis || normalizedResult,
      report: row.report || normalizedResult,
      createdAt: row.createdAt || row.created_at || row.timestamp,
    };
  }

  const rawId = String(row.id || "");
  const compareScore = readDashboardScore(row, analysisJson);
  const cmrCode =
    row.displayCode ||
    row.code ||
    row.refCode ||
    (rawId.toUpperCase().startsWith("CMR-")
      ? rawId.toUpperCase()
      : `CMR-${rawId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || Math.random().toString(36).slice(2, 6).toUpperCase()}`);

  return {
    ...row,
    id: row.id,
    code: cmrCode,
    displayCode: cmrCode,
    refCode: cmrCode,

    type: "seller_compare",
    mode: "seller_compare",
    source: "seller_compare",
    analysisType: "seller_compare",
    reportType: "seller_compare",
    category: "seller_compare",

    title: row.title || row.productName || row.product_name || "Seller Compare",
    productName: row.productName || row.product_name || "Seller Compare",
    product_name: row.product_name || row.productName || "Seller Compare",
    summary: row.summary || "Seller competitor comparison",

    createdAt: row.createdAt || row.created_at || row.timestamp || new Date().toISOString(),
    created_at: row.created_at || row.createdAt || new Date().toISOString(),

    result: row.result || row.analysis || row.report || row.analysis_json,
    analysis: row.analysis || row.result || row.analysis_json,
    report: row.report || row.result || row.analysis_json,

    productScore: row.productScore ?? compareScore ?? undefined,
    product_score: row.product_score ?? compareScore ?? undefined,
    score: row.score ?? compareScore ?? undefined,

    counted: row.counted ?? analysisJson.counted ?? false,
    scanCount: row.scanCount ?? analysisJson.scanCount ?? 0,
    isCompare: true,
    isSellerCompare: true,
  };
}

function normalizeAnalysesForDashboard(payload: unknown) {
  if (Array.isArray(payload)) return payload.map(normalizeAnalysisForDashboard);

  if (!payload || typeof payload !== "object") return payload;

  const row = payload as Record<string, unknown>;

  if (Array.isArray(row.analyses)) {
    return {
      ...row,
      analyses: row.analyses.map((item) =>
        normalizeAnalysisForDashboard(item as Record<string, unknown>)
      ),
    };
  }

  if (Array.isArray(row.history)) {
    return {
      ...row,
      history: row.history.map((item) =>
        normalizeAnalysisForDashboard(item as Record<string, unknown>)
      ),
    };
  }

  if (Array.isArray(row.items)) {
    return {
      ...row,
      items: row.items.map((item) =>
        normalizeAnalysisForDashboard(item as Record<string, unknown>)
      ),
    };
  }

  return row;
}


export const runtime = "nodejs";

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function compareSideName(value: unknown, fallback: string) {
  const record = recordOf(value);
  const product = recordOf(record.product);
  return String(
    product.title ||
      product.name ||
      record.productName ||
      record.title ||
      record.name ||
      record.fileName ||
      fallback
  );
}

function compareHistoryTitle(analysis: Record<string, unknown>) {
  const productA = analysis.productA || analysis.resultA || analysis.a;
  const productB = analysis.productB || analysis.resultB || analysis.b;

  if (productA || productB) {
    return `Compare: ${compareSideName(productA, "Product A")} vs ${compareSideName(productB, "Product B")}`;
  }

  return "Compare result";
}


function weekKey(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "unknown";
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function retainByPlan(rows: Record<string, unknown>[], plan: string) {
  if (plan === "free_buyer") return [];

  // Shopper Premium / Buyer Pro history should not be capped to 10 per week.
  // Keep the newest 50 records total so new product scans and compare scans appear immediately.
  if ((plan === "buyer_pro" || plan === "buyer_beta")) {
    return rows.slice(0, 50);
  }

  const counts = new Map<string, number>();
  const retained: Record<string, unknown>[] = [];

  for (const row of rows) {
    const key = weekKey(row.created_at);
    const count = counts.get(key) || 0;

    if (count < 10) {
      retained.push(row);
      counts.set(key, count + 1);
    }
  }

  return retained.slice(0, 50);
}


async function getAuthenticatedHistoryAccount(request: Request) {
  const session = readAccountSession(request);
  const email = String(session?.email ?? "").toLowerCase().trim();
  let plan = normalizePlan(session?.plan || "free_buyer");
  let role = normalizeRole(session?.role || (plan.includes("seller") ? "seller" : "buyer"));

  if (email) {
    const rows = await supabaseSelect(
      "profiles",
      `select=plan,role&email=eq.${encodeURIComponent(email)}&limit=1`
    ).catch(() => []);
    const profile = rows[0] as Record<string, unknown> | undefined;

    if (profile) {
      plan = normalizePlan(String(profile.plan ?? plan));
      role = normalizeRole(String(profile.role ?? role));
    }
  }

  const forced = forceSellerPremiumTesterAccount({
    email,
    plan,
    role: role === "guest" ? (plan.includes("seller") ? "seller" : "buyer") : role
  });

  return {
    email,
    plan: normalizePlan(String(forced?.plan ?? plan)),
    role: normalizeRole(String(forced?.role ?? role))
  };
}

function emailMismatchResponse(requestedEmail: string, authenticatedEmail: string) {
  if (requestedEmail && authenticatedEmail && requestedEmail !== authenticatedEmail) {
    return NextResponse.json(
      normalizeAnalysesForDashboard({ error: "You are not allowed to access another account's analysis history." }),
      { status: 403 }
    );
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedEmail = String(url.searchParams.get("email") ?? "").toLowerCase().trim();
  const account = await getAuthenticatedHistoryAccount(request);
  const email = account.email;
  const mismatch = emailMismatchResponse(requestedEmail, email);
  if (mismatch) return mismatch;
  const plan = account.plan;
  const role = account.role;

  if (!email) {
    return NextResponse.json(normalizeAnalysesForDashboard({ error: "Account email is required." }), { status: 400 });
  }

  await supabaseDelete(
    "analyses",
    [
      `profile_email=eq.${encodeURIComponent(email)}`,
      `created_at=lt.${encodeURIComponent(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())}`
    ].join("&")
  ).catch(() => false);
  await supabaseDelete(
    "usage_events",
    [
      `profile_email=eq.${encodeURIComponent(email)}`,
      "event_type=eq.analysis",
      `created_at=lt.${encodeURIComponent(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())}`
    ].join("&")
  ).catch(() => false);

  const rows = await supabaseSelect(
    "analyses",
    `select=*&profile_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=500`
  );

  const filteredRows = (rows ?? []).filter((row) => {
    const mode = String(row.mode ?? "").toLowerCase();

    if (role === "seller" || plan === "seller_premium" || plan === "seller_beta" || plan === "seller_pro") {
      return mode === "seller" || mode === "both" || mode.includes("seller");
    }

    if (role === "buyer" || plan === "free_buyer" || plan === "buyer_pro" || plan === "buyer_beta") {
      return mode !== "seller" && !mode.includes("seller");
    }

    return true;
  });

  const limitedRows = retainByPlan(filteredRows, plan);
  const retainedIds = new Set(limitedRows.map((row) => String(row.id ?? "")).filter(Boolean));
  const rowsToDrop = filteredRows.filter((row) => {
    const id = String(row.id ?? "").trim();
    return id && !retainedIds.has(id);
  });

  if (rowsToDrop.length) {
    await Promise.all(
      rowsToDrop.map((row) => {
        const id = String(row.id ?? "").trim();
        return id ? deleteAnalysisHistory({ email, id }) : Promise.resolve(null);
      })
    );
  }

  return NextResponse.json(normalizeAnalysesForDashboard({ analyses: limitedRows }));
}


export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const requestedEmail = String(body?.email ?? body?.profile_email ?? "").toLowerCase().trim();
  const account = await getAuthenticatedHistoryAccount(request);
  const email = account.email;
  const mismatch = emailMismatchResponse(requestedEmail, email);
  if (mismatch) return mismatch;

  if (!email) {
    return NextResponse.json(normalizeAnalysesForDashboard({ error: "Account email is required." }), { status: 400 });
  }

  // CLOUD_HISTORY_SAVE_ALLOWED:
  // Free shoppers only keep the current/latest product locally.
  // Premium and beta accounts get cloud history across devices.
  if (!hasCloudHistoryAccess(account.plan)) {
    return Response.json({
      ok: true,
      saved: false,
      cloudHistory: false,
      reason: "Cloud history is available for Premium and Beta accounts only.",
    });
  }

  const analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : body;
  const analysisRecord = recordOf(analysis);
  const modeText = String(body?.mode ?? analysisRecord.mode ?? "").toLowerCase();
  const typeText = String(analysisRecord.type ?? "").toLowerCase();
  const compareIdText = String(analysisRecord.compareId ?? "");

  const isComparePayload =
    Boolean(analysisRecord.productA && analysisRecord.productB) &&
    (
      typeText === "compare" ||
      modeText === "buyer_compare" ||
      compareIdText.startsWith("CMR-")
    );

  const compareTitle = compareHistoryTitle(analysisRecord);

  const result = await saveAnalysisRecord({
    profile_email: email,
    email,
    mode: isComparePayload ? "buyer_compare" : body?.mode ?? analysisRecord.mode ?? "buyer",
    audience: isComparePayload ? "buyer" : body?.audience ?? analysisRecord.audience ?? "buyer",
    product_name: isComparePayload
      ? String(analysisRecord.title ?? analysisRecord.fileName ?? analysisRecord.productName ?? compareTitle)
      : body?.product_name ??
        body?.productName ??
        analysisRecord.fileName ??
        analysisRecord.title ??
        analysisRecord.productName ??
        "Analyzed product",
    platform: isComparePayload ? "compare" : body?.platform ?? analysisRecord.platform ?? null,
    product_score: isComparePayload
      ? null
      : body?.product_score ??
        body?.productScore ??
        analysisRecord.product_score ??
        analysisRecord.productScore ??
        analysisRecord.healthScore ??
        analysisRecord.buyingConfidence ??
        analysisRecord.score ??
        readDashboardScore(analysisRecord, recordOf(analysisRecord.analysis)) ??
        null,
    recommendation: isComparePayload
      ? String(body?.recommendation ?? analysisRecord.verdict ?? analysisRecord.winner ?? "")
      : body?.recommendation ?? analysisRecord.verdict ?? null,
    summary: isComparePayload
      ? String(body?.summary ?? analysisRecord.summary ?? "")
      : body?.summary ?? analysisRecord.summary ?? null,
    analysis_json: analysis,
    account: body?.account ?? null
  });

  return NextResponse.json(normalizeAnalysesForDashboard({ ok: true, analysis: result }));
}


export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const requestedEmail = String(body?.email ?? "").toLowerCase().trim();
  const account = await getAuthenticatedHistoryAccount(request);
  const email = account.email;
  const mismatch = emailMismatchResponse(requestedEmail, email);
  if (mismatch) return mismatch;
  const id = String(body?.id ?? "").trim();
  const all = Boolean(body?.all);

  if (!email) {
    return NextResponse.json(normalizeAnalysesForDashboard({ error: "Account email is required." }), { status: 400 });
  }

  if (!all && !id) {
    return NextResponse.json(normalizeAnalysesForDashboard({ error: "Analysis id is required unless clear-all is requested." }), { status: 400 });
  }

  const result = await deleteAnalysisHistory({ email, id, all });

  return NextResponse.json(normalizeAnalysesForDashboard(result));
}
