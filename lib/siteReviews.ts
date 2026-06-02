import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type SiteReviewStatus = "pending" | "approved" | "hidden";

export type SiteReview = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  role: string;
  rating: number;
  comment: string;
  email?: string;
  status: SiteReviewStatus;
  featured: boolean;
  sampleOnly?: boolean;
};

type SiteReviewStore = {
  reviews: SiteReview[];
};

declare global {
  var reviewIntelSiteReviewStore: SiteReviewStore | undefined;
}

function store() {
  if (!globalThis.reviewIntelSiteReviewStore) {
    globalThis.reviewIntelSiteReviewStore = readStoreFromDisk();
  }

  return globalThis.reviewIntelSiteReviewStore;
}

function storePath() {
  return path.join(process.cwd(), ".reviewintel-data", "site-reviews.json");
}

function readStoreFromDisk(): SiteReviewStore {
  try {
    const raw = readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw);
    return { reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [] };
  } catch {
    return { reviews: [] };
  }
}

function writeStoreToDisk() {
  try {
    const file = storePath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(store(), null, 2));
  } catch {
    // Local file persistence is best-effort; API responses still work in memory.
  }
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function cleanEmail(value: unknown) {
  const email = cleanText(value).toLowerCase();
  return email.includes("@") ? email.slice(0, 160) : "";
}

function clampRating(value: unknown) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `site-review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function listSiteReviews(options?: { publicOnly?: boolean; featuredOnly?: boolean }) {
  const reviews = [...store().reviews].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return reviews.filter((review) => {
    if (options?.publicOnly && review.status !== "approved") return false;
    if (options?.featuredOnly && !review.featured) return false;
    return true;
  });
}

export function createSiteReview(input: Partial<SiteReview>) {
  const name = cleanText(input.name, "ReviewIntel user").slice(0, 80);
  const role = cleanText(input.role, "Shopper").slice(0, 80);
  const comment = cleanText(input.comment).slice(0, 900);
  const rating = clampRating(input.rating);

  if (comment.length < 12) throw new Error("Please add a short review comment.");
  if (rating <= 0) throw new Error("Please choose a rating.");

  const now = new Date().toISOString();
  const review: SiteReview = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    name,
    role,
    rating,
    comment,
    email: cleanEmail(input.email),
    status: "pending",
    featured: false
  };

  store().reviews = [review, ...store().reviews];
  writeStoreToDisk();
  return review;
}

export function updateSiteReview(id: string, patch: Partial<SiteReview>) {
  let updated: SiteReview | null = null;
  store().reviews = store().reviews.map((review) => {
    if (review.id !== id) return review;

    updated = {
      ...review,
      name: patch.name !== undefined ? cleanText(patch.name, review.name).slice(0, 80) : review.name,
      role: patch.role !== undefined ? cleanText(patch.role, review.role).slice(0, 80) : review.role,
      rating: patch.rating !== undefined ? clampRating(patch.rating) : review.rating,
      comment: patch.comment !== undefined ? cleanText(patch.comment, review.comment).slice(0, 900) : review.comment,
      email: patch.email !== undefined ? cleanEmail(patch.email) : review.email,
      status: patch.status === "approved" || patch.status === "hidden" || patch.status === "pending" ? patch.status : review.status,
      featured: typeof patch.featured === "boolean" ? patch.featured : review.featured,
      updatedAt: new Date().toISOString()
    };
    return updated;
  });

  if (!updated) throw new Error("Review not found.");
  writeStoreToDisk();
  return updated;
}

export function deleteSiteReview(id: string) {
  const before = store().reviews.length;
  store().reviews = store().reviews.filter((review) => review.id !== id);
  if (store().reviews.length === before) throw new Error("Review not found.");
  writeStoreToDisk();
}
