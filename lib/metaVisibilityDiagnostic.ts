import { getStoredFacebookPageToken } from "@/lib/facebookConnector";
import { listSocialPosts } from "@/lib/socialAutoPost";

type GraphRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeMessage(value: unknown) {
  return text(value)
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/access_token\s*[=:]\s*[^&\s]+/gi, "access_token=[redacted]")
    .replace(/(authorization\s*[:=]\s*)([^\s]+)/gi, "$1[redacted]")
    .slice(0, 500);
}

function safeError(response: Response, body: GraphRecord) {
  const graphError = body.error;
  if (graphError && typeof graphError === "object" && !Array.isArray(graphError)) {
    const item = graphError as GraphRecord;
    return {
      status: response.status,
      code: typeof item.code === "number" ? item.code : null,
      subcode: typeof item.error_subcode === "number" ? item.error_subcode : null,
      message: safeMessage(item.message) || `Meta returned HTTP ${response.status}.`
    };
  }
  return { status: response.status, code: null, subcode: null, message: `Meta returned HTTP ${response.status}.` };
}

async function graphGet<T extends GraphRecord>(input: { graphVersion: string; path: string; token: string; params?: Record<string, string> }) {
  const url = new URL(`https://graph.facebook.com/${input.graphVersion}/${input.path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(input.params || {})) if (value) url.searchParams.set(key, value);
  url.searchParams.set("access_token", input.token);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T;
  if (!response.ok || body.error) return { ok: false as const, body, error: safeError(response, body) };
  return { ok: true as const, body, error: null };
}

function appSummary(appId: string) {
  return { configured_id: Boolean(appId), id: appId || null, mode: "NOT_EXPOSED_BY_META_API", status: "NOT_EXPOSED_BY_META_API" };
}

function restrictionsSummary() {
  return {
    page_publication_state: "NOT_EXPOSED_BY_META_API",
    age_restrictions: "NOT_EXPOSED_BY_META_API",
    country_restrictions: "NOT_EXPOSED_BY_META_API",
    page_quality: "NOT_EXPOSED_BY_META_API",
    distribution_restrictions: "NOT_EXPOSED_BY_META_API"
  };
}

export async function runReviewIntelMetaVisibilityDiagnostic() {
  const credential = await getStoredFacebookPageToken();
  const pageId = text(credential?.pageId || process.env.FACEBOOK_PAGE_ID);
  const token = text(credential?.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  const graphVersion = text(process.env.FACEBOOK_GRAPH_API_VERSION || process.env.META_GRAPH_API_VERSION) || "v25.0";
  const appId = text(process.env.FACEBOOK_APP_ID);

  if (!pageId || !token) {
    return {
      product: "reviewintel",
      graph_version: graphVersion,
      page: { configured_id: pageId || null, actual_id: null, name: null, configured_id_matches_meta: null, lookup: "NOT_EXPOSED" },
      token: { valid: false, type: "NOT_EXPOSED_BY_META_API", expires_at: credential?.expiresAt || null, note: "Server-side Page credentials are incomplete." },
      permissions: { configured_scopes: [], actual_tasks: "NOT_EXPOSED_BY_META_API", required_for_reels: "NOT_EXPOSED_BY_META_API" },
      app: appSummary(appId),
      reel: null,
      restrictions: restrictionsSummary(),
      errors: [{ code: "CREDENTIALS_INCOMPLETE", message: "Server-side Page credentials are incomplete." }]
    };
  }

  const page = await graphGet<GraphRecord>({ graphVersion, path: pageId, token, params: { fields: "id,name,link" } });
  const actualPageId = text(page.body.id);
  const posts = await listSocialPosts().catch(() => []);
  const candidate = Array.isArray(posts)
    ? posts.find((post) => {
        const item = post as GraphRecord;
        const metadata = item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata as GraphRecord : {};
        const reel = metadata.facebookReel && typeof metadata.facebookReel === "object" && !Array.isArray(metadata.facebookReel) ? metadata.facebookReel as GraphRecord : {};
        return item.platform === "facebook" && item.status === "posted" && Boolean(item.external_post_id || reel.video_id);
      }) as GraphRecord | undefined
    : undefined;
  const metadata = candidate?.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata) ? candidate.metadata as GraphRecord : {};
  const reelMetadata = metadata.facebookReel && typeof metadata.facebookReel === "object" && !Array.isArray(metadata.facebookReel) ? metadata.facebookReel as GraphRecord : {};
  const objectId = text(candidate?.external_post_id) || text(reelMetadata.video_id);
  const reel = objectId
    ? await graphGet<GraphRecord>({ graphVersion, path: objectId, token, params: { fields: "id,permalink_url,media_type,is_reel,created_time,status" } })
    : null;

  return {
    product: "reviewintel",
    graph_version: graphVersion,
    page: { configured_id: pageId, actual_id: actualPageId || null, name: text(page.body.name) || null, link: text(page.body.link) || null, configured_id_matches_meta: page.ok ? actualPageId === pageId : null, lookup: page.ok ? "PROVEN" : "NOT_EXPOSED" },
    token: { valid: page.ok, type: "NOT_EXPOSED_BY_META_API", expires_at: credential?.expiresAt || null, note: page.ok ? "Page-token lookup succeeded." : page.error?.message || "Page-token lookup failed." },
    permissions: { configured_scopes: [], actual_tasks: "NOT_EXPOSED_BY_META_API", required_for_reels: "NOT_EXPOSED_BY_META_API" },
    app: appSummary(appId),
    reel: {
      internal_record_id: text(candidate?.id) || null,
      meta_object_id: objectId || null,
      lookup: reel ? (reel.ok ? "PROVEN" : "NOT_EXPOSED") : "NOT_EXPOSED",
      exists: reel ? Boolean(reel.body.id || objectId) : false,
      id: reel ? text(reel.body.id) || objectId || null : null,
      is_reel: reel && typeof reel.body.is_reel === "boolean" ? reel.body.is_reel : null,
      media_type: reel ? text(reel.body.media_type) || null : null,
      status: reel?.body.status ?? null,
      permalink_url: reel ? text(reel.body.permalink_url) || null : null,
      created_time: reel ? text(reel.body.created_time) || null : null,
    },
    restrictions: restrictionsSummary(),
    errors: [!page.ok ? page.error : null, reel && !reel.ok ? reel.error : null].filter(Boolean)
  };
}
