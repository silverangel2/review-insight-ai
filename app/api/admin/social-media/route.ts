import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseFetch } from "@/lib/supabaseServer";
import { assertFacebookAccessibleUrl } from "@/lib/supabasePublicStorage";

const allowedMediaTypes = new Set(["image", "video"]);
const allowedMetadataKeys = new Set([
  "uploaded_via",
  "storage",
  "storage_bucket",
  "storage_bucket_source",
  "object_path",
  "original_filename",
]);

type SocialMediaRow = Record<string, unknown> & {
  id?: string;
  file_url?: string;
  media_type?: string;
  metadata?: Record<string, unknown> | null;
};

async function requireAdmin(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  return Boolean(session);
}

function cleanUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";

  if (url.startsWith("/uploads/social/") || url.startsWith("/uploads/ads/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const clean: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedMetadataKeys.has(key)) continue;
    const text = String(raw || "").trim();
    if (text) clean[key] = text.slice(0, 500);
  }

  return clean;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function selectedUsage(item: Record<string, unknown>) {
  const metadata = metadataRecord(item.metadata);
  const metadataUsage = metadataRecord(metadata.platform_usage);
  const rootUsage = metadataRecord(item.platform_usage);
  const legacyUsage = metadataRecord(item.platforms);
  return Object.keys(metadataUsage).length ? metadataUsage : Object.keys(rootUsage).length ? rootUsage : legacyUsage;
}

function isSelectedForPlatform(item: Record<string, unknown>) {
  const usage = selectedUsage(item);
  return Boolean(usage.facebook || usage.tiktok || usage.both);
}

function usableMediaRows(rows: unknown) {
  if (!Array.isArray(rows)) return [];

  return (rows as SocialMediaRow[]).filter((item) => {
    const mediaType = String(item.media_type || "");
    return Boolean(item.file_url) && (mediaType === "image" || mediaType === "video");
  });
}

function supabaseRestError(data: unknown, text: string, status: number) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return String(record.message || record.error || text || `Supabase request failed with HTTP ${status}.`);
}

async function supabaseJson<T>(path: string, init: RequestInit = {}) {
  const response = await supabaseFetch(path, init);
  const maybeResponse = response as Response;

  if (typeof maybeResponse.ok !== "boolean" || typeof maybeResponse.text !== "function") {
    return response as T;
  }

  const text = await maybeResponse.text().catch(() => "");
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!maybeResponse.ok) {
    throw new Error(supabaseRestError(data, text, maybeResponse.status));
  }

  return data as T;
}

async function fetchMediaRows(limit = 1000) {
  const data = await supabaseJson<unknown>(
    `/rest/v1/admin_social_media?select=*&order=created_at.desc&limit=${limit}`
  );
  return usableMediaRows(data);
}

async function fetchMediaById(id: string) {
  const rows = await supabaseJson<SocialMediaRow[]>(
    `/rest/v1/admin_social_media?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchMediaRow(id: string, payload: Record<string, unknown>) {
  const rows = await supabaseJson<SocialMediaRow[]>(
    `/rest/v1/admin_social_media?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }
  );

  const updated = Array.isArray(rows) ? rows[0] || null : null;
  if (!updated?.id) throw new Error("Media item was not found or could not be updated.");
  return updated;
}

