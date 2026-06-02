import type { AnalyzeResponse } from "@/lib/types";
import { ACCOUNT_STORAGE_KEY, normalizePlan, normalizeRole } from "@/lib/account";

const SELLER_JOURNAL_KEY_BASE = "reviewintel:seller-improvement-journal";
const SELLER_JOURNAL_NOTES_KEY_BASE = "reviewintel:seller-improvement-notes";

export type SellerJournalScan = {
  id: string;
  date: string;
  productName: string;
  productScore: number;
  sentimentScore: number;
  reviewCount: number;
  mainComplaint: string;
  topComplaints: string[];
  topPositiveFeedback: string[];
  recommendations: string[];
  actionPlan: string[];
  summary: string;
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

function safeArray(items: string[] | undefined, fallback: string) {
  const cleaned = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, 6) : [fallback];
}

function safeAccountKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, "-");
}

function currentSellerJournalScope() {
  if (!canUseStorage()) return { key: "guest", role: "guest", plan: "free_buyer", isSellerPro: false };

  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return { key: "guest", role: "guest", plan: "free_buyer", isSellerPro: false };

    const parsed = JSON.parse(raw) as { email?: string; role?: string; plan?: string; userId?: string | null; authUserId?: string | null };
    const role = normalizeRole(parsed.role);
    const plan = normalizePlan(parsed.plan);
    const identity = parsed.email || parsed.userId || parsed.authUserId || "guest";
    const key = `${safeAccountKey(identity)}:${plan}`;

    return { key, role, plan, isSellerPro: role === "seller" && plan === "seller_pro" };
  } catch {
    return { key: "guest", role: "guest", plan: "free_buyer", isSellerPro: false };
  }
}

function journalKey() {
  return `${SELLER_JOURNAL_KEY_BASE}:${currentSellerJournalScope().key}`;
}

function journalNotesKey() {
  return `${SELLER_JOURNAL_NOTES_KEY_BASE}:${currentSellerJournalScope().key}`;
}

export function canUseSellerProJournal() {
  return currentSellerJournalScope().isSellerPro;
}

export function readSellerJournal(): SellerJournalScan[] {
  if (!canUseStorage() || !canUseSellerProJournal()) return [];

  try {
    const raw = window.localStorage.getItem(journalKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.date) : [];
  } catch {
    return [];
  }
}

export function saveSellerJournalScan(result: AnalyzeResponse, productName: string) {
  if (!canUseStorage() || !canUseSellerProJournal()) return;
  if (result.meta.audience !== "seller" && result.meta.audience !== "both") return;

  const analysis = result.analysis;
  const seller = analysis.seller_insights;
  const scan: SellerJournalScan = {
    id: result.meta.analysis_id || `seller-scan-${Date.now()}`,
    date: todayKey(),
    productName: productName.trim() || "Untitled product",
    productScore: Math.round(analysis.product_score),
    sentimentScore: analysis.sentiment_score,
    reviewCount: result.meta.review_count_estimate,
    mainComplaint: seller.complaint_clusters[0] || analysis.common_complaints[0] || "No dominant complaint yet",
    topComplaints: safeArray(seller.main_customer_pain_points.length ? seller.main_customer_pain_points : analysis.common_complaints, "No major complaint cluster detected."),
    topPositiveFeedback: safeArray(analysis.praised_features.length ? analysis.praised_features : analysis.positive_points, "Positive feedback needs more review volume."),
    recommendations: safeArray(seller.product_improvement_recommendations, "Collect more reviews before making a product change."),
    actionPlan: safeArray(seller.seller_recommendations, "Monitor the next scan and compare complaint movement."),
    summary: analysis.overall_summary
  };

  const current = readSellerJournal().filter((item) => item.id !== scan.id);
  window.localStorage.setItem(journalKey(), JSON.stringify([scan, ...current].slice(0, 120)));
}

export function readSellerJournalNotes(): Record<string, string> {
  if (!canUseStorage() || !canUseSellerProJournal()) return {};

  try {
    const raw = window.localStorage.getItem(journalNotesKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSellerJournalNote(date: string, note: string) {
  if (!canUseStorage() || !canUseSellerProJournal()) return;
  const notes = readSellerJournalNotes();
  window.localStorage.setItem(journalNotesKey(), JSON.stringify({ ...notes, [date]: note }));
}
