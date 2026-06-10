const METADATA_REPLACEMENTS: RegExp[] = [
  /\b\d+\s+(?:person|people)\s+found\s+this\s+helpful\b/gi,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:person|people)\s+found\s+this\s+helpful\b/gi,
  /\bhelpful\s+report\b/gi,
  /\btranslate\s+review\s+to\s+english\b/gi,
  /\bverified\s+purchase\b/gi,
  /\bverified\s+buyer\b/gi,
  /\bvine\s+customer\s+review\s+of\s+free\s+product\b/gi,
  /\bcustomer\s+review\s+of\s+free\s+product\b/gi,
  /\breport\s+abuse\b/gi,
  /\breviewed\s+in\s+[a-z\s]+?\s+on\s+[a-z]+\s+\d{1,2}(?:,\s+\d{4})?\b/gi,
  /\breviewed\s+on\s+[a-z]+\s+\d{1,2}(?:,\s+\d{4})?\b/gi,
  /\breviewed\s+in\s+[a-z\s]+?\s+on\s+\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/gi,
  /\b(?:colour|color)\s+name\s*:\s*[^|.;\n]+/gi,
  /\bsize\s*:\s*[^|.;\n]+/gi,
  /\bstyle\s*:\s*[^|.;\n]+/gi,
  /\bpattern\s+name\s*:\s*[^|.;\n]+/gi,
  /\breview\s+\d+\s*[:|-]?\s*\|?/gi,
  /\breview\s*#\d+\s*[:|-]?/gi
];

const LOW_VALUE_PHRASES = [
  "helpful",
  "report",
  "translate",
  "verified purchase",
  "reviewed in",
  "customer review of free product",
  "vine customer review",
  "colour name",
  "color name"
];

const USEFUL_SIGNAL_WORDS = [
  "fit",
  "fits",
  "quality",
  "durable",
  "durability",
  "broken",
  "refund",
  "return",
  "support",
  "shipping",
  "packaging",
  "price",
  "value",
  "easy",
  "works",
  "protect",
  "comfort",
  "battery",
  "leak",
  "size",
  "material",
  "instructions",
  "customer",
  "buyer"
];

const NON_ENGLISH_FRAGMENT_PATTERNS = [
  /\btr[eè]s\b/i,
  /\bqualit[eé]\b/i,
  /\bqualit[eé]-prix\b/i,
  /\brapport\s+qualit[eé]\s*[- ]?\s*prix\b/i,
  /\bbon\s+rapport\b/i,
  /\bproduit\b/i,
  /\blivraison\b/i,
  /\bemballage\b/i,
  /\bmerci\b/i
];

const LANGUAGE_NORMALIZATIONS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\btr[eè]s\s+bon\s+rapport\s+qualit[eé]\s*[- ]?\s*prix\b/gi,
    replacement: "strong price-to-quality value"
  },
  {
    pattern: /\bbon\s+rapport\s+qualit[eé]\s*[- ]?\s*prix\b/gi,
    replacement: "price-to-quality value"
  },
  {
    pattern: /\bqualit[eé]\s*[- ]?\s*prix\b/gi,
    replacement: "price-to-quality value"
  }
];

