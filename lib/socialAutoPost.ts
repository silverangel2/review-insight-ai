const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SocialSettings = {
  id: string;
  full_auto_enabled: boolean;
  semi_auto_enabled: boolean;
  daily_time: string;
  platforms: string[];
  topics: string[];
  emergency_pause: boolean;
};

type SocialPost = {
  id?: string;
  platform: string;
  mode: string;
  status: string;
  topic: string;
  caption: string;
  hashtags: string[];
  external_post_id?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
};

function hasStorage() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

function headers() {
  return {
    apikey: supabaseServiceKey || "",
    Authorization: `Bearer ${supabaseServiceKey || ""}`,
    "Content-Type": "application/json",
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  if (!hasStorage()) {
    throw new Error("Supabase social storage is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : text || "Supabase request failed.");
  }

  return data;
}

export function generateReviewIntelCaption(topic: string) {
  const templates: Record<string, string[]> = {
    shopper_tips: [
      "Before you buy, scan the reviews first. A 5-star product can still hide weak review quality. ReviewIntel helps shoppers decide faster.",
      "Shopping online? Don’t just count stars. Check review quality, fake-review risk, and real buyer complaints with ReviewIntel.",
      "Fast shopping decision: upload, scan, and know if the product looks trustworthy. ReviewIntel helps you buy smarter.",
    ],
    seller_tips: [
      "Seller tip: negative reviews are not just complaints. They are product data. ReviewIntel turns customer feedback into action.",
      "Your reviews are telling you what to fix. ReviewIntel helps sellers find complaints, trends, and product improvement signals.",
      "Better product decisions start with review intelligence. ReviewIntel helps sellers understand what buyers really say.",
    ],
    fake_review_warning: [
      "Fake reviews are getting smarter. ReviewIntel helps shoppers check review quality before spending money.",
      "A product can look perfect and still be risky. Scan reviews before buying with ReviewIntel.",
      "Don’t let fake reviews decide for you. ReviewIntel gives shoppers a faster trust check.",
    ],
  };

  const pool = templates[topic] || templates.shopper_tips;
  const index = new Date().getDate() % pool.length;
  return pool[index];
}

export async function getSocialSettings(): Promise<SocialSettings> {
  const rows = await supabaseFetch("admin_social_settings?id=eq.default&select=*&limit=1");

  return rows?.[0] || {
    id: "default",
    full_auto_enabled: false,
    semi_auto_enabled: true,
    daily_time: "09:00",
    platforms: ["facebook"],
    topics: ["shopper_tips", "seller_tips", "fake_review_warning"],
    emergency_pause: false,
  };
}

export async function updateSocialSettings(payload: Partial<SocialSettings>) {
  const body = {
    id: "default",
    updated_at: new Date().toISOString(),
    ...payload,
  };

  const rows = await supabaseFetch("admin_social_settings?id=eq.default", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });

  return rows?.[0] || body;
}

export async function listSocialPosts() {
  return supabaseFetch("admin_social_posts?select=*&order=created_at.desc&limit=30");
}

export async function createSocialPost(post: SocialPost) {
  const rows = await supabaseFetch("admin_social_posts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      scheduled_for: new Date().toISOString(),
      ...post,
    }),
  });

  return rows?.[0];
}

export async function updateSocialPost(id: string, payload: Partial<SocialPost>) {
  const rows = await supabaseFetch(`admin_social_posts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return rows?.[0];
}

async function postToFacebookPage(caption: string) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageToken) {
    return {
      ok: false,
      error: "Facebook Page connector missing. Add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: caption,
      access_token: pageToken,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || "Facebook post failed.",
      metadata: data,
    };
  }

  return {
    ok: true,
    externalPostId: data?.id || null,
    metadata: data,
  };
}

async function postToPlatform(platform: string, caption: string) {
  if (platform === "facebook") {
    return postToFacebookPage(caption);
  }

  if (platform === "tiktok") {
    return {
      ok: false,
      error: "TikTok connector required. Direct posting needs TikTok developer approval and OAuth posting token.",
    };
  }

  if (platform === "instagram") {
    return {
      ok: false,
      error: "Instagram connector required. Instagram auto-publishing needs a Business/Creator account and media container flow.",
    };
  }

  return {
    ok: false,
    error: `Unsupported platform: ${platform}`,
  };
}

export async function runSocialAutoPost() {
  const settings = await getSocialSettings();

  if (settings.emergency_pause) {
    return { ok: true, skipped: true, reason: "Emergency pause is enabled." };
  }

  if (!settings.full_auto_enabled) {
    return { ok: true, skipped: true, reason: "Full auto posting is disabled." };
  }

  const topics = settings.topics?.length ? settings.topics : ["shopper_tips"];
  const platforms = settings.platforms?.length ? settings.platforms : ["facebook"];
  const topic = topics[new Date().getDate() % topics.length];
  const caption = generateReviewIntelCaption(topic);
  const hashtags = ["ReviewIntel", "FakeReviews", "SmartShopping"];

  const results = [];

  for (const platform of platforms) {
    const draft = await createSocialPost({
      platform,
      mode: "full_auto",
      status: "posting",
      topic,
      caption,
      hashtags,
      metadata: { source: "vercel_cron" },
    });

    const published = await postToPlatform(platform, `${caption}\n\n#${hashtags.join(" #")}`);

    if (published.ok) {
      const updated = await updateSocialPost(draft.id, {
        status: "posted",
        external_post_id: published.externalPostId || null,
        metadata: published.metadata || {},
      });

      results.push(updated);
    } else {
      const updated = await updateSocialPost(draft.id, {
        status: "failed",
        error: published.error,
        metadata: published.metadata || {},
      });

      results.push(updated);
    }
  }

  return { ok: true, skipped: false, results };
}
