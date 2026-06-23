import { NextResponse } from "next/server";
import {
  type AdPlacement,
  type AdPaymentStatus,
  type AdvertiserApplicationStatus,
  type AdMediaType,
  type SponsorAd,
} from "@/lib/adConfig";
import { readAdSettings, writeAdSettings } from "@/lib/adSettingsStore";
import { supabaseSelect } from "@/lib/supabaseServer";

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

type SponsorAdRow = {
  id?: unknown;
  sponsor_name?: unknown;
  headline?: unknown;
  description?: unknown;
  image_url?: unknown;
  creative_url?: unknown;
  media_type?: unknown;
  destination_url?: unknown;
  placement?: unknown;
  active?: unknown;
  status?: unknown;
  payment_status?: unknown;
  daily_impression_cap?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStatus(value: unknown): AdvertiserApplicationStatus {
  const status = cleanString(value);
  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "paused"
  ) {
    return status;
  }

  return "pending";
}

function cleanPaymentStatus(value: unknown): AdPaymentStatus {
  const status = cleanString(value);
  if (status === "unpaid" || status === "pending_review" || status === "paid" || status === "refunded") {
    return status;
  }

  return "unpaid";
}

function cleanMediaType(value: unknown): AdMediaType {
  return cleanString(value) === "video" ? "video" : "image";
}

function cleanNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function isLiveWindow(ad: Pick<SponsorAd, "startsAt" | "endsAt">): boolean {
  const now = Date.now();
  const startsAt = ad.startsAt ? Date.parse(ad.startsAt) : null;
  const endsAt = ad.endsAt ? Date.parse(ad.endsAt) : null;

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

function mapSponsorAd(row: SponsorAdRow, impressionsToday = 0): SponsorAd | null {
  const placement = cleanString(row.placement) as AdPlacement;
  const destinationUrl = cleanString(row.destination_url);
  const status = cleanStatus(row.status);
  const paymentStatus = cleanPaymentStatus(row.payment_status);
  const dailyImpressionCap = cleanNumber(row.daily_impression_cap);

  if (!adPlacements.has(placement)) return null;
  if (!destinationUrl) return null;
  if (row.active !== true || status !== "approved") return null;
  if (paymentStatus !== "paid") return null;
  if (dailyImpressionCap !== null && impressionsToday >= dailyImpressionCap) return null;

  const sponsorName = cleanString(row.sponsor_name) || "Sponsor";
  const headline = cleanString(row.headline) || sponsorName;
  const description = cleanString(row.description);
  const mediaUrl = cleanString(row.creative_url) || cleanString(row.image_url);
  const mediaType = cleanMediaType(row.media_type);
  const startsAt = cleanString(row.starts_at);
  const endsAt = cleanString(row.ends_at);

  const ad: SponsorAd = {
    id: cleanString(row.id) || `${placement}-${destinationUrl}`,
    sponsorName,
    headline,
    description,
    imageUrl: mediaType === "image" ? mediaUrl || undefined : undefined,
    mediaUrl: mediaUrl || undefined,
    mediaType,
    destinationUrl,
    placement,
    active: true,
    status,
    paymentStatus,
    dailyImpressionCap,
    impressionsToday,
    startsAt: startsAt || undefined,
    endsAt: endsAt || undefined,
  };

  return isLiveWindow(ad) ? ad : null;
}

async function readApprovedSponsorAds(): Promise<SponsorAd[]> {
  const rows = await supabaseSelect<SponsorAdRow>(
    "sponsor_ads",
    "select=*&active=eq.true&status=eq.approved&order=created_at.desc",
  );

  const ids = rows.map((row) => cleanString(row.id)).filter(Boolean);
  const impressionsToday = await readTodayImpressionCounts(ids);

  return rows
    .map((row) => mapSponsorAd(row, impressionsToday[cleanString(row.id)] ?? 0))
    .filter((ad): ad is SponsorAd => Boolean(ad));
}

async function readTodayImpressionCounts(ids: string[]) {
  if (!ids.length) return {} as Record<string, number>;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = await supabaseSelect<{ sponsor_id?: string; event_type?: string }>(
    "sponsor_ad_events",
    [
      "select=sponsor_id,event_type",
      "event_type=eq.impression",
      `created_at=gte.${encodeURIComponent(today.toISOString())}`,
      `sponsor_id=in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`
    ].join("&")
  );

  return rows.reduce<Record<string, number>>((totals, row) => {
    const sponsorId = cleanString(row.sponsor_id);
    if (!sponsorId) return totals;
    totals[sponsorId] = (totals[sponsorId] ?? 0) + 1;
    return totals;
  }, {});
}

export async function GET(): Promise<Response> {
  const settings = await readAdSettings();
  const ads =
    settings.adsEnabled && settings.directSponsorAdsEnabled
      ? await readApprovedSponsorAds()
      : [];

  return NextResponse.json({ settings, ads });
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await writeAdSettings(body);

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not update ad settings.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
