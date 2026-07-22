import { NextRequest, NextResponse } from "next/server";
import {
  affiliatePartnerCanShowInGroup,
  normalizeAffiliatePartnerPlacement,
} from "@/lib/adConfig";
import { affiliateSourceDisclosure, collectAffiliateSourceLinks } from "@/lib/affiliateSources";
import { readAdSettings } from "@/lib/adSettingsStore";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = asRecord(await request.json().catch(() => ({})));
    const limit = Math.max(1, Math.min(12, Number(body.limit || 8)));
    const affiliatePlacement = normalizeAffiliatePartnerPlacement(
      body.affiliatePlacement,
      "results",
    );
    const settings = await readAdSettings();

    if (
      !settings.adsEnabled ||
      !affiliatePartnerCanShowInGroup(
        "amazon",
        affiliatePlacement,
        settings.affiliatePartners,
      )
    ) {
      return NextResponse.json({
        ok: true,
        count: 0,
        affiliateDisabled: true,
        disclosure: affiliateSourceDisclosure(),
        links: [],
      });
    }

    const links = collectAffiliateSourceLinks(
      {
        urls: body.urls,
        result: body.result,
        context: body.context,
      },
      limit
    );

    return NextResponse.json({
      ok: true,
      count: links.length,
      disclosure: affiliateSourceDisclosure(),
      links,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Affiliate source links failed.",
        links: [],
      },
      { status: 500 }
    );
  }
}
