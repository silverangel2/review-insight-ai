import { readdirSync, readFileSync } from "fs";
import path from "path";
import {
  buildAffiliateUrl,
  getAffiliateDisclosure,
  getAmazonAssociateTag,
  isSupportedAffiliateUrl,
} from "@/lib/affiliate";
import { getFacebookPageAccessTokenForPosting } from "@/lib/facebookConnector";
import { HOMEPAGE_VIDEO_TOPIC } from "@/lib/socialMediaTopics";
import { getTikTokAccessTokenForPosting, getTikTokOAuthHealth } from "@/lib/tiktokConnector";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PublicSiteUrlResolution = {
  url: string;
  source: string;
};

function cleanPublicSiteUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.includes("localhost") || trimmed.includes("127.0.0.1")) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function resolvePublicSiteUrl(): PublicSiteUrlResolution {
  const candidates = [
    { source: "NEXT_PUBLIC_SITE_URL", value: process.env.NEXT_PUBLIC_SITE_URL },
    { source: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
    { source: "APP_URL", value: process.env.APP_URL },
    { source: "VERCEL_PROJECT_PRODUCTION_URL", value: process.env.VERCEL_PROJECT_PRODUCTION_URL },
    { source: "VERCEL_URL", value: process.env.VERCEL_URL },
    { source: "fallback", value: "https://getreviewintel.com" },
  ];

  for (const candidate of candidates) {
    const url = cleanPublicSiteUrl(candidate.value);
    if (url) {
      return {
        url,
        source: candidate.source,
      };
    }
  }

  return {
    url: "https://getreviewintel.com",
    source: "fallback",
  };
}

function getPublicSiteUrl() {
  return resolvePublicSiteUrl().url;
}

type SocialSettings = {
  id: string;
  full_auto_enabled: boolean;
  semi_auto_enabled: boolean;
  daily_time: string;
  platforms: string[];
  topics: string[];
  emergency_pause: boolean;
  cycle_length?: number;
  posts_per_day?: number;
  recycle_after_days?: number;
  last_queue_day?: number;
  last_posted_at?: string | null;
  updated_at?: string;
};

type SocialPost = {
  id?: string;
  platform: string;
  mode: string;
  status: string;
  topic: string;
  caption: string;
  hashtags: string[];
  link_url?: string | null;
  external_post_id?: string | null;
  scheduled_for?: string | null;
  queue_day?: number | null;
  cycle_number?: number | null;
  recycle_count?: number | null;
  media_id?: string | null;
  posted_at?: string | null;
  content_fingerprint?: string | null;
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

const codexSocialLibraryDir = "uploads/social";
const codexSocialImagePattern = /^reviewintel-premium-day-\d{2}-.+\.(?:png|jpg|jpeg|webp)$/i;
const builtInSocialTopics = Object.keys(topicBriefs);

type ConnectorCheck = {
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
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
  return (
    getPublicSiteUrl()
  ).replace(/\/$/, "");
}

let localEnvCache: Record<string, string[]> | null = null;

function readLocalEnvValues() {
  if (localEnvCache) return localEnvCache;
  localEnvCache = {};

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return localEnvCache;
  }

  for (const filename of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(path.join(process.cwd(), filename), "utf8");

      for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;

        const key = match[1];
        let value = match[2].trim();
        if (!value || value.startsWith("#")) continue;

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!value.trim()) continue;
        localEnvCache[key] = [...(localEnvCache[key] || []), value.trim()];
      }
    } catch {
      // Missing local env files are fine; Vercel should provide env vars.
    }
  }

  return localEnvCache;
}

function envFirst(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  const localValues = readLocalEnvValues();
  for (const name of names) {
    const value = localValues[name]?.find((item) => item.trim());
    if (value) return value.trim();
  }

  return "";
}

async function resolveFacebookPostingCredentials() {
  const oauthCredential = await getFacebookPageAccessTokenForPosting();

  const pageId =
    oauthCredential.pageId ||
    envFirst("FACEBOOK_PAGE_ID", "META_PAGE_ID", "META_FACEBOOK_PAGE_ID");

  const pageToken =
    oauthCredential.accessToken ||
    envFirst(
      "FACEBOOK_PAGE_ACCESS_TOKEN",
      "META_PAGE_ACCESS_TOKEN",
      "META_FACEBOOK_PAGE_ACCESS_TOKEN"
    );

  return {
    pageId,
    pageToken,
    source: oauthCredential.accessToken ? oauthCredential.source : "env-fallback",
    hasPageId: Boolean(pageId),
    hasPageToken: Boolean(pageToken),
  };
}


function facebookConfig() {
  const graphVersion = envFirst("FACEBOOK_GRAPH_API_VERSION", "META_GRAPH_API_VERSION") || "v25.0";

  return {
    pageId: envFirst("FACEBOOK_PAGE_ID", "FB_PAGE_ID", "META_PAGE_ID", "META_FACEBOOK_PAGE_ID"),
    pageToken: envFirst(
      "FACEBOOK_PAGE_ACCESS_TOKEN",
      "FB_PAGE_ACCESS_TOKEN",
      "META_PAGE_ACCESS_TOKEN",
      "META_FACEBOOK_PAGE_ACCESS_TOKEN"
    ),
    graphVersion: graphVersion.startsWith("v") ? graphVersion : `v${graphVersion}`,
  };
}

function tiktokConfig() {
  return {
    privacyLevel: envFirst("TIKTOK_PRIVACY_LEVEL", "TIKTOK_DEFAULT_PRIVACY_LEVEL"),
  };
}

function maskIdentifier(value: string) {
  if (!value) return "";
  if (value.length <= 8) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function isPrivateOrLocalUrl(url: string) {
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

function connectorCheck(label: string, status: ConnectorCheck["status"], detail: string): ConnectorCheck {
  return { label, status, detail };
}

function platformUrl(platform: string, topic: string) {
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "organic_social",
    utm_campaign: topic,
  });

  return `${publicSiteUrl()}/?${params.toString()}`;
}

function envEnabled(...names: string[]) {
  const value = envFirst(...names).toLowerCase();
  return ["1", "true", "yes", "on", "enabled"].includes(value);
}

function hasAffiliateProgramConfigured() {
  return Boolean(getAmazonAssociateTag());
}

