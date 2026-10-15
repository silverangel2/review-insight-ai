import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  feedTierAReviewsToLibrary,
  listAllCommunityReviews,
  moderateCommunityReview,
  type CommunityReviewStatus,
} from "@/lib/communityReviews";

export const runtime = "nodejs";

function requireAdmin(request: Request) {
  return Boolean(adminSessionFromRequest(request));
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json({ reviews: await listAllCommunityReviews() });
}

export async function PATCH(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };

  const status = String(body.status ?? "");
  const review = await moderateCommunityReview(
    String(body.id ?? ""),
    status as CommunityReviewStatus
  );
  if (!review) return NextResponse.json({ error: "Could not update review." }, { status: 400 });

  // Tier A: approved + purchase-verified reviews feed the product library.
  // Fail-soft: a library problem never fails the moderation action.
  let libraryFed = 0;
  if (review.status === "approved" && review.verified_purchase) {
    const fed = await feedTierAReviewsToLibrary(review.product_key);
    libraryFed = fed.fedCount;
  }

  return NextResponse.json({ review, libraryFed });
}

export async function DELETE(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const review = await moderateCommunityReview(
    new URL(request.url).searchParams.get("id") ?? "",
    "hidden"
  );
  if (!review) return NextResponse.json({ error: "Could not remove review." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
