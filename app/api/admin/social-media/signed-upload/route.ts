import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const storageBucket =
  process.env.SUPABASE_MEDIA_BUCKET ||
  process.env.SUPABASE_STORAGE_BUCKET ||
  "reviewintel-media";

const allowedTypes: Record<string, { ext: string; mediaType: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/png": { ext: "png", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/webp": { ext: "webp", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/gif": { ext: "gif", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/webm": { ext: "webm", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
};

function storageHeaders(extra?: HeadersInit) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function ensureStorageBucket() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase Storage credentials.");
  }

  const lookup = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`, {
    headers: storageHeaders(),
    cache: "no-store",
  });

  if (lookup.ok) {
    await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`, {
      method: "PUT",
      headers: storageHeaders(),
      body: JSON.stringify({
        public: true,
        file_size_limit: 100 * 1024 * 1024,
        allowed_mime_types: Object.keys(allowedTypes),
      }),
      cache: "no-store",
    }).catch(() => null);

    return;
  }

  const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(),
    body: JSON.stringify({
      id: storageBucket,
      name: storageBucket,
      public: true,
      file_size_limit: 100 * 1024 * 1024,
      allowed_mime_types: Object.keys(allowedTypes),
    }),
    cache: "no-store",
  });

  if (!created.ok && created.status !== 409) {
    const detail = await created.text().catch(() => "");
    throw new Error(detail || "Supabase Storage media bucket could not be created.");
  }
}

function cleanBaseName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 36);
}

export async function POST(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const filenameInput = typeof body.filename === "string" ? body.filename : "reviewintel-video.mp4";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : 0;

    const config = allowedTypes[contentType];
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV media." },
        { status: 400 }
      );
    }

    if (size > config.maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error:
            config.mediaType === "image"
              ? "Images must be 8 MB or smaller."
              : "Videos must be 60 MB or smaller.",
        },
        { status: 400 }
      );
    }

    await ensureStorageBucket();

    const base = cleanBaseName(filenameInput) || "reviewintel-social";
    const filename = `${base}-${randomUUID()}.${config.ext}`;
    const objectPath = `social/${filename}`;

    const signedResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(storageBucket)}/${objectPath}`,
      {
        method: "POST",
        headers: storageHeaders(),
        body: JSON.stringify({ upsert: true }),
        cache: "no-store",
      }
    );

    const signedData = await signedResponse.json().catch(() => ({}));

    if (!signedResponse.ok || !signedData.signedURL) {
      return NextResponse.json(
        {
          ok: false,
          error: signedData?.message || signedData?.error || "Could not create signed upload URL.",
        },
        { status: 500 }
      );
    }

    const signedURL = String(signedData.signedURL).startsWith("http")
      ? String(signedData.signedURL)
      : `${supabaseUrl}/storage/v1${signedData.signedURL}`;

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(storageBucket)}/${objectPath}`;

    return NextResponse.json({
      ok: true,
      uploadUrl: signedURL,
      url: publicUrl,
      thumbnailUrl: config.mediaType === "image" ? publicUrl : "",
      title: base.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      mediaType: config.mediaType,
      contentType,
      objectPath,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not prepare signed upload.",
      },
      { status: 500 }
    );
  }
}
