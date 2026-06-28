import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  hasAdminSeoDatabase,
  readAdminSeoSettings,
  saveAdminSeoDraft,
  saveAdminSeoSettings,
} from "@/lib/adminSeoSettings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const result = await readAdminSeoSettings();

    return NextResponse.json({
      ok: true,
      settings: result.settings,
      source: result.source,
      deploymentReady: result.source === "supabase",
      hasSupabaseSeoStorage: hasAdminSeoDatabase(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "SEO settings load failed.",
        deploymentReady: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const incomingSettings =
      body.settings && typeof body.settings === "object"
        ? (body.settings as Record<string, Record<string, unknown>>)
        : {};

    const selectedPath = String(body.path || "");
    const draft =
      body.draft && typeof body.draft === "object"
        ? (body.draft as Record<string, unknown>)
        : null;

    const result =
      selectedPath && draft
        ? await saveAdminSeoDraft(selectedPath, draft, incomingSettings)
        : await saveAdminSeoSettings(incomingSettings);

    return NextResponse.json({
      ok: true,
      settings: result.settings,
      source: result.source,
      deploymentReady: result.source === "supabase",
      hasSupabaseSeoStorage: hasAdminSeoDatabase(),
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "SEO settings save failed.",
        deploymentReady: false,
      },
      { status: 500 }
    );
  }
}
