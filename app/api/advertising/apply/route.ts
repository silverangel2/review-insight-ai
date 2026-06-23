import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { adPackages, type AdPackageId, type AdPlacement } from "@/lib/adConfig";
import { supabaseFetch } from "@/lib/supabaseServer";

const adPlacements = new Set<AdPlacement>([
  "homepage_hero",
  "homepage_mid",
  "analyze_below_card",
  "analyze_premium_top",
  "analyze_premium_bottom",
  "results_below_verdict",
  "buyer_dashboard",
  "seller_dashboard",
  "footer",
]);

const allowedMediaTypes = new Map([
  ["image/png", { extension: "png", mediaType: "image" }],
  ["image/jpeg", { extension: "jpg", mediaType: "image" }],
  ["image/webp", { extension: "webp", mediaType: "image" }],
  ["image/gif", { extension: "gif", mediaType: "image" }],
  ["video/mp4", { extension: "mp4", mediaType: "video" }],
  ["video/webm", { extension: "webm", mediaType: "video" }],
]);

type AdvertiserApplyBody = {
  brandName?: string;
  contactName?: string;
  contactEmail?: string;
  websiteUrl?: string;
  campaignGoal?: string;
  headline?: string;
  preferredPlacement?: string;
  bannerUrl?: string;
  creativeUrl?: string;
  creativeType?: string;
  destinationUrl?: string;
  packageId?: string;
  paymentReference?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePackage(value: unknown): AdPackageId {
  return value === "featured_monthly" ? "featured_monthly" : "sponsored_monthly";
}

function normalizePlacement(value: unknown): AdPlacement {
  const placement = clean(value) as AdPlacement;
  return adPlacements.has(placement) ? placement : "homepage_mid";
}

function safeUrl(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return "";
  }

  return "";
}

async function saveCreative(file: File) {
  const mediaConfig = allowedMediaTypes.get(file.type);

  if (!mediaConfig) {
    throw new Error("Upload PNG, JPG, WEBP, GIF, MP4, or WEBM creative.");
  }

  const maxBytes = mediaConfig.mediaType === "video" ? 20 * 1024 * 1024 : 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(mediaConfig.mediaType === "video" ? "Video ads must stay under 20 MB." : "Image ads must stay under 4 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = join(process.cwd(), "public", "uploads", "ads");
  const filename = `ad-${Date.now()}-${randomUUID()}.${mediaConfig.extension}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), bytes);

  return {
    creativeUrl: `/uploads/ads/${filename}`,
    creativeType: mediaConfig.mediaType,
  };
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("creativeFile");
    const uploadedCreative = file instanceof File && file.size > 0 ? await saveCreative(file) : null;

    return {
      body: {
        brandName: clean(formData.get("brandName")),
        contactName: clean(formData.get("contactName")),
        contactEmail: clean(formData.get("contactEmail")),
        websiteUrl: clean(formData.get("websiteUrl")),
        destinationUrl: clean(formData.get("destinationUrl")),
        creativeUrl: uploadedCreative?.creativeUrl || clean(formData.get("creativeUrl")) || clean(formData.get("bannerUrl")),
        creativeType: uploadedCreative?.creativeType || clean(formData.get("creativeType")),
        preferredPlacement: clean(formData.get("preferredPlacement")),
        campaignGoal: clean(formData.get("campaignGoal")),
        headline: clean(formData.get("headline")),
        packageId: clean(formData.get("packageId")),
        paymentReference: clean(formData.get("paymentReference")),
      } satisfies AdvertiserApplyBody,
      uploadedCreative
    };
  }

  return {
    body: (await request.json().catch(() => ({}))) as AdvertiserApplyBody,
    uploadedCreative: null
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { body } = await readPayload(request);

    const brandName = clean(body.brandName);
    const contactName = clean(body.contactName);
    const contactEmail = clean(body.contactEmail).toLowerCase();
    const websiteUrl = safeUrl(clean(body.websiteUrl));
    const destinationUrl = safeUrl(clean(body.destinationUrl)) || websiteUrl;
    const creativeUrl = clean(body.creativeUrl);
    const creativeType = clean(body.creativeType) === "video" ? "video" : "image";
    const preferredPlacement = normalizePlacement(body.preferredPlacement);
    const campaignGoal = clean(body.campaignGoal);
    const headline = clean(body.headline) || `${brandName} on ReviewIntel`;
    const packageId = normalizePackage(body.packageId);
    const adPackage = adPackages[packageId];
    const paymentReference = clean(body.paymentReference);
    const paymentStatus = paymentReference ? "pending_review" : "unpaid";

    if (!brandName || !contactEmail || !websiteUrl || !campaignGoal) {
      return NextResponse.json(
        { error: "Brand name, contact email, website URL, and campaign goal are required." },
        { status: 400 },
      );
    }

    if (!contactEmail.includes("@")) {
      return NextResponse.json({ error: "Enter a valid advertiser email." }, { status: 400 });
    }

    if (creativeUrl && !creativeUrl.startsWith("/uploads/ads/") && !safeUrl(creativeUrl)) {
      return NextResponse.json({ error: "Creative URL must be a valid URL or an uploaded ReviewIntel file." }, { status: 400 });
    }

    const payload = {
      brand_name: brandName,
      contact_name: contactName,
      contact_email: contactEmail,
      website_url: websiteUrl,
      campaign_goal: campaignGoal,
      headline,
      preferred_placement: preferredPlacement,
      banner_url: creativeType === "image" ? creativeUrl || null : null,
      creative_url: creativeUrl || null,
      media_type: creativeType,
      destination_url: destinationUrl,
      package_id: packageId,
      package_name: adPackage.name,
      package_price: adPackage.price,
      daily_impression_cap: adPackage.dailyImpressionCap,
      duration_days: adPackage.durationDays,
      payment_reference: paymentReference || null,
      payment_status: paymentStatus,
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
      message:
        paymentReference
          ? "Application submitted. ReviewIntel will verify payment and review the creative before activation."
          : "Application submitted. Pay for the selected package, then send the payment reference for activation.",
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
