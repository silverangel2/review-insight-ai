import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type UploadedAdCreative = {
  creativeUrl: string;
  creativeType: "image" | "video";
};

const allowedMediaTypes: Record<string, { extension: string; mediaType: "image" | "video"; maxBytes: number }> = {
  "image/png": { extension: "png", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/jpeg": { extension: "jpg", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/webp": { extension: "webp", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/gif": { extension: "gif", mediaType: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { extension: "mp4", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/webm": { extension: "webm", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/quicktime": { extension: "mov", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
};

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
  process.env.SUPABASE_AD_MEDIA_BUCKET ||
  process.env.SUPABASE_MEDIA_BUCKET ||
  process.env.SUPABASE_SOCIAL_MEDIA_BUCKET ||
  "reviewintel-media";

function isProductionRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function hasSupabaseStorage() {
  return Boolean(supabaseUrl && serviceKey && storageBucket);
}

function storageHeaders(extra?: Record<string, string>) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

function cleanBaseName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 36);
}

async function ensureStorageBucket() {
  if (!hasSupabaseStorage()) return;

  const bucketUrl = `${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`;
  const lookup = await fetch(bucketUrl, {
    headers: storageHeaders(),
    cache: "no-store",
  });

  if (lookup.ok) {
    await fetch(bucketUrl, {
      method: "PUT",
      headers: storageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        public: true,
        file_size_limit: 100 * 1024 * 1024,
        allowed_mime_types: Object.keys(allowedMediaTypes),
      }),
      cache: "no-store",
    }).catch(() => null);
    return;
  }

  const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: storageBucket,
      name: storageBucket,
      public: true,
      file_size_limit: 100 * 1024 * 1024,
      allowed_mime_types: Object.keys(allowedMediaTypes),
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

  const objectPath = `ads/${filename}`;
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
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Supabase Storage ad upload failed.");
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(storageBucket)}/${objectPath}`;
}

export async function saveAdCreative(file: File): Promise<UploadedAdCreative> {
  const mediaConfig = allowedMediaTypes[file.type];

  if (!mediaConfig) {
    throw new Error("Upload PNG, JPG, WEBP, GIF, MP4, WEBM, or MOV creative.");
  }

  if (file.size > mediaConfig.maxBytes) {
    throw new Error(
      mediaConfig.mediaType === "video"
        ? "Video ads must stay under 60 MB."
        : "Image ads must stay under 8 MB.",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base = cleanBaseName(file.name) || "reviewintel-ad";
  const filename = `${base}-${Date.now()}-${randomUUID()}.${mediaConfig.extension}`;

  try {
    const storageUrl = await uploadToSupabaseStorage(filename, bytes, file.type);
    if (storageUrl) {
      return {
        creativeUrl: storageUrl,
        creativeType: mediaConfig.mediaType,
      };
    }
  } catch (error) {
    if (isProductionRuntime()) throw error;
  }

  if (isProductionRuntime()) {
    throw new Error("Production ad uploads need Supabase Storage credentials.");
  }

  const uploadDir = join(process.cwd(), "public", "uploads", "ads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), bytes);

  return {
    creativeUrl: `/uploads/ads/${filename}`,
    creativeType: mediaConfig.mediaType,
  };
}
