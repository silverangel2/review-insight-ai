import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  publicSocialMediaStorageBucket,
  uploadPublicSupabaseObject,
} from "@/lib/supabasePublicStorage";

export const runtime = "nodejs";

const allowedTypes: Record<string, { ext: string; mediaType: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/png": { ext: "png", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/webp": { ext: "webp", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/gif": { ext: "gif", mediaType: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", mediaType: "video", maxBytes: 50 * 1024 * 1024 },
  "video/webm": { ext: "webm", mediaType: "video", maxBytes: 50 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", mediaType: "video", maxBytes: 50 * 1024 * 1024 },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicSocialBucket = publicSocialMediaStorageBucket();
const storageBucket = publicSocialBucket.storageBucket;

function isProductionRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function hasSupabaseStorage() {
  return Boolean(supabaseUrl && supabaseServiceKey && storageBucket);
}

async function uploadToSupabaseStorage(filename: string, buffer: Buffer, contentType: string) {
  if (!hasSupabaseStorage()) return "";

  const objectPath = `social/${filename}`;

  return uploadPublicSupabaseObject({
    supabaseUrl: supabaseUrl || "",
    serviceKey: supabaseServiceKey || "",
    storageBucket,
    objectPath,
    body: new Blob([new Uint8Array(buffer)], { type: contentType }),
    contentType,
    allowedMimeTypes: Object.keys(allowedTypes),
    fileSizeLimit: 50 * 1024 * 1024,
  });
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
        { ok: false, error: config.mediaType === "image" ? "Images must be 8 MB or smaller." : "Videos must be 50 MB or smaller. For best results, upload a vertical MP4/H.264 file." },
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
          storageBucket,
          storageBucketSource: publicSocialBucket.source,
          objectPath: `social/${filename}`,
          metadata: {
            uploaded_via: "admin_social_media_upload",
            storage: "supabase",
            storage_bucket: storageBucket,
            storage_bucket_source: publicSocialBucket.source,
            object_path: `social/${filename}`,
            original_filename: file.name,
          },
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
      metadata: {
        uploaded_via: "admin_social_media_upload",
        storage: "local",
        object_path: `uploads/social/${filename}`,
        original_filename: file.name,
      },
      title: file.name.replace(/\.[a-z0-9]+$/i, ""),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media upload failed." },
      { status: 500 }
    );
  }
}
