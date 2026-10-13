import { NextResponse } from "next/server";
import { createSiteReview, listSiteReviews } from "@/lib/siteReviews";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    reviews: listSiteReviews({ publicOnly: true, featuredOnly: true })
  });
}

export async function POST(request: Request) {
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
