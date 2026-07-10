import { NextResponse } from "next/server";
import { resolveAmazonAffiliateDestination } from "@/lib/socialRedirects";

export function GET() {
  const destination = resolveAmazonAffiliateDestination();

  if (!destination) {
    return NextResponse.json(
      { ok: false, error: "ReviewIntel affiliate destination is not configured." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(destination, 307);
}
