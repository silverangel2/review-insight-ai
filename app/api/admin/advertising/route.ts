import { NextResponse } from "next/server";
import { supabaseFetch } from "@/lib/supabaseServer";

type AdminAdvertisingBody = {
  action?: "approve" | "reject" | "pause" | "activate";
  applicationId?: string;
  adId?: string;
};

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  try {
    const applicationsResponse = await supabaseFetch(
      "/rest/v1/advertiser_applications?select=*&order=created_at.desc",
      { method: "GET" },
    );

    const adsResponse = await supabaseFetch(
      "/rest/v1/sponsor_ads?select=*&order=created_at.desc",
      { method: "GET" },
    );

    const applications = applicationsResponse.ok ? await readJsonSafe(applicationsResponse) : [];
    const ads = adsResponse.ok ? await readJsonSafe(adsResponse) : [];

    return NextResponse.json({
      applications: Array.isArray(applications) ? applications : [],
      ads: Array.isArray(ads) ? ads : [],
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
  try {
    const body = (await request.json()) as AdminAdvertisingBody;
    const action = body.action;
    const applicationId = body.applicationId;
    const adId = body.adId;

    if (!action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    if ((action === "approve" || action === "reject") && !applicationId) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    if ((action === "pause" || action === "activate") && !adId) {
      return NextResponse.json({ error: "Ad ID is required." }, { status: 400 });
    }

    if (action === "reject") {
      const response = await supabaseFetch(
        `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId ?? "")}`,
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
      const applicationResponse = await supabaseFetch(
        `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId ?? "")}&select=*`,
        { method: "GET" },
      );

      const applications = await readJsonSafe(applicationResponse);
      const application = Array.isArray(applications) ? applications[0] : null;

      if (!application) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }

      const now = new Date().toISOString();

      const adPayload = {
        sponsor_name: application.brand_name,
        headline: `${application.brand_name} on ReviewIntel`,
        description: application.campaign_goal,
        image_url: application.banner_url,
        destination_url: application.destination_url || application.website_url,
        placement: application.preferred_placement || "homepage_mid",
        active: true,
        status: "approved",
        application_id: application.id,
        created_at: now,
        updated_at: now,
      };

      const createAdResponse = await supabaseFetch("/rest/v1/sponsor_ads", {
        method: "POST",
        body: JSON.stringify(adPayload),
      });

      if (!createAdResponse.ok) {
        const text = await createAdResponse.text();
        return NextResponse.json(
          { error: "Could not create sponsor ad.", details: text },
          { status: 500 },
        );
      }

      await supabaseFetch(
        `/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(applicationId ?? "")}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "approved",
            updated_at: now,
          }),
        },
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "pause" || action === "activate") {
      const response = await supabaseFetch(
        `/rest/v1/sponsor_ads?id=eq.${encodeURIComponent(adId ?? "")}`,
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
