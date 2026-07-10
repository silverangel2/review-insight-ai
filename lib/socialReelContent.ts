export type ReelDiscoveryTopic =
  | "customer_reviews"
  | "reputation_management"
  | "local_business_growth"
  | "customer_trust"
  | "online_visibility"
  | "small_business_marketing";

type HashtagCategory = "broad" | "niche" | "audience" | "branded" | "timely";

type HashtagCandidate = {
  tag: string;
  category: HashtagCategory;
  topics: ReelDiscoveryTopic[];
  months?: number[];
};

export type HashtagScore = {
  topicalRelevance: number;
  audienceFit: number;
  repetitionRisk: number;
  spamRisk: number;
  total: number;
};

export type BalancedHashtagResult = {
  hashtags: string[];
  topic: ReelDiscoveryTopic;
  score: HashtagScore;
};

export type MinimalReelContentPlan = {
  caption: string;
  hashtags: string[];
  websiteUrl: string;
  websiteShortUrl: string;
  affiliateUrl: string;
  affiliateShortUrl: string;
  affiliateRelevant: boolean;
  cta: string;
  theme: string;
  overlayHook: string;
  overlaySupport: string;
  overlayCta: string;
  discoveryTopic: ReelDiscoveryTopic;
  hashtagScore: HashtagScore;
};

export const reelOverlayLimits = {
  hook: 58,
  support: 92,
  cta: 28,
  caption: 420,
  hashtagsMin: 4,
  hashtagsMax: 7,
};

const bannedOrSpammyHashtags = new Set([
  "viral",
  "fyp",
  "foryou",
  "foryoupage",
  "trending",
  "explorepage",
  "likeforlike",
  "followforfollow",
  "buynow",
  "sale",
  "discount",
  "promo",
  "deal",
  "deals",
]);

const hashtagCandidates: HashtagCandidate[] = [
  { tag: "CustomerReviews", category: "broad", topics: ["customer_reviews", "customer_trust"] },
  { tag: "ReputationManagement", category: "broad", topics: ["reputation_management", "customer_trust"] },
  { tag: "LocalBusinessGrowth", category: "broad", topics: ["local_business_growth", "small_business_marketing"] },
  { tag: "CustomerTrust", category: "broad", topics: ["customer_trust", "customer_reviews"] },
  { tag: "OnlineVisibility", category: "broad", topics: ["online_visibility", "small_business_marketing"] },
  { tag: "SmallBusinessMarketing", category: "broad", topics: ["small_business_marketing", "local_business_growth"] },
  { tag: "ReviewAnalysis", category: "niche", topics: ["customer_reviews", "customer_trust"] },
  { tag: "ReviewStrategy", category: "niche", topics: ["customer_reviews", "reputation_management"] },
  { tag: "ReviewSignals", category: "niche", topics: ["customer_reviews", "customer_trust"] },
  { tag: "CustomerFeedback", category: "niche", topics: ["customer_reviews", "local_business_growth", "small_business_marketing"] },
  { tag: "OnlineReputation", category: "niche", topics: ["reputation_management", "online_visibility"] },
  { tag: "ReputationStrategy", category: "niche", topics: ["reputation_management"] },
  { tag: "ReviewManagement", category: "niche", topics: ["reputation_management"] },
  { tag: "TrustSignals", category: "niche", topics: ["customer_trust"] },
  { tag: "BusinessReputation", category: "niche", topics: ["reputation_management", "local_business_growth"] },
  { tag: "CustomerExperience", category: "niche", topics: ["customer_trust", "local_business_growth"] },
  { tag: "LocalSEO", category: "niche", topics: ["online_visibility", "local_business_growth"] },
  { tag: "SearchVisibility", category: "niche", topics: ["online_visibility"] },
  { tag: "SmallBusinessOwners", category: "audience", topics: ["small_business_marketing", "local_business_growth"] },
  { tag: "LocalBusinessOwners", category: "audience", topics: ["local_business_growth", "reputation_management", "online_visibility"] },
  { tag: "EcommerceSellers", category: "audience", topics: ["customer_reviews", "small_business_marketing"] },
  { tag: "ServiceBusiness", category: "audience", topics: ["reputation_management", "customer_trust"] },
  { tag: "RetailBusiness", category: "audience", topics: ["local_business_growth", "customer_reviews"] },
  { tag: "ReviewIntel", category: "branded", topics: ["customer_reviews", "reputation_management", "local_business_growth", "customer_trust", "online_visibility", "small_business_marketing"] },
  { tag: "BackToSchoolShopping", category: "timely", topics: ["customer_reviews", "customer_trust"], months: [7, 8] },
  { tag: "HolidayShopping", category: "timely", topics: ["customer_reviews", "customer_trust"], months: [11, 12] },
  { tag: "YearEndReviews", category: "timely", topics: ["reputation_management", "local_business_growth"], months: [12, 1] },
];

