import { compareEvidenceInput, freeShopperCompare, lowConfidenceShopperCompare, realReviewCount } from "@/lib/shopperCompareFree";
import { runZeroOpenAi } from "@/lib/openAiGuard";
import { NextResponse } from "next/server";
import { isAdminRole, normalizePlan, normalizeRole } from "@/lib/account";
import { readAccountSession } from "@/lib/accountSession";
import { rateLimitRequest, rejectSuspiciousInput } from "@/lib/security";
import { collectAndAnalyzeReviewEvidence } from "@/lib/reviewEvidence";
import { stabilizeAnalysisResultWithMemory } from "@/lib/productStability";
import { hasSufficientReviewEvidenceRecord } from "@/lib/reviewEvidenceScoring";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function recordOf(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function list(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item || "").trim()).filter(Boolean);
    return cleaned.length ? cleaned.slice(0, 5) : fallback;
  }

  if (typeof value === "string" && value.trim()) {
    const cleaned = value
      .split(/\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned.slice(0, 5) : fallback;
  }

  return fallback;
}

function normalizeWinner(value: unknown) {
  const winner = String(value || "").trim().toUpperCase();
  if (winner === "A" || winner === "B" || winner === "TIE" || winner === "INCOMPARABLE") return winner;
  return "TIE";
}

function normalize(rawValue: unknown) {
  const raw = recordOf(rawValue);
  const winnerValue = String(raw.winner || "").trim().toUpperCase();
  const hasWinner = ["A", "B", "TIE", "INCOMPARABLE"].includes(winnerValue);
  const winner = hasWinner ? normalizeWinner(winnerValue) : "INCOMPARABLE";
  // Tri-state, passed through untouched: only a real product-type judgment
  // may set directSubstitutes true or false. An evidence shortfall leaves it
  // null (unknown), so the client can never render a types claim from a
  // reviews problem (2026-10-20 compare audit, D1).
  const directSubstitutes = raw.directSubstitutes === true ? true : raw.directSubstitutes === false ? false : null;
  const hasConfidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence);
  const evidenceRaw = recordOf(raw.evidence);
  const evidenceCount = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;

  return {
    winner,
    directSubstitutes,
    reason: typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : null,
    evidence: {
      commentsAnalyzedA: evidenceCount(evidenceRaw.commentsAnalyzedA),
      commentsAnalyzedB: evidenceCount(evidenceRaw.commentsAnalyzedB),
    },
    confidence: hasConfidence ? Math.max(0, Math.min(100, Math.round(raw.confidence as number))) : null,
    verdictHeadline: text(raw.verdictHeadline, "Low confidence · too few real reviews to compare yet"),
    summary: text(raw.summary, "One or both products have too few real written reviews to pick a winner honestly."),
    reasons: list(raw.reasons, ["Too few real written reviews on at least one side."]).slice(0, 4),
    nextSteps: list(raw.nextSteps, ["Scan the Amazon link for each product to pull in more real reviews.", "Or add a review screenshot."]).slice(0, 3),
  };
}

function hasWrittenReviewEvidence(value: unknown) {
  return hasSufficientReviewEvidenceRecord(value);
}


type ProductRecord = Record<string, unknown>;

function asRecord(value: unknown): ProductRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ProductRecord) : {};
}

async function attachRealReviewEvidence(product: unknown) {
  const record = asRecord(product);
  // compareEvidenceInput passes the scan's own listing URL / ASIN / store
  // through, so this re-collection anchors on the shopper's exact listing
  // instead of a name-only search (2026-10-20 compare audit, D3).
  const reviewEvidence = await collectAndAnalyzeReviewEvidence(compareEvidenceInput(product));

  return await stabilizeAnalysisResultWithMemory(
    {
      ...record,
      reviewEvidence,
      reviewAuthenticity: reviewEvidence.reviewAuthenticity,
    },
    { reviewEvidence }
  );
}

async function handlePOST(request: Request): Promise<Response> {
  try {
    const limit = await rateLimitRequest(request, {
      key: "shopper_compare_api",
      limit: 12,
      windowMs: 10 * 60 * 1000,
      eventType: "shopper_compare_rate_limited",
    });

    if (!limit.allowed) {
      return limit.response ?? NextResponse.json({ error: "Too many shopper comparison requests." }, { status: 429 });
    }

    const session = readAccountSession(request);
    const plan = normalizePlan(session?.plan);
    const role = normalizeRole(session?.role);
    const hasCompareAccess =
      Boolean(session) &&
      (isAdminRole(role) || (role === "buyer" && (plan === "buyer_pro" || plan === "buyer_beta")));

    if (!hasCompareAccess) {
      return NextResponse.json(
        { error: "Shopper Compare requires Shopper Premium access.", code: "SHOPPER_COMPARE_ACCESS_REQUIRED" },
        { status: session ? 403 : 401 },
      );
    }

    const body = await request.json();
    const securityResponse = await rejectSuspiciousInput(
      request,
      JSON.stringify(body).slice(0, 120000),
      "shopper product comparison"
    );

    if (securityResponse) return securityResponse;

    const productA = body?.productA;
    const productB = body?.productB;

    if (!productA || !productB) {
      return NextResponse.json({ error: "Both product scan results are required." }, { status: 400 });
    }

    const [productAWithReviewEvidence, productBWithReviewEvidence] = await Promise.all([
      attachRealReviewEvidence(productA),
      attachRealReviewEvidence(productB),
    ]);

    if (!hasWrittenReviewEvidence(productAWithReviewEvidence) || !hasWrittenReviewEvidence(productBWithReviewEvidence)) {
      // Low confidence with the real counts and a next step, never "not scored".
      return NextResponse.json(normalize(lowConfidenceShopperCompare(realReviewCount(productAWithReviewEvidence), realReviewCount(productBWithReviewEvidence))));
    }

    // The deterministic free comparison is the only winner engine. There is
    // no OpenAI winner path in this route (owner rule: no OpenAI anywhere in
    // ReviewIntel); the runZeroOpenAi wrapper below proves every request
    // made zero OpenAI calls.
    return NextResponse.json(normalize(freeShopperCompare(productAWithReviewEvidence, productBWithReviewEvidence)));
  } catch (error) {
    console.error("Shopper compare failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Shopper comparison failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const { value: response, ...run } = await runZeroOpenAi(() => handlePOST(request));
  try { response.headers.set("x-reviewintel-openai-calls", String(run.openAiCalls)); } catch { /* immutable headers */ }
  if (run.openAiCalls > 0) console.warn("[openai-guard] OpenAI calls in run", run);
  return response;
}
