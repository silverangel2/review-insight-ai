#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  assertSafePublicSocialMediaBucket,
  publicSocialMediaStorageBucket,
  uploadPublicSupabaseObject,
} from "./social-storage-public.mjs";

const cwd = process.cwd();
const publicSocialMaxBytes = 50 * 1024 * 1024;

function hasArg(name) {
  return process.argv.includes(name);
}

function loadLocalEnv() {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return;

  for (const filename of [".env.local", ".env"]) {
    let raw = "";
    try {
      raw = readFileSync(`${cwd}/${filename}`, "utf8");
    } catch {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const key = match[1];
      if (process.env[key]) continue;

      let value = match[2].trim();
      if (!value || value.startsWith("#")) continue;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";
const targetBucket = publicSocialMediaStorageBucket().storageBucket;
assertSafePublicSocialMediaBucket({ storageBucket: targetBucket });
const apply = hasArg("--apply");

function storageHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function responseDetail(response) {
  const text = await response.text().catch(() => "");

  if (!text) return "";

  try {
    const data = JSON.parse(text);
    return String(data?.message || data?.error || text);
  } catch {
    return text;
  }
}

async function restFetch(resource, init = {}) {
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase is not configured.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : text || "Supabase request failed.");
  }

  return data;
}

function parseSupabaseObjectUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const marker = "/storage/v1/object/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    let rest = url.pathname.slice(markerIndex + marker.length);
    if (rest.startsWith("public/")) rest = rest.slice("public/".length);
    if (rest.startsWith("sign/")) rest = rest.slice("sign/".length);

    const [bucket, ...pathParts] = rest.split("/").filter(Boolean);
    const objectPath = pathParts.map((part) => decodeURIComponent(part)).join("/");

    if (!bucket || !objectPath) return null;
    return { bucket: decodeURIComponent(bucket), objectPath };
  } catch {
    return null;
  }
}

function destinationPath(sourcePath) {
  if (sourcePath.startsWith("social/videos/")) return sourcePath;
  return `social/videos/${basename(sourcePath)}`;
}

function storageObjectUrl(bucket, objectPath) {
  const safeObjectPath = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${safeObjectPath}`;
}

async function probeSourceObject(bucket, objectPath) {
  const url = storageObjectUrl(bucket, objectPath);

  let headFailure = null;
  try {
    const head = await fetch(url, {
      method: "HEAD",
      headers: storageHeaders(),
      cache: "no-store",
    });

    if (head.ok) return { ok: true, method: "HEAD", status: head.status };

    headFailure = {
      method: "HEAD",
      status: head.status,
      error: (await responseDetail(head)) || `Source HEAD returned HTTP ${head.status}.`,
    };
  } catch (error) {
    headFailure = {
      method: "HEAD",
      error: error instanceof Error ? error.message : "Source HEAD request failed.",
    };
  }

  try {
    const ranged = await fetch(url, {
      headers: storageHeaders({ Range: "bytes=0-0" }),
      cache: "no-store",
    });
    const ok = ranged.ok || ranged.status === 206;

    return {
      ok,
      method: "GET",
      status: ranged.status,
      ...(ok
        ? {}
        : { error: (await responseDetail(ranged)) || `Source ranged GET returned HTTP ${ranged.status}.` }),
      head: headFailure,
    };
  } catch (error) {
    return {
      ok: false,
      method: "GET",
      error: error instanceof Error ? error.message : "Source ranged GET request failed.",
      head: headFailure,
    };
  }
}

async function downloadObject(bucket, objectPath) {
  const response = await fetch(storageObjectUrl(bucket, objectPath), {
    headers: storageHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(detail || `Could not download ${bucket}/${objectPath}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function repairRow(row) {
  const parsed = parseSupabaseObjectUrl(row.file_url);
  if (!parsed) {
    return { id: row.id, status: "skipped", reason: "not a Supabase object URL" };
  }

  if (parsed.bucket === targetBucket) {
    return { id: row.id, status: "skipped", reason: "already in target public bucket" };
  }

  const objectPath = destinationPath(parsed.objectPath);

  if (!apply) {
    const sourceProbe = await probeSourceObject(parsed.bucket, parsed.objectPath);

    return {
      id: row.id,
      status: sourceProbe.ok ? "dry-run" : "source-inaccessible",
      source: `${parsed.bucket}/${parsed.objectPath}`,
      target: `${targetBucket}/${objectPath}`,
      source_accessible: sourceProbe.ok,
      source_probe: sourceProbe,
      ...(sourceProbe.ok ? {} : { reason: "source object could not be read" }),
    };
  }

  const body = await downloadObject(parsed.bucket, parsed.objectPath);
  const publicUrl = await uploadPublicSupabaseObject({
    supabaseUrl,
    serviceKey,
    storageBucket: targetBucket,
    objectPath,
    body,
    contentType: "video/mp4",
    allowedMimeTypes: ["video/mp4"],
    fileSizeLimit: publicSocialMaxBytes,
  });
  const now = new Date().toISOString();
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  await restFetch(`admin_social_media?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      file_url: publicUrl,
      metadata: {
        ...metadata,
        storage: "supabase",
        storage_bucket: targetBucket,
        public_url_repaired_at: now,
        previous_private_file_url: row.file_url,
      },
      updated_at: now,
    }),
  });

  return {
    id: row.id,
    status: "repaired",
    source: `${parsed.bucket}/${parsed.objectPath}`,
    target: publicUrl,
  };
}

async function main() {
  const rows = await restFetch(
    "admin_social_media?select=id,title,file_url,metadata&media_type=eq.video&metadata->>codex_library=eq.true&limit=1000"
  );
  const results = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    results.push(await repairRow(row));
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target_bucket: targetBucket,
    total: results.length,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Social video repair failed.");
  process.exitCode = 1;
});