const candidateByTag = new Map(hashtagCandidates.map((candidate) => [candidate.tag.toLowerCase(), candidate]));

const reelThemes: Array<{
  id: string;
  topics: ReelDiscoveryTopic[];
  hook: string;
  support: string;
  thought: string;
  cta: string;
}> = [
  {
    id: "reviews-real-story",
    topics: ["customer_reviews"],
    hook: "Reviews reveal the real story.",
    support: "ReviewIntel turns repeated buyer signals into a clearer decision.",
    thought: "The rating is only the surface. The repeated review pattern is where the useful signal starts.",
    cta: "See how it works",
  },
  {
    id: "reputation-patterns",
    topics: ["reputation_management"],
    hook: "Your reputation has patterns.",
    support: "The right review signals can point to the next trust-building move.",
    thought: "Reputation management works better when customer feedback becomes specific action.",
    cta: "Grow with ReviewIntel",
  },
  {
    id: "local-growth",
    topics: ["local_business_growth"],
    hook: "Local growth starts with trust.",
    support: "Customer feedback can show what to fix, prove, and improve next.",
    thought: "Local businesses grow when the review story gets clearer for both teams and customers.",
    cta: "Learn more",
  },
  {
    id: "trust-signals",
    topics: ["customer_trust"],
    hook: "Trust lives in the details.",
    support: "ReviewIntel helps separate repeat signals from review noise.",
    thought: "Customer trust is built in the details buyers repeat, not only in the average rating.",
    cta: "See how it works",
  },
  {
    id: "visibility-proof",
    topics: ["online_visibility"],
    hook: "Visibility needs believable proof.",
    support: "Clear review signals make a stronger first impression online.",
    thought: "Online visibility is stronger when the trust proof behind it is easy to understand.",
    cta: "Learn more",
  },
  {
    id: "small-business-marketing",
    topics: ["small_business_marketing"],
    hook: "Marketing lands better with proof.",
    support: "Review patterns can sharpen the message customers already believe.",
    thought: "Small-business marketing gets cleaner when it is built from real customer feedback.",
    cta: "Grow with ReviewIntel",
  },
];