const SELLER_THEME_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "fit and compatibility clarity", pattern: /\b(fit|fits|fitting|size|sizing|compatible|compatibility|model|macbook|case|port|cutout|screen size)\b/i },
  { label: "price-to-quality value proof", pattern: /\b(price|value|worth|budget|affordable|expensive|cost|quality-price|qualit[eé]-prix|rapport)\b/i },
  { label: "durability and long-term reliability proof", pattern: /\b(durable|durability|sturdy|weak|broke|broken|defect|stopped|scratch|scratches|leak|leaking|motor|seal|lid)\b/i },
  { label: "packaging and unboxing expectation", pattern: /\b(packaging|package|box|plastic|wrap|wrapped|bag|unboxing|dented|crushed)\b/i },
  { label: "material quality perception", pattern: /\b(quality|qualit[eé]|material|shell|finish|premium|cheap)\b/i },
  { label: "shipping and delivery reliability", pattern: /\b(shipping|delivery|late|arrived|carrier|shipment)\b/i },
  { label: "support, returns, and warranty confidence", pattern: /\b(support|service|seller|refund|return|replacement|warranty|contact)\b/i },
  { label: "setup and instruction clarity", pattern: /\b(instruction|instructions|manual|setup|install|installation|easy|difficult|hard)\b/i },
  { label: "included accessories and bundle clarity", pattern: /\b(adapter|included|missing|bundle|accessory|accessories|keyboard|template)\b/i },
  { label: "real-use performance proof", pattern: /\b(works|performance|protect|protection|comfort|battery|daily use|heavy use|office|travel)\b/i }
];

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripMetadata(value: string) {
  let clean = value.replace(/<[^>]*>/g, " ").replace(/https?:\/\/\S+/g, " ");

  for (const pattern of METADATA_REPLACEMENTS) {
    clean = clean.replace(pattern, " ");
  }

  for (const item of LANGUAGE_NORMALIZATIONS) {
    clean = clean.replace(item.pattern, item.replacement);
  }

  return clean
    .split(/\s*(?:\||•|\n|\t)\s*/)
    .map((part) => part.trim())
    .filter((part) => part && !isMetadataFragment(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, "")
    .trim();
}

function isMetadataFragment(value: string) {
  const lower = value.trim().toLowerCase();
  if (!lower) return true;
  if (/^(helpful|report|share|permalink|translate|verified|verified purchase)$/i.test(lower)) return true;
  if (/^(review|reviews?|customer review|rating|stars?|date|profile name|country)$/i.test(lower)) return true;
  if (/^(yes|no|true|false|null|n\/a|na)$/i.test(lower)) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(lower)) return true;
  if (/^\d+(?:\.\d+)?\s*(?:out of\s*)?5\s*stars?$/i.test(lower)) return true;
  if (/^[\d\s.,$%:/#-]+$/.test(lower) && lower.length < 28) return true;
  if (/^\d+\s+(?:person|people)\s+found/i.test(lower)) return true;
  if (LOW_VALUE_PHRASES.some((phrase) => lower === phrase)) return true;
  if (/\breview\s+\d+\b/i.test(lower)) return true;
  if (/\btranslate\s+review\b/i.test(lower)) return true;
  if (/\breviewed\s+in\b|\breviewed\s+on\b/i.test(lower)) return true;
  if (/\bfound\s+this\s+helpful\b/i.test(lower)) return true;
  return false;
}

function hasNonEnglishFragment(value: string) {
  return NON_ENGLISH_FRAGMENT_PATTERNS.some((pattern) => pattern.test(value));
}

function isRawMarketplaceScrap(value: string) {
  const lower = value.toLowerCase();
  if (/\breview\s+\d+\b|\bfound\s+this\s+helpful\b|\btranslate\s+review\b|\breviewed\s+in\b/i.test(lower)) return true;
  const separators = (value.match(/\|/g) ?? []).length;
  if (separators >= 2) return true;
  if (hasNonEnglishFragment(value) && value.split(/\s+/).length <= 18) return true;
  return false;
}

export function isLowQualityReviewInsight(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return true;

  const clean = stripMetadata(raw);
  if (!clean || clean.length < 8) return true;

  const rawKey = normalizeKey(raw);
  const cleanKey = normalizeKey(clean);
  const lowValueHits = LOW_VALUE_PHRASES.filter((phrase) => rawKey.includes(phrase.replace(/\s+/g, " "))).length;
  const hasUsefulSignal = USEFUL_SIGNAL_WORDS.some((word) => cleanKey.includes(word));

  if (lowValueHits >= 2 && !hasUsefulSignal) return true;
  if (/^(review\s*)?\d+$/i.test(clean)) return true;
  if (/^(no|none|n\/a)$/i.test(clean)) return true;
  return false;
}

export function cleanReviewInsightText(value: string | undefined, fallback = "") {
  const raw = value?.trim() ?? "";
  if (!raw) return fallback;

  const clean = stripMetadata(raw);
  if (!clean || isLowQualityReviewInsight(clean) || isRawMarketplaceScrap(clean)) return fallback;

  return clean;
}

export function sanitizeInsightList(items: Array<string | undefined>, fallback: string[] = [], limit = 6) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of [...items, ...fallback]) {
    const clean = cleanReviewInsightText(item);
    if (!clean) continue;

    const key = normalizeKey(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(clean.replace(/\.$/, ""));
    if (output.length >= limit) break;
  }

  return output;
}

export function sanitizeModelReviewText(value: string) {
  return value
    .split(/\n+/)
    .map((line) => stripMetadata(line))
    .filter((line) => line && !isLowQualityReviewInsight(line))
    .join("\n")
    .trim();
}

export function sellerFriendlyTheme(value: string | undefined, fallback = "not enough clean review evidence") {
  const raw = value?.trim() ?? "";
  if (!raw) return fallback;

  const clean = stripMetadata(raw).replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  if (!clean || isMetadataFragment(clean)) return fallback;

  for (const rule of SELLER_THEME_RULES) {
    if (rule.pattern.test(clean)) return rule.label;
  }

  if (isRawMarketplaceScrap(clean) || isLowQualityReviewInsight(clean)) return fallback;

  const firstClause = clean.split(/[.;:]/)[0]?.trim() || clean;
  return firstClause.toLowerCase();
}

export function sanitizeSellerInsightList(items: Array<string | undefined>, fallback: string[] = [], limit = 6) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of [...items, ...fallback]) {
    const theme = sellerFriendlyTheme(item);
    if (!theme || theme === "not enough clean review evidence") continue;

    const key = normalizeKey(theme);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(theme.replace(/\.$/, ""));
    if (output.length >= limit) break;
  }

  if (output.length) return output;

  return fallback.length
    ? sanitizeInsightList(fallback, ["Not enough clean review evidence"], limit)
    : ["Not enough clean review evidence"];
}
