import { NextResponse } from "next/server";
import { adPackages, type AdPackageId } from "@/lib/adConfig";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseFetch } from "@/lib/supabaseServer";

type AdminAdvertisingBody = {
  action?: "approve" | "reject" | "pause" | "activate" | "mark_paid" | "mark_unpaid";
  applicationId?: string;
  adId?: string;
};

type ApplicationRow = Record<string, unknown>;
type SponsorAdRow = Record<string, unknown>;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePackage(value: unknown): AdPackageId {
  return value === "featured_monthly" ? "featured_monthly" : "sponsored_monthly";
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readRows(path: string) {
  const response = await supabaseFetch(path, { method: "GET" });
  if (!response.ok) return [];
  const rows = await readJsonSafe(response);
  return Array.isArray(rows) ? rows : [];
}

async function readApplication(applicationId: string) {
  const rows = await readRows(`/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId)}&select=*`);
  return rows[0] as ApplicationRow | undefined;
}

async function readAdByApplication(applicationId: string) {
  const rows = await readRows(`/rest/v1/sponsor_ads?application_id=eq.${encodeURIComponent(applicationId)}&select=*&limit=1`);
  return rows[0] as SponsorAdRow | undefined;
}

function campaignWindow(application: ApplicationRow) {
  const now = new Date();
  const startsAt = clean(application.starts_at) || now.toISOString();
  const packageId = normalizePackage(application.package_id);
  const durationDays = Number(application.duration_days || adPackages[packageId].durationDays);
  const ends = new Date(startsAt);
  ends.setUTCDate(ends.getUTCDate() + Math.max(1, Number.isFinite(durationDays) ? durationDays : 30));

  return {
    startsAt,
    endsAt: clean(application.ends_at) || ends.toISOString(),
  };
}

async function createOrUpdateAdFromApplication(application: ApplicationRow, forcePaid = false) {
  const id = clean(application.id);
  const packageId = normalizePackage(application.package_id);
  const adPackage = adPackages[packageId];
  const paymentStatus = forcePaid ? "paid" : clean(application.payment_status) || "unpaid";
  const canGoLive = paymentStatus === "paid";
  const existingAd = id ? await readAdByApplication(id) : undefined;
  const { startsAt, endsAt } = campaignWindow(application);
  const creativeUrl = clean(application.creative_url) || clean(application.banner_url);
  const mediaType = clean(application.media_type) === "video" ? "video" : "image";

  const payload = {
    sponsor_name: clean(application.brand_name) || "Sponsor",
    headline: clean(application.headline) || `${clean(application.brand_name) || "Sponsor"} on ReviewIntel`,
    description: clean(application.campaign_goal),
    image_url: mediaType === "image" ? creativeUrl || null : null,
    creative_url: creativeUrl || null,
    media_type: mediaType,
    destination_url: clean(application.destination_url) || clean(application.website_url),
    placement: clean(application.preferred_placement) || "homepage_mid",
    package_id: packageId,
    package_name: clean(application.package_name) || adPackage.name,
    payment_status: paymentStatus,
    daily_impression_cap: Number(application.daily_impression_cap || adPackage.dailyImpressionCap),
    duration_days: Number(application.duration_days || adPackage.durationDays),
    starts_at: startsAt,
    ends_at: endsAt,
    active: canGoLive,
    status: canGoLive ? "approved" : "paused",
    application_id: id,
    updated_at: new Date().toISOString(),
  };

  if (existingAd?.id) {
    const response = await supabaseFetch(
      `/rest/v1/sponsor_ads?id=eq.${encodeURIComponent(clean(existingAd.id))}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.ok;
  }

  const response = await supabaseFetch("/rest/v1/sponsor_ads", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      created_at: new Date().toISOString(),
    }),
  });

  return response.ok;
}

async function readEventStats() {
  const rows = await readRows("/rest/v1/sponsor_ad_events?select=sponsor_id,event_type");
  return rows.reduce<Record<string, { impressions: number; clicks: number }>>((totals, row) => {
    const sponsorId = clean(row.sponsor_id);
    if (!sponsorId) return totals;
    totals[sponsorId] ??= { impressions: 0, clicks: 0 };
    if (row.event_type === "click") totals[sponsorId].clicks += 1;
    if (row.event_type === "impression") totals[sponsorId].impressions += 1;
    return totals;
  }, {});
}

export async function GET(request: Request): Promise<Response> {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const [applications, ads, stats] = await Promise.all([
      readRows("/rest/v1/advertiser_applications?select=*&order=created_at.desc"),
      readRows("/rest/v1/sponsor_ads?select=*&order=created_at.desc"),
      readEventStats(),
    ]);

    return NextResponse.json({
      applications,
      ads: ads.map((ad) => ({
        ...ad,
        impressions: stats[clean(ad.id)]?.impressions ?? 0,
        clicks: stats[clean(ad.id)]?.clicks ?? 0,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load advertising admin data.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as AdminAdvertisingBody;
    const action = body.action;
    const applicationId = clean(body.applicationId);
    const adId = clean(body.adId);

    if (!action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    if ((action === "approve" || action === "reject" || action === "mark_paid" || action === "mark_unpaid") && !applicationId && !adId) {
      return NextResponse.json({ error: "Application ID or ad ID is required." }, { status: 400 });
    }

    if ((action === "pause" || action === "activate") && !adId) {
      return NextResponse.json({ error: "Ad ID is required." }, { status: 400 });
    }

    if (action === "reject") {
      const response = await supabaseFetch(
        `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "rejected",
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return NextResponse.json({ ok: response.ok });
    }

    if (action === "approve") {
      const application = await readApplication(applicationId);

      if (!application) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }

      const now = new Date().toISOString();
      const applicationResponse = await supabaseFetch(
        `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "approved",
            reviewed_at: now,
            updated_at: now,
          }),
        },
      );

      if (!applicationResponse.ok) {
        return NextResponse.json({ error: "Could not approve application." }, { status: 500 });
      }

      const adCreated = await createOrUpdateAdFromApplication({
        ...application,
        status: "approved",
        updated_at: now,
      });

      return NextResponse.json({
        ok: adCreated,
        message: clean(application.payment_status) === "paid"
          ? "Approved and live."
          : "Approved. Mark payment verified before it goes live.",
      });
    }

    if (action === "mark_paid" || action === "mark_unpaid") {
      const paymentStatus = action === "mark_paid" ? "paid" : "unpaid";

      if (applicationId) {
        const application = await readApplication(applicationId);
        if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

        await supabaseFetch(
          `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              payment_status: paymentStatus,
              updated_at: new Date().toISOString(),
            }),
          },
        );

        const approved = clean(application.status) === "approved";
        if (approved) {
          await createOrUpdateAdFromApplication({ ...application, payment_status: paymentStatus }, paymentStatus === "paid");
        }

        return NextResponse.json({ ok: true });
      }

      const response = await supabaseFetch(
        `/rest/v1/sponsor_ads?id=eq.${encodeURIComponent(adId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            payment_status: paymentStatus,
            active: paymentStatus === "paid",
            status: paymentStatus === "paid" ? "approved" : "paused",
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return NextResponse.json({ ok: response.ok });
    }

    if (action === "pause" || action === "activate") {
      const rows = await readRows(`/rest/v1/sponsor_ads?id=eq.${encodeURIComponent(adId)}&select=payment_status`);
      const ad = rows[0] as SponsorAdRow | undefined;

      if (action === "activate" && clean(ad?.payment_status) !== "paid") {
        return NextResponse.json({ error: "Verify payment before activating this ad." }, { status: 402 });
      }

      const response = await supabaseFetch(
        `/rest/v1/sponsor_ads?id=eq.${encodeURIComponent(adId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            active: action === "activate",
            status: action === "activate" ? "approved" : "paused",
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return NextResponse.json({ ok: response.ok });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Advertising admin action failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