function seedNumber(seed: string) {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function seededIndex(seed: string, length: number, attempt = 0) {
  if (length <= 0) return 0;
  return Math.abs(seedNumber(`${seed}:${attempt}`)) % length;
}

export function normalizeHashtag(value: string) {
  return String(value || "").replace(/^#/, "").replace(/[^a-zA-Z0-9]/g, "").trim();
}

function hashtagKey(tags: string[]) {
  return tags.map(normalizeHashtag).filter(Boolean).map((tag) => tag.toLowerCase()).sort().join("|");
}

function isRelevantCandidate(candidate: HashtagCandidate, topic: ReelDiscoveryTopic, date: Date) {
  if (!candidate.topics.includes(topic)) return false;
  if (!candidate.months?.length) return true;
  return candidate.months.includes(date.getUTCMonth() + 1);
}

function rotateCandidates(
  category: HashtagCategory,
  topic: ReelDiscoveryTopic,
  seed: string,
  attempt: number,
  excluded: Set<string>,
  date: Date,
  count = 1
) {
  const candidates = hashtagCandidates.filter(
    (candidate) =>
      candidate.category === category &&
      isRelevantCandidate(candidate, topic, date) &&
      !excluded.has(candidate.tag.toLowerCase())
  );
  const selected: string[] = [];

  for (let index = 0; index < candidates.length && selected.length < count; index += 1) {
    const candidate = candidates[(seededIndex(seed, candidates.length, attempt + index) + index) % candidates.length];
    if (!candidate || selected.includes(candidate.tag)) continue;
    selected.push(candidate.tag);
    excluded.add(candidate.tag.toLowerCase());
  }

  return selected;
}

export function reelDiscoveryTopicForSocialTopic(topic: string, seed = ""): ReelDiscoveryTopic {
  const normalized = String(topic || "").toLowerCase();

  if (normalized === "seller_tips") return "reputation_management";
  if (normalized === "competitor_watch") return "online_visibility";
  if (normalized === "trust_signals") return "customer_trust";
  if (normalized === "buyer_mistakes") return "customer_reviews";
  if (normalized === "fake_review_warning") return "customer_trust";
  if (normalized === "shopper_tips") {
    return seedNumber(seed) % 2 === 0 ? "customer_reviews" : "customer_trust";
  }

  const topics: ReelDiscoveryTopic[] = [
    "customer_reviews",
    "reputation_management",
    "local_business_growth",
    "customer_trust",
    "online_visibility",
    "small_business_marketing",
  ];

  return topics[seededIndex(`${normalized}:${seed}`, topics.length)] || "customer_reviews";
}

export function scoreBalancedHashtagSet(input: {
  hashtags: string[];
  topic: ReelDiscoveryTopic;
  recentHashtagSets?: string[][];
}) {
  const tags = input.hashtags.map(normalizeHashtag).filter(Boolean);
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.toLowerCase())));
  const candidates = tags.map((tag) => candidateByTag.get(tag.toLowerCase()) || null);
  const knownCount = candidates.filter(Boolean).length;
  const relevantCount = candidates.filter(
    (candidate) => candidate && (candidate.category === "branded" || candidate.topics.includes(input.topic))
  ).length;
  const broadCount = candidates.filter((candidate) => candidate?.category === "broad").length;
  const audienceFit = candidates.some(
    (candidate) => candidate?.category === "audience" && candidate.topics.includes(input.topic)
  )
    ? 1
    : 0;
  const currentKey = hashtagKey(tags);
  const recentSets = (input.recentHashtagSets || []).map(hashtagKey).filter(Boolean);
  const exactRepeat = recentSets.includes(currentKey);
  const maxOverlap = Math.max(
    0,
    ...(input.recentHashtagSets || []).map((set) => {
      const recent = new Set(set.map((tag) => normalizeHashtag(tag).toLowerCase()).filter(Boolean));
      if (!recent.size || !uniqueTags.length) return 0;
      return uniqueTags.filter((tag) => recent.has(tag)).length / uniqueTags.length;
    })
  );
  const hasSpamTag = tags.some((tag) => bannedOrSpammyHashtags.has(tag.toLowerCase()));
  const hasUnknownTag = knownCount !== tags.length;
  const spamRisk = Math.min(
    1,
    (hasSpamTag ? 1 : 0) +
      (hasUnknownTag ? 0.45 : 0) +
      (broadCount > 1 ? 0.35 : 0) +
      (tags.length > reelOverlayLimits.hashtagsMax ? 0.35 : 0)
  );
  const topicalRelevance = tags.length ? relevantCount / tags.length : 0;
  const repetitionRisk = exactRepeat ? 1 : Math.min(0.95, maxOverlap * 0.75);
  const total = Math.max(
    0,
    Math.min(
      1,
      topicalRelevance * 0.45 +
        audienceFit * 0.25 +
        (1 - repetitionRisk) * 0.2 +
        (1 - spamRisk) * 0.1
    )
  );

  return {
    topicalRelevance,
    audienceFit,
    repetitionRisk,
    spamRisk,
    total,
  };
}

