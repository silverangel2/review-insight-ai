import { NextResponse } from "next/server";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { readAccountSession } from "@/lib/accountSession";
import {
  consumePersistentQuota,
  isSupabaseConfigured,
  readPersistentQuota,
  saveAnalysisRecord,
  supabaseSelect,
} from "@/lib/supabaseServer";
import { rateLimitRequest, rejectSuspiciousInput } from "@/lib/security";
import type { SubscriptionPlan, UserRole } from "@/lib/types";
import { collectAndAnalyzeReviewEvidence } from "@/lib/reviewEvidence";

export const runtime = "nodejs";
export const maxDuration = 90;

type Verdict = "BUY" | "CONSIDER" | "AVOID";
type JsonRecord = Record<string, unknown>;

type ProfileAccessRow = {
  role?: unknown;
  plan?: unknown;
  subscription_status?: unknown;
  status?: unknown;
  beta_expires_at?: unknown;
};

type VisionFacts = {
  name: string;
  brand: string;
  category: string;
  store: string;
  price: string;
  rating: string;
  reviewCount: string;
  priceBelongsToProduct: boolean;
  ratingBelongsToProduct: boolean;
  reviewCountBelongsToProduct: boolean;
  visibleFeatures: string[];
  visibleBadges: string[];
  identityWarnings: string[];
  normalizedSearchQuery: string;
  imageConfidence: number;
};

type ResearchQuality = {
  evidenceLevel: "verified" | "limited" | "screenshot_only" | "product_mismatch";
  exactProductMatch: boolean;
  sourceCount: number;
  citationCount: number;
  notes: string[];
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asTextArray(value: unknown, limit: number) {
  return asArray(value).slice(0, limit).map(String).filter(Boolean);
}

function uniqueTextArray(values: string[], limit: number) {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || /^turn\d+(search|view|fetch|source)\d*$/i.test(text) || seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
    if (clean.length >= limit) break;
  }

  return clean;
}

function readString(source: JsonRecord, key: string) {
  return String(source[key] || "");
}

function readKnownString(source: JsonRecord, key: string) {
  const value = readString(source, key).trim();
  return /^(not specified|not shown|unknown|n\/a|none|null|not available)$/i.test(value) ? "" : value;
}

function normalizeConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return clampScore(number > 0 && number <= 1 ? number * 100 : number);
}

function readBoolean(source: JsonRecord, key: string, fallback = false) {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function isShopperPremiumTestAccount(email: string) {
  return email.trim().toLowerCase() === "shopper.premium@reviewintel.test";
}

function isReviewIntelTestAccount(email: string) {
  return email.trim().toLowerCase().endsWith("@reviewintel.test");
}

function hasActivePaidAccess(profile: ProfileAccessRow, plan: SubscriptionPlan) {
  const accountStatus = String(profile.status ?? "active").toLowerCase();
  const subscriptionStatus = String(profile.subscription_status ?? "").toLowerCase();

  if (["banned", "suspended", "disabled"].includes(accountStatus)) return false;

  if (plan === "free_buyer") return true;

  if (plan === "buyer_beta" || plan === "seller_beta") {
    const expiresAt = String(profile.beta_expires_at ?? "").trim();
    if (!expiresAt) return subscriptionStatus === "beta";

    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now()) {
      return true;
    }
  }

  return ["active", "trialing", "developer"].includes(subscriptionStatus);
}

async function resolveAnalyzeAccount(
  email: string,
  requestedPlan: SubscriptionPlan,
  requestedRole: UserRole,
) {
  if (requestedRole === "admin") {
    return { email, plan: requestedPlan, role: requestedRole };
  }

  if (!email || email === "guest") {
    return { email, plan: "free_buyer" as const, role: "guest" as const };
  }

  if (!isSupabaseConfigured()) {
    return { email, plan: requestedPlan, role: requestedRole };
  }

  const rows = await supabaseSelect<ProfileAccessRow>(
    "profiles",
    `select=role,plan,subscription_status,status,beta_expires_at&email=eq.${encodeURIComponent(email)}&limit=1`,
  );
  const profile = rows[0];

  if (!profile) {
    if (isShopperPremiumTestAccount(email)) {
      return {
        email: email.trim().toLowerCase(),
        plan: "buyer_pro" as const,
        role: "buyer" as const,
      };
    }

    return { email, plan: "free_buyer" as const, role: "buyer" as const };
  }

  const plan = normalizePlan(String(profile.plan ?? "free_buyer"));
  const role = normalizeRole(String(profile.role ?? "buyer"));

  if (!hasActivePaidAccess(profile, plan)) {
    return { email, plan: "free_buyer" as const, role: role === "seller" ? "seller" as const : "buyer" as const };
  }

  return { email, plan, role };
}

function languageNameFromLocale(locale: string) {
  const value = normalizedLocaleCode(locale);

  if (value === "fr") return "French";
  if (value === "es") return "Spanish";
  if (value === "zh") return "Simplified Chinese";
  if (value === "de") return "German";
  if (value === "hi") return "Hindi";

  return "English";
}

function normalizedLocaleCode(locale: string) {
  const value = String(locale || "en").trim().toLowerCase().split("-")[0];
  return ["en", "fr", "es", "zh", "de", "hi"].includes(value) ? value : "en";
}

function localizedAnalyzeText(locale: string) {
  const value = normalizedLocaleCode(locale);
  const copy: Record<string, { unclear: string; needConfidentDecision: string; needClearerInput: string; needMoreEvidence: string }> = {
    en: {
      unclear: "The screenshot does not clearly identify the product.",
      needConfidentDecision: "Shoppers who need a confident buying decision.",
      needClearerInput: "We need a clearer screenshot or product link to analyze this properly.",
      needMoreEvidence: "We need more reliable product evidence before giving a strong buying verdict."
    },
    fr: {
      unclear: "La capture d’écran n’identifie pas clairement le produit.",
      needConfidentDecision: "Les acheteurs qui ont besoin d’une décision d’achat fiable.",
      needClearerInput: "Nous avons besoin d’une capture plus claire ou d’un lien produit pour analyser cela correctement.",
      needMoreEvidence: "Nous avons besoin de preuves produit plus fiables avant de donner un verdict d’achat solide."
    },
    es: {
      unclear: "La captura de pantalla no identifica claramente el producto.",
      needConfidentDecision: "Compradores que necesitan una decisión de compra confiable.",
      needClearerInput: "Necesitamos una captura más clara o un enlace del producto para analizarlo correctamente.",
      needMoreEvidence: "Necesitamos evidencia más fiable del producto antes de dar un veredicto de compra sólido."
    },
    zh: {
      unclear: "截图没有清楚识别该产品。",
      needConfidentDecision: "需要可靠购买决定的购物者。",
      needClearerInput: "我们需要更清晰的截图或产品链接，才能正确分析这个产品。",
      needMoreEvidence: "在给出强购买结论前，我们需要更可靠的产品证据。"
    },
    de: {
      unclear: "Der Screenshot identifiziert das Produkt nicht eindeutig.",
      needConfidentDecision: "Käufer, die eine verlässliche Kaufentscheidung brauchen.",
      needClearerInput: "Wir benötigen einen klareren Screenshot oder einen Produktlink, um dies korrekt zu analysieren.",
      needMoreEvidence: "Wir benötigen verlässlichere Produktbelege, bevor wir ein starkes Kaufurteil geben."
    },
    hi: {
      unclear: "स्क्रीनशॉट उत्पाद को स्पष्ट रूप से पहचान नहीं पा रहा है।",
      needConfidentDecision: "वे खरीदार जिन्हें भरोसेमंद खरीद निर्णय चाहिए।",
      needClearerInput: "इसे ठीक से विश्लेषित करने के लिए हमें अधिक स्पष्ट स्क्रीनशॉट या उत्पाद लिंक चाहिए।",
      needMoreEvidence: "मज़बूत खरीद निर्णय देने से पहले हमें अधिक भरोसेमंद उत्पाद प्रमाण चाहिए।"
    }
  };

  return copy[value] ?? copy.en;
}

function attachLanguageMeta<T extends JsonRecord>(result: T, locale: string, outputLanguage: string) {
  return {
    ...result,
    meta: {
      ...asRecord(result.meta),
      audience: "buyer",
      locale: normalizedLocaleCode(locale),
      outputLanguage,
      researchQuality: asRecord(result.researchQuality),
      generatedAt: new Date().toISOString()
    }
  };
}

function createProductKey(parts: Array<string | undefined | null>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

async function brainFetch(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    console.error("ReviewIntel Brain fetch failed:", await response.text().catch(() => ""));
    return null;
  }

  return response.json().catch(() => null);
}

