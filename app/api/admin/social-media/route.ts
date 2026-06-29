import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseFetch, supabaseInsert, supabaseUpdate } from "@/lib/supabaseServer";

const allowedMediaTypes = new Set(["image", "video"]);

async function requireAdmin(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  return Boolean(session);
}

function cleanUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const media = await supabaseFetch(
      "admin_social_media?select=*&order=created_at.desc&limit=200"
    );

    return NextResponse.json({ ok: true, media: Array.isArray(media) ? media : [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media library could not load." },
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
    const action = String(body.action || "create");

    if (action === "toggle-active") {
      const id = String(body.id || "").trim();

      if (!id) {
        return NextResponse.json({ ok: false, error: "Media ID is required." }, { status: 400 });
      }

      const updated = await supabaseUpdate("admin_social_media", id, {
        is_active: Boolean(body.is_active),
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, media: updated });
    }

    const fileUrl = cleanUrl(body.file_url);

    if (!fileUrl) {
      return NextResponse.json({ ok: false, error: "Valid media URL is required." }, { status: 400 });
    }

    const mediaType = allowedMediaTypes.has(String(body.media_type)) ? String(body.media_type) : "image";
    const now = new Date().toISOString();

    const media = await supabaseInsert("admin_social_media", {
      title: String(body.title || "").trim() || null,
      media_type: mediaType,
      file_url: fileUrl,
      thumbnail_url: cleanUrl(body.thumbnail_url) || null,
      alt_text: String(body.alt_text || "").trim() || null,
      topic: String(body.topic || "").trim() || null,
      tags: Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag || "").trim()).filter(Boolean)
        : String(body.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
      is_active: true,
      used_count: 0,
      metadata: {},
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media item could not be saved." },
      { status: 500 }
    );
  }
}