export function validateBalancedHashtagSet(input: {
  hashtags: string[];
  topic: ReelDiscoveryTopic;
  recentHashtagSets?: string[][];
}) {
  const hashtags = input.hashtags.map(normalizeHashtag).filter(Boolean);
  const lowerTags = hashtags.map((tag) => tag.toLowerCase());
  const errors: string[] = [];
  const categoryCounts: Record<HashtagCategory, number> = {
    broad: 0,
    niche: 0,
    audience: 0,
    branded: 0,
    timely: 0,
  };

  if (hashtags.length < reelOverlayLimits.hashtagsMin || hashtags.length > reelOverlayLimits.hashtagsMax) {
    errors.push("Hashtag count must be between 4 and 7.");
  }

  if (new Set(lowerTags).size !== lowerTags.length) {
    errors.push("Hashtags must be unique.");
  }

  for (const hashtag of hashtags) {
    const candidate = candidateByTag.get(hashtag.toLowerCase());
    if (!candidate) {
      errors.push(`#${hashtag} is not in the approved topical hashtag set.`);
      continue;
    }

    categoryCounts[candidate.category] += 1;
    if (candidate.category !== "branded" && !candidate.topics.includes(input.topic)) {
      errors.push(`#${hashtag} is not relevant for ${input.topic}.`);
    }
  }

  if (categoryCounts.broad !== 1) errors.push("Hashtag set must include exactly one broad discovery hashtag.");
  if (categoryCounts.niche < 2 || categoryCounts.niche > 3) errors.push("Hashtag set must include 2 to 3 niche hashtags.");
  if (categoryCounts.audience !== 1) errors.push("Hashtag set must include one audience-specific hashtag.");
  if (categoryCounts.branded !== 1 || !lowerTags.includes("reviewintel")) {
    errors.push("Hashtag set must include #ReviewIntel exactly once.");
  }

  const score = scoreBalancedHashtagSet(input);
  if (score.repetitionRisk >= 1) errors.push("Hashtag set repeats a recent full set.");
  if (score.topicalRelevance < 0.85) errors.push("Hashtag set is not topically relevant enough.");
  if (score.audienceFit < 1) errors.push("Hashtag set is missing audience fit.");
  if (score.spamRisk > 0) errors.push("Hashtag set has spam or promotion risk.");

  return {
    ok: errors.length === 0,
    errors,
    score,
    categoryCounts,
  };
}

export function selectBalancedReelHashtags(input: {
  socialTopic: string;
  seed: string;
  recentHashtagSets?: string[][];
  attempt?: number;
  date?: Date;
}): BalancedHashtagResult {
  const baseAttempt = Math.max(0, Math.floor(Number(input.attempt || 0)));
  const date = input.date || new Date();
  const topic = reelDiscoveryTopicForSocialTopic(input.socialTopic, input.seed);
  const recentHashtagSets = (input.recentHashtagSets || []).slice(0, 12);

  for (let attempt = baseAttempt; attempt < baseAttempt + 36; attempt += 1) {
    const excluded = new Set<string>();
    const seed = `${input.seed}:${topic}:${attempt}`;
    const broad = rotateCandidates("broad", topic, `${seed}:broad`, attempt, excluded, date, 1);
    const nicheCount = 2 + (seededIndex(`${seed}:niche-count`, 2, attempt) % 2);
    const niche = rotateCandidates("niche", topic, `${seed}:niche`, attempt, excluded, date, nicheCount);
    const audience = rotateCandidates("audience", topic, `${seed}:audience`, attempt, excluded, date, 1);
    const branded = rotateCandidates("branded", topic, `${seed}:branded`, attempt, excluded, date, 1);
    const timely =
      seededIndex(`${seed}:timely`, 3, attempt) === 0
        ? rotateCandidates("timely", topic, `${seed}:timely`, attempt, excluded, date, 1)
        : [];
    const hashtags = [...broad, ...niche, ...audience, ...branded, ...timely];
    const validation = validateBalancedHashtagSet({ hashtags, topic, recentHashtagSets });

    if (validation.ok) {
      return {
        hashtags,
        topic,
        score: validation.score,
      };
    }
  }

  throw new Error("Could not create a balanced non-repeating hashtag set.");
}

function extractUrls(value: string) {
  return String(value || "").match(/https?:\/\/[^\s)]+/gi) || [];
}

function containsDisallowedRawUrl(value: string, allowedUrls: string[]) {
  const allowed = new Set(allowedUrls.filter(Boolean).map((url) => url.replace(/\/$/, "")));

  return extractUrls(value).some((url) => {
    const clean = url.replace(/[.,;:!?]+$/, "").replace(/\/$/, "");
    return !allowed.has(clean);
  });
}

function hasVideoOverlayUrl(value: string) {
  return /https?:\/\//i.test(value) || /\b[a-z0-9.-]+\.(com|net|org|io|ai|co)\b/i.test(value);
}

export function isAffiliateRelevantForSocialTopic(topic: string) {
  return ["shopper_tips", "buyer_mistakes", "fake_review_warning"].includes(String(topic || "").toLowerCase());
}

