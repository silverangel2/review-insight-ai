import { NextResponse } from "next/server";
import { supabaseFetch } from "@/lib/supabaseServer";

type AdvertiserApplyBody = {
  brandName?: string;
  contactName?: string;
  contactEmail?: string;
  websiteUrl?: string;
  campaignGoal?: string;
  preferredPlacement?: string;
  bannerUrl?: string;
  destinationUrl?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as AdvertiserApplyBody;

    const brandName = clean(body.brandName);
    const contactName = clean(body.contactName);
    const contactEmail = clean(body.contactEmail);
    const websiteUrl = clean(body.websiteUrl);
    const campaignGoal = clean(body.campaignGoal);
    const preferredPlacement = clean(body.preferredPlacement) || "homepage_mid";
    const bannerUrl = clean(body.bannerUrl);
    const destinationUrl = clean(body.destinationUrl) || websiteUrl;

    if (!brandName || !contactEmail || !websiteUrl || !campaignGoal) {
      return NextResponse.json(
        { error: "Brand name, contact email, website URL, and campaign goal are required." },
        { status: 400 },
      );
    }

    const payload = {
      brand_name: brandName,
      contact_name: contactName,
      contact_email: contactEmail,
      website_url: websiteUrl,
      campaign_goal: campaignGoal,
      preferred_placement: preferredPlacement,
      banner_url: bannerUrl || null,
      destination_url: destinationUrl || websiteUrl,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const response = await supabaseFetch("/rest/v1/advertiser_applications", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Could not submit advertiser application.", details: text },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Application submitted. ReviewIntel will review it before activation.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Advertiser application failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
