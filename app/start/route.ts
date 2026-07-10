import { NextResponse } from "next/server";
import { resolveReviewIntelStartDestination } from "@/lib/socialRedirects";

export function GET() {
  return NextResponse.redirect(resolveReviewIntelStartDestination(), 307);
}