async function brainInsert(payload: JsonRecord) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/product_scan_memory`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("ReviewIntel Brain save failed:", await response.text().catch(() => ""));
  }
}

async function getProductMemory(productKey: string) {
  if (!productKey) return [];

  const query = `/rest/v1/product_scan_memory?product_key=eq.${encodeURIComponent(productKey)}&select=created_at,verdict,product_score,ai_review_signs,top_complaints,top_strengths,sources_used,user_feedback&order=created_at.desc&limit=10`;
  const data = await brainFetch(query);

  return Array.isArray(data) ? data : [];
}

function summarizeProductMemory(memory: unknown[]) {
  if (!memory.length) {
    return {
      scanCount: 0,
      verdictHistory: [] as string[],
      repeatedComplaints: [] as string[],
      memoryNote: ""
    };
  }

  const verdictHistory = memory
    .map((item) => String(asRecord(item).verdict || ""))
    .filter(Boolean);

  const complaintCounts = new Map<string, number>();

  for (const item of memory) {
    const record = asRecord(item);
    for (const complaint of asTextArray(record.top_complaints, 10)) {
      const key = complaint.toLowerCase().trim();
      if (!key) continue;
      complaintCounts.set(key, (complaintCounts.get(key) || 0) + 1);
    }
  }

  const repeatedComplaints = Array.from(complaintCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([complaint]) => complaint);

  return {
    scanCount: memory.length,
    verdictHistory,
    repeatedComplaints,
    memoryNote:
      memory.length === 1
        ? "ReviewIntel has seen this product once before."
        : `ReviewIntel has seen this product ${memory.length} times before.`
  };
}

function applyProductMemory(
  result: ReturnType<typeof normalizeVerdictWithScores>,
  memorySummary: ReturnType<typeof summarizeProductMemory>,
  locale = "en",
) {
  if (!memorySummary.scanCount) return result;

  let verdict = result.verdict;
  let productScore = result.productScore;
  let bottomLine = result.bottomLine;
  let topComplaints = result.topComplaints;

  const avoidCount = memorySummary.verdictHistory.filter((item) => item === "AVOID").length;
  const considerCount = memorySummary.verdictHistory.filter((item) => item === "CONSIDER").length;

  if (avoidCount >= 3) {
    verdict = "AVOID";
    productScore = Math.min(productScore, 49);
  } else if (avoidCount >= 2 && verdict === "BUY") {
    verdict = "CONSIDER";
    productScore = Math.min(productScore, 74);
  } else if (considerCount + avoidCount >= 3 && verdict === "BUY") {
    verdict = "CONSIDER";
    productScore = Math.min(productScore, 74);
  }

  if (normalizedLocaleCode(locale) === "en" && memorySummary.repeatedComplaints.length) {
    topComplaints = Array.from(new Set([...memorySummary.repeatedComplaints, ...topComplaints])).slice(0, 6);
  }

  if (normalizedLocaleCode(locale) === "en") {
    bottomLine = `${bottomLine} ${memorySummary.memoryNote}`;
  }

  return {
    ...result,
    verdict,
    productScore,
    topComplaints,
    bottomLine
  };
}

async function saveProductMemory({
  productKey,
  vision,
  result,
  productLink
}: {
  productKey: string;
  vision: VisionFacts;
  result: ReturnType<typeof normalizeVerdictWithScores>;
  productLink: string;
}) {
  await brainInsert({
    product_key: productKey,
    product_name: result.product.name,
    brand: result.product.brand,
    category: result.product.category,
    store: result.product.store,
    verdict: result.verdict,
    product_score: result.productScore,
    ai_review_signs: result.reviewAuthenticity.score,
    value_for_money: result.valueForMoney,
    review_trust: result.reviewAuthenticity.label,
    top_strengths: result.topStrengths,
    top_complaints: result.topComplaints,
    best_for: result.bestFor,
    not_ideal_for: result.notIdealFor,
    sources_used: result.sourcesUsed,
    product_link: productLink || null,
    screenshot_facts: vision,
    result_json: result
  });
}

function legalSafeText(value: string) {
  return value
    .replace(/\bscam\b/gi, "high-risk listing")
    .replace(/\bfraud\b/gi, "suspicious activity")
    .replace(/\bfraudulent\b/gi, "suspicious")
    .replace(/\bcon artist\b/gi, "unreliable seller")
    .replace(/\bcon\b/gi, "high-risk concern")
    .replace(/\bfake reviews detected\b/gi, "AI-like review patterns observed")
    .replace(/\bfake reviews\b/gi, "AI-like review patterns")
    .replace(/\billegal\b/gi, "policy concern")
    .trim();
}

function legalSafeArray(items: string[]) {
  return items.map(legalSafeText).filter(Boolean);
}

function clampScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeResult(rawValue: unknown, vision: VisionFacts, locale = "en") {
  const raw = asRecord(rawValue);
  const product = asRecord(raw.product);
  const reviewAuthenticity = asRecord(raw.reviewAuthenticity);
  const fallbackCopy = localizedAnalyzeText(locale);

  const rawVerdict = String(raw.verdict || "");
  const verdict: Verdict = ["BUY", "CONSIDER", "AVOID"].includes(rawVerdict) ? (rawVerdict as Verdict) : "CONSIDER";

  const rawValueForMoney = String(raw.valueForMoney || "");
  const valueForMoney = ["Excellent", "Good", "Fair", "Poor"].includes(rawValueForMoney) ? rawValueForMoney : "Fair";

  const rawTrustLabel = String(reviewAuthenticity.label || "");
  const trustLabel = ["High Trust", "Medium Trust", "Low Trust"].includes(rawTrustLabel) ? rawTrustLabel : "Medium Trust";

  const rawSuspiciousRisk = String(reviewAuthenticity.suspiciousReviewRisk || "");
  const suspiciousReviewRisk = ["Low", "Medium", "High"].includes(rawSuspiciousRisk) ? rawSuspiciousRisk : "Medium";

  return {
    product: {
      name: readString(product, "name") || vision.name,
      brand: readString(product, "brand") || vision.brand,
      category: readString(product, "category") || vision.category,
      store: vision.store || readKnownString(product, "store"),
      price: vision.price,
      rating: vision.rating,
      reviewCount: vision.reviewCount,
      imageConfidence: vision.imageConfidence
    },
    verdict,
    productScore: clampScore(raw.productScore),
    buyingConfidence: clampScore(raw.buyingConfidence),
    valueForMoney,
    reviewAuthenticity: {
      label: trustLabel,
      score: typeof reviewAuthenticity.score === "number" ? clampScore(reviewAuthenticity.score) : null,
      suspiciousReviewRisk,
      reasons: asTextArray(reviewAuthenticity.reasons, 5)
    },
    topStrengths: asTextArray(raw.topStrengths, 5),
    topComplaints: asTextArray(raw.topComplaints, 6),
    bestFor: asTextArray(raw.bestFor, 4),
    notIdealFor: asTextArray(raw.notIdealFor, 4),
    bottomLine: String(raw.bottomLine || fallbackCopy.needMoreEvidence),
    sourcesUsed: normalizeSources(raw),
    researchQuality: normalizeResearchQuality(raw),
    reviewEvidence: raw.reviewEvidence || null
  };
}

function normalizeSources(raw: JsonRecord) {
  return uniqueTextArray([
    ...asTextArray(raw.sourcesUsed, 12),
    ...asTextArray(raw._webCitations, 12)
  ], 12);
}

function normalizeResearchQuality(raw: JsonRecord): ResearchQuality {
  const research = asRecord(raw.researchQuality);
  const sourcesUsed = normalizeSources(raw);
  const citationCount = asTextArray(raw._webCitations, 20).length;
  const rawLevel = String(research.evidenceLevel || "").toLowerCase();
  let evidenceLevel: ResearchQuality["evidenceLevel"] =
    rawLevel === "verified" || rawLevel === "limited" || rawLevel === "screenshot_only" || rawLevel === "product_mismatch"
      ? rawLevel
      : sourcesUsed.length >= 2
        ? "verified"
        : sourcesUsed.length === 1
          ? "limited"
          : "screenshot_only";

  if (!sourcesUsed.length && citationCount === 0) {
    evidenceLevel = "screenshot_only";
  } else if (evidenceLevel === "verified" && sourcesUsed.length < 2) {
    evidenceLevel = "limited";
  }

  return {
    evidenceLevel,
    exactProductMatch: readBoolean(research, "exactProductMatch", evidenceLevel !== "product_mismatch"),
    sourceCount: sourcesUsed.length,
    citationCount,
    notes: uniqueTextArray(asTextArray(research.notes, 6), 6)
  };
}

function parseVisibleRating(rating: string) {
  const match = rating.match(/\d+(\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;

  if (value <= 5) return value;
  if (value <= 100) return value / 20;

  return null;
}

function parseVisibleReviewCount(reviewCount: string) {
  const match = reviewCount.replace(/,/g, "").match(/\d+/);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function countSeriousComplaints(items: string[]) {
  const seriousWords = [
    "broken",
    "defective",
    "durability",
    "zipper",
    "lock",
    "wheel",
    "crack",
    "cheap",
    "failed",
    "malfunction",
    "return",
    "unsafe",
    "leak",
    "battery",
    "overheat",
    "support",
    "warranty"
  ];

  return items.filter((item) => {
    const lower = item.toLowerCase();
    return seriousWords.some((word) => lower.includes(word));
  }).length;
}

function fractionalReviewVolumeWeight(reviewCount: number | null) {
  if (reviewCount === null || reviewCount <= 0) return 0;

  // Review count should never directly bump the score by whole numbers.
  // It only increases confidence in the public rating using a fractional curve.
  // Examples:
  // 1 review   -> low reliability
  // 50 reviews -> moderate reliability
  // 278 reviews -> good reliability
  // 1000+ reviews -> capped reliability
  return Math.max(0.25, Math.min(0.95, Math.log10(reviewCount + 1) / 3.2));
}

function evidenceCoverageWeight(commentsAnalyzed: number) {
  if (!Number.isFinite(commentsAnalyzed) || commentsAnalyzed <= 0) return 0;

  // Written review text must dominate the score.
  // Coverage grows gradually and caps around 50 analyzed reviews.
  return Math.max(0.05, Math.min(1, commentsAnalyzed / 50));
}

function calculateReviewIntelScore(result: ReturnType<typeof normalizeResult>) {
  const reviewEvidence = asRecord(result.reviewEvidence);
  const listingEvidence = asRecord(reviewEvidence.listingEvidence);

  const evidenceRating =
    typeof listingEvidence.rating === "number" && Number.isFinite(listingEvidence.rating) && listingEvidence.rating > 0
      ? listingEvidence.rating
      : typeof reviewEvidence.rating === "number" && Number.isFinite(reviewEvidence.rating) && reviewEvidence.rating > 0
        ? reviewEvidence.rating
        : null;

  const marketplaceReviewCount =
    typeof reviewEvidence.marketplaceReviewCount === "number" && Number.isFinite(reviewEvidence.marketplaceReviewCount)
      ? reviewEvidence.marketplaceReviewCount
      : typeof listingEvidence.reviewCount === "number" && Number.isFinite(listingEvidence.reviewCount)
        ? listingEvidence.reviewCount
        : null;

  const rating = evidenceRating ?? parseVisibleRating(result.product.rating);
  const publicReviewCount = marketplaceReviewCount ?? parseVisibleReviewCount(result.product.reviewCount);

  const reviewSnippets = Array.isArray(reviewEvidence.reviewSnippets)
    ? reviewEvidence.reviewSnippets
    : [];

  const repeatedPraises = Array.isArray(reviewEvidence.repeatedPraises)
    ? reviewEvidence.repeatedPraises
    : [];

  const repeatedComplaints = Array.isArray(reviewEvidence.repeatedComplaints)
    ? reviewEvidence.repeatedComplaints
    : [];

  const aiPatternSignals = Array.isArray(reviewEvidence.aiPatternSignals)
    ? reviewEvidence.aiPatternSignals
    : [];

  const productPros = Array.isArray(reviewEvidence.productPros)
    ? reviewEvidence.productPros
    : [];

  const productCons = Array.isArray(reviewEvidence.productCons)
    ? reviewEvidence.productCons
    : [];

  const rawScoreCommentsAnalyzed =
    typeof reviewEvidence.commentsAnalyzed === "number" && Number.isFinite(reviewEvidence.commentsAnalyzed)
      ? reviewEvidence.commentsAnalyzed
      : 0;

  const scoreCollector = asRecord(reviewEvidence.reviewCollector);
  const scoreCollectorReviewsCollected =
    typeof scoreCollector.reviewsCollected === "number" && Number.isFinite(scoreCollector.reviewsCollected)
      ? scoreCollector.reviewsCollected
      : 0;

  const scoreGroundedCommentsAnalyzed = Math.max(
    scoreCollectorReviewsCollected,
    reviewSnippets.length,
    repeatedPraises.length,
    repeatedComplaints.length
  );

  const commentsAnalyzed =
    rawScoreCommentsAnalyzed > 0 &&
    rawScoreCommentsAnalyzed !== publicReviewCount &&
    rawScoreCommentsAnalyzed <= Math.max(scoreGroundedCommentsAnalyzed, reviewSnippets.length)
      ? rawScoreCommentsAnalyzed
      : scoreGroundedCommentsAnalyzed;

  const analyzedReviewCount = Math.max(commentsAnalyzed, reviewSnippets.length);

  const publicRatingReliability = fractionalReviewVolumeWeight(publicReviewCount);
  const writtenReviewCoverage = evidenceCoverageWeight(analyzedReviewCount);

  // 35% max from online rating.
  // The public review count only changes reliability as a fraction.
  // Example: 4.3 stars with 278 reviews can support the score, but cannot dominate it.
  const onlineRatingComponent =
    rating === null
      ? 0
      : (rating / 5) * 35 * publicRatingReliability;

  const seriousComplaintCount = countSeriousComplaints([
    ...result.topComplaints,
    ...result.notIdealFor,
    ...productCons.map(String),
    ...repeatedComplaints.map((item) =>
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).theme || "")
        : String(item || "")
    ),
  ]);

  const praiseCount = Math.min(
    8,
    productPros.length + repeatedPraises.length + result.topStrengths.length
  );

  const complaintCount = Math.min(
    8,
    productCons.length + repeatedComplaints.length + result.topComplaints.length
  );

  // 65% max from actual written review analysis.
  // If RI did not analyze written reviews, this component is near zero.
  let writtenReviewSignal = 50;
  writtenReviewSignal += praiseCount * 5;
  writtenReviewSignal -= complaintCount * 7;
  writtenReviewSignal -= seriousComplaintCount * 8;
  writtenReviewSignal -= Math.min(25, aiPatternSignals.length * 6);

  writtenReviewSignal = clampScore(writtenReviewSignal);

  const writtenReviewComponent =
    (writtenReviewSignal / 100) * 65 * writtenReviewCoverage;

  let productScore = Math.round(onlineRatingComponent + writtenReviewComponent);

  // AI-like/fake-review risk can only penalize when actual review text was analyzed.
  if (analyzedReviewCount > 0) {
    if (result.reviewAuthenticity.suspiciousReviewRisk === "High") productScore -= 12;
    if (result.reviewAuthenticity.suspiciousReviewRisk === "Medium") productScore -= 6;
  }

  productScore = clampScore(productScore);

  // Confidence is not the product score.
  // Confidence measures how much RI actually analyzed.
  let buyingConfidence = 10;

  if (rating !== null) buyingConfidence += Math.round(15 * publicRatingReliability);
  if (publicReviewCount !== null && publicReviewCount >= 50) buyingConfidence += 5;
  if (analyzedReviewCount > 0) buyingConfidence += Math.round(65 * writtenReviewCoverage);
  if (reviewSnippets.length >= 10) buyingConfidence += 5;
  if (reviewSnippets.length >= 30) buyingConfidence += 5;
  if (aiPatternSignals.length >= 3) buyingConfidence -= 10;
  if (seriousComplaintCount >= 2) buyingConfidence -= 10;

  buyingConfidence = clampScore(buyingConfidence);

  let verdict: Verdict = "CONSIDER";

  // Do not allow confident BUY/AVOID from public rating/count alone.
  if (analyzedReviewCount < 5) {
    verdict = "CONSIDER";
  } else if (
    productScore >= 75 &&
    buyingConfidence >= 70 &&
    result.reviewAuthenticity.suspiciousReviewRisk !== "High"
  ) {
    verdict = "BUY";
  } else if (productScore < 45 || seriousComplaintCount >= 4) {
    verdict = "AVOID";
  }

  return {
    productScore,
    buyingConfidence,
    verdict,
    scoreAudit: {
      onlineRatingComponent: Math.round(onlineRatingComponent),
      publicRatingReliability,
      writtenReviewComponent: Math.round(writtenReviewComponent),
      writtenReviewCoverage,
      publicReviewCount,
      analyzedReviewCount,
      aiPatternSignalCount: aiPatternSignals.length,
      praiseCount,
      complaintCount,
      seriousComplaintCount,
    },
  };
}

function enforceResearchQuality(result: ReturnType<typeof normalizeVerdictWithScores>, locale = "en") {
  const quality = result.researchQuality;
  const sourceCount = Math.max(result.sourcesUsed.length, quality?.sourceCount || 0);
  const evidenceLevel = quality?.evidenceLevel || "screenshot_only";
  const exactMatch = quality?.exactProductMatch !== false;
  const canRewriteCopy = normalizedLocaleCode(locale) === "en";

  let verdict = result.verdict;
  let productScore = clampScore(result.productScore);
  let buyingConfidence = clampScore(result.buyingConfidence);
  let valueForMoney = result.valueForMoney;
  let bottomLine = result.bottomLine;
  let topComplaints = result.topComplaints;
  let notIdealFor = result.notIdealFor;

  if (evidenceLevel === "product_mismatch" || !exactMatch) {
    verdict = productScore < 45 ? "AVOID" : "CONSIDER";
    productScore = Math.min(productScore, 54);
    buyingConfidence = Math.min(buyingConfidence, 45);
    valueForMoney = valueForMoney === "Excellent" ? "Fair" : valueForMoney;

    if (canRewriteCopy) {
      bottomLine =
        "ReviewIntel could not confidently match the screenshot to the public web evidence. Do not rely on this as a buy signal yet; upload the exact product page or paste the product link.";
      topComplaints = uniqueTextArray([
        "Product identity is uncertain across sources.",
        "Visible screenshot details may belong to a nearby sponsored or different product.",
        ...topComplaints
      ], 6);
      notIdealFor = uniqueTextArray([
        "Anyone who needs a confident purchase decision from this scan.",
        ...notIdealFor
      ], 4);
    }
  } else if (evidenceLevel === "screenshot_only" || sourceCount === 0) {
    if (verdict === "BUY") verdict = "CONSIDER";
    productScore = Math.min(productScore, 59);
    buyingConfidence = Math.min(buyingConfidence, 45);
    if (valueForMoney === "Excellent") valueForMoney = "Fair";

    if (canRewriteCopy) {
      bottomLine =
        "This scan did not find enough verified public review evidence. The screenshot identifies the product, but ReviewIntel needs web review sources or a product link before giving a confident buying verdict.";
    }
  } else if (evidenceLevel === "limited" || sourceCount < 2) {
    if (verdict === "BUY") verdict = "CONSIDER";
    productScore = Math.min(productScore, 69);
    buyingConfidence = Math.min(buyingConfidence, 60);
    if (valueForMoney === "Excellent") valueForMoney = "Good";

    if (canRewriteCopy && result.verdict === "BUY") {
      bottomLine =
        "ReviewIntel found some public product evidence, but not enough matching review sources for a clean BUY. Compare alternatives and check the latest low-star reviews before purchasing.";
    }
  }

  return {
    ...result,
    verdict,
    productScore,
    buyingConfidence,
    valueForMoney,
    bottomLine,
    topComplaints,
    notIdealFor
  };
}

function hasSeriousBuyingComplaints(result: ReturnType<typeof normalizeResult>) {
  const seriousWords = [
    "durability",
    "broken",
    "crack",
    "cracking",
    "handle",
    "zipper",
    "wheel",
    "malfunction",
    "defective",
    "failed",
    "quality control",
    "return",
    "unreliable",
    "stopped working",
    "poor quality"
  ];

  const combined = [
    ...result.topComplaints,
    ...result.notIdealFor
  ]
    .join(" ")
    .toLowerCase();

  return seriousWords.some((word) => combined.includes(word));
}

function applyReviewIntelBrain(result: ReturnType<typeof normalizeResult>, locale = "en") {
  const aiReviewSigns =
    typeof result.reviewAuthenticity.score === "number"
      ? clampScore(result.reviewAuthenticity.score)
      : 0;
  const hasSeriousComplaints = hasSeriousBuyingComplaints(result);
  const canRewriteCopy = normalizedLocaleCode(locale) === "en";

  let verdict: Verdict = result.verdict;
  let productScore = clampScore(result.productScore);
  let buyingConfidence = clampScore(result.buyingConfidence);
  let valueForMoney = result.valueForMoney;
  let bottomLine = result.bottomLine;
  let bestFor = result.bestFor;
  let notIdealFor = result.notIdealFor;

  // HARD TRUST RULES — raw AI cannot override these.
  if (aiReviewSigns >= 50 && verdict === "BUY") {
    verdict = "CONSIDER";
    productScore = Math.min(productScore, 74);
    buyingConfidence = Math.min(buyingConfidence, 65);
    if (canRewriteCopy) {
      bottomLine =
        "This product may still be okay, but the reviews show enough AI-like signs that the rating should not be trusted by itself. Check low-star reviews, buyer photos, and the return policy before buying.";
    }
  }

  if (aiReviewSigns >= 75) {
    verdict = "AVOID";
    productScore = Math.min(productScore, 45);
    buyingConfidence = Math.min(buyingConfidence, 45);
    valueForMoney = "Poor";
    if (canRewriteCopy) {
      bottomLine =
        "The review evidence shows strong AI-like signs, so the rating may not be reliable enough for a confident purchase decision. Compare alternatives before buying.";
    }
  }

  if (hasSeriousComplaints && verdict === "BUY") {
    verdict = "CONSIDER";
    productScore = Math.min(productScore, 74);
    buyingConfidence = Math.min(buyingConfidence, 65);
    if (canRewriteCopy) {
      bottomLine =
        "This product has useful features, but repeated complaint signals mean it is not a clean buy. Compare alternatives before purchasing.";
    }
  }

  if (verdict === "BUY" && productScore < 75) {
    verdict = "CONSIDER";
  }

  if (verdict === "AVOID") {
    productScore = Math.min(productScore, 49);
    buyingConfidence = Math.min(buyingConfidence, 50);
    valueForMoney = "Poor";
    if (canRewriteCopy) {
      bestFor = ["Not recommended based on the current buying evidence."];
    }

    if (canRewriteCopy && !notIdealFor.length) {
      notIdealFor = [
        "People who need a reliable purchase.",
        "Frequent users or heavy-use buyers.",
        "Anyone who wants fewer return hassles."
      ];
    }
  }

  if (verdict === "CONSIDER") {
    productScore = Math.min(productScore, 74);
    if (valueForMoney === "Excellent") valueForMoney = "Good";

    if (canRewriteCopy && !bestFor.length) {
      bestFor = ["Shoppers who are willing to compare alternatives first."];
    }

    if (canRewriteCopy && !notIdealFor.length) {
      notIdealFor = ["People who need proven long-term reliability."];
    }
  }

  return {
    ...result,
    verdict,
    productScore,
    buyingConfidence,
    valueForMoney,
    bestFor,
    notIdealFor,
    bottomLine
  };
}

function normalizeVerdictWithScores(result: ReturnType<typeof normalizeResult>, locale = "en") {
  const calculated = calculateReviewIntelScore(result);
  const canRewriteCopy = normalizedLocaleCode(locale) === "en";

  let valueForMoney = result.valueForMoney;

  if (calculated.verdict === "AVOID" || calculated.productScore < 40) {
    valueForMoney = "Poor";
  } else if (calculated.productScore < 55 && (valueForMoney === "Excellent" || valueForMoney === "Good")) {
    valueForMoney = "Fair";
  }

  let reviewAuthenticity = result.reviewAuthenticity;

  if (calculated.productScore < 35 && reviewAuthenticity.label === "High Trust") {
    reviewAuthenticity = {
      ...reviewAuthenticity,
      label: "Medium Trust",
      suspiciousReviewRisk:
        reviewAuthenticity.suspiciousReviewRisk === "Low" ? "Medium" : reviewAuthenticity.suspiciousReviewRisk
    };
  }

  let topStrengths = legalSafeArray(result.topStrengths);
  let topComplaints = legalSafeArray(result.topComplaints);
  let bestFor = legalSafeArray(result.bestFor);
  let notIdealFor = legalSafeArray(result.notIdealFor);
  let bottomLine = legalSafeText(result.bottomLine);

  if (calculated.verdict === "AVOID") {
    if (canRewriteCopy) {
      bestFor = ["Not recommended based on the current buying evidence."];
    }
    topStrengths = topStrengths.slice(0, 2);

    if (canRewriteCopy && !notIdealFor.length) {
      notIdealFor = [
        "Shoppers who need a reliable purchase.",
        "People buying for frequent use or heavy use."
      ];
    }

    if (canRewriteCopy && !topComplaints.length) {
      topComplaints = [
        "The available buying signals are weak.",
        "Public review evidence does not support a confident purchase."
      ];
    }

    if (canRewriteCopy) {
      bottomLine =
        "Based on the visible listing and public review signals available now, this product does not have enough strong buying evidence. Safer choice: compare alternatives before buying.";
    }
  }

  if (calculated.verdict === "CONSIDER") {
    if (canRewriteCopy) {
      bestFor = bestFor.length ? bestFor : ["Shoppers who are willing to compare alternatives first."];
      bottomLine = bottomLine || "This may work for some buyers, but the evidence is mixed. Compare similar products before buying.";
    }
  }

  if (canRewriteCopy && calculated.verdict === "BUY") {
    notIdealFor = notIdealFor.length ? notIdealFor : ["Shoppers who need features not shown in the listing."];
  }

  const normalized = {
    ...result,
    verdict: calculated.verdict,
    productScore: calculated.productScore,
    buyingConfidence: calculated.buyingConfidence,
    valueForMoney,
    reviewAuthenticity: {
      ...reviewAuthenticity,
      reasons: legalSafeArray(reviewAuthenticity.reasons)
    },
    topStrengths,
    topComplaints,
    bestFor,
    notIdealFor,
    bottomLine
  };

  return applyReviewIntelBrain(normalized, locale);
}

function hasContradictoryNegativeLanguage(text: string) {
  return /\b(hard to recommend|not recommended|not a clean buy|compare alternatives|weak satisfaction|heavy complaint|complaint pressure|risk signals|poor value|avoid|skip|unreliable|not enough strong buying evidence)\b/i.test(text);
}

function enforceFinalResultConsistency(result: ReturnType<typeof normalizeVerdictWithScores>, locale = "en") {
  const productScore = clampScore(result.productScore);
  const buyingConfidence = clampScore(result.buyingConfidence);
  const evidenceText = [
    result.bottomLine,
    ...result.topComplaints,
    ...result.notIdealFor
  ].join(" ");
  const negativeEvidence = hasContradictoryNegativeLanguage(evidenceText);
  const poorValue = result.valueForMoney === "Poor";

  let verdict = result.verdict;
  let valueForMoney = result.valueForMoney;
  let bottomLine = result.bottomLine;

  if (verdict === "BUY" && (productScore < 75 || buyingConfidence < 60 || poorValue || negativeEvidence)) {
    verdict = productScore < 45 || poorValue || negativeEvidence ? "AVOID" : "CONSIDER";
  }

  if (verdict === "CONSIDER" && ((productScore < 35 && buyingConfidence < 45) || (poorValue && negativeEvidence))) {
    verdict = "AVOID";
  }

  if (verdict === "BUY") {
    return result;
  }

  if (verdict === "CONSIDER") {
    valueForMoney = valueForMoney === "Excellent" ? "Good" : valueForMoney;
    if (normalizedLocaleCode(locale) === "en" && result.verdict === "BUY") {
      bottomLine =
        "The AI research found useful buying signals, but the score and confidence do not support a clean BUY. Compare alternatives, review the complaints, and check return terms before purchasing.";
    }
  }

  if (verdict === "AVOID") {
    valueForMoney = poorValue || productScore < 45 ? "Poor" : valueForMoney;
    if (normalizedLocaleCode(locale) === "en" && (result.verdict === "BUY" || result.verdict === "CONSIDER")) {
      bottomLine =
        "The final evidence score, buyer confidence, or complaint signals do not support a BUY verdict. Safer choice: compare alternatives before purchasing.";
    }
  }

  return {
    ...result,
    verdict,
    productScore:
      verdict === "AVOID"
        ? Math.min(productScore, 49)
        : verdict === "CONSIDER"
          ? Math.min(productScore, 74)
          : productScore,
    buyingConfidence:
      verdict === "AVOID"
        ? Math.min(buyingConfidence, 55)
        : verdict === "CONSIDER"
          ? Math.min(buyingConfidence, 74)
          : buyingConfidence,
    valueForMoney,
    bottomLine
  };
}

const visionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    brand: { type: "string" },
    category: { type: "string" },
    store: { type: "string" },
    price: { type: "string" },
    rating: { type: "string" },
    reviewCount: { type: "string" },
    priceBelongsToProduct: { type: "boolean" },
    ratingBelongsToProduct: { type: "boolean" },
    reviewCountBelongsToProduct: { type: "boolean" },
    visibleFeatures: { type: "array", items: { type: "string" } },
    visibleBadges: { type: "array", items: { type: "string" } },
    identityWarnings: { type: "array", items: { type: "string" } },
    normalizedSearchQuery: { type: "string" },
    imageConfidence: { type: "number" }
  },
  required: [
    "name",
    "brand",
    "category",
    "store",
    "price",
    "rating",
    "reviewCount",
    "priceBelongsToProduct",
    "ratingBelongsToProduct",
    "reviewCountBelongsToProduct",
    "visibleFeatures",
    "visibleBadges",
    "identityWarnings",
    "normalizedSearchQuery",
    "imageConfidence"
  ]
};

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    product: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        brand: { type: "string" },
        category: { type: "string" },
        store: { type: "string" },
        price: { type: "string" },
        rating: { type: "string" },
        reviewCount: { type: "string" },
        imageConfidence: { type: "number" }
      },
      required: ["name", "brand", "category", "store", "price", "rating", "reviewCount", "imageConfidence"]
    },
    verdict: { type: "string", enum: ["BUY", "CONSIDER", "AVOID"] },
    productScore: { type: "number" },
    buyingConfidence: { type: "number" },
    valueForMoney: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
    reviewAuthenticity: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string", enum: ["High Trust", "Medium Trust", "Low Trust"] },
        score: { type: "number" },
        suspiciousReviewRisk: { type: "string", enum: ["Low", "Medium", "High"] },
        reasons: { type: "array", items: { type: "string" } }
      },
      required: ["label", "score", "suspiciousReviewRisk", "reasons"]
    },
    topStrengths: { type: "array", items: { type: "string" } },
    topComplaints: { type: "array", items: { type: "string" } },
    bestFor: { type: "array", items: { type: "string" } },
    notIdealFor: { type: "array", items: { type: "string" } },
    bottomLine: { type: "string" },
    sourcesUsed: { type: "array", items: { type: "string" } },
    researchQuality: {
      type: "object",
      additionalProperties: false,
      properties: {
        evidenceLevel: { type: "string", enum: ["verified", "limited", "screenshot_only", "product_mismatch"] },
        exactProductMatch: { type: "boolean" },
        sourceCount: { type: "number" },
        citationCount: { type: "number" },
        notes: { type: "array", items: { type: "string" } }
      },
      required: ["evidenceLevel", "exactProductMatch", "sourceCount", "citationCount", "notes"]
    }
  },
  required: [
    "product",
    "verdict",
    "productScore",
    "buyingConfidence",
    "valueForMoney",
    "reviewAuthenticity",
    "topStrengths",
    "topComplaints",
    "bestFor",
    "notIdealFor",
    "bottomLine",
    "sourcesUsed",
    "researchQuality"
  ]
};

function collectWebCitations(value: unknown, citations = new Map<string, string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectWebCitations(item, citations);
    return citations;
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) return citations;

  const type = String(record.type || "").toLowerCase();
  const url = String(record.url || "").trim();
  if (url && (type.includes("url_citation") || "title" in record || "start_index" in record || "end_index" in record)) {
    const title = String(record.title || "").trim();
    citations.set(url, title ? `${title} (${url})` : url);
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") collectWebCitations(child, citations);
  }

  return citations;
}

async function openAIResponse(payload: JsonRecord) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || "OpenAI request failed.");
  }

  const data = await response.json();
  const dataRecord = asRecord(data);

  const outputTextFromField = typeof dataRecord.output_text === "string" ? dataRecord.output_text : "";
  const outputItems = asArray(dataRecord.output);
  const outputTextFromItems = outputItems
    .flatMap((item) => asArray(asRecord(item).content))
    .map((content) => {
      const contentRecord = asRecord(content);
      return typeof contentRecord.text === "string" ? contentRecord.text : "";
    })
    .join("");

  const outputText = outputTextFromField || outputTextFromItems;

  if (!outputText) {
    throw new Error("No structured analysis returned.");
  }

  const parsed = JSON.parse(outputText) as unknown;
  const citations = Array.from(collectWebCitations(data).values()).slice(0, 12);

  if (citations.length && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return {
      ...(parsed as JsonRecord),
      _webCitations: citations
    };
  }

  return parsed;
}

function normalizeVision(rawValue: unknown): VisionFacts {
  const raw = asRecord(rawValue);
  const priceBelongsToProduct = readBoolean(raw, "priceBelongsToProduct", false);
  const rawStore = readKnownString(raw, "store");
  const isWalmartScreenshot = String(rawStore || "").toLowerCase().includes("walmart");

  const ratingBelongsToProduct =
    readBoolean(raw, "ratingBelongsToProduct", false) || isWalmartScreenshot;
  const reviewCountBelongsToProduct =
    readBoolean(raw, "reviewCountBelongsToProduct", false) || isWalmartScreenshot;

  return {
    name: readString(raw, "name"),
    brand: readString(raw, "brand"),
    category: readString(raw, "category"),
    store: readString(raw, "store"),
    price: priceBelongsToProduct ? readString(raw, "price") : "",
    rating: ratingBelongsToProduct ? readString(raw, "rating") : "",
    reviewCount: reviewCountBelongsToProduct ? readString(raw, "reviewCount") : "",
    priceBelongsToProduct,
    ratingBelongsToProduct,
    reviewCountBelongsToProduct,
    visibleFeatures: asTextArray(raw.visibleFeatures, 10),
    visibleBadges: asTextArray(raw.visibleBadges, 10),
    identityWarnings: asTextArray(raw.identityWarnings, 8),
    normalizedSearchQuery: readString(raw, "normalizedSearchQuery"),
    imageConfidence: normalizeConfidence(raw.imageConfidence)
  };
}

async function extractScreenshotFacts(imageDataUrl: string) {
  const raw = await openAIResponse({
    model: process.env.OPENAI_MODEL || "gpt-4.1",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
You are ReviewIntel's visual product reader.

Read the uploaded product screenshot carefully.

Return only facts visible in the image.
Do not use web search.
Do not guess missing values.
If a field is unclear, return an empty string.

Important:
- Identify the MAIN product being evaluated. The main product is usually the large product detail/listing area, not sponsored rows, recommendation cards, browser suggestions, carousel items, or nearby ads.
- Do not copy price, rating, review count, brand, or title from a sponsored/nearby product if it is not the same product as the main listing.
- Only copy price when that price is visually connected to the main product title/brand. If a visible price belongs to another product, return price as "" and priceBelongsToProduct as false.
- Only copy rating and reviewCount when they are visually connected to the main product title/brand. If they belong to another product, return those fields as "" and their belongsToProduct flags as false.
- If the screenshot shows a sponsored product above the real listing, ignore the sponsored product unless it is clearly the item being scanned.
- If the browser/site shows Amazon.ca, return Amazon.ca.
- Copy visible price exactly.
- Copy visible rating exactly.
- Copy visible review count exactly.
- Add identityWarnings for ambiguous/mismatched visible facts, for example: "Visible price appears to belong to a sponsored product."
- Build normalizedSearchQuery from visible brand + product title + model/category.
`.trim()
          },
          { type: "input_image", image_url: imageDataUrl }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reviewintel_screenshot_facts",
        schema: visionSchema,
        strict: true
      }
    }
  });

  return normalizeVision(raw);
}

