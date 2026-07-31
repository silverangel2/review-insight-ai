import { NextResponse } from "next/server";
import { affiliatePartnerIsEnabled } from "@/lib/adConfig";
import { readAdSettings } from "@/lib/adSettingsStore";
import {
  resolveAmazonAffiliateDestination,
  resolveReviewIntelStartDestination,
} from "@/lib/socialRedirects";

export async function GET() {
  const settings = await readAdSettings();

  if (!settings.adsEnabled || !affiliatePartnerIsEnabled("amazon", settings.affiliatePartners)) {
    return NextResponse.redirect(resolveReviewIntelStartDestination(), 307);
  }

  const destination = resolveAmazonAffiliateDestination();

  if (!destination) {
    return NextResponse.redirect(resolveReviewIntelStartDestination(), 307);
  }

  return NextResponse.redirect(destination, 307);
}
