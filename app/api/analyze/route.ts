import { NextResponse } from "next/server";
import { analyzeReviewsLocally, estimateReviewCount } from "@/lib/localAnalyzer";
import { reconcileAnalysisScores } from "@/lib/analysisScoring";
import { normalizePlatform, platformLabel } from "@/lib/platforms";
import { buildReviewPrompt, REVIEW_ANALYZER_SYSTEM_PROMPT } from "@/lib/prompts";
import { cleanReviewInsightText, sanitizeInsightList, sanitizeSellerInsightList, sellerFriendlyTheme } from "@/lib/insightSanitizer";
import { openAiTextFormat } from "@/lib/reviewSchema";
import { FREE_DAILY_REVIEW_LIMIT, GUEST_TOTAL_REVIEW_LIMIT, hasUnlimitedUsage, isSellerPlan, makeQuotaInfo } from "@/lib/account";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import {
  combineReviewSections,
  confidenceFromReviewCount,
  inferIngestionMode,
  MAX_BULK_REVIEW_CHARS,
  MAX_TEXT_UPLOAD_BYTES,
  normalizeConfidenceScore,
  normalizeReviewSections,
  prepareReviewTextForModel,
  reviewEvidenceFromText
} from "@/lib/reviewIngestion";
import {
  accountFromRequest,
  consumePersistentQuota,
  hasSupabaseServiceEnv,
  readPersistentQuota,
  rollbackPersistentQuota,
  saveAnalysisRecord
} from "@/lib/supabaseServer";
import type { AnalysisAudience, AnalyzeRequest, AnalyzeResponse, QuotaInfo, ReviewAnalysis, ReviewTextSection, SubscriptionPlan, UploadedReviewImage, UserRole } from "@/lib/types";
import { supabaseInsert, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";
import { rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

const MAX_BULK_CHARS = MAX_BULK_REVIEW_CHARS;
const MAX_ADMIN_BULK_CHARS = MAX_BULK_REVIEW_CHARS * 4;
const MAX_REQUEST_BYTES = 6_000_000;
const MIN_REVIEW_CHARS = 80;
const MAX_IMAGES_FREE = 2;
const MAX_IMAGES_PAID = 8;
const MAX_IMAGE_BYTES = 3_500_000;
const MAX_REVIEW_SECTIONS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

type UsageRecord = {
  day: string;
  used: number;
};

const usageStore = ((globalThis as typeof globalThis & { __reviewintelUsage?: Map<string, UsageRecord> }).__reviewintelUsage ??=
  new Map<string, UsageRecord>());
const rateStore = ((globalThis as typeof globalThis & { __reviewintelRateLimit?: Map<string, { resetAt: number; count: number }> })
  .__reviewintelRateLimit ??= new Map<string, { resetAt: number; count: number }>());

function extractOutputText(response: unknown) {
  const candidate = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };

  if (typeof candidate.output_text === "string") return candidate.output_text;

  return candidate.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string")
    .join("")
    .trim();
}

function jsonError(message: string, status = 400, quota?: QuotaInfo, code?: string) {
  return NextResponse.json({ error: message, quota, code }, { status });
}

function publicAnalysisError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Review analysis failed.";
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (raw.includes("insufficient_quota") || raw.includes("OpenAI request failed: 429")) {
    return {
      code: "OPENAI_QUOTA_UNAVAILABLE",
      status: 503,
      message: isDevelopment
        ? "AI analysis is unavailable because the OpenAI project has no available quota. Add billing or credits in OpenAI Platform, then try again."
        : "AI analysis is temporarily unavailable. Please try again shortly."
    };
  }

  if (raw.includes("OpenAI request failed: 401") || raw.includes("invalid_api_key")) {
    return {
      code: "OPENAI_AUTH_FAILED",
      status: 503,
      message: isDevelopment
        ? "AI analysis is unavailable because the OpenAI API key is invalid or not authorized."
        : "AI analysis is temporarily unavailable. Please try again shortly."
    };
  }

  if (raw.includes("OpenAI request failed: 404") || raw.includes("model_not_found")) {
    return {
      code: "OPENAI_MODEL_UNAVAILABLE",
      status: 503,
      message: isDevelopment
        ? "AI analysis is unavailable because the configured OpenAI model is not available to this project."
        : "AI analysis is temporarily unavailable. Please try again shortly."
    };
  }

  if (raw.includes("OpenAI request failed")) {
    return {
      code: "OPENAI_PROVIDER_ERROR",
      status: 503,
      message: "AI analysis is temporarily unavailable. Please try again shortly."
    };
  }

  return {
    code: "ANALYSIS_FAILED",
    status: 502,
    message: "Review analysis failed. Please try again."
  };
}

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function requestUserKey(request: Request) {
  const user = request.headers.get("x-reviewintel-user")?.trim().toLowerCase();
  if (user && user !== "guest") return user;

  const guestId = request.headers.get("x-reviewintel-guest-id")?.trim();
  if (guestId) return guestId;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "guest";
}

