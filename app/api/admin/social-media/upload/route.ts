import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

const allowedTypes: Record<string, { ext: string; mediaType: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/png": { ext: "png", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/webp": { ext: "webp", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/gif": { ext: "gif", mediaType: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/webm": { ext: "webm", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storageBucket =
  process.env.SUPABASE_SOCIAL_MEDIA_BUCKET ||
  process.env.SUPABASE_MEDIA_BUCKET ||
  "reviewintel-media";

function isProductionRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function hasSupabaseStorage() {
  return Boolean(supabaseUrl && supabaseServiceKey && storageBucket);
}

function storageHeaders(extra?: Record<string, string>) {
  return {
    apikey: supabaseServiceKey || "",
    Authorization: `Bearer ${supabaseServiceKey || ""}`,
    ...extra,
  };
}

async function makeBucketPublic() {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`, {
    method: "PUT",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      public: true,
      file_size_limit: 60 * 1024 * 1024,
      allowed_mime_types: Object.keys(allowedTypes),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Supabase Storage bucket exists but could not be made public.");
  }
}

async function ensureStorageBucket() {
  if (!hasSupabaseStorage()) return;

  const check = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`, {
    headers: storageHeaders(),
    cache: "no-store",
  });

  if (check.ok) {
    const bucket = await check.json().catch(() => null);
    if (bucket && bucket.public !== true) {
      await makeBucketPublic();
    }
    return;
  }
  if (check.status !== 404) return;

  const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: storageBucket,
      name: storageBucket,
      public: true,
      file_size_limit: 60 * 1024 * 1024,
      allowed_mime_types: Object.keys(allowedTypes),
    }),
    cache: "no-store",
  });

  if (!created.ok && created.status !== 409) {
    const detail = await created.text().catch(() => "");
    throw new Error(detail || "Supabase Storage media bucket could not be created.");
  }
}

async function uploadToSupabaseStorage(filename: string, buffer: Buffer, contentType: string) {
  if (!hasSupabaseStorage()) return "";

  await ensureStorageBucket();

  const objectPath = `social/${filename}`;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath}`,
    {
      method: "POST",
      headers: storageHeaders({
        "Content-Type": contentType,
        "Cache-Control": "31536000",
        "x-upsert": "true",
      }),
      body: new Blob([new Uint8Array(buffer)], { type: contentType }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail ||
        "Supabase Storage upload failed. Check the media bucket and service-role storage permissions."
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(storageBucket)}/${objectPath}`;
}

async function requireAdmin(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  return Boolean(session);
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
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Upload a photo or video file." }, { status: 400 });
    }

    const config = allowedTypes[file.type];
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV media." },
        { status: 400 }
      );
    }

    if (file.size > config.maxBytes) {
      return NextResponse.json(
        { ok: false, error: config.mediaType === "image" ? "Images must be 8 MB or smaller." : "Videos must be 60 MB or smaller. For best results, upload a vertical MP4/H.264 file." },
        { status: 400 }
      );
    }

    const base = cleanBaseName(file.name) || "reviewintel-social";
    const filename = `${base}-${randomUUID()}.${config.ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const storageUrl = await uploadToSupabaseStorage(filename, buffer, file.type);

      if (storageUrl) {
        return NextResponse.json({
          ok: true,
          url: storageUrl,
          thumbnailUrl: config.mediaType === "image" ? storageUrl : "",
          mediaType: config.mediaType,
          storage: "supabase",
          title: file.name.replace(/\.[a-z0-9]+$/i, ""),
        });
      }
    } catch (error) {
      if (isProductionRuntime()) {
        throw error;
      }
    }

    if (isProductionRuntime()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Production media uploads need Supabase Storage. Add NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a public media bucket.",
        },
        { status: 500 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "social");
    await mkdir(uploadDir, { recursive: true });

    const destination = path.join(uploadDir, filename);
    await writeFile(destination, buffer);

    const url = `/uploads/social/${filename}`;

    return NextResponse.json({
      ok: true,
      url,
      thumbnailUrl: config.mediaType === "image" ? url : "",
      mediaType: config.mediaType,
      title: file.name.replace(/\.[a-z0-9]+$/i, ""),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media upload failed." },
      { status: 500 }
    );
  }
}
