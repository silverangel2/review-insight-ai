import { NextResponse } from "next/server";
import { rateLimitRequest } from "@/lib/security";
import { resolveShopperScanAccount } from "@/lib/shopperScanAllowance";
import {
  CommunityReviewError,
  listApprovedReviews,
  normalizeProductKey,
  submitCommunityReview,
} from "@/lib/communityReviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_MAX_BYTES = 5_000_000;
const OCR_TIMEOUT_MS = 15_000;

type ProofVerification = {
  verifiedPurchase: boolean;
  proofSha256: string | null;
  proofOcrConfidence: number | null;
};

/**
 * Verify an order/receipt photo against the product name using the existing
 * on-device OCR lane (zero OpenAI). Fail-soft: any OCR problem means
 * "unverified", never a failed submission.
 */
async function verifyProofImage(image: Buffer, productName: string): Promise<ProofVerification> {
  const fallback: ProofVerification = { verifiedPurchase: false, proofSha256: null, proofOcrConfidence: null };
  const name = String(productName || "").trim();
  if (!name || !image.length) return fallback;
  try {
    const { ocrReviewScreenshot } = await import("@/lib/reviewScreenshotOcr");
    const ocr = await ocrReviewScreenshot(image, { timeoutMs: OCR_TIMEOUT_MS });
    const haystack = ocr.lines.map((line) => line.text.toLowerCase()).join(" ");
    const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
    const hits = tokens.filter((token) => haystack.includes(token));
    const verified = tokens.length > 0 && hits.length >= Math.max(1, Math.ceil(tokens.length / 2));
    return {
      verifiedPurchase: verified,
      proofSha256: ocr.fileSha256,
      proofOcrConfidence: Math.round(ocr.ocrConfidence),
    };
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "community_reviews_read",
    limit: 60,
    windowMs: 60 * 1000,
    eventType: "community_review_read_rate_limited",
  });
  if (!limit.allowed) return limit.response ?? NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const productKey = normalizeProductKey(searchParams.get("product_key"));
  if (!productKey) return NextResponse.json({ error: "A product is required." }, { status: 400 });

  const reviews = await listApprovedReviews(productKey);
  return NextResponse.json({ product_key: productKey, reviews });
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "community_reviews",
    limit: 3,
    windowMs: 60 * 60 * 1000,
    eventType: "community_review_rate_limited",
  });
  if (!limit.allowed)
    return (
      limit.response ??
      NextResponse.json({ error: "You've reached the review limit for now. Please try again later." }, { status: 429 })
    );

  const account = await resolveShopperScanAccount(request);
  if (!account.ok)
    return NextResponse.json(
      { error: "Please sign in to your ReviewIntel account to leave a review." },
      { status: 401 }
    );
  const email = account.email.toLowerCase().trim();

  let fields: Record<string, unknown> = {};
  let proofBuffer: Buffer | null = null;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const key of ["product_key", "product_name", "product_url", "stars", "body", "store", "bought_it"]) {
        const value = form.get(key);
        if (value !== null) fields[key] = value;
      }
      const file = form.get("proof");
      if (file && typeof file !== "string") {
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > 0 && bytes.byteLength <= PROOF_MAX_BYTES) {
          proofBuffer = Buffer.from(bytes);
        }
      }
    } else {
      const parsed: unknown = await request.json().catch(() => ({}));
      fields = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    }
  } catch {
    return NextResponse.json({ error: "We couldn't read your submission. Please try again." }, { status: 400 });
  }

  const boughtIt = fields.bought_it === true || fields.bought_it === "true" || fields.bought_it === "on";
  const productName = String(fields.product_name ?? "").trim();
  let proof: ProofVerification = { verifiedPurchase: false, proofSha256: null, proofOcrConfidence: null };
  if (proofBuffer && boughtIt && productName) {
    proof = await verifyProofImage(proofBuffer, productName);
  }

  const productKey = normalizeProductKey(fields.product_key);
  try {
    const review = await submitCommunityReview({
      accountEmail: email,
      productKey: productKey ?? "",
      productName: productName || undefined,
      productUrl: String(fields.product_url ?? "") || undefined,
      stars: Number(fields.stars),
      body: String(fields.body ?? ""),
      store: String(fields.store ?? "") || undefined,
      boughtIt,
      verifiedPurchase: proof.verifiedPurchase,
      proofSha256: proof.proofSha256,
      proofOcrConfidence: proof.proofOcrConfidence,
    });
    return NextResponse.json({
      ok: true,
      id: review.id,
      status: review.status,
      verified_purchase: review.verified_purchase,
      message:
        "Thank you — your review is in the moderation queue and will appear here once it's approved.",
    });
  } catch (error) {
    if (error instanceof CommunityReviewError && error.code === "VALIDATION") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "We couldn't save your review right now. Please try again later." },
      { status: 503 }
    );
  }
}
