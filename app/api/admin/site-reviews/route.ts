import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { deleteSiteReview, listSiteReviews, updateSiteReview } from "@/lib/siteReviews";

export const runtime = "nodejs";

function requireAdmin(request: Request) {
  return Boolean(adminSessionFromRequest(request));
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json({ reviews: listSiteReviews() });
}

export async function PATCH(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));

  try {
    const review = updateSiteReview(String(body.id ?? ""), body.patch ?? body);
    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update review." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { searchParams } = new URL(request.url);

  try {
    deleteSiteReview(searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete review." }, { status: 400 });
  }
}
