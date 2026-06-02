"use client";

import type { AnalyzeResponse, ReviewPlatform, SubscriptionPlan } from "@/lib/types";
import { ACCOUNT_STORAGE_KEY, normalizePlan, normalizeRole } from "@/lib/account";

const SELLER_PRODUCTS_KEY_BASE = "reviewintel:seller-products";
const ACTIVE_SELLER_PRODUCT_KEY_BASE = "reviewintel:active-seller-product";

export type SellerProductScanTone = "positive" | "mixed" | "negative" | "improvement";

export type SellerProductScan = {
  id: string;
  date: string;
  productHealthScore: number;
  customerSatisfactionScore: number;
  complaintSeverityScore: number;
  sentimentScore: number;
  reviewCount: number;
  topComplaint: string;
  topPositiveTheme: string;
  aiSummary: string;
  actionRecommendation: string;
  strengths: string[];
  complaints: string[];
  actionPlan: string[];
  tone: SellerProductScanTone;
};

export type SellerProduct = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  imageUrl: string;
  platform: ReviewPlatform;
  productUrl: string;
  category: string;
  notes: string;
  scans: SellerProductScan[];
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeArray(items: string[] | undefined, fallback: string) {
  const cleaned = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, 6) : [fallback];
}

function safeAccountKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, "-");
}

function currentSellerProductScope() {
  if (!canUseStorage()) {
    return { key: "guest", role: "guest", plan: "free_buyer", isSeller: false, isSellerPro: false };
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) {
      return { key: "guest", role: "guest", plan: "free_buyer", isSeller: false, isSellerPro: false };
    }

    const parsed = JSON.parse(raw) as {
      email?: string;
      role?: string;
      plan?: string;
      userId?: string | null;
      authUserId?: string | null;
    };

    const role = normalizeRole(parsed.role);
    const plan = normalizePlan(parsed.plan);
    const identity = parsed.email || parsed.userId || parsed.authUserId || "guest";
    const key = `${safeAccountKey(identity)}:${plan}`;

    return {
      key,
      role,
      plan,
      isSeller: role === "seller" && (plan === "seller_starter" || plan === "seller_pro"),
      isSellerPro: role === "seller" && plan === "seller_pro"
    };
  } catch {
    return { key: "guest", role: "guest", plan: "free_buyer", isSeller: false, isSellerPro: false };
  }
}

function productsKey() {
  return `${SELLER_PRODUCTS_KEY_BASE}:${currentSellerProductScope().key}`;
}

function activeProductKey() {
  return `${ACTIVE_SELLER_PRODUCT_KEY_BASE}:${currentSellerProductScope().key}`;
}

function toneForScan(score: number, previousScore?: number): SellerProductScanTone {
  if (typeof previousScore === "number" && score >= previousScore + 5) return "improvement";
  if (score >= 72) return "positive";
  if (score >= 50) return "mixed";
  return "negative";
}

export function productLimitForPlan(plan: SubscriptionPlan | undefined) {
  if (plan === "seller_pro") return 50;
  if (plan === "seller_starter") return 10;
  return 0;
}

export function readSellerProducts(): SellerProduct[] {
  if (!canUseStorage()) return [];
  const scope = currentSellerProductScope();
  if (!scope.isSeller) return [];

  try {
    const raw = window.localStorage.getItem(productsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.name) : [];
  } catch {
    return [];
  }
}

export function writeSellerProducts(products: SellerProduct[]) {
  if (!canUseStorage()) return;
  const scope = currentSellerProductScope();
  if (!scope.isSeller) return;
  window.localStorage.setItem(productsKey(), JSON.stringify(products));
}

export function activeSellerProductId() {
  if (!canUseStorage()) return "";
  const scope = currentSellerProductScope();
  if (!scope.isSeller) return "";
  return window.localStorage.getItem(activeProductKey()) ?? "";
}

export function saveActiveSellerProductId(productId: string) {
  if (!canUseStorage()) return;
  const scope = currentSellerProductScope();
  if (!scope.isSeller) return;
  if (productId) window.localStorage.setItem(activeProductKey(), productId);
  else window.localStorage.removeItem(activeProductKey());
}