export function buildMinimalReelContentPlan(input: {
  socialTopic: string;
  queueDay: number;
  cycleNumber: number;
  sourceImageId: string;
  websiteUrl: string;
  websiteShortUrl: string;
  affiliateUrl: string;
  affiliateShortUrl: string;
  recentHashtagSets?: string[][];
  attempt?: number;
  date?: Date;
}): MinimalReelContentPlan {
  const seed = [
    input.socialTopic,
    input.queueDay,
    input.cycleNumber,
    input.sourceImageId,
    input.attempt || 0,
  ].join(":");
  const hashtagResult = selectBalancedReelHashtags({
    socialTopic: input.socialTopic,
    seed,
    recentHashtagSets: input.recentHashtagSets,
    attempt: input.attempt,
    date: input.date,
  });
  const themePool = reelThemes.filter((theme) => theme.topics.includes(hashtagResult.topic));
  const theme = themePool[seededIndex(`${seed}:theme`, themePool.length || reelThemes.length)] || reelThemes[0];
  const affiliateRelevant = isAffiliateRelevantForSocialTopic(input.socialTopic);
  const captionLines = [
    theme.thought,
    "",
    `${theme.cta}: ${input.websiteShortUrl}`,
  ];

  if (affiliateRelevant) {
    captionLines.push(`Helpful review tools: ${input.affiliateShortUrl}`);
  }

  const plan: MinimalReelContentPlan = {
    caption: captionLines.join("\n"),
    hashtags: hashtagResult.hashtags,
    websiteUrl: input.websiteUrl,
    websiteShortUrl: input.websiteShortUrl,
    affiliateUrl: input.affiliateUrl,
    affiliateShortUrl: input.affiliateShortUrl,
    affiliateRelevant,
    cta: theme.cta,
    theme: theme.thought,
    overlayHook: theme.hook,
    overlaySupport: theme.support,
    overlayCta: theme.cta,
    discoveryTopic: hashtagResult.topic,
    hashtagScore: hashtagResult.score,
  };
  const validation = validateMinimalReelContentPlan(plan);

  if (!validation.ok) {
    throw new Error(`Generated Reel content failed validation: ${validation.errors.join(" ")}`);
  }

  return plan;
}

export function formatMinimalReelCaption(plan: MinimalReelContentPlan) {
  return `${plan.caption}\n\n#${plan.hashtags.join(" #")}`;
}

export function parseHashtagsFromCaption(caption: string) {
  return Array.from(String(caption || "").matchAll(/#([a-zA-Z0-9]+)/g))
    .map((match) => normalizeHashtag(match[1]))
    .filter(Boolean);
}

export function validateMinimalReelContentPlan(plan: MinimalReelContentPlan) {
  const errors: string[] = [];
  const overlayParts = [plan.overlayHook, plan.overlaySupport, plan.overlayCta];

  if (!plan.overlayHook || plan.overlayHook.length > reelOverlayLimits.hook) {
    errors.push(`Overlay hook must be ${reelOverlayLimits.hook} characters or fewer.`);
  }
  if (plan.overlaySupport && plan.overlaySupport.length > reelOverlayLimits.support) {
    errors.push(`Overlay support text must be ${reelOverlayLimits.support} characters or fewer.`);
  }
  if (!plan.overlayCta || plan.overlayCta.length > reelOverlayLimits.cta) {
    errors.push(`Overlay CTA must be ${reelOverlayLimits.cta} characters or fewer.`);
  }
  if (overlayParts.some((part) => /#[a-zA-Z0-9]+/.test(part))) {
    errors.push("Video overlay must not contain hashtags.");
  }
  if (overlayParts.some(hasVideoOverlayUrl)) {
    errors.push("Video overlay must not contain URLs.");
  }
  if (plan.caption.length > reelOverlayLimits.caption) {
    errors.push(`Caption body must be ${reelOverlayLimits.caption} characters or fewer before hashtags.`);
  }
  if (/#\w+/.test(plan.caption)) {
    errors.push("Hashtags must be placed only at the end of the formatted caption.");
  }
  if (containsDisallowedRawUrl(plan.caption, [plan.websiteShortUrl, plan.affiliateShortUrl])) {
    errors.push("Caption must use only approved short branded links.");
  }
  if (containsDisallowedRawUrl(overlayParts.join(" "), [])) {
    errors.push("Video overlay must not render raw URLs.");
  }

  const hashtagValidation = validateBalancedHashtagSet({
    hashtags: plan.hashtags,
    topic: plan.discoveryTopic,
  });
  if (!hashtagValidation.ok) {
    errors.push(...hashtagValidation.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