function socialAffiliateAttachment(platform: string, topic: string) {
  if (platform !== "facebook") return null;
  if (!envEnabled("SOCIAL_AFFILIATE_POSTS_ENABLED", "FACEBOOK_AFFILIATE_POSTS_ENABLED")) return null;

  const rawUrl = envFirst(
    "SOCIAL_AFFILIATE_URL",
    "FACEBOOK_AFFILIATE_URL",
    "SOCIAL_QUALIFYING_LINK_URL",
    "FACEBOOK_QUALIFYING_LINK_URL"
  );

  const disclosure =
    envFirst("SOCIAL_AFFILIATE_DISCLOSURE", "FACEBOOK_AFFILIATE_DISCLOSURE") ||
    `${getAffiliateDisclosure()} #affiliate`;

  if (rawUrl && isSupportedAffiliateUrl(rawUrl)) {
    const url = buildAffiliateUrl(rawUrl);

    return {
      url,
      disclosure,
      label: "Shop qualifying source",
      mode: "direct-product-affiliate",
    };
  }

  if (!hasAffiliateProgramConfigured()) return null;

  return {
    url: platformUrl(platform, `${topic}_affiliate_picks`),
    disclosure,
    label: "Scan products and see affiliate-ready picks",
    mode: "reviewintel-affiliate-hub",
  };
}

function appendSocialAffiliateLink(
  caption: string,
  attachment: { url: string; disclosure: string; label: string } | null
) {
  if (!attachment || caption.includes(attachment.url)) return caption;

  return `${caption}\n\n${attachment.label}: ${attachment.url}\n\nAffiliate disclosure: ${attachment.disclosure}`;
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

const socialContentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    caption: {
      type: "string",
      description: "A platform-ready caption without hashtags."
    },
    hashtags: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 8
    },
    shortVideoScript: {
      type: "string",
      description: "A short reusable reel/shorts script with hook, visual idea, and CTA."
    },
    altText: {
      type: "string",
      description: "Accessible alt text for the selected image or video."
    }
  },
  required: ["caption", "hashtags", "shortVideoScript", "altText"]
};

function textArray(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").replace(/^#/, "").trim())
    .map(cleanHashtag)
    .filter(Boolean)
    .slice(0, limit);
}

function responseOutputText(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (typeof record.output_text === "string") return record.output_text;

  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .flatMap((item) => {
      const itemRecord = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return Array.isArray(itemRecord.content) ? itemRecord.content : [];
    })
    .map((content) => {
      const contentRecord = content && typeof content === "object" ? (content as Record<string, unknown>) : {};
      return typeof contentRecord.text === "string" ? contentRecord.text : "";
    })
    .join("");
}

function freshFallbackCaption(caption: string, platform: string, topic: string) {
  const hooks = [
    "Some products look perfect until the review patterns tell another story.",
    "A high rating is only the surface. The real signal is in what buyers repeat.",
    "Before trusting the stars, check the patterns behind the praise and complaints.",
    "ReviewIntel turns messy product reviews into a faster buying-confidence signal.",
    "The smartest purchase is not based on hype. It is based on repeated buyer patterns.",
    "Reviews are noisy. ReviewIntel helps separate useful signals from empty praise.",
    "A product can look popular and still have warning signs hiding in plain sight.",
    "Better buying starts with understanding what real customers keep saying.",
    "Not every five-star product deserves blind trust.",
    "Review patterns can reveal what the product page does not want you to notice.",
    "The best product decision starts before checkout.",
    "Good reviews matter, but repeated complaints matter more.",
    "A smart shopper looks past the rating and checks the pattern.",
    "ReviewIntel helps buyers slow down for one second before making the wrong purchase.",
    "The product page tells one story. The review pattern tells another."
  ];

  const seed = Math.abs(
    Array.from(`${Date.now()}-${Math.random()}-${topic}-${platform}`)
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  );

  const hook = hooks[seed % hooks.length];
  const cleanCaption = caption.replace(/^(.{0,160}?)(\n\n|$)/, "").trim();

  if (platform === "x") {
    return `${hook} ${topic ? `#${topic.replace(/\s+/g, "")}` : "#ReviewIntel"}`.slice(0, 250);
  }

  return `${hook}\n\n${cleanCaption || "Use ReviewIntel to spot patterns, compare buyer feedback, and make faster product decisions."}`;
}

function normalizeAiContent(raw: unknown, fallback: SocialContentPack, platform: string, topic: string): SocialContentPack {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const caption = String(record.caption || fallback.caption || "").trim();
  const hashtags = Array.from(
    new Set([
      ...textArray(record.hashtags, 8),
      ...hashtagsFor(platform, topic),
    ])
  ).slice(0, platform === "x" ? 4 : 8);

  return {
    caption: caption || freshFallbackCaption(fallback.caption, platform, topic),
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    shortVideoScript: String(record.shortVideoScript || fallback.shortVideoScript || "").trim() || fallback.shortVideoScript,
    altText: String(record.altText || fallback.altText || "").trim() || fallback.altText,
    link: fallback.link,
  };
}

async function generateAiReviewIntelContentPack(
  platform: string,
  topic: string,
  queue: SocialQueueState,
  media?: SocialMediaItem | null
): Promise<SocialContentPack> {
  const fallback = generateReviewIntelContentPack(platform, topic);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ...fallback,
      caption: freshFallbackCaption(fallback.caption, platform, topic),
    };
  }

  const brief = topicBriefs[topic] || topicBriefs.shopper_tips;
  const label = platformLabels[platform] || platform;
  const mediaBrief = media
    ? [
        `Media type: ${media.media_type || "image"}`,
        `Media title: ${media.title || "untitled media"}`,
        `Media topic: ${media.topic || "general"}`,
        `Media tags: ${(media.tags || []).join(", ") || "none"}`,
      ].join("\n")
    : "No uploaded media selected for this post.";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: `You are ReviewIntel's organic social media strategist.

Create one ${label} post for an automatic ReviewIntel social queue.

Topic: ${brief.title}
Angle: ${brief.angle}
CTA: ${brief.cta}
Link to mention naturally when useful: ${fallback.link}
Queue day: ${queue.queueDay}
Cycle number: ${queue.cycleNumber}
Recycle count: ${queue.recycleCount}
${mediaBrief}

Rules:
- Make the post feel useful, human, and premium, not spammy.
- Do not claim guaranteed results, official platform partnerships, or impossible automation.
- Do not pretend a platform was connected or posted.
- Reuse the uploaded media idea, but reinvent the caption angle when recycle count is above 0.
- For shoppers, emphasize safer buying decisions before checkout.
- For sellers, emphasize review intelligence, competitor gaps, product improvement, and clearer action.
- Caption must not include hashtags; return hashtags separately.
- Keep ${label} caption length appropriate: short for X, stronger story for Facebook/LinkedIn, punchier for TikTok/Instagram/Shorts.
- Include a short video script that can be used with the uploaded media.
- Return JSON only.`,
        text: {
          format: {
            type: "json_schema",
            name: "reviewintel_social_post",
            strict: true,
            schema: socialContentSchema,
          },
        },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ...fallback,
        caption: freshFallbackCaption(fallback.caption, platform, topic),
      };
    }

    const outputText = responseOutputText(data);
    if (!outputText) {
      return {
        ...fallback,
        caption: freshFallbackCaption(fallback.caption, platform, topic),
      };
    }

    return normalizeAiContent(JSON.parse(outputText), fallback, platform, topic);
  } catch {
    return fallback;
  }
}


