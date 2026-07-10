function cleanSupabaseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function isPrivateOrLocalUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    return (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return true;
  }
}

function storageHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
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

async function readBucket(fetcher, bucketUrl, serviceKey) {
  const response = await fetcher(bucketUrl, {
    headers: storageHeaders(serviceKey),
    cache: "no-store",
  });

  if (!response.ok) return { response, bucket: null };

  const bucket = await response.json().catch(() => null);
  return { response, bucket };
}

async function verifyPublicBucket(fetcher, bucketUrl, serviceKey) {
  const { response, bucket } = await readBucket(fetcher, bucketUrl, serviceKey);

  if (!response.ok) {
    throw new Error((await responseDetail(response)) || "Supabase Storage bucket could not be verified.");
  }

  if (bucket?.public !== true) {
    throw new Error("Supabase Storage bucket must be public before returning public media URLs.");
  }

  return bucket;
}

export async function ensurePublicSupabaseStorageBucket({
  supabaseUrl,
  serviceKey,
  storageBucket,
  allowedMimeTypes,
  fileSizeLimit,
  fetcher = fetch,
}) {
  const cleanUrl = cleanSupabaseUrl(supabaseUrl);
  const bucketUrl = `${cleanUrl}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`;
  const payload = {
    public: true,
    file_size_limit: fileSizeLimit,
    allowed_mime_types: allowedMimeTypes,
  };

  const lookup = await readBucket(fetcher, bucketUrl, serviceKey);

  if (lookup.response.ok) {
    if (lookup.bucket?.public === true) return lookup.bucket;

    const updated = await fetcher(bucketUrl, {
      method: "PUT",
      headers: storageHeaders(serviceKey),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!updated.ok) {
      throw new Error((await responseDetail(updated)) || "Supabase Storage bucket exists but could not be made public.");
    }

    return verifyPublicBucket(fetcher, bucketUrl, serviceKey);
  }

  if (lookup.response.status !== 404) {
    throw new Error((await responseDetail(lookup.response)) || "Supabase Storage bucket lookup failed.");
  }

  const created = await fetcher(`${cleanUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(serviceKey),
    body: JSON.stringify({
      id: storageBucket,
      name: storageBucket,
      ...payload,
    }),
    cache: "no-store",
  });

  if (!created.ok && created.status !== 409) {
    throw new Error((await responseDetail(created)) || "Supabase Storage media bucket could not be created.");
  }

  return verifyPublicBucket(fetcher, bucketUrl, serviceKey);
}

export function supabasePublicObjectUrl({ supabaseUrl, storageBucket, objectPath }) {
  return `${cleanSupabaseUrl(supabaseUrl)}/storage/v1/object/public/${encodeURIComponent(storageBucket)}/${objectPath}`;
}

async function fetchWithTimeout(fetcher, input, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function probeError(error, fallback) {
  if (error instanceof DOMException && error.name === "AbortError") return "Media fetch timed out.";
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message || "");
    if (message) return message;
  }
  return fallback;
}

export async function probeFacebookAccessibleUrl({ url, fetcher = fetch, timeoutMs = 5000 }) {
  const cleanUrl = String(url || "").trim();
  const safeTimeoutMs = Math.max(100, timeoutMs);

  if (!cleanUrl) return { ok: false, error: "Media URL is missing." };
  if (isPrivateOrLocalUrl(cleanUrl)) return { ok: false, error: "Media URL is private or local." };

  try {
    const head = await fetchWithTimeout(fetcher, cleanUrl, { method: "HEAD", cache: "no-store" }, safeTimeoutMs);
    if (head.ok) return { ok: true, status: head.status };

    if (head.status !== 405 && head.status !== 501) {
      return { ok: false, status: head.status, error: `Media HEAD returned HTTP ${head.status}.` };
    }
  } catch (error) {
    return { ok: false, error: probeError(error, "Media HEAD check failed.") };
  }

  try {
    const ranged = await fetchWithTimeout(
      fetcher,
      cleanUrl,
      {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        cache: "no-store",
      },
      safeTimeoutMs,
    );

    return ranged.ok || ranged.status === 206
      ? { ok: true, status: ranged.status }
      : { ok: false, status: ranged.status, error: `Media range GET returned HTTP ${ranged.status}.` };
  } catch (error) {
    return { ok: false, error: probeError(error, "Media range GET check failed.") };
  }
}

export async function assertFacebookAccessibleUrl({ url, fetcher = fetch, timeoutMs = 5000 }) {
  const result = await probeFacebookAccessibleUrl({ url, fetcher, timeoutMs });
  if (!result.ok) throw new Error(result.error || "Media URL is not publicly fetchable.");
  return result;
}
