import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  getSocialSettings,
  listSocialPosts,
  runSocialAutoPost,
  updateSocialSettings,
} from "@/lib/socialAutoPost";

const allowedPlatforms = new Set(["facebook", "instagram", "tiktok", "linkedin", "x", "youtube_shorts", "pinterest", "reddit"]);
const allowedTopics = new Set(["shopper_tips", "seller_tips", "fake_review_warning", "buyer_mistakes", "competitor_watch", "trust_signals"]);

function sanitizeList(value: unknown, allowed: Set<string>, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const clean = value
    .map((item) => String(item || "").trim())
    .filter((item) => allowed.has(item));

  return clean.length ? Array.from(new Set(clean)) : fallback;
}

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
      platforms: sanitizeList(body.platforms, allowedPlatforms, ["facebook"]),
      topics: sanitizeList(body.topics, allowedTopics, ["shopper_tips"]),
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