function normalizeAudience(value: string | null | undefined): AnalysisAudience {
  if (value === "buyer" || value === "seller" || value === "both") return value;
  if (value === "customer") return "buyer";
  return "both";
}

function enforceAudienceForAccount(requested: AnalysisAudience, account: Awaited<ReturnType<typeof accountFromRequest>>): AnalysisAudience {
  if (!account) return "buyer";
  const accountPlan = account.plan as SubscriptionPlan;
  const accountRole = account.role as UserRole;

  if (accountRole === "admin") return requested;
  if (accountRole === "seller" || isSellerPlan(accountPlan)) return "seller";
  return "buyer";
}

function checkRateLimit(request: Request) {
  const key = requestUserKey(request);
  const now = Date.now();
  const existing = rateStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateStore.set(key, { resetAt: now + RATE_LIMIT_WINDOW_MS, count: 1 });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX) return false;

  existing.count += 1;
  rateStore.set(key, existing);
  return true;
}

function validateImages(images: UploadedReviewImage[] | undefined, plan: SubscriptionPlan, unlimited = false) {
  const safeImages = images ?? [];
  if (unlimited) return null;

  const maxImages = plan === "free_buyer" ? MAX_IMAGES_FREE : MAX_IMAGES_PAID;

  if (safeImages.length > maxImages) {
    return `Your ${plan} plan supports ${maxImages} screenshot uploads per analysis.`;
  }

  for (const image of safeImages) {
    if (image.type !== "image/jpeg" && image.type !== "image/png") {
      return "Only JPG and PNG screenshots are supported.";
    }

    if (!image.dataUrl.startsWith(`data:${image.type};base64,`)) {
      return "Screenshot upload data is invalid.";
    }

    if (image.size > MAX_IMAGE_BYTES || image.dataUrl.length > MAX_IMAGE_BYTES * 1.4) {
      return "One screenshot is too large. Compress images under 3.5 MB each.";
    }
  }

  return null;
}

function validateReviewSections(sections: ReviewTextSection[], adminBypass = false) {
  if (adminBypass) return null;

  if (sections.length > MAX_REVIEW_SECTIONS) {
    return `Use ${MAX_REVIEW_SECTIONS} review sections or fewer in one analysis.`;
  }

  for (const section of sections) {
    if ((section.source === "txt_upload" || section.source === "csv_upload") && (section.size ?? 0) > MAX_TEXT_UPLOAD_BYTES) {
      return `TXT and CSV uploads must be under ${Math.round(MAX_TEXT_UPLOAD_BYTES / 1000).toLocaleString()} KB each. Split very large exports into smaller batches.`;
    }
  }

  return null;
}

function collectReviewText(input: AnalyzeRequest) {
  const sectionText = combineReviewSections(input.reviewSections);
  return sectionText || input.reviews?.trim() || "";
}

function currentMemoryUsage(key: string, plan: SubscriptionPlan, guest = false) {
  const day = guest ? "guest-total" : utcDayKey();
  const existing = usageStore.get(key);

  if (!existing || existing.day !== day) {
    const fresh = { day, used: 0 };
    usageStore.set(key, fresh);
    return makeQuotaInfo(plan, 0);
  }

  return makeQuotaInfo(plan, existing.used);
}

