import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { hasAdminSeoDatabase, saveAdminSeoSettings } from "@/lib/adminSeoSettings";
import { automatedSeoPages, buildAutomatedSeoSettings } from "@/lib/seoAutomation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const settings = buildAutomatedSeoSettings();
    const result = await saveAdminSeoSettings(settings);

    return NextResponse.json({
      ok: true,
      settings: result.settings,
      source: result.source,
      deploymentReady: result.source === "supabase",
      hasSupabaseSeoStorage: hasAdminSeoDatabase(),
      pageCount: automatedSeoPages.length,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "SEO automation failed.",
        deploymentReady: false,
      },
      { status: 500 }
    );
  }
}
