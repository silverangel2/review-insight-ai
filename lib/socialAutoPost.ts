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

type SocialContentPack = {
  caption: string;
  hashtags: string[];
  shortVideoScript: string;
  altText: string;
  link: string;
};

type PublishResult = {
  ok: boolean;
  externalPostId?: string | null;
  error?: string;
  metadata?: Record<string, unknown>;
  draftOnly?: boolean;
};

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X",
  youtube_shorts: "YouTube Shorts",
  pinterest: "Pinterest",
  reddit: "Reddit",
};

const topicBriefs: Record<string, { title: string; angle: string; cta: string }> = {
  shopper_tips: {
    title: "Shop smarter before checkout",
    angle: "remind shoppers to scan reviews, complaints, pricing, and fake-review risk before spending money",
    cta: "Try a product scan at ReviewIntel.",
  },
  seller_tips: {
    title: "Turn reviews into seller decisions",
    angle: "show sellers how review intelligence reveals buyer objections, competitor gaps, and product fixes",
    cta: "Use ReviewIntel to find the next product improvement.",
  },
  fake_review_warning: {
    title: "Do not trust star ratings alone",
    angle: "warn buyers that polished ratings can hide weak review quality or repeated complaints",
    cta: "Scan before you buy.",
  },
  buyer_mistakes: {
    title: "Common online buying mistakes",
    angle: "teach shoppers to verify return policy, real complaints, product limits, and review patterns",
    cta: "Check the product with ReviewIntel first.",
  },
  competitor_watch: {
    title: "Competitor review watch",
    angle: "help sellers turn competitor complaints into better positioning and product-page messaging",
    cta: "Compare your product against a competitor inside ReviewIntel.",
  },
  trust_signals: {
    title: "Real trust signals",
    angle: "explain what makes reviews useful: specific details, balanced pros and cons, recent complaints, and verified context",
    cta: "Let ReviewIntel organize the buying signals.",
  },
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

function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://getreviewintel.com").replace(/\/$/, "");
}

function platformUrl(platform: string, topic: string) {
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "organic_social",
    utm_campaign: topic,
  });

  return `${publicSiteUrl()}/?${params.toString()}`;
}

function cleanHashtag(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function hashtagsFor(platform: string, topic: string) {
  const base = ["ReviewIntel", "SmartShopping", "ReviewAnalysis"];
  const extraByTopic: Record<string, string[]> = {
    shopper_tips: ["ShoppingTips", "BuySmarter"],
    seller_tips: ["EcommerceSellers", "ProductResearch"],
    fake_review_warning: ["FakeReviews", "OnlineShopping"],
    buyer_mistakes: ["ConsumerTips", "CheckoutChecklist"],
    competitor_watch: ["CompetitorResearch", "SellerGrowth"],
    trust_signals: ["TrustSignals", "ReviewQuality"],
  };
  const shortPlatforms = platform === "x" ? base.slice(0, 2) : base;

  return [...shortPlatforms, ...(extraByTopic[topic] || extraByTopic.shopper_tips)]
    .map(cleanHashtag)
    .filter(Boolean)
    .slice(0, platform === "x" ? 4 : 8);
}

export function generateReviewIntelContentPack(platform: string, topic: string): SocialContentPack {
  const brief = topicBriefs[topic] || topicBriefs.shopper_tips;
  const label = platformLabels[platform] || platform;
  const link = platformUrl(platform, topic);
  const hashtags = hashtagsFor(platform, topic);

  const longCaption = `${brief.title}: ${brief.angle}. ReviewIntel helps turn messy reviews into a clearer decision before money is spent. ${brief.cta}`;
  const shortCaption = `${brief.title}. ${brief.cta} ${link}`;

  const caption = platform === "x"
    ? shortCaption.slice(0, 245)
    : `${longCaption}\n\n${link}`;

  return {
    caption,
    hashtags,
    shortVideoScript: [
      "Hook: Stop trusting star ratings by themselves.",
      `Show: ${brief.title}.`,
      "Explain: ReviewIntel scans buyer signals, complaints, trust patterns, and product risks.",
      `CTA: ${brief.cta}`,
    ].join("\n"),
    altText: `ReviewIntel ${label} post about ${brief.title.toLowerCase()}.`,
    link,
  };
}

function formatPostCaption(content: SocialContentPack) {
  return `${content.caption}\n\n#${content.hashtags.join(" #")}`;
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

  const rows = await supabaseFetch("admin_social_settings?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
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

async function postToFacebookPage(caption: string): Promise<PublishResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const graphVersion = process.env.FACEBOOK_GRAPH_API_VERSION || "v20.0";

  if (!pageId || !pageToken) {
    return {
      ok: false,
      error: "Facebook Page connector missing. Add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
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

async function postToPlatform(platform: string, caption: string): Promise<PublishResult> {
  if (platform === "facebook") {
    return postToFacebookPage(caption);
  }

  return {
    ok: true,
    draftOnly: true,
    metadata: {
      connectorRequired: true,
      platform,
      note: `${platformLabels[platform] || platform} draft created. Add the official platform connector before direct auto-publishing.`,
    },
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

  const results = [];

  for (const platform of platforms) {
    const content = generateReviewIntelContentPack(platform, topic);
    const draft = await createSocialPost({
      platform,
      mode: "full_auto",
      status: "posting",
      topic,
      caption: content.caption,
      hashtags: content.hashtags,
      metadata: {
        source: "vercel_cron",
        shortVideoScript: content.shortVideoScript,
        altText: content.altText,
        link: content.link,
      },
    });

    const published = await postToPlatform(platform, formatPostCaption(content));

    if (published.ok) {
      const updated = await updateSocialPost(draft.id, {
        status: published.draftOnly ? "draft_ready" : "posted",
        external_post_id: published.externalPostId || null,
        metadata: {
          ...(draft.metadata || {}),
          ...(published.metadata || {}),
        },
      });

      results.push(updated);
    } else {
      const updated = await updateSocialPost(draft.id, {
        status: "failed",
        error: published.error,
        metadata: {
          ...(draft.metadata || {}),
          ...(published.metadata || {}),
        },
      });

      results.push(updated);
    }
  }

  return { ok: true, skipped: false, results };
}