function consumeMemoryQuota(request: Request, account: Awaited<ReturnType<typeof accountFromRequest>>) {
  if (!account) {
    return {
      allowed: true,
      remaining: null,
      used: 0,
      limit: null,
      key: requestUserKey(request)
    };
  }
  const plan = account.plan as SubscriptionPlan;
  const role = account.role as UserRole;
  const guest = role === "guest";
  const day = guest ? "guest-total" : utcDayKey();
  const key = `${day}:${requestUserKey(request)}`;

  if (plan !== "free_buyer") {
    return { allowed: true, key, plan, quota: makeQuotaInfo(plan, 0), consumed: false };
  }

  const existing = usageStore.get(key);
  const used = existing?.day === day ? existing.used : 0;
  const limit = guest ? GUEST_TOTAL_REVIEW_LIMIT : FREE_DAILY_REVIEW_LIMIT;

  if (used >= limit) {
    return { allowed: false, key, plan, quota: makeQuotaInfo(plan, used), consumed: false };
  }

  const nextUsed = used + 1;
  usageStore.set(key, { day, used: nextUsed });

  return { allowed: true, key, plan, quota: makeQuotaInfo(plan, nextUsed), consumed: true };
}

function rollbackQuota(key: string, plan: SubscriptionPlan, consumed: boolean) {
  if (!consumed || plan !== "free_buyer") return;

  const existing = usageStore.get(key);
  const expectedDay = key.startsWith("guest-total:") ? "guest-total" : utcDayKey();
  if (!existing || existing.day !== expectedDay) return;

  existing.used = Math.max(0, existing.used - 1);
  usageStore.set(key, existing);
}


