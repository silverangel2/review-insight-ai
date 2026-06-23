import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  getSocialSettings,
  listSocialPosts,
  runSocialAutoPost,
  updateSocialSettings,
} from "@/lib/socialAutoPost";

async function requireAdmin(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  return Boolean(session);
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const settings = await getSocialSettings();
    const posts = await listSocialPosts();

    return NextResponse.json({ ok: true, settings, posts });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social auto-post could not load." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === "run-now") {
      const result = await runSocialAutoPost();
      const settings = await getSocialSettings();
      const posts = await listSocialPosts();

      return NextResponse.json({ ok: true, result, settings, posts });
    }

    const settings = await updateSocialSettings({
      full_auto_enabled: Boolean(body.full_auto_enabled),
      semi_auto_enabled: Boolean(body.semi_auto_enabled ?? true),
      emergency_pause: Boolean(body.emergency_pause),
      daily_time: String(body.daily_time || "09:00"),
      platforms: Array.isArray(body.platforms) ? body.platforms : ["facebook"],
      topics: Array.isArray(body.topics) ? body.topics : ["shopper_tips"],
    });

    const posts = await listSocialPosts();

    return NextResponse.json({ ok: true, settings, posts });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social auto-post could not save." },
      { status: 500 }
    );
  }
}
