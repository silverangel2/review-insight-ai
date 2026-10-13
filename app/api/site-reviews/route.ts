import { NextResponse } from "next/server";
import { rateLimitRequest } from "@/lib/security";
import { createSiteReview, listSiteReviews } from "@/lib/siteReviews";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    reviews: listSiteReviews({ publicOnly: true, featuredOnly: true })
  });
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, { key: "site_reviews", limit: 3, windowMs: 60 * 60 * 1000, eventType: "site_review_rate_limited" });
  if (!limit.allowed) return limit.response ?? NextResponse.json({ error: "Too many submissions." }, { status: 429 });
  const body = await request.json().catch(() => ({}));

  try {
    const review = createSiteReview(body);
    return NextResponse.json({
      ok: true,
      review: {
        id: review.id,
        status: review.status
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review submission failed." }, { status: 400 });
  }
}