function uniqueStrings(items: string[] | undefined, fallback: string[] = []) {
  const seen = new Set<string>();
  const source = sanitizeInsightList(items ?? [], fallback, 12);
  const usefulSource = source.filter((item) => !/^not enough review data/i.test(item));
  const usableSource = usefulSource.length ? usefulSource : source;

  return usableSource
    .map((item) => cleanReviewInsightText(String(item ?? "")))
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function uniqueSellerStrings(items: string[] | undefined, fallback: string[] = []) {
  const seen = new Set<string>();
  const source = sanitizeSellerInsightList(items ?? [], fallback, 12);

  return source
    .map((item) => sellerFriendlyTheme(String(item ?? ""), ""))
    .filter((item) => {
      if (!item || /^not enough clean review evidence/i.test(item)) return false;
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function uniqueKeywordAnalysis<T extends { keyword?: string; context?: string }>(items: T[] | undefined) {
  const seen = new Set<string>();
  return (items ?? []).map((item) => ({
    ...item,
    context: cleanReviewInsightText(item.context, sellerFriendlyTheme(item.context, "Mentioned in reviews."))
  })).filter((item) => {
    const key = cleanReviewInsightText(String(item.keyword || item.context || "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function normalizeKeywordSentiment(value: unknown): "positive" | "neutral" | "negative" {
  const raw = String(value ?? "neutral").toLowerCase();
  if (raw === "positive" || raw === "negative" || raw === "neutral") return raw;
  return "neutral";
}

function normalizeAnalysis(analysis: ReviewAnalysis, reviewCountEstimate = 0): ReviewAnalysis {
  const recommendation = analysis.buyer_recommendation ?? analysis.customer_recommendation;
  const normalizedRecommendation = {
    verdict: recommendation?.verdict ?? "Maybe",
    rationale: cleanReviewInsightText(recommendation?.rationale, "Review signal needs more clean evidence.")
  };
  const qualityConcerns = analysis.quality_concerns ?? analysis.product_quality_concerns ?? [];
  const featureRequests = analysis.feature_requests ?? analysis.seller_insights?.feature_requests ?? [];
  const packagingIssues = analysis.packaging_issues ?? analysis.seller_insights?.packaging_shipping_issues ?? [];
  const productScore = Math.max(0, Math.min(100, analysis.product_score ?? Math.round((analysis.sentiment_score + 1) * 45)));

  const normalized = {
    ...analysis,
    overall_summary: cleanReviewInsightText(
      analysis.overall_summary,
      "ReviewIntel found usable review signals in the supplied sample."
    ),
    buyer_recommendation: normalizedRecommendation,
    customer_recommendation: normalizedRecommendation,
    product_score: productScore,
    positive_points: uniqueStrings(analysis.positive_points),
    negative_points: uniqueStrings(analysis.negative_points),
    common_complaints: uniqueStrings(analysis.common_complaints, ["No strong repeated complaint pattern was detected in the pasted sample."]),
    praised_features: uniqueStrings(analysis.praised_features),
    value_for_money_opinion: cleanReviewInsightText(
      analysis.value_for_money_opinion,
      "Value signal needs more clean review evidence."
    ),
    fake_review_indicators: uniqueStrings(analysis.fake_review_indicators, ["No clear fake-review warning indicators were found."]),
    quality_concerns: uniqueStrings(qualityConcerns),
    product_quality_concerns: uniqueStrings(analysis.product_quality_concerns ?? qualityConcerns),
    feature_requests: uniqueStrings(featureRequests),
    packaging_issues: uniqueStrings(packagingIssues),
    durability_issues: uniqueStrings(analysis.durability_issues ?? []),
    support_issues: uniqueStrings(analysis.support_issues ?? []),
    improvement_suggestions: uniqueStrings(analysis.improvement_suggestions ?? []),
    confidence_score: normalizeConfidenceScore(analysis.confidence_score, reviewCountEstimate),
    keywords: uniqueStrings(analysis.keywords ?? []),
    keyword_analysis:
      uniqueKeywordAnalysis(analysis.keyword_analysis).length > 0
        ? uniqueKeywordAnalysis(analysis.keyword_analysis).map((item) => ({
            ...item,
            sentiment: normalizeKeywordSentiment(item.sentiment)
          }))
        : uniqueKeywordAnalysis(
            analysis.keywords.map((keyword) => ({
              keyword,
              mentions: 1,
              sentiment: normalizeKeywordSentiment("neutral"),
              context: "Mentioned in reviews."
            }))
          ),
    seller_insights: {
      ...analysis.seller_insights,
      main_customer_pain_points: uniqueSellerStrings([...(analysis.seller_insights.main_customer_pain_points ?? []), ...(analysis.negative_points ?? [])]),
      complaint_clusters: uniqueSellerStrings([...(analysis.seller_insights.complaint_clusters ?? []), ...(analysis.common_complaints ?? [])]),
      product_improvement_recommendations: uniqueSellerStrings([...(analysis.seller_insights.product_improvement_recommendations ?? []), ...(analysis.improvement_suggestions ?? [])]),
      listing_improvement_suggestions: uniqueSellerStrings([...(analysis.seller_insights.listing_improvement_suggestions ?? []), ...(analysis.improvement_suggestions ?? [])]),
      packaging_shipping_issues: uniqueSellerStrings([...(analysis.seller_insights.packaging_shipping_issues ?? []), ...packagingIssues]),
      shipping_complaint_detection: uniqueSellerStrings([...(analysis.seller_insights.shipping_complaint_detection ?? []), ...(analysis.seller_insights.packaging_shipping_issues ?? [])]),
      sentiment_trends: uniqueSellerStrings(analysis.seller_insights.sentiment_trends, ["Trend analysis needs multiple dated review batches."]),
      refund_risk_issues: uniqueSellerStrings([...(analysis.seller_insights.refund_risk_issues ?? []), ...(analysis.support_issues ?? [])]),
      feature_requests: uniqueSellerStrings([...(analysis.seller_insights.feature_requests ?? []), ...featureRequests]),
      competitor_opportunity_insights: uniqueSellerStrings(analysis.seller_insights.competitor_opportunity_insights ?? []),
      seller_recommendations: uniqueSellerStrings(analysis.seller_insights.seller_recommendations ?? analysis.improvement_suggestions),
      seller_action_cards: analysis.seller_insights.seller_action_cards ?? [],
      customer_satisfaction_score: analysis.seller_insights.customer_satisfaction_score ?? productScore
    }
  };

  return reconcileAnalysisScores(normalized, reviewCountEstimate);
}

function buildOpenAiContent(input: AnalyzeRequest, prompt: string) {
  const content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> = [
    { type: "input_text", text: prompt }
  ];

  for (const image of input.images ?? []) {
    content.push({ type: "input_image", image_url: image.dataUrl });
  }

  return content;
}

async function analyzeWithOpenAI(
  input: AnalyzeRequest,
  platformName: string,
  audience: AnalysisAudience,
  reviews: string,
  modelReviews: string,
  reviewCountEstimate: number,
  chunkCount: number,
  originalCharCount: number,
  modelCharCount: number
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.2";
  const sectionCount = normalizeReviewSections(input.reviewSections).length;
  const ingestionMode = inferIngestionMode(input, reviews);

  if (!apiKey) {
    return {
      analysis: normalizeAnalysis(
        analyzeReviewsLocally(reviews || `Screenshot-only analysis requested for ${platformName}. Add an OpenAI API key for OCR and vision analysis.`),
        reviewCountEstimate
      ),
      mode: "local-fallback" as const,
      model: "local-keyword-fallback"
    };
  }

  const prompt = buildReviewPrompt({
    reviews: modelReviews || "No pasted review text was supplied. Use uploaded screenshots as the source evidence.",
    productName: input.productName,
    productUrl: input.productUrl,
    platform: platformName,
    audience,
    imageCount: input.images?.length ?? 0,
    sectionCount,
    ingestionMode,
    imageAggregation: input.imageAggregation,
    reviewCountEstimate,
    chunkCount,
    originalCharCount,
    modelCharCount
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: REVIEW_ANALYZER_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: buildOpenAiContent(input, prompt)
        }
      ],
      text: {
        format: openAiTextFormat
      },
      max_output_tokens: audience === "seller" || audience === "both" ? 9000 : 5000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText.slice(0, 500)}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);

  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }

  return {
    analysis: normalizeAnalysis(JSON.parse(outputText) as ReviewAnalysis, reviewCountEstimate),
    mode: "openai" as const,
    model
  };
}


async function incrementProfileScanCounters(email?: string | null) {
  const normalizedEmail = String(email || "").toLowerCase().trim();

  if (!normalizedEmail) return;

  const existing = await supabaseSelect<{
    email: string;
    daily_scan_count?: number | null;
    monthly_scan_count?: number | null;
  }>(
    "profiles",
    `select=email,daily_scan_count,monthly_scan_count&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`
  );

  const current = existing[0];

  await supabaseUpsert("profiles", {
    email: normalizedEmail,
    daily_scan_count: Number(current?.daily_scan_count ?? 0) + 1,
    monthly_scan_count: Number(current?.monthly_scan_count ?? 0) + 1,
    last_scan_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}


export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimitRequest(request, {
    key: "analyze_api_request",
    limit: 20,
    windowMs: 60 * 60 * 1000,
    eventType: "analyze_api_rate_limited"
  });

  if (!limit.allowed) {
    return (
      limit.response ??
      NextResponse.json(
        { error: "Daily scan limit reached. Please upgrade or try again tomorrow." },
        { status: 429 },
      )
    );
  }

  const account =
    (await accountFromRequest(request)) ?? {
      email: "guest@reviewintel.local",
      name: "",
      plan: "free_buyer" as SubscriptionPlan,
      role: "guest" as UserRole,
      trusted: false
    };

  const accountPlan = account.plan as SubscriptionPlan;
  const accountRole = account.role as UserRole;
  const unlimited = hasUnlimitedUsage(accountRole, accountPlan);
  const adminBypass = accountRole === "admin";
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (!adminBypass && contentLength > MAX_REQUEST_BYTES) {
    return jsonError(`Request is too large. Keep uploads under ${Math.round(MAX_REQUEST_BYTES / 1_000_000)} MB per analysis.`, 413);
  }

  let body: AnalyzeRequest;

  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return jsonError("Invalid JSON request body.");
  }

  if (!unlimited && !checkRateLimit(request)) {
    return jsonError("Too many requests. Wait a minute before trying again.", 429);
  }

  const reviews = collectReviewText(body);
  const platform = normalizePlatform(body.platform);
  const audience = enforceAudienceForAccount(normalizeAudience(body.audience), account);
  const platformName = platformLabel(platform);
  const reviewSections = normalizeReviewSections(body.reviewSections);
  const ingestionMode = inferIngestionMode(body, reviews);
  const appSettings = await getRuntimeAppSettings();
  const sectionError = validateReviewSections(reviewSections, adminBypass);

  if (sectionError) {
    return jsonError(sectionError);
  }

  if (appSettings.maintenance_mode && account.role !== "admin") {
    return jsonError(appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly.", 503);
  }

  if (!appSettings.ai_enabled && account.role !== "admin") {
    return jsonError("AI analysis is currently paused while ReviewIntel is updating. Please try again shortly.", 503);
  }

  const imageError = validateImages(body.images, accountPlan, unlimited);
  if (imageError) {
    return jsonError(imageError);
  }

  const hasProductLookupInput =
    typeof body.productUrl === "string" && body.productUrl.trim().length >= 8 ||
    typeof body.productName === "string" && body.productName.trim().length >= 2;

  if (reviews.length < MIN_REVIEW_CHARS && !(body.images?.length) && !hasProductLookupInput) {
    return jsonError("Add a product name, product URL, larger review sample, or at least one review screenshot before analyzing.");
  }

  const maxChars = adminBypass ? MAX_ADMIN_BULK_CHARS : MAX_BULK_CHARS;
  if (reviews.length > maxChars) {
    return jsonError(`Review text is too large. Keep it under ${maxChars.toLocaleString()} characters for one bulk analysis.`);
  }

  const persistentQuotaGate = await consumePersistentQuota(account, { imageCount: body.images?.length ?? 0 });
  const memoryQuotaGate = persistentQuotaGate?.mode === "supabase" ? null : consumeMemoryQuota(request, account);
  const quotaGate =
    persistentQuotaGate?.mode === "supabase"
      ? {
          allowed: persistentQuotaGate.ok,
          remaining: persistentQuotaGate.quota?.remaining ?? null,
          used: persistentQuotaGate.quota?.used ?? 0,
          limit: persistentQuotaGate.quota?.limit ?? null,
          key: account.email
        }
      : memoryQuotaGate!;

  if (!quotaGate.allowed) {
    const limitMessage =
      account.role === "guest"
        ? "Guest limit reached. Create a free Shopper or Seller account to keep testing ReviewIntel."
        : "Shopper Free limit reached. You can analyze 3 products per day on the free plan. Upgrade to Shopper Premium or Seller access for unlimited analyses.";
    return jsonError(
      limitMessage,
      429,
      "quota" in quotaGate
        ? quotaGate.quota
        : {
            plan: accountPlan,
            used: quotaGate.used ?? 0,
            remaining: quotaGate.remaining ?? null,
            limit: quotaGate.limit ?? null,
            resets_at: new Date().toISOString()
          }
    );
  }

  try {
    const reviewEvidence = reviewEvidenceFromText(reviews);
    const reviewCountEstimate = reviewEvidence.validReviewCount || estimateReviewCount(reviews);
    const ratingBreakdown = reviewEvidence.ratingBreakdown;
    const evidenceConfidence = confidenceFromReviewCount(reviewCountEstimate);
    const evidenceReviews =
      reviewEvidence.validReviewCount > 0
        ? reviewEvidence.text
        : reviews ||
          [
            body.productName ? `Product name: ${body.productName}` : "",
            body.productUrl ? `Product URL: ${body.productUrl}` : "",
            `Analysis requested for ${platform}. No pasted review text or screenshot evidence was supplied. Generate a buyer-focused preliminary product confidence report from the available product lookup input.`
          ].filter(Boolean).join("\n");

    const preparedReviews = prepareReviewTextForModel(evidenceReviews);
    const result = await analyzeWithOpenAI(
      { ...body, reviewSections, reviews: evidenceReviews, platform, audience, ingestionMode },
      platformName,
      audience,
      evidenceReviews,
      preparedReviews.text,
      reviewCountEstimate,
      preparedReviews.chunkCount,
      preparedReviews.originalChars,
      preparedReviews.modelChars
    );
    const analysisId = await saveAnalysisRecord({
      account,
      productName: body.productName,
      productUrl: body.productUrl,
      platform,
      audience,
      reviews,
      images: body.images ?? [],
      analysis: result.analysis,
      model: result.model,
      mode: result.mode,
      reviewCountEstimate,
      sectionCount: reviewSections.length,
      ingestionMode
    });

    await supabaseInsert("usage_events", {
      profile_email: account.email ?? null,
      event_type: "analysis_scan",
      plan: accountPlan,
      estimated_cost: 0,
      metadata: {
        role: accountRole,
        platform,
        audience,
        product_name: body.productName ?? null,
        analysis_id:
          typeof analysisId === "string"
            ? analysisId
            : analysisId && typeof analysisId === "object" && "id" in analysisId
              ? String(analysisId.id)
              : null,
        mode: result.mode,
        model: result.model,
        review_count_estimate: reviewCountEstimate,
        image_count: body.images?.length ?? 0,
        section_count: reviewSections.length,
        ingestion_mode: ingestionMode
      },
      created_at: new Date().toISOString()
    });

    await incrementProfileScanCounters(account.email);

    const payload: AnalyzeResponse = {
      analysis: result.analysis,
      meta: {
        mode: result.mode,
        model: result.model,
        review_count_estimate: reviewCountEstimate,
        quota:
          "quota" in quotaGate
            ? quotaGate.quota
            : {
                plan: accountPlan,
                used: quotaGate.used ?? 0,
                remaining: quotaGate.remaining ?? null,
                limit: quotaGate.limit ?? null,
                resets_at: new Date().toISOString()
              },
        platform,
        audience,
        image_count: body.images?.length ?? 0,
        ingestion_mode: ingestionMode,
        review_section_count: reviewSections.length,
        confidence_label: evidenceConfidence.label,
        confidence_detail: evidenceConfidence.detail,
        chunk_count: preparedReviews.chunkCount,
        model_review_chars: preparedReviews.modelChars,
        rating_breakdown: ratingBreakdown,
        analysis_id:
          typeof analysisId === "string"
            ? analysisId
            : analysisId && typeof analysisId === "object" && "id" in analysisId
              ? String(analysisId.id)
              : undefined
      }
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (persistentQuotaGate) {
      await rollbackPersistentQuota(persistentQuotaGate.row);
    } else if (memoryQuotaGate) {
      rollbackQuota(memoryQuotaGate.key, memoryQuotaGate.plan ?? accountPlan, Boolean(memoryQuotaGate.consumed));
    }
    console.error("ReviewIntel analysis failed raw:", error);
    console.error("[ReviewIntel analyze debug BEFORE publicAnalysisError]", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null
    });

    let publicError;
    try {
      publicError = publicAnalysisError(error);
    } catch (publicErrorCrash) {
      console.error("[ReviewIntel publicAnalysisError crashed]", publicErrorCrash);
      publicError = {
        message: error instanceof Error ? error.message : "Analysis failed. Please try again.",
        status: 500,
        code: "analysis_failed"
      };
    }
    const rawQuota = hasSupabaseServiceEnv()
      ? await readPersistentQuota(account)
      : currentMemoryUsage(memoryQuotaGate?.key ?? requestUserKey(request), memoryQuotaGate?.plan ?? accountPlan, accountRole === "guest");

    const quota = rawQuota
      ? {
          ...rawQuota,
          plan: accountPlan,
          resets_at: "resets_at" in rawQuota
            ? rawQuota.resets_at ?? new Date().toISOString()
            : "resetAt" in rawQuota
              ? rawQuota.resetAt ?? new Date().toISOString()
              : new Date().toISOString()
        }
      : undefined;

    return jsonError(publicError.message, publicError.status, quota, publicError.code);
  }
}