type SocialMediaItem = {
  id: string;
  media_type: "image" | "video" | string;
  mime_type?: string | null;
  file_url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  used_count?: number | null;
  last_used_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SocialQueueState = {
  queueDay: number;
  cycleNumber: number;
  recycleCount: number;
};

type SocialMediaPickOptions = {
  preferMediaType?: "image" | "video";
  requireMediaType?: "image" | "video";
  allowCodexFallback?: boolean;
};

let codexSocialLibraryCache: string[] | null = null;

function codexSocialLibraryPaths() {
  if (codexSocialLibraryCache) return codexSocialLibraryCache;

  try {
    const dir = path.join(process.cwd(), "public", codexSocialLibraryDir);
    codexSocialLibraryCache = readdirSync(dir)
      .filter((file) => codexSocialImagePattern.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => `/${codexSocialLibraryDir}/${file}`);
  } catch {
    codexSocialLibraryCache = [];
  }

  return codexSocialLibraryCache;
}

function normalSocialDay(day: number, librarySize = Math.max(1, codexSocialLibraryPaths().length)) {
  const numericDay = Math.max(1, Math.floor(Number(day) || 1));
  return ((numericDay - 1) % librarySize) + 1;
}

function codexSocialImagePath(day: number) {
  const paths = codexSocialLibraryPaths();
  if (!paths.length) return "";
  return paths[normalSocialDay(day, paths.length) - 1] || "";
}

function codexLibrarySocialMedia(topic: string, queue: SocialQueueState): SocialMediaItem {
  const paths = codexSocialLibraryPaths();
  const queueDay = normalSocialDay(queue.queueDay, Math.max(1, paths.length));
  const fileUrl = codexSocialImagePath(queueDay);
  const topicKey = topic || builtInSocialTopics[(queueDay - 1) % builtInSocialTopics.length] || "shopper_tips";

  return {
    id: fileUrl
      ? `codex-reviewintel-premium-${String(queueDay).padStart(3, "0")}`
      : "reviewintel-text-only-fallback",
    media_type: fileUrl ? "image" : "text",
    file_url: fileUrl,
    thumbnail_url: fileUrl,
    title: fileUrl
      ? `ReviewIntel Codex premium social creative ${String(queueDay).padStart(3, "0")}`
      : "ReviewIntel text-only social fallback",
    topic: topicKey,
    tags: ["ReviewIntel", "AIReviewIntelligence", "SmartShopping", "CodexLibrary", topicKey],
    used_count: 0,
    last_used_at: null,
    metadata: {
      codex_library: Boolean(fileUrl),
      text_only_fallback: !fileUrl,
      queue_day: queueDay,
      cycle_number: queue.cycleNumber,
      note: fileUrl
        ? "Codex-made ReviewIntel premium image used because no active uploaded media matched the queue."
        : "No active uploaded media or Codex image was available, so ReviewIntel created a text-only post.",
    },
  };
}

function isSystemSocialMedia(media: SocialMediaItem | null) {
  return Boolean(
    media?.metadata?.codex_library ||
      media?.metadata?.text_only_fallback ||
      media?.id?.startsWith("codex-reviewintel-premium-") ||
      media?.id === "reviewintel-text-only-fallback"
  );
}

function isCodexLibraryMedia(media: SocialMediaItem | null) {
  if (!media) return false;

  const id = String(media.id || "").toLowerCase();
  const title = String(media.title || "").toLowerCase();
  const tags = Array.isArray(media.tags) ? media.tags.map((tag) => String(tag).toLowerCase()) : [];
  const metadata = media.metadata && typeof media.metadata === "object" ? media.metadata : {};
  const source = String(metadata.source || metadata.media_source || "").toLowerCase();

  return (
    metadata.codex_library === true ||
    id.startsWith("codex-") ||
    id.includes("codex") ||
    title.includes("codex") ||
    source === "codex" ||
    source === "codex_library" ||
    tags.includes("codexlibrary") ||
    tags.includes("codex_library") ||
    tags.includes("codex")
  );
}

function isOldHouseSocialMedia(media: SocialMediaItem | null) {
  const fileUrl = String(media?.file_url || "");
  const title = String(media?.title || "");

  return (
    fileUrl.includes("/social/house/") ||
    /reviewintel-house-\d+/i.test(fileUrl) ||
    /reviewintel house/i.test(title)
  );
}

function absoluteMediaUrl(media?: SocialMediaItem | null) {
  if (!media?.file_url) return "";
  return media.file_url.startsWith("/") ? `${publicSiteUrl()}${media.file_url}` : media.file_url;
}

function facebookAutoPostFormat() {
  const value = (envFirst("SOCIAL_AUTOPOST_FACEBOOK_FORMAT", "FACEBOOK_AUTOPOST_FORMAT") || "auto")
    .trim()
    .toLowerCase();

  if (value === "auto") return "auto";
  if (value === "reel" || value === "reels" || value === "video") return "reel";
  if (value === "image" || value === "photo") return "image";
  return "default";
}

function codexMediaJsonFilter() {
  return __riSocialMediaSourceMode() === "codex_library"
    ? "&metadata->>codex_library=eq.true"
    : "";
}

function mediaTypeFilter(mediaType?: "image" | "video") {
  return mediaType ? `&media_type=eq.${mediaType}` : "";
}

function compactSocialText(value: string, limit: number) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

async function postedPlatformsToday(platforms: string[], now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const rows = await supabaseFetch(
    `admin_social_posts?select=platform&status=eq.posted&posted_at=gte.${encodeURIComponent(start)}&limit=100`
  ).catch(() => []);

  if (!Array.isArray(rows)) return new Set<string>();

  return new Set(
    rows
      .map((row) => String((row as Record<string, unknown>)?.platform || ""))
      .filter(Boolean)
  );
}

function makeContentFingerprint(input: {
  platform: string;
  topic: string;
  queueDay: number;
  cycleNumber: number;
  recycleCount: number;
}) {
  return [
    input.platform,
    input.topic,
    `day-${input.queueDay}`,
    `cycle-${input.cycleNumber}`,
    `recycle-${input.recycleCount}`,
  ].join(":");
}

async function getLatestQueueState(cycleLength: number): Promise<SocialQueueState> {
  const rows = await supabaseFetch(
    "admin_social_posts?select=queue_day,cycle_number,recycle_count&status=in.(posted,draft_ready)&order=created_at.desc&limit=1"
  );

  const latest = Array.isArray(rows) ? rows[0] : null;
  const lastQueueDay = Number(latest?.queue_day || 0);
  const lastCycleNumber = Math.max(1, Number(latest?.cycle_number || 1));

  const queueDay = lastQueueDay >= cycleLength ? 1 : lastQueueDay + 1;
  const cycleNumber = lastQueueDay >= cycleLength ? lastCycleNumber + 1 : lastCycleNumber;
  const recycleCount = Math.max(0, cycleNumber - 1);

  return { queueDay, cycleNumber, recycleCount };
}

function advanceQueueState(queue: SocialQueueState, cycleLength: number): SocialQueueState {
  const queueDay = queue.queueDay >= cycleLength ? 1 : queue.queueDay + 1;
  const cycleNumber = queue.queueDay >= cycleLength ? queue.cycleNumber + 1 : queue.cycleNumber;
  const recycleCount = Math.max(0, cycleNumber - 1);

  return { queueDay, cycleNumber, recycleCount };
}

function sortPickedMedia(rows: SocialMediaItem[], options: SocialMediaPickOptions) {
  const preferredType = options.preferMediaType;
  if (!preferredType) return rows;

  const preferredRows = rows.filter((row) => String(row.media_type || "") === preferredType);
  return preferredRows.length ? preferredRows : rows;
}

async function pickSocialMedia(
  topic: string,
  queue: SocialQueueState,
  options: SocialMediaPickOptions = {}
): Promise<SocialMediaItem | null> {
  const sourceMode = __riSocialMediaSourceMode();
  const usable = (rows: unknown): SocialMediaItem[] =>
    Array.isArray(rows)
      ? (rows as SocialMediaItem[]).filter((row) => {
          const mediaType = String(row.media_type || "");
          return (
            Boolean(row.file_url) &&
            (mediaType === "image" || mediaType === "video") &&
            (!options.requireMediaType || mediaType === options.requireMediaType) &&
            String(row.topic || "") !== HOMEPAGE_VIDEO_TOPIC &&
            !Boolean(row.metadata?.homepage_video) &&
            !isOldHouseSocialMedia(row) &&
            (sourceMode !== "codex_library" || isCodexLibraryMedia(row))
          );
        })
      : [];

  const topicQuery = encodeURIComponent(topic);
  const codexFilter = codexMediaJsonFilter();
  const preferredType = options.preferMediaType || options.requireMediaType;
  const topicRows = sortPickedMedia(usable(
    await supabaseFetch(
      `admin_social_media?select=*&is_active=eq.true&topic=eq.${topicQuery}${codexFilter}${mediaTypeFilter(preferredType)}&order=last_used_at.asc.nullsfirst,used_count.asc,created_at.asc&limit=50`
    ).catch(() => [])
  ), options);

  let fallbackRows = topicRows.length
    ? topicRows
    : sortPickedMedia(usable(
        await supabaseFetch(
          `admin_social_media?select=*&is_active=eq.true${codexFilter}${mediaTypeFilter(preferredType)}&order=last_used_at.asc.nullsfirst,used_count.asc,created_at.asc&limit=100`
        ).catch(() => [])
      ), options);

  if (!fallbackRows.length && options.preferMediaType && !options.requireMediaType) {
    fallbackRows = sortPickedMedia(usable(
      await supabaseFetch(
        `admin_social_media?select=*&is_active=eq.true${codexFilter}&order=last_used_at.asc.nullsfirst,used_count.asc,created_at.asc&limit=100`
      ).catch(() => [])
    ), options);
  }

  if (!fallbackRows.length) {
    if (options.requireMediaType || options.allowCodexFallback === false) return null;
    return codexLibrarySocialMedia(topic, queue);
  }

  return fallbackRows[(queue.queueDay - 1) % fallbackRows.length] || fallbackRows[0] || codexLibrarySocialMedia(topic, queue);
}

async function markSocialMediaUsed(media: SocialMediaItem | null, usedAt: string) {
  if (!media?.id) return;
  if (isSystemSocialMedia(media)) return;

  await supabaseFetch(`admin_social_media?id=eq.${encodeURIComponent(media.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      used_count: Number(media.used_count || 0) + 1,
      last_used_at: usedAt,
      updated_at: usedAt,
    }),
  }).catch(() => null);
}


function finalFreshSocialCaption(caption: string, topic: string, queue: SocialQueueState) {
  const openers = [
    "A product can look perfect online — until the review patterns start repeating.",
    "The star rating is only the surface. The real story is hiding in the repeated buyer feedback.",
    "Before checkout, it helps to know what customers keep praising and complaining about.",
    "Some products win attention fast, but ReviewIntel looks for the patterns behind the hype.",
    "The product page gives you the pitch. The reviews reveal the pattern.",
    "A smarter buying decision starts with the repeated signals customers leave behind.",
    "Not every popular product is a confident buy. The review pattern matters.",
    "The fastest way to understand a product is to separate noise from repeated buyer signals.",
    "Good reviews are helpful, but repeated complaints are where the warning signs usually appear.",
    "ReviewIntel helps turn messy product feedback into a faster buying-confidence check.",
    "Before trusting the rating, check what real buyers keep saying again and again.",
    "The best clue is not one review. It is the pattern across many reviews.",
    "A product may look safe, but review trends can expose hidden risks.",
    "Buying confidence comes from patterns, not just stars.",
    "ReviewIntel helps shoppers look past the surface before they click buy."
  ];

  const closers = [
    "ReviewIntel helps shoppers decide faster with clearer review signals.",
    "Use ReviewIntel before you buy, compare, or trust the hype.",
    "Turn scattered reviews into a clearer product decision.",
    "See the pattern before you spend.",
    "Shop with more confidence before checkout.",
    "Let the reviews explain the product, not just the rating.",
    "Find the signal hiding inside the noise.",
    "Make the product decision clearer in seconds.",
    "Know the pattern before the purchase.",
    "Use review intelligence before the cart becomes a mistake."
  ];

  const seed = Math.abs(
    Array.from(`${Date.now()}-${Math.random()}-${topic}-${queue.recycleCount}`)
      .reduce((total, char) => total + char.charCodeAt(0), 0)
  );

  const opener = openers[seed % openers.length];
  const closer = closers[(seed + 7) % closers.length];

  const body = caption
    .replace(/^A product can look perfect online[\s\S]*?(\n\n|$)/, "")
    .replace(/^The star rating is only the surface[\s\S]*?(\n\n|$)/, "")
    .replace(/^Before checkout[\s\S]*?(\n\n|$)/, "")
    .replace(/^Some products win attention[\s\S]*?(\n\n|$)/, "")
    .trim();

  const cleanedBody = body.length > 40 ? body : "ReviewIntel analyzes product feedback, repeated complaints, fake-review risk, and buyer confidence signals.";

  return `${opener}\n\n${cleanedBody}\n\n${closer}`;
}

function recycleCaption(caption: string, queue: SocialQueueState) {
  if (queue.recycleCount <= 0) return caption;

  const refreshers = [
    "Fresh angle:",
    "Another buyer-signal check:",
    "New review pattern to watch:",
    "Before the next checkout:",
    "Worth checking twice:",
    "A different way to look at reviews:",
    "Today’s product signal:",
    "Quick buyer-confidence reminder:"
  ];

  const seed = Math.abs(queue.recycleCount + Date.now());
  const index = seed % refreshers.length;

  return `${refreshers[index]} ${freshFallbackCaption(
    caption,
    "facebook",
    `cycle-${queue.recycleCount}`
  )}`;
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

export async function deleteSocialPost(id: string) {
  const cleanId = String(id || "").trim();
  if (!cleanId) throw new Error("Social post id is required.");

  await supabaseFetch(`admin_social_posts?id=eq.${encodeURIComponent(cleanId)}`, {
    method: "DELETE",
  });

  return true;
}

export async function clearSocialPostHistory() {
  await supabaseFetch("admin_social_posts?id=not.is.null", {
    method: "DELETE",
  });

  return true;
}

export async function pruneSocialPostHistory(days = 30) {
  const safeDays = Math.max(1, Math.min(365, Math.round(Number(days) || 30)));
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  await supabaseFetch(`admin_social_posts?created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: "DELETE",
  });

  return true;
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

async function postToFacebookReel(input: {
  graphVersion: string;
  pageId: string;
  pageToken: string;
  caption: string;
  mediaUrl: string;
}): Promise<PublishResult> {
  const endpoint = `https://graph.facebook.com/${input.graphVersion}/${encodeURIComponent(input.pageId)}/video_reels`;
  const startResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      upload_phase: "start",
      access_token: input.pageToken,
    }),
  });
  const startData = await startResponse.json().catch(() => ({}));
  const videoId = String(startData?.video_id || "");
  const uploadUrl = String(
    startData?.upload_url ||
      (videoId ? `https://rupload.facebook.com/video-upload/${input.graphVersion}/${encodeURIComponent(videoId)}` : "")
  );

  if (!startResponse.ok || !videoId || !uploadUrl) {
    return {
      ok: false,
      error: startData?.error?.message || "Facebook Reel upload could not start.",
      metadata: { facebookReel: { phase: "start", response: startData } },
    };
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${input.pageToken}`,
      file_url: input.mediaUrl,
    },
  });
  const uploadData = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok || uploadData?.success === false) {
    return {
      ok: false,
      error: uploadData?.error?.message || "Facebook Reel video upload failed.",
      metadata: {
        facebookReel: {
          phase: "upload",
          video_id: videoId,
          upload_url_available: Boolean(uploadUrl),
          response: uploadData,
        },
      },
    };
  }

  const finishResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      description: input.caption,
      title: "ReviewIntel",
      access_token: input.pageToken,
    }),
  });
  const finishData = await finishResponse.json().catch(() => ({}));

  if (!finishResponse.ok || finishData?.success === false) {
    return {
      ok: false,
      error: finishData?.error?.message || "Facebook Reel publish failed.",
      metadata: {
        facebookReel: {
          phase: "finish",
          video_id: videoId,
          response: finishData,
        },
      },
    };
  }

  return {
    ok: true,
    externalPostId: finishData?.post_id || finishData?.id || videoId,
    metadata: {
      facebookReel: {
        posted_as: "reel",
        video_id: videoId,
        upload_success: uploadData?.success ?? true,
        publish_response: finishData,
      },
    },
  };
}

async function postToFacebookPage(caption: string, media?: SocialMediaItem | null): Promise<PublishResult> {
  const { graphVersion } = facebookConfig();
  const facebookCredentials = await resolveFacebookPostingCredentials();
  const pageId = facebookCredentials.pageId;
  const pageToken = facebookCredentials.pageToken;

  if (!pageId || !pageToken) {
    return {
      ok: false,
      error: "Facebook Page connector missing. Connect Facebook with OAuth or add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
      metadata: {
        facebookConnector: {
          pageIdConfigured: Boolean(pageId),
          pageTokenConfigured: Boolean(pageToken),
        },
      },
    };
  }

  const mediaUrl = absoluteMediaUrl(media);
  const facebookFormat = facebookAutoPostFormat();
  let reelAttempt: PublishResult | null = null;

  if (
    media?.file_url &&
    (media.media_type === "image" || media.media_type === "video") &&
    (!mediaUrl || isPrivateOrLocalUrl(mediaUrl))
  ) {
    return {
      ok: false,
      error:
        "Facebook cannot fetch localhost or private media URLs. Use the deployed site URL or Supabase Storage public URLs.",
      metadata: {
        media_id: media.id,
        media_type: media.media_type,
        media_url_public: Boolean(mediaUrl && !isPrivateOrLocalUrl(mediaUrl)),
      },
    };
  }

  if (
    media?.media_type === "video" &&
    media.file_url &&
    mediaUrl &&
    (facebookFormat === "auto" || facebookFormat === "reel")
  ) {
    reelAttempt = await postToFacebookReel({
      graphVersion,
      pageId,
      pageToken,
      caption,
      mediaUrl,
    });

    if (reelAttempt.ok || facebookFormat === "reel") {
      return reelAttempt;
    }
  }

  const endpoint =
    media?.media_type === "video" && media.file_url
      ? `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/videos`
      : media?.media_type === "image" && media.file_url
        ? `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/photos`
        : `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/feed`;

  const body =
    media?.media_type === "video" && media.file_url
      ? new URLSearchParams({
          file_url: mediaUrl,
          description: caption,
          published: "true",
          access_token: pageToken,
        })
      : media?.media_type === "image" && media.file_url
        ? new URLSearchParams({
            url: mediaUrl,
            caption,
            access_token: pageToken,
          })
        : new URLSearchParams({
            message: caption,
            access_token: pageToken,
          });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || "Facebook post failed.",
      metadata: { ...data, facebookReelFallback: reelAttempt?.metadata || null },
    };
  }

  return {
    ok: true,
    externalPostId: data?.post_id || data?.id || null,
    metadata: { ...data, facebookReelFallback: reelAttempt?.metadata || null },
  };
}

export async function checkFacebookConnector() {
  const { graphVersion } = facebookConfig();
  const facebookCredentials = await resolveFacebookPostingCredentials();
  const pageId = facebookCredentials.pageId;
  const pageToken = facebookCredentials.pageToken;
  const sampleMediaPath = codexSocialImagePath(1);
  const sampleMediaUrl = sampleMediaPath ? `${publicSiteUrl()}${sampleMediaPath}` : "";
  const checks: ConnectorCheck[] = [
    connectorCheck(
      "Facebook credentials",
      pageId && pageToken ? "passed" : "failed",
      pageId && pageToken
        ? "Facebook page ID and a usable Page token were found from OAuth storage or env fallback."
        : "Missing Facebook Page ID or usable Page token. Connect Facebook with OAuth or add a valid env fallback token."
    ),
  ];

  if (pageId && pageToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}?fields=id,name,link&access_token=${encodeURIComponent(pageToken)}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));

      checks.push(
        connectorCheck(
          "Facebook page access",
          response.ok ? "passed" : "failed",
          response.ok
            ? `Connected to ${data?.name || "the configured Facebook Page"}.`
            : data?.error?.message || "Facebook rejected the page ID/token pair."
        )
      );
    } catch {
      checks.push(
        connectorCheck(
          "Facebook page access",
          "failed",
          "Could not reach Facebook Graph API from this server."
        )
      );
    }
  }

  if (isPrivateOrLocalUrl(sampleMediaUrl)) {
    checks.push(
      connectorCheck(
        "Public media URL",
        "failed",
        "The current site URL is localhost/private. Facebook needs the deployed getreviewintel.com URL to fetch images."
      )
    );
  } else {
    try {
      const response = await fetch(sampleMediaUrl, { method: "HEAD", cache: "no-store" });
      checks.push(
        connectorCheck(
          "Codex premium media library",
          response.ok ? "passed" : "warning",
          response.ok
            ? "The Codex-made ReviewIntel media library is reachable from the public site URL."
            : `The Codex media URL returned HTTP ${response.status}; posting may still work after deployment if the file exists there.`
        )
      );
    } catch {
      checks.push(
        connectorCheck(
          "Codex premium media library",
          "warning",
          "Could not verify the public Codex media URL from this environment. The local Codex library files deploy with the app."
        )
      );
    }
  }

  const failed = checks.some((item) => item.status === "failed");
  const warning = checks.some((item) => item.status === "warning");

  return {
    ok: !failed,
    status: failed ? "failed" : warning ? "warning" : "ready",
    graphVersion,
    page: { id: pageId ? maskIdentifier(pageId) : "" },
    sampleMediaUrl,
    checks,
  };
}

async function queryTikTokCreatorInfo(accessToken: string) {
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  return { response, data };
}

function tiktokPrivacyLevel(data: unknown, configuredPrivacyLevel = "") {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const payload = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : {};
  const options = Array.isArray(payload.privacy_level_options)
    ? payload.privacy_level_options.map(String)
    : [];

  if (configuredPrivacyLevel && options.includes(configuredPrivacyLevel)) return configuredPrivacyLevel;
  if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (options.includes("SELF_ONLY")) return "SELF_ONLY";
  return options[0] || configuredPrivacyLevel || "SELF_ONLY";
}

async function postToTikTok(caption: string, media?: SocialMediaItem | null): Promise<PublishResult> {
  const { privacyLevel } = tiktokConfig();
  const credential = await getTikTokAccessTokenForPosting();
  const accessToken = credential.accessToken;

  if (!accessToken) {
    return {
      ok: true,
      draftOnly: true,
      metadata: {
        connectorRequired: true,
        platform: "tiktok",
        note: "TikTok draft created. Connect TikTok in Admin Social after TikTok approves Content Posting API direct publishing.",
      },
    };
  }

  if (credential.source.startsWith("connected") && !credential.scopes.includes("video.publish")) {
    return {
      ok: false,
      error: "Connected TikTok account is missing the video.publish scope. Reconnect TikTok after TikTok approves Direct Post access.",
      metadata: {
        platform: "tiktok",
        credentialSource: credential.source,
        scopes: credential.scopes,
      },
    };
  }

  if (media?.media_type === "video") {
    return {
      ok: true,
      draftOnly: true,
      metadata: {
        connectorRequired: true,
        platform: "tiktok",
        note: "TikTok video direct posting needs a video-specific source flow. Image/photo posting is wired first.",
      },
    };
  }

  const mediaUrl = absoluteMediaUrl(media);

  if (!media || media.media_type !== "image" || !mediaUrl || isPrivateOrLocalUrl(mediaUrl)) {
    return {
      ok: false,
      error: "TikTok direct posting needs a public image URL that TikTok can fetch.",
      metadata: {
        media_id: media?.id ?? null,
        media_url_public: Boolean(mediaUrl && !isPrivateOrLocalUrl(mediaUrl)),
      },
    };
  }

  const creatorInfo = await queryTikTokCreatorInfo(accessToken);
  if (!creatorInfo.response.ok) {
    return {
      ok: false,
      error: creatorInfo.data?.error?.message || creatorInfo.data?.error?.code || "TikTok creator info check failed.",
      metadata: {
        tiktok: creatorInfo.data,
        credentialSource: credential.source,
        accountName: credential.accountName,
      },
    };
  }

  const selectedPrivacyLevel = tiktokPrivacyLevel(creatorInfo.data, privacyLevel);
  const description = compactSocialText(caption, 3900);

  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: compactSocialText("ReviewIntel AI review intelligence", 90),
        description,
        privacy_level: selectedPrivacyLevel,
        disable_comment: false,
        auto_add_music: false,
        brand_content_toggle: false,
        brand_organic_toggle: true,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: [mediaUrl],
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message || data?.error?.code || "TikTok post failed.",
      metadata: {
        tiktok: data,
        selectedPrivacyLevel,
      },
    };
  }

  const publishId = data?.data?.publish_id || data?.publish_id || null;

  return {
    ok: true,
    externalPostId: publishId,
    metadata: {
      tiktok: data,
      selectedPrivacyLevel,
      credentialSource: credential.source,
      accountName: credential.accountName,
      privacyWarning: selectedPrivacyLevel !== "PUBLIC_TO_EVERYONE"
        ? "TikTok did not offer PUBLIC_TO_EVERYONE. The post may be private until TikTok app/account permissions are upgraded."
        : null,
    },
  };
}

export async function checkTikTokConnector() {
  const { privacyLevel } = tiktokConfig();
  const credential = await getTikTokAccessTokenForPosting();
  const accessToken = credential.accessToken;
  const oauthHealth = getTikTokOAuthHealth();
  const sampleMediaPath = codexSocialImagePath(2);
  const sampleMediaUrl = sampleMediaPath ? `${publicSiteUrl()}${sampleMediaPath}` : "";
  const checks: ConnectorCheck[] = [
    connectorCheck(
      "TikTok OAuth app",
      oauthHealth.clientKeyConfigured && oauthHealth.clientSecretConfigured ? "passed" : "failed",
      oauthHealth.clientKeyConfigured && oauthHealth.clientSecretConfigured
        ? `TikTok app credentials are configured. Redirect URI: ${oauthHealth.redirectUri}.`
        : "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET in Vercel."
    ),
    connectorCheck(
      "TikTok OAuth scopes",
      oauthHealth.directPostRequested ? "passed" : "warning",
      oauthHealth.directPostRequested
        ? "OAuth requests video.publish for Direct Post / full automatic posting."
        : `OAuth currently requests ${oauthHealth.scopes.join(", ")}. This is approval-safe, but full automatic posting needs video.publish after TikTok approval.`
    ),
    connectorCheck(
      "TikTok connection",
      accessToken ? "passed" : "warning",
      accessToken
        ? `TikTok token found from ${credential.source}${credential.accountName ? ` for ${credential.accountName}` : ""}.`
        : "TikTok is not connected. Use Connect TikTok after TikTok approves the Content Posting API product."
    ),
  ];

  if (accessToken && credential.source.startsWith("connected") && !credential.scopes.includes("video.publish")) {
    checks.push(
      connectorCheck(
        "Direct post scope",
        "failed",
        "The connected TikTok account does not include video.publish. Reconnect TikTok after Direct Post approval."
      )
    );
  } else if (accessToken) {
    checks.push(
      connectorCheck(
        "Direct post scope",
        "passed",
        credential.source === "env-fallback"
          ? "Using env token. Scope cannot be inspected locally, so TikTok creator-info will verify it."
          : "Connected TikTok token includes video.publish."
      )
    );
  }

  if (isPrivateOrLocalUrl(sampleMediaUrl)) {
    checks.push(
      connectorCheck(
        "Public media URL",
        "failed",
        "The current site URL is localhost/private. TikTok direct posting needs the deployed public URL."
      )
    );
  } else {
    checks.push(
      connectorCheck(
        "Public media URL",
        "passed",
        "Codex-made ReviewIntel media resolves to a public URL for TikTok to fetch."
      )
    );
  }

  if (accessToken) {
    try {
      const creatorInfo = await queryTikTokCreatorInfo(accessToken);
      const selectedPrivacyLevel = tiktokPrivacyLevel(creatorInfo.data, privacyLevel);
      checks.push(
        connectorCheck(
          "Creator permission",
          creatorInfo.response.ok ? "passed" : "failed",
          creatorInfo.response.ok
            ? `TikTok creator info is reachable. Selected privacy: ${selectedPrivacyLevel}.`
            : creatorInfo.data?.error?.message || creatorInfo.data?.error?.code || "TikTok rejected the access token or app permissions."
        )
      );

      if (creatorInfo.response.ok && selectedPrivacyLevel !== "PUBLIC_TO_EVERYONE") {
        checks.push(
          connectorCheck(
            "Public posting",
            "warning",
            "TikTok did not expose PUBLIC_TO_EVERYONE. Direct posts may be private until app review/account permissions allow public posting."
          )
        );
      }
    } catch {
      checks.push(
        connectorCheck(
          "Creator permission",
          "failed",
          "Could not reach TikTok Content Posting API from this server."
        )
      );
    }
  }

  const failed = checks.some((item) => item.status === "failed");
  const warning = checks.some((item) => item.status === "warning");

  return {
    ok: !failed,
    status: failed ? "failed" : warning ? "warning" : "ready",
    sampleMediaUrl,
    oauth: oauthHealth,
    account: credential.accountName ? { name: credential.accountName, source: credential.source } : null,
    checks,
  };
}

async function postToPlatform(platform: string, caption: string, media?: SocialMediaItem | null): Promise<PublishResult> {
  if (platform === "facebook") {
    return postToFacebookPage(caption, media);
  }

  if (platform === "tiktok") {
    return postToTikTok(caption, media);
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

async function runSocialAutoPostInternal(options: { force?: boolean } = {}) {
  const settings = await getSocialSettings();

  if (settings.emergency_pause) {
    return { ok: true, skipped: true, reason: "Emergency pause is enabled." };
  }

  if (!settings.full_auto_enabled && !options.force) {
    return { ok: true, skipped: true, reason: "Full auto-post is disabled." };
  }

  const topics = settings.topics?.length ? settings.topics : ["shopper_tips"];
  const platforms = settings.platforms?.length ? settings.platforms : ["facebook"];
  const postedToday = await postedPlatformsToday(platforms);
  const remainingPlatforms = platforms.filter((platform) => !postedToday.has(platform));

  if (!options.force && remainingPlatforms.length === 0) {
    return { ok: true, skipped: true, reason: "Every selected platform already published today." };
  }

  const platformsToPost = options.force ? platforms : remainingPlatforms;
  const cycleLength = Math.max(1, Number(settings.cycle_length || 100));
  const batchCount = Math.max(1, Math.min(12, Number(settings.posts_per_day || 1)));
  let queue = await getLatestQueueState(cycleLength);
  let lastQueue = queue;
  const now = new Date().toISOString();
  const results = [];
  const mediaUsed: Array<SocialMediaItem | null> = [];

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const topic = topics[(new Date().getUTCDate() + batchIndex) % topics.length];
    const defaultMedia = (await pickSocialMedia(topic, queue)) || codexLibrarySocialMedia(topic, queue);

    for (const platform of platformsToPost) {
      const facebookFormat = platform === "facebook" ? facebookAutoPostFormat() : "default";
      const media =
        facebookFormat === "auto"
          ? (await pickSocialMedia(topic, queue, { preferMediaType: "video" })) || defaultMedia
          : facebookFormat === "reel"
            ? await pickSocialMedia(topic, queue, {
                preferMediaType: "video",
                requireMediaType: "video",
                allowCodexFallback: false,
              })
            : defaultMedia;

      if (facebookFormat === "reel" && (!media || media.media_type !== "video")) {
        results.push({
          platform,
          status: "skipped",
          topic,
          error: "SOCIAL_AUTOPOST_FACEBOOK_FORMAT=reel requires active video media, but no generated or uploaded video was available.",
          metadata: {
            queue,
            facebookFormat,
            fix: "Generate Codex video assets in Admin Social or upload an active MP4 video to the social media library.",
          },
        });
        continue;
      }

      mediaUsed.push(media);
      const content = await generateAiReviewIntelContentPack(platform, topic, queue, media);
      const affiliateAttachment = socialAffiliateAttachment(platform, topic);
      const baseCaption = finalFreshSocialCaption(recycleCaption(formatPostCaption(content), queue), topic, queue);
      const caption = appendSocialAffiliateLink(baseCaption, affiliateAttachment);
      const fingerprint = makeContentFingerprint({
        platform,
        topic,
        queueDay: queue.queueDay,
        cycleNumber: queue.cycleNumber,
        recycleCount: queue.recycleCount,
      });

      const draft = await createSocialPost({
        platform,
        mode: "full_auto",
        status: "draft_ready",
        topic,
        caption,
        hashtags: content.hashtags,
        link_url: affiliateAttachment?.url || content.link,
        queue_day: queue.queueDay,
        cycle_number: queue.cycleNumber,
        recycle_count: queue.recycleCount,
        media_id: isSystemSocialMedia(media) ? null : media?.id ?? null,
        content_fingerprint: fingerprint,
        metadata: {
          content,
          affiliate: affiliateAttachment
            ? {
                enabled: true,
                url: affiliateAttachment.url,
                disclosure: affiliateAttachment.disclosure,
                mode: affiliateAttachment.mode,
                note:
                  affiliateAttachment.mode === "direct-product-affiliate"
                    ? "Direct Amazon qualifying link appended only for Facebook because social affiliate posting was explicitly enabled."
                    : "ReviewIntel affiliate hub link appended because affiliate posting is enabled and no exact product URL was configured.",
              }
            : null,
          queue,
          media: media
            ? {
                id: media.id,
                type: media.media_type,
                mime_type: media.mime_type || media.metadata?.mime_type || null,
                file_url: media.file_url,
                thumbnail_url: media.thumbnail_url ?? null,
                title: media.title ?? null,
                topic: media.topic ?? null,
                tags: media.tags ?? [],
                codex_library: Boolean(media?.metadata?.codex_library),
                text_only_fallback: Boolean(media?.metadata?.text_only_fallback),
              }
            : null,
          recycle_note:
            queue.recycleCount > 0
              ? "This post is from a recycled 100-day cycle with a refreshed caption angle."
              : null,
        },
      });

      const published = await postToPlatform(platform, caption, media);

      if (published.ok) {
        const updated = await updateSocialPost(draft.id, {
          status: published.draftOnly ? "draft_ready" : "posted",
          external_post_id: published.externalPostId,
          posted_at: published.draftOnly ? null : now,
          error: null,
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

    lastQueue = queue;
    queue = advanceQueueState(queue, cycleLength);
  }

  const completedResults = results.filter((result) => {
    const status = String((result as Record<string, unknown> | null)?.status || "");
    return status === "posted" || status === "draft_ready";
  });
  const postedResults = results.filter((result) => {
    const status = String((result as Record<string, unknown> | null)?.status || "");
    return status === "posted";
  });
  const hasCompletedResults = completedResults.length > 0;

  if (hasCompletedResults) {
    const uniqueMediaUsed = Array.from(
      new Map(
        mediaUsed
          .filter((media): media is SocialMediaItem => Boolean(media?.id))
          .map((media) => [media.id, media])
      ).values()
    );

    for (const media of uniqueMediaUsed) {
      await markSocialMediaUsed(media, now);
    }

    await updateSocialSettings({
      last_queue_day: lastQueue.queueDay,
      ...(postedResults.length ? { last_posted_at: now } : {}),
    });
  }

  return {
    ok: hasCompletedResults,
    skipped: false,
    status: hasCompletedResults ? "completed" : "failed",
    reason: hasCompletedResults
      ? null
      : "Every selected platform failed to publish. The daily scheduler was not locked, so it can retry after connector settings are fixed.",
    queue_day: lastQueue.queueDay,
    cycle_number: lastQueue.cycleNumber,
    recycle_count: lastQueue.recycleCount,
    batches: batchCount,
    media_ids: mediaUsed
      .filter((media): media is SocialMediaItem => Boolean(media?.id))
      .map((media) => media.id),
    results,
  };
}

type __ReviewIntelSocialMediaSourceMode = "codex_library" | "uploaded" | "mixed";

function __riSocialMediaSourceMode(): __ReviewIntelSocialMediaSourceMode {
  const value = (process.env.SOCIAL_AUTOPOST_MEDIA_SOURCE || "codex_library")
    .trim()
    .toLowerCase();

  if (value === "uploaded" || value === "mixed" || value === "codex_library") {
    return value;
  }

  return "codex_library";
}

function __riShouldForceCodexMediaTable(tableName: string): boolean {
  const table = tableName.toLowerCase();

  if (
    table === "social_media_assets" ||
    table === "social_assets" ||
    table === "social_media_library" ||
    table === "social_library" ||
    table === "media_assets"
  ) {
    return true;
  }

  return table.includes("social") && (
    table.includes("media") ||
    table.includes("asset") ||
    table.includes("library")
  );
}

function installCodexMediaFetchGuard(): () => void {
  const mode = __riSocialMediaSourceMode();

  if (mode !== "codex_library") {
    return () => {};
  }

  const originalFetch = globalThis.fetch;

  if (typeof originalFetch !== "function") {
    return () => {};
  }

  const guardedFetch: typeof fetch = async (input, init) => {
    try {
      const isRequest =
        typeof Request !== "undefined" && input instanceof Request;

      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : isRequest
              ? input.url
              : "";

      if (!rawUrl) {
        return originalFetch(input, init);
      }

      const url = new URL(rawUrl);
      const method = (init?.method || (isRequest ? input.method : "GET") || "GET")
        .toUpperCase();

      const lowerPathname = url.pathname.toLowerCase();

      const restPrefix = "/rest/v1/";
      const restIndex = lowerPathname.indexOf(restPrefix);

      if (restIndex >= 0 && (method === "GET" || method === "HEAD")) {
        const tableName = decodeURIComponent(
          lowerPathname
            .slice(restIndex + restPrefix.length)
            .split("/")
            .filter(Boolean)[0] || ""
        );

        if (__riShouldForceCodexMediaTable(tableName)) {
          url.searchParams.set("metadata->>codex_library", "eq.true");

          const existingOrder = url.searchParams.get("order") || "";
          if (!existingOrder.includes("created_at")) {
            url.searchParams.set("order", "created_at.asc");
          }

          const forwardedInit: RequestInit | undefined = isRequest
            ? {
                method: input.method,
                headers: input.headers,
                signal: input.signal,
                ...init,
              }
            : init;

          return originalFetch(url.toString(), forwardedInit);
        }
      }
    } catch {
      // Fall through to the original request.
    }

    return originalFetch(input, init);
  };

  globalThis.fetch = guardedFetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

export async function runSocialAutoPost(
  ...args: Parameters<typeof runSocialAutoPostInternal>
) {
  const restoreFetch = installCodexMediaFetchGuard();

  try {
    const result = await runSocialAutoPostInternal(...args);

    const mediaItems = Array.isArray(result?.results)
      ? result.results
          .map((item) => item?.metadata?.media)
          .filter(Boolean)
      : [];

    const hasCodexMarker = (media: Record<string, unknown>): boolean => {
      const id = String(media.id || "").toLowerCase();
      const title = String(media.title || "").toLowerCase();
      const source = String(media.source || media.media_source || "").toLowerCase();
      const tags = Array.isArray(media.tags)
        ? media.tags.map((tag: unknown) => String(tag).toLowerCase())
        : [];
      const metadata =
        media.metadata && typeof media.metadata === "object"
          ? (media.metadata as Record<string, unknown>)
          : {};

      return (
        media.codex_library === true ||
        metadata.codex_library === true ||
        id.startsWith("codex-") ||
        id.includes("codex") ||
        title.includes("codex") ||
        source === "codex" ||
        source === "codex_library" ||
        tags.includes("codexlibrary") ||
        tags.includes("codex_library") ||
        tags.includes("codex")
      );
    };

    const usedNonCodexMedia = mediaItems.some((media) => !hasCodexMarker(media));

    if (__riSocialMediaSourceMode() === "codex_library" && usedNonCodexMedia) {
      return {
        ...result,
        media_source_warning:
          "A non-Codex social media asset was selected while Codex library mode is enabled.",
      };
    }

    return result;
  } finally {
    restoreFetch();
  }
}