async function deleteMediaRow(id: string) {
  await supabaseJson<null>(`/rest/v1/admin_social_media?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function insertMediaRow(row: Record<string, unknown>) {
  const rows = await supabaseJson<SocialMediaRow[]>("/rest/v1/admin_social_media", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  const inserted = Array.isArray(rows) ? rows[0] || null : null;
  if (!inserted?.id) throw new Error("Media item could not be saved.");
  return inserted;
}

function encodeObjectPath(value: string) {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function storageTargetFromPublicUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const storagePath = parsed.pathname.slice(markerIndex + marker.length);
    const slashIndex = storagePath.indexOf("/");
    if (slashIndex < 0) return null;

    return {
      storageBucket: decodeURIComponent(storagePath.slice(0, slashIndex)),
      objectPath: storagePath
        .slice(slashIndex + 1)
        .split("/")
        .map((part) => decodeURIComponent(part))
        .join("/"),
    };
  } catch {
    return null;
  }
}

function storageTargetForMedia(item: SocialMediaRow | null) {
  if (!item) return null;
  const metadata = metadataRecord(item.metadata);
  const metadataBucket = String(metadata.storage_bucket || "").trim();
  const metadataPath = String(metadata.object_path || "").trim();

  if (metadataBucket && metadataPath) {
    return { storageBucket: metadataBucket, objectPath: metadataPath };
  }

  return storageTargetFromPublicUrl(item.file_url);
}

async function deleteStorageObjectForMedia(item: SocialMediaRow | null) {
  const target = storageTargetForMedia(item);

  if (!target) {
    return {
      deleted: false,
      skipped: true,
      reason: "No Supabase storage object path was stored for this media item.",
    };
  }

  try {
    const response = await supabaseFetch(
      `/storage/v1/object/${encodeURIComponent(target.storageBucket)}/${encodeObjectPath(target.objectPath)}`,
      { method: "DELETE" }
    );
    const maybeResponse = response as Response;

    if (typeof maybeResponse.ok === "boolean" && !maybeResponse.ok) {
      const text = await maybeResponse.text().catch(() => "");
      return {
        deleted: false,
        storageBucket: target.storageBucket,
        objectPath: target.objectPath,
        error: text || `Storage delete returned HTTP ${maybeResponse.status}.`,
      };
    }

    return {
      deleted: true,
      storageBucket: target.storageBucket,
      objectPath: target.objectPath,
    };
  } catch (error) {
    return {
      deleted: false,
      storageBucket: target.storageBucket,
      objectPath: target.objectPath,
      error: errorMessage(error, "Storage object could not be deleted."),
    };
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const media = await fetchMediaRows();

    return NextResponse.json({ ok: true, media, count: media.length });
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

    if (action === "delete-media") {
      const id = String(body.id || "").trim();

      if (!id) {
        return NextResponse.json({ ok: false, error: "Media ID is required." }, { status: 400 });
      }

      const existing = await fetchMediaById(id);

      if (!existing) {
        return NextResponse.json({ ok: false, error: "Media item was not found." }, { status: 404 });
      }

      const storage = await deleteStorageObjectForMedia(existing);
      await deleteMediaRow(id);
      const media = await fetchMediaRows();

      return NextResponse.json({ ok: true, media, count: media.length, storage });
    }

    if (action === "clear-library") {
      const rows = await fetchMediaRows();
      const rowsToDelete = rows.filter((item) => !isSelectedForPlatform(item));
      const storage: Array<Awaited<ReturnType<typeof deleteStorageObjectForMedia>>> = [];

      for (const item of rowsToDelete) {
        if (item?.id) {
          storage.push(await deleteStorageObjectForMedia(item));
          await deleteMediaRow(String(item.id));
        }
      }

      const refreshed = await fetchMediaRows();

      return NextResponse.json({
        ok: true,
        media: refreshed,
        count: refreshed.length,
        deleted_count: rowsToDelete.length,
        storage,
      });
    }

    if (action === "select-facebook" || action === "select-tiktok" || action === "select-both") {
      const id = String(body.id || "").trim();

      if (!id) {
        return NextResponse.json({ ok: false, error: "Media ID is required." }, { status: 400 });
      }

      const platformUsage =
        action === "select-facebook"
          ? { facebook: true, tiktok: false, both: false, selected_at: new Date().toISOString() }
          : action === "select-tiktok"
            ? { facebook: false, tiktok: true, both: false, selected_at: new Date().toISOString() }
            : { facebook: true, tiktok: true, both: true, selected_at: new Date().toISOString() };

      const existing = await fetchMediaById(id);
      if (!existing) {
        return NextResponse.json({ ok: false, error: "Media item was not found." }, { status: 404 });
      }

      await patchMediaRow(id, {
        is_active: true,
        metadata: {
          ...metadataRecord(existing.metadata),
          platform_usage: platformUsage,
        },
        updated_at: new Date().toISOString(),
      });

      const media = await fetchMediaRows();

      return NextResponse.json({ ok: true, media, count: media.length });
    }

    if (action === "replace-media") {
      const id = String(body.id || "").trim();
      const fileUrl = cleanUrl(body.file_url);
      const thumbnailUrl = String(body.thumbnail_url || "").trim();
      const title = String(body.title || "").trim();
      const mediaType = String(body.media_type || "").trim();

      if (!id || !fileUrl) {
        return NextResponse.json(
          { ok: false, error: "Media ID and replacement URL are required." },
          { status: 400 }
        );
      }

      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        try {
          await assertFacebookAccessibleUrl({ url: fileUrl });
        } catch (error) {
          return NextResponse.json(
            { ok: false, error: errorMessage(error, "Media URL is not publicly fetchable.") },
            { status: 400 }
          );
        }
      }

      const updatePayload: Record<string, unknown> = {
        file_url: fileUrl,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (thumbnailUrl) updatePayload.thumbnail_url = cleanUrl(thumbnailUrl) || null;
      if (title) updatePayload.title = title;
      if (allowedMediaTypes.has(mediaType)) updatePayload.media_type = mediaType;

      await patchMediaRow(id, updatePayload);

      const media = await fetchMediaRows();

      return NextResponse.json({ ok: true, media, count: media.length });
    }

    if (action === "toggle-active") {
      const id = String(body.id || "").trim();

      if (!id) {
        return NextResponse.json({ ok: false, error: "Media ID is required." }, { status: 400 });
      }

      await patchMediaRow(id, {
        is_active: Boolean(body.is_active),
        updated_at: new Date().toISOString(),
      });
      const media = await fetchMediaRows();

      return NextResponse.json({ ok: true, media, count: media.length });
    }

    const fileUrl = cleanUrl(body.file_url);

    if (!fileUrl) {
      return NextResponse.json({ ok: false, error: "Valid media URL is required." }, { status: 400 });
    }

    const mediaType = allowedMediaTypes.has(String(body.media_type)) ? String(body.media_type) : "image";

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      try {
        await assertFacebookAccessibleUrl({ url: fileUrl });
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              error && typeof error === "object" && "message" in error
                ? String((error as { message?: unknown }).message || "Media URL is not publicly fetchable.")
                : "Media URL is not publicly fetchable.",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    const media = await insertMediaRow({
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
      metadata: cleanMetadata(body.metadata),
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true, media, count: 1 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media item could not be saved." },
      { status: 500 }
    );
  }
}