export function createSellerProduct(input: Partial<SellerProduct>, plan: SubscriptionPlan | undefined) {
  const scope = currentSellerProductScope();
  if (!scope.isSeller) throw new Error("Product tracking requires a seller account.");

  const products = readSellerProducts();
  const limit = productLimitForPlan(plan);
  if (limit <= 0) throw new Error("Seller product tracking requires Seller Starter or Seller Pro.");
  if (products.length >= limit) throw new Error(`Your current seller plan supports up to ${limit} products.`);

  const now = new Date().toISOString();
  const product: SellerProduct = {
    id: uid("seller-product"),
    createdAt: now,
    updatedAt: now,
    name: input.name?.trim() || "Untitled product",
    imageUrl: input.imageUrl?.trim() || "",
    platform: input.platform ?? "other",
    productUrl: input.productUrl?.trim() || "",
    category: input.category?.trim() || "",
    notes: input.notes?.trim() || "",
    scans: []
  };

  writeSellerProducts([product, ...products]);
  saveActiveSellerProductId(product.id);
  return product;
}

export function updateSellerProduct(productId: string, patch: Partial<SellerProduct>) {
  const products = readSellerProducts();
  const next = products.map((product) =>
    product.id === productId
      ? {
          ...product,
          ...patch,
          name: patch.name !== undefined ? patch.name.trim() || product.name : product.name,
          imageUrl: patch.imageUrl !== undefined ? patch.imageUrl.trim() : product.imageUrl,
          productUrl: patch.productUrl !== undefined ? patch.productUrl.trim() : product.productUrl,
          category: patch.category !== undefined ? patch.category.trim() : product.category,
          notes: patch.notes !== undefined ? patch.notes.trim() : product.notes,
          updatedAt: new Date().toISOString()
        }
      : product
  );
  writeSellerProducts(next);
  return next.find((product) => product.id === productId) ?? null;
}

export function deleteSellerProduct(productId: string) {
  const products = readSellerProducts().filter((product) => product.id !== productId);
  writeSellerProducts(products);
  if (activeSellerProductId() === productId) saveActiveSellerProductId(products[0]?.id ?? "");
}

export function productScanFromResult(result: AnalyzeResponse): SellerProductScan {
  const analysis = result.analysis;
  const seller = analysis.seller_insights;
  const score = clamp(analysis.product_score);
  const satisfaction = clamp(seller.customer_satisfaction_score);
  const complaintSeverity = clamp(analysis.complaint_severity_score);
  const sentiment = clamp(analysis.sentiment_percentage ?? (analysis.sentiment_score + 1) * 50);

  return {
    id: result.meta.analysis_id || uid("product-scan"),
    date: todayKey(),
    productHealthScore: score,
    customerSatisfactionScore: satisfaction,
    complaintSeverityScore: complaintSeverity,
    sentimentScore: sentiment,
    reviewCount: result.meta.review_count_estimate,
    topComplaint: seller.complaint_clusters[0] || analysis.common_complaints[0] || "No dominant complaint yet",
    topPositiveTheme: analysis.praised_features[0] || analysis.positive_points[0] || "Positive theme needs more review volume",
    aiSummary: analysis.overall_summary,
    actionRecommendation: seller.seller_recommendations[0] || seller.product_improvement_recommendations[0] || "Run another scan and compare movement.",
    strengths: safeArray(analysis.praised_features.length ? analysis.praised_features : analysis.positive_points, "Positive feedback needs more review volume."),
    complaints: safeArray(seller.complaint_clusters.length ? seller.complaint_clusters : analysis.common_complaints, "No major complaint cluster detected."),
    actionPlan: safeArray(seller.seller_recommendations.length ? seller.seller_recommendations : seller.product_improvement_recommendations, "Monitor the next scan and compare complaint movement."),
    tone: "mixed"
  };
}

export function saveSellerProductScan(productId: string, result: AnalyzeResponse) {
  const scope = currentSellerProductScope();
  if (!scope.isSeller) return null;
  if (!productId || (result.meta.audience !== "seller" && result.meta.audience !== "both")) return null;

  const products = readSellerProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return null;

  const scan = productScanFromResult(result);
  const previous = product.scans[0];
  scan.tone = toneForScan(scan.productHealthScore, previous?.productHealthScore);
  const nextProduct: SellerProduct = {
    ...product,
    updatedAt: new Date().toISOString(),
    scans: [scan, ...product.scans.filter((item) => item.id !== scan.id)].slice(0, 180)
  };
  writeSellerProducts(products.map((item) => (item.id === productId ? nextProduct : item)));
  saveActiveSellerProductId(productId);
  return nextProduct;
}
