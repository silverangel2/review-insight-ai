import { NextResponse } from "next/server";
import { affiliatePartnerIsEnabled } from "@/lib/adConfig";
import { readAdSettings } from "@/lib/adSettingsStore";
import { resolveAmazonAffiliateDestination } from "@/lib/socialRedirects";

export async function GET() {
  const settings = await readAdSettings();

  if (!settings.adsEnabled || !affiliatePartnerIsEnabled("amazon", settings.affiliatePartners)) {
    return NextResponse.json(
      { ok: false, error: "ReviewIntel Amazon affiliate destination is disabled." },
      { status: 404 }
    );
  }

  const destination = resolveAmazonAffiliateDestination();

  if (!destination) {
    return NextResponse.json(
      { ok: false, error: "ReviewIntel affiliate destination is not configured." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(destination, 307);
}