async function researchAndVerdict(vision: VisionFacts, productLink: string, outputLanguage = "English", locale = "en") {
  const searchQuery =
    productLink ||
    vision.normalizedSearchQuery ||
    [vision.brand, vision.name, vision.category].filter(Boolean).join(" ");

  const raw = await openAIResponse({
    model: process.env.OPENAI_MODEL || "gpt-4.1",
    tools: [{ type: "web_search_preview" }],
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
You are ReviewIntel, a serious product research assistant.

The screenshot reader extracted these visible facts:
${JSON.stringify(vision, null, 2)}

User product link, if provided:
${productLink || "None"}

Research query:
${searchQuery}

Language rule:
Write all user-facing result text in ${outputLanguage}.
Keep JSON keys in English.
Keep verdict values exactly BUY, CONSIDER, or AVOID.
Keep enum values exactly as required by the schema: valueForMoney must be Excellent, Good, Fair, or Poor; reviewAuthenticity.label must be High Trust, Medium Trust, or Low Trust; suspiciousReviewRisk must be Low, Medium, or High.
Use ${outputLanguage} for every free-text customer-facing field: product category if translated naturally, bottomLine, topStrengths, topComplaints, bestFor, notIdealFor, reviewAuthenticity reasons, and source summaries.
If ${outputLanguage} is not English, do not mix English into those free-text fields except for product names, brand names, marketplace names, source names, model numbers, and the required JSON enum values.

Your job:
Go online and research the product using public sources. Consolidate real review signals and give a buying verdict.

Use the screenshot facts only as the product identity seed. You must search the internet for trusted public product and review evidence before scoring. Search the exact visible product title, brand, model, store, and the user-provided link when available.

Important matching rules:
- Prefer sources that match the visible screenshot product name and brand.
- If the screenshot says Amazon.ca, do not switch the product to Walmart, Ubuy, or another marketplace unless you are using that only as an extra comparison source.
- Do not overwrite visible screenshot price, rating, review count, or store when the screenshot reader marked that fact as belonging to the main product.
- If the screenshot reader left price, rating, or reviewCount blank because it may belong to a sponsored/nearby product, you may fill it only from clearly matching public web evidence.
- If the screenshot reader reports identityWarnings, treat those warnings seriously and lower confidence unless web research resolves them.
- If web results refer to a different product, ignore them.
- If trusted public review evidence is limited, do not invent certainty and do not create fake-looking scores.
- Do not score from the screenshot alone. The screenshot identifies the product; the final verdict must come from trusted public product/review evidence plus visible screenshot facts.
- Use trusted sources such as major retailers, manufacturer pages, marketplace review sections, consumer forums, Reddit discussions, review sites, and support/complaint signals when available.
- Prefer exact product matches. Do not switch to a different model, bundle, size, color, or marketplace listing unless clearly marked as comparison evidence.
- If you cannot find enough trusted review evidence for the exact product, return a limited-evidence result with lower confidence and tell the shopper what to upload next.

Use sources such as:
- official product page
- visible marketplace listing if available
- third-party reviews
- Reddit/forum discussions
- blogs/video review summaries when available

Rules:
1. Do not fabricate sources.
2. Do not claim exact review scraping unless reviews were actually retrieved.
3. Do not call reviews fake or AI-generated as a proven fact. Say "AI-generated review signs" only when actual review wording patterns support it.
4. For reviewAuthenticity, analyze only AI-generated review signs. This means wording patterns in actual review comments, not product quality problems.

reviewAuthenticity.score must mean:
0 = no AI-generated review signs found
25 = weak signs
50 = some signs
75 = many signs
100 = very strong signs

reviewAuthenticity.reasons must only mention review-writing signals, such as:
- repeated phrases
- generic praise
- little product-specific detail
- many short 5-star comments
- similar wording across reviews
- unusual timing pattern if visible from sources

Do not put product complaints like durability, zipper issues, shipping, packaging, or quality reports inside reviewAuthenticity.reasons.

Do not fake reviewAuthenticity. Review authenticity must be based on real review/comment evidence supplied by ReviewIntel's reviewEvidence scan. If no real review/comment evidence is supplied, do not invent fake-review findings. Say the review evidence was not verified instead of pretending the risk is Low or Medium.

Do not say AI-generated reviews are confirmed unless a source proves it.
5. Screenshot facts remain locked for store, price, visible rating, and visible review count.
6. Web research may add complaints, strengths, durability issues, support issues, value signals, and authenticity concerns.
7. If you cannot find enough reliable public evidence, say so in bottomLine and lower buyingConfidence.
8. If the visible screenshot rating is weak, review count is low, or web evidence is limited, do not return a confident BUY.
9. Never manufacture review counts, complaints, pros, cons, or fake-review risk. If evidence is not found, say it is not found.
10. The final shopper score must reflect evidence quality. Limited evidence should reduce confidence and should show a cautious verdict.
9. If the visible product and web results do not clearly match, return CONSIDER or AVOID and explain that identification is uncertain.
10. sourcesUsed must contain real source names or URLs actually used.
11. researchQuality must be honest:
   - evidenceLevel "verified" only when you found at least two matching public sources or one exact product page plus enough review evidence.
   - evidenceLevel "limited" when sources are sparse, review text is unavailable, or only one useful source matches.
   - evidenceLevel "screenshot_only" when you could not verify the product online.
   - evidenceLevel "product_mismatch" when public results appear to be a different product, brand, size, bundle, or model.
   - exactProductMatch must be false if there is any unresolved mismatch between screenshot and web evidence.
   - notes must briefly explain what was verified and what was not verified.

Verdict rules:
BUY = strong evidence across sources, good value, low serious complaints, low suspicious review risk.
CONSIDER = mixed evidence, limited reviews, unclear product match, decent product but meaningful complaints.
AVOID = repeated serious complaints, durability/safety issues, poor value, low trust, insufficient reliable evidence, or product mismatch.

Return only the required JSON.
`.trim()
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reviewintel_product_verdict",
        schema: resultSchema,
        strict: true
      }
    }
  });

  const productForReviewEvidence =
    vision.normalizedSearchQuery ||
    [vision.brand, vision.category]
      .filter(Boolean)
      .join(" ")
      .trim();

  console.log("[ReviewIntel DEBUG vision]", {
    name: vision.name,
    brand: vision.brand,
    store: vision.store,
    price: vision.price,
    rating: vision.rating,
    reviewCount: vision.reviewCount,
    ratingBelongsToProduct: vision.ratingBelongsToProduct,
    reviewCountBelongsToProduct: vision.reviewCountBelongsToProduct,
  });

  const screenshotRating =
    vision.ratingBelongsToProduct || String(vision.store || "").toLowerCase().includes("walmart")
      ? vision.rating
      : undefined;

  const screenshotReviewCount =
    vision.reviewCountBelongsToProduct || String(vision.store || "").toLowerCase().includes("walmart")
      ? vision.reviewCount
      : undefined;

  const reviewEvidence = await collectAndAnalyzeReviewEvidence({
    productName: productForReviewEvidence || vision.category || "unknown product",
    brand: vision.brand,
    model: undefined,
    store: vision.store,
    price: vision.priceBelongsToProduct || String(vision.store || "").toLowerCase().includes("walmart")
      ? vision.price
      : undefined,
    rating: screenshotRating,
    reviewCount: screenshotReviewCount,
    forceRefresh: true,
  });

  const rawRecord = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as JsonRecord) : {};
  const reviewAuthenticity =
    reviewEvidence.commentsAnalyzed > 0
      ? reviewEvidence.reviewAuthenticity
      : {
          ...(rawRecord.reviewAuthenticity && typeof rawRecord.reviewAuthenticity === "object"
            ? (rawRecord.reviewAuthenticity as JsonRecord)
            : {}),
          score: null,
          label: "Review scan not verified",
          suspiciousReviewRisk: "Not scored",
          reasons: reviewEvidence.reviewAuthenticity.reasons,
        };

  console.log("[ReviewIntel DEBUG reviewEvidence]", {
    exactListingUrl: reviewEvidence?.listingEvidence?.exactListingUrl,
    exactListingTitle: reviewEvidence?.listingEvidence?.exactListingTitle,
    store: reviewEvidence?.listingEvidence?.store,
    rating: reviewEvidence?.listingEvidence?.rating,
    reviewCount: reviewEvidence?.listingEvidence?.reviewCount,
    reviewsFound: reviewEvidence?.reviewsFound,
    evidenceStrength: reviewEvidence?.evidenceStrength,
    exactListingConfirmed: reviewEvidence?.exactListingConfirmed,
  });

  return buildReviewEvidenceShopperResult({
    vision: vision as Record<string, unknown>,
    reviewEvidence: reviewEvidence as unknown as Record<string, unknown>,
    reviewAuthenticity,
    rawRecord,
  });
}



function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeVerdictConfidenceAudit(input: {
  exactListingUrl?: unknown;
  exactListingConfirmed?: unknown;
  screenshotTitle?: unknown;
  listingTitle?: unknown;
  screenshotStore?: unknown;
  listingStore?: unknown;
  screenshotPrice?: unknown;
  listingPrice?: unknown;
  rating?: unknown;
  marketplaceReviewCount?: unknown;
  commentsAnalyzed?: unknown;
  repeatedPraisesCount?: number;
  repeatedComplaintsCount?: number;
  productProsCount?: number;
  productConsCount?: number;
  buyScore?: number | null;
  verdict?: string;
  finalDecisionSource?: string;
}) {
  const exactListingUrl = String(input.exactListingUrl || "").trim();
  const screenshotTitle = String(input.screenshotTitle || "").trim();
  const listingTitle = String(input.listingTitle || "").trim();
  const screenshotStore = String(input.screenshotStore || "").trim().toLowerCase();
  const listingStore = String(input.listingStore || "").trim().toLowerCase();
  const screenshotPrice = String(input.screenshotPrice || "").replace(/[^0-9.]/g, "");
  const listingPrice = String(input.listingPrice || "").replace(/[^0-9.]/g, "");

  const rating = Number(input.rating);
  const marketplaceReviewCount = Number(input.marketplaceReviewCount || 0);
  const commentsAnalyzed = Number(input.commentsAnalyzed || 0);

  const hasExactListing = Boolean(exactListingUrl);
  const sameStore =
    Boolean(screenshotStore && listingStore && (listingStore.includes(screenshotStore) || screenshotStore.includes(listingStore))) ||
    Boolean(screenshotStore && exactListingUrl.toLowerCase().includes(screenshotStore.replace(".ca", "").replace(".com", "")));

  const titleLooksMatched =
    Boolean(screenshotTitle && listingTitle) &&
    screenshotTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 8)
      .some((word) => listingTitle.toLowerCase().includes(word));

  const priceMatches =
    Boolean(screenshotPrice && listingPrice) &&
    Math.abs(Number(screenshotPrice) - Number(listingPrice)) <= 1;

  // Gate 1: Did RI reach the right product?
  const productMatchScore =
    hasExactListing && (titleLooksMatched || priceMatches) && sameStore
      ? 25
      : hasExactListing && sameStore
        ? 16
        : hasExactListing
          ? 8
          : 0;

  // Hard fail: wrong/no product identity means no trust.
  if (productMatchScore < 8) {
    return {
      verdictConfidence: 0,
      audit: {
        productMatchScore,
        listingInfoScore: 0,
        reviewCoverageScore: 0,
        prosConsScore: 0,
        scoreCalculationScore: 0,
        verdictRatificationScore: 0,
        marketplaceReviewCount,
        commentsAnalyzed,
        reviewCoverageRatio: 0,
        reason: "ReviewIntel did not verify the exact product strongly enough.",
      },
    };
  }

  // Gate 2: Did RI get listing info right?
  let listingInfoScore = 0;
  if (sameStore) listingInfoScore += 6;
  if (priceMatches || !screenshotPrice) listingInfoScore += 4;
  if (Number.isFinite(rating) && rating > 0) listingInfoScore += 5;
  if (marketplaceReviewCount > 0) listingInfoScore += 5;
  listingInfoScore = Math.min(20, listingInfoScore);

  // Hard fail if website/store is wrong.
  if (!sameStore) {
    return {
      verdictConfidence: 0,
      audit: {
        productMatchScore,
        listingInfoScore: 0,
        reviewCoverageScore: 0,
        prosConsScore: 0,
        scoreCalculationScore: 0,
        verdictRatificationScore: 0,
        marketplaceReviewCount,
        commentsAnalyzed,
        reviewCoverageRatio: 0,
        reason: "ReviewIntel did not verify the same store/website.",
      },
    };
  }

  // Gate 3: Did RI reach the reviews?
  const reviewCoverageRatio =
    marketplaceReviewCount > 0
      ? Math.min(1, commentsAnalyzed / marketplaceReviewCount)
      : commentsAnalyzed > 0
        ? Math.min(1, commentsAnalyzed / 50)
        : 0;

  const reviewCoverageScore = Math.round(25 * reviewCoverageRatio);

  // Gate 4: Did RI separate pros and cons?
  const prosCount = Number(input.productProsCount || 0);
  const consCount = Number(input.productConsCount || 0);
  const repeatedSignals = Number(input.repeatedPraisesCount || 0) + Number(input.repeatedComplaintsCount || 0);

  const prosConsScore =
    commentsAnalyzed > 0 && (prosCount > 0 || consCount > 0 || repeatedSignals > 0)
      ? Math.min(10, 4 + prosCount + consCount + repeatedSignals)
      : 0;

  // Gate 5: Did RI make the correct score decision?
  // It gets credit if it calculated a Buy Score from real review evidence,
  // OR if it correctly withheld the Buy Score because review evidence was not enough.
  const hasEnoughReviewCoverage =
    commentsAnalyzed >= 15 &&
    reviewCoverageRatio >= 0.05;

  const scoreCalculationScore =
    typeof input.buyScore === "number" && hasEnoughReviewCoverage
      ? 10
      : 0;

  // Gate 6: Is the final verdict ratified/correct based on evidence state?
  const verdict = String(input.verdict || "").toUpperCase();
  const finalDecisionSource = String(input.finalDecisionSource || "");

  let verdictRatificationScore = 0;

  const isLimitedEvidenceVerdict =
    verdict.includes("LIMITED") ||
    verdict.includes("EVIDENCE") ||
    finalDecisionSource === "limitedReviewEvidence" ||
    finalDecisionSource === "reviewEvidenceNotEnough";

  if (!hasEnoughReviewCoverage && isLimitedEvidenceVerdict) {
    // RI gets small credit for refusing to fake a scored verdict,
    // but this must not make the scan look highly reliable.
    verdictRatificationScore = commentsAnalyzed > 0 ? 7 : 5;
  } else if (
    hasEnoughReviewCoverage &&
    ["BUY", "CONSIDER", "AVOID"].includes(verdict) &&
    finalDecisionSource === "reviewEvidence"
  ) {
    verdictRatificationScore = 10;
  }

  let verdictConfidence = clampPercent(
    productMatchScore +
      listingInfoScore +
      reviewCoverageScore +
      prosConsScore +
      scoreCalculationScore +
      verdictRatificationScore
  );

  // Hard caps: if RI did not actually read written reviews, confidence must stay low.
  if (commentsAnalyzed <= 0) {
    verdictConfidence = Math.min(verdictConfidence, 40);
  } else if (reviewCoverageRatio < 0.05) {
    verdictConfidence = Math.min(verdictConfidence, 55);
  }

  return {
    verdictConfidence,
    audit: {
      productMatchScore,
      listingInfoScore,
      reviewCoverageScore,
      prosConsScore,
      scoreCalculationScore,
      verdictRatificationScore,
      marketplaceReviewCount,
      commentsAnalyzed,
      reviewCoverageRatio,
      reason: "Verdict Confidence is based on product match, listing accuracy, review coverage, pros/cons extraction, score calculation, and verdict ratification.",
    },
  };
}


function buildReviewEvidenceShopperResult(input: {
  vision: Record<string, unknown>;
  reviewEvidence: Record<string, unknown>;
  reviewAuthenticity: unknown;
  rawRecord?: Record<string, unknown>;
}) {
  const vision = input.vision || {};
  const evidence = input.reviewEvidence || {};
  const rawRecord = input.rawRecord || {};

  const listingEvidence =
    evidence.listingEvidence && typeof evidence.listingEvidence === "object"
      ? (evidence.listingEvidence as Record<string, unknown>)
      : null;

  const productName = String(
    listingEvidence?.exactListingTitle ||
      listingEvidence?.title ||
      listingEvidence?.name ||
      vision.name ||
      vision.title ||
      vision.category ||
      "Unknown product"
  ).trim();

  const brand = String(vision.brand || listingEvidence?.brand || "").trim();
  const store = String(vision.store || listingEvidence?.store || listingEvidence?.domain || "").trim();
  const price = String(vision.price || listingEvidence?.price || "").trim();

  const reviewSnippets = Array.isArray(evidence.reviewSnippets) ? evidence.reviewSnippets : [];
  const repeatedPraises = Array.isArray(evidence.repeatedPraises) ? evidence.repeatedPraises : [];
  const repeatedComplaints = Array.isArray(evidence.repeatedComplaints) ? evidence.repeatedComplaints : [];
  const aiPatternSignals = Array.isArray(evidence.aiPatternSignals) ? evidence.aiPatternSignals.map(String).filter(Boolean) : [];
  const buyerExperienceSignals = Array.isArray(evidence.buyerExperienceSignals) ? evidence.buyerExperienceSignals.map(String).filter(Boolean) : [];
  const productPros = Array.isArray(evidence.productPros) ? evidence.productPros.map(String).filter(Boolean) : [];
  const productCons = Array.isArray(evidence.productCons) ? evidence.productCons.map(String).filter(Boolean) : [];
  const overallImpact = String(evidence.overallImpact || "").trim();
  const buyAssessment = String(evidence.buyAssessment || "").trim();

  const reviewsFound = Number(evidence.reviewsFound || 0);
  const marketplaceReviewCount = Number(evidence.marketplaceReviewCount || evidence.reviewsFound || 0);

  const rawCommentsAnalyzed = Number(evidence.commentsAnalyzed || 0);

  const collectorReviewsCollected =
    evidence.reviewCollector &&
    typeof evidence.reviewCollector === "object" &&
    typeof (evidence.reviewCollector as Record<string, unknown>).reviewsCollected === "number"
      ? Number((evidence.reviewCollector as Record<string, unknown>).reviewsCollected)
      : 0;

  // commentsAnalyzed must be grounded in actual written review text.
  // Never allow the AI to copy marketplaceReviewCount/reviewsFound and pretend all reviews were analyzed.
  const groundedCommentsAnalyzed = Math.max(
    collectorReviewsCollected,
    reviewSnippets.length,
    repeatedPraises.length,
    repeatedComplaints.length
  );

  const commentsAnalyzed =
    rawCommentsAnalyzed > 0 &&
    rawCommentsAnalyzed !== marketplaceReviewCount &&
    rawCommentsAnalyzed !== reviewsFound &&
    rawCommentsAnalyzed <= Math.max(groundedCommentsAnalyzed, reviewSnippets.length)
      ? rawCommentsAnalyzed
      : groundedCommentsAnalyzed;
  const evidenceStrength = String(evidence.evidenceStrength || "none").toLowerCase();

  const hasReadableReviewEvidence =
    reviewSnippets.length > 0 ||
    repeatedPraises.length > 0 ||
    repeatedComplaints.length > 0 ||
    commentsAnalyzed > 0;

  const reviewCoverageRatio =
    marketplaceReviewCount > 0
      ? commentsAnalyzed / marketplaceReviewCount
      : commentsAnalyzed > 0
        ? commentsAnalyzed / 50
        : 0;

  // RI is only allowed to give BUY / CONSIDER / AVOID when it actually analyzed
  // a meaningful amount of written buyer review text.
  const hasUsableReviewEvidence =
    hasReadableReviewEvidence &&
    commentsAnalyzed >= 15 &&
    reviewSnippets.length >= 5 &&
    reviewCoverageRatio >= 0.05 &&
    !["none", "weak"].includes(evidenceStrength);

  // If RI found the product/review count but did not reach enough written reviews,
  // it must be honest: LIMITED REVIEW EVIDENCE, not a scored verdict.
  const hasLimitedReviewEvidence =
    marketplaceReviewCount > 0 ||
    reviewsFound > 0 ||
    hasReadableReviewEvidence ||
    evidenceStrength === "weak" ||
    evidenceStrength === "limited";

  const praiseThemes = repeatedPraises
    .map((item) =>
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).theme || "").trim()
        : ""
    )
    .filter(Boolean)
    .slice(0, 4);

  const complaintThemes = repeatedComplaints
    .map((item) =>
      item && typeof item === "object"
        ? String((item as Record<string, unknown>).theme || "").trim()
        : ""
    )
    .filter(Boolean)
    .slice(0, 4);

  let verdict = "REVIEW EVIDENCE NOT ENOUGH";
  let decisionStatus = "not_enough_evidence";
  let finalDecisionSource = "reviewEvidenceNotEnough";
  let buyScore: number | null = null;
  let valueForMoney = "Unknown";
  let bottomLine =
    "ReviewIntel searched the web and found the product identity/listing, but could not access enough readable review evidence to judge this product.";

  if (hasUsableReviewEvidence) {
    finalDecisionSource = "reviewEvidence";
    decisionStatus = "evidence_based";

    if (complaintThemes.length >= 3 && complaintThemes.length > praiseThemes.length) {
      verdict = "AVOID";
      buyScore = 3;
      valueForMoney = "Risky";
      bottomLine =
        "ReviewIntel found usable review evidence with repeated complaint themes. Avoid unless the seller, return policy, or newer reviews clearly reduce the risk.";
    } else if (praiseThemes.length >= 2 && complaintThemes.length === 0) {
      verdict = "BUY";
      buyScore = 8;
      valueForMoney = "Good";
      bottomLine =
        "ReviewIntel found usable review evidence with repeated positive buyer themes and no repeated complaint pattern in the collected evidence.";
    } else {
      verdict = "CONSIDER";
      buyScore = 6;
      valueForMoney = "Fair";
      bottomLine =
        "ReviewIntel found usable review evidence, but the signals are mixed or not strong enough for a confident Buy.";
    }
  } else if (hasLimitedReviewEvidence) {
    verdict = "LIMITED REVIEW EVIDENCE";
    decisionStatus = "limited_review_evidence";
    finalDecisionSource = "limitedReviewEvidence";
    bottomLine =
      "ReviewIntel found the public marketplace review count, but could only access a limited number of written review signals. It cannot judge the product until it analyzes enough of the buyer experiences inside those reviews.";
  }

  const verdictConfidenceAudit = computeVerdictConfidenceAudit({
    exactListingUrl: listingEvidence?.exactListingUrl || listingEvidence?.url || null,
    exactListingConfirmed: evidence.exactListingConfirmed,
    screenshotTitle: vision.name || vision.title || vision.category,
    listingTitle: productName,
    screenshotStore: vision.store,
    listingStore: store,
    screenshotPrice: vision.price,
    listingPrice: price,
    rating: evidence.rating ?? listingEvidence?.rating ?? null,
    marketplaceReviewCount,
    commentsAnalyzed,
    repeatedPraisesCount: repeatedPraises.length,
    repeatedComplaintsCount: repeatedComplaints.length,
    productProsCount: productPros.length,
    productConsCount: productCons.length,
    buyScore,
    verdict,
    finalDecisionSource,
  });

  const verdictConfidence = verdictConfidenceAudit.verdictConfidence;

  console.log("[ReviewIntel DEBUG verdictAudit]", {
    verdict,
    finalDecisionSource,
    buyScore,
    verdictConfidence,
    productMatchScore: verdictConfidenceAudit.audit.productMatchScore,
    listingInfoScore: verdictConfidenceAudit.audit.listingInfoScore,
    reviewCoverageScore: verdictConfidenceAudit.audit.reviewCoverageScore,
    prosConsScore: verdictConfidenceAudit.audit.prosConsScore,
    scoreCalculationScore: verdictConfidenceAudit.audit.scoreCalculationScore,
    verdictRatificationScore: verdictConfidenceAudit.audit.verdictRatificationScore,
    marketplaceReviewCount: verdictConfidenceAudit.audit.marketplaceReviewCount,
    rawCommentsAnalyzed,
    collectorReviewsCollected,
    groundedCommentsAnalyzed,
    commentsAnalyzed: verdictConfidenceAudit.audit.commentsAnalyzed,
    reviewCoverageRatio: verdictConfidenceAudit.audit.reviewCoverageRatio,
    reason: verdictConfidenceAudit.audit.reason,
  });

  return {
    ...rawRecord,

    analysisVersion: "review-evidence-v2",
    meta: {
      audience: "buyer",
      mode: "shopper",
      source: "review-evidence-v2",
    },

    productName,
    name: productName,
    title: productName,
    brand,
    store,
    price,

    productIdentity: {
      title: productName,
      brand,
      store,
      price,
      rating: evidence.rating ?? null,
      reviewCount: (evidence.reviewCount ?? marketplaceReviewCount) || null,
      exactListingUrl: listingEvidence?.exactListingUrl || listingEvidence?.url || null,
    },

    reviewEvidence: evidence,
    reviewAuthenticity: input.reviewAuthenticity,

    reviewIntelTrace: {
      screenshotIdentity: {
        title: String(vision.name || vision.title || vision.category || "").trim(),
        brand: String(vision.brand || "").trim(),
        store: String(vision.store || "").trim(),
        price: String(vision.price || "").trim(),
      },
      exactListingEvidence: listingEvidence,
      reviewEvidence: {
        marketplaceReviewCount,
        reviewsFound,
        commentsAnalyzed,
        evidenceStrength,
        reviewSnippets: reviewSnippets.length,
        repeatedPraises: repeatedPraises.length,
        repeatedComplaints: repeatedComplaints.length,
      },
      finalDecisionSource,
      verdictConfidenceAudit: verdictConfidenceAudit.audit,
    },

    verdict,
    recommendation: verdict,
    finalVerdict: verdict,
    stableVerdict: verdict,
    decisionStatus,

    buyerConfidence: verdictConfidence,
    confidence: verdictConfidence,
    verdictConfidence,
    verdictConfidenceAudit: verdictConfidenceAudit.audit,
    buyScore,
    score: buyScore,
    productScore: buyScore,

    valueForMoney,
    value: valueForMoney,

    rating: evidence.rating ?? null,
    reviewCount: (evidence.reviewCount ?? marketplaceReviewCount) || null,
    reviewsFound,
    marketplaceReviewCount,
    commentsAnalyzed,

    topStrengths: hasUsableReviewEvidence ? (productPros.length ? productPros : praiseThemes) : [],
    topComplaints: hasUsableReviewEvidence ? (productCons.length ? productCons : complaintThemes) : [],
    strengths: hasUsableReviewEvidence ? (productPros.length ? productPros : praiseThemes) : [],
    complaints: hasUsableReviewEvidence ? (productCons.length ? productCons : complaintThemes) : [],
    aiPatternSignals,
    buyerExperienceSignals,
    overallImpact,
    buyAssessment,

    screenshotOnly: false,
    screenshotOnlyWarning: false,

    bottomLine,
    summary: bottomLine,
    stableVerdictReason: bottomLine,
  };
}


export async function POST(request: Request) {
  try {
    const limit = await rateLimitRequest(request, {
      key: "analyze_api",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      eventType: "analyze_rate_limited"
    });

    if (!limit.allowed) {
      return limit.response ?? NextResponse.json({ error: "Too many analysis requests." }, { status: 429 });
    }

    const cookieHeader = request.headers.get("cookie") || "";

    const readCookie = (name: string) => {
      const entry = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

      if (!entry) return "";

      const rawValue = entry.slice(name.length + 1);

      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    };

    const accountSession = readAccountSession(request);
    const adminSession = adminSessionFromRequest(request);
    const requestedRole = adminSession && !accountSession
      ? "admin"
      : normalizeRole(accountSession?.role || "");
    const requestedPlan = adminSession && !accountSession
      ? "seller_pro"
      : normalizePlan(accountSession?.plan || "");
    const email = accountSession?.email || adminSession?.email || "";
    const resolvedAccount = await resolveAnalyzeAccount(email, requestedPlan, requestedRole);
    const role = resolvedAccount.role;
    const plan = resolvedAccount.plan;

    if (role === "guest") {
      return NextResponse.json(
        { error: "Please log in before analyzing a product." },
        { status: 401 }
      );
    }

    const normalizedPlanForAnalyze = String(plan || "").trim();
    const isBetaPlanForAnalyze =
      normalizedPlanForAnalyze === "buyer_beta" ||
      normalizedPlanForAnalyze === "seller_beta";

    const isShopperFree =
      role !== "admin" &&
      !isBetaPlanForAnalyze &&
      normalizedPlanForAnalyze === "free_buyer";

    if (isShopperFree) {
      if (!email) {
        return NextResponse.json(
          { error: "Please log in again before analyzing a product." },
          { status: 401 }
        );
      }

      const quota = await readPersistentQuota({
        email,
        plan: "free_buyer"
      });

      if (!quota) {
        return NextResponse.json(
          {
            error: "We could not verify your daily scan allowance. Please try again.",
            code: "QUOTA_UNAVAILABLE"
          },
          { status: 503 }
        );
      }

      if ((quota.remaining ?? 0) <= 0) {
        return NextResponse.json(
          {
            error: "You have used all 3 free scans for today. Upgrade to Premium for more scans and the fuller buying-confidence report.",
            code: "DAILY_SCAN_LIMIT_REACHED",
            upgradeRequired: true,
            upgradeUrl: "/pricing?plan=shopper_premium",
            cta: "Try Premium",
            quota
          },
          { status: 429 }
        );
      }
    }

    const recordCompletedScan = async (scanResult: JsonRecord) => {
      if (!email) {
        return scanResult;
      }

      const accountPlan = isBetaPlanForAnalyze ? normalizedPlanForAnalyze : plan || "free_buyer";
      const shouldSaveHistory = role === "admin" || accountPlan !== "free_buyer";
      const analysisRecord = shouldSaveHistory
        ? (await saveAnalysisRecord({
            profile_email: email,
            mode: "buyer",
            product_name: asRecord(scanResult.product).name ?? "Product scan",
            platform: asRecord(scanResult.product).store ?? "other",
            product_score: scanResult.productScore ?? scanResult.buyingConfidence ?? null,
            recommendation: scanResult.verdict ?? null,
            summary: scanResult.bottomLine ?? null,
            analysis_json: {
              ...scanResult,
              analysisVersion: "review-evidence-v2",
            },
            account: { email, plan: accountPlan, role }
          }) as { id?: string; created_at?: string } | null)
        : null;

      const usage = await consumePersistentQuota(
        {
          email,
          plan: accountPlan
        },
        {
          analysis_id: analysisRecord?.id ?? null,
          audience: "buyer",
          product_name: asRecord(scanResult.product).name ?? null,
          verdict: scanResult.verdict ?? null
        }
      );

      return {
        ...scanResult,
        analysisId: analysisRecord?.id ?? null,
        createdAt: analysisRecord?.created_at ?? new Date().toISOString(),
        quota: usage.quota ?? null
      };
    };

    const formData = await request.formData();
    const file = formData.get("image");
    const productLink = String(formData.get("productLink") || "").trim();
    const locale = normalizedLocaleCode(String(formData.get("locale") || readCookie("reviewintel_locale") || "en").trim());
    const outputLanguage = languageNameFromLocale(locale);
    const fallbackCopy = localizedAnalyzeText(locale);
    const securityResponse = await rejectSuspiciousInput(request, productLink, "shopper product link", email || null);

    if (securityResponse) return securityResponse;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a product screenshot." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image is too large. Please upload a screenshot under 8MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageDataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const vision = await extractScreenshotFacts(imageDataUrl);

    const hasVisibleProductIdentity =
      Boolean(vision.name) ||
      Boolean(vision.store) ||
      Boolean(vision.price) ||
      Boolean(vision.rating) ||
      Boolean(vision.reviewCount);

    if (vision.imageConfidence < 45 && !productLink && !hasVisibleProductIdentity) {
      const fallbackResult = {
        product: {
          name: vision.name,
          brand: vision.brand,
          category: vision.category,
          store: vision.store,
          price: vision.price,
          rating: vision.rating,
          reviewCount: vision.reviewCount,
          imageConfidence: vision.imageConfidence
        },
        verdict: "CONSIDER" as Verdict,
        productScore: 40,
        buyingConfidence: 30,
        valueForMoney: "Fair",
        reviewAuthenticity: {
          label: "Low Trust",
          score: 35,
          suspiciousReviewRisk: "High",
          reasons: [fallbackCopy.unclear]
        },
        topStrengths: [],
        topComplaints: [],
        bestFor: [],
        notIdealFor: [fallbackCopy.needConfidentDecision],
        bottomLine: fallbackCopy.needClearerInput,
        sourcesUsed: [],
        researchQuality: {
          evidenceLevel: "screenshot_only" as const,
          exactProductMatch: false,
          sourceCount: 0,
          citationCount: 0,
          notes: [fallbackCopy.needClearerInput]
        }
      ,
        reviewEvidence: null};

      return NextResponse.json(await recordCompletedScan(attachLanguageMeta(enforceFinalResultConsistency(fallbackResult, locale), locale, outputLanguage)));
    }

    const productKey = createProductKey([
      vision.brand,
      vision.name,
      vision.category,
      productLink
    ]);

    const memory = await getProductMemory(productKey);
    void memory;

    const freshResult = await researchAndVerdict(vision, productLink, outputLanguage, locale);

    // Shopper v2: do not re-score, normalize, or apply old product memory after the review-evidence result is built.
    const result = attachLanguageMeta(
      freshResult,
      locale,
      outputLanguage,
    );

    // Shopper v2 is built only from review evidence.
    // Do not save v2 results into old product memory, because that memory expects
    // legacy screenshot-scored fields and can reintroduce old verdict authority.
    const shouldWriteLegacyProductMemory =
      String((result as Record<string, unknown>).analysisVersion || "") !== "review-evidence-v2";

    if (!isReviewIntelTestAccount(email) && shouldWriteLegacyProductMemory) {
      await saveProductMemory({
        productKey,
        vision,
        result: result as unknown as Parameters<typeof saveProductMemory>[0]["result"],
        productLink
      });
    }

    return NextResponse.json(await recordCompletedScan(result));
  } catch (error) {
    console.error("Analyze product failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We could not analyze this product. Please try a clearer screenshot or paste the product link."
      },
      { status: 500 }
    );
  }
}
