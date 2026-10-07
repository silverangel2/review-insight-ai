export type ProductIdentityTokenRoles = {
  primaryBrand: string | null;
  manufacturerOrParent: string | null;
  primaryProductFamily: string[];
  primaryModels: string[];
  primaryVariants: string[];
  capacityOrSize: string[];
  colors: string[];
  categoryBreadcrumbs: string[];
  compatibleWith: string[];
  accessoryModels: string[];
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  marketingText: string[];
  specifications: string[];
};

const MODEL_TOKEN = /(?<![A-Za-z0-9])(?:[A-Za-z]+\d[A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)*|\d+[A-Za-z]+[A-Za-z0-9-]*)(?![A-Za-z0-9])/g;
const MODEL_MARKER = /\b(?:xxl|xl|mini|pro|max|plus)\b/gi;
const SPECIFICATION = /\b(?:\d[\d,]*(?:\.\d+)?\s*-?\s*(?:pa|kpa|mah|wh|kw|w|v|days?|hours?|hrs?)\b|ip\d{2,3}\b|(?:19|20)\d{2}\b|ultra[- ]thin\b|\d+-in-\d+\b)/gi;
const COMPATIBILITY_CONTEXT = /(?:compatible\s+with|works\s+with|requires|supports|homebase|accessory|optional)\b([^.;,)]*)/gi;
const MARKETING_WORDS = new Set([
  "premium", "smart", "new", "latest", "best", "official", "amazon", "choice",
  "healthy", "digital", "touchscreen", "battery", "powered", "dual",
  "camera", "cameras", "wireless", "portable", "rechargeable", "protection",
  "ultra", "thin", "sleep", "fitness", "health", "tracking", "tracker",
  "for", "with", "and", "the", "of", "to", "featuring", "compatible",
]);
const VARIANT_WORDS = new Set([
  "battery", "powered", "wired", "wireless", "dual", "camera", "cameras", "black",
  "white", "blue", "red", "silver", "gold", "mini", "plus", "max", "pro", "ultra",
]);

function text(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9.%+-]+/g, " ").replace(/\s+/g, " ").trim();
}

function modelTokens(value: unknown) {
  const source = text(value).replace(SPECIFICATION, " ");
  return Array.from(new Set([
    ...(source.match(MODEL_TOKEN) || []),
    ...(source.match(MODEL_MARKER) || []),
  ]));
}

function numericToken(token: string) {
  return /^\d+(?:\.\d+)?$/.test(token) || /^\d+(?:\.\d+)?(?:\.\d+)?$/.test(token);
}

function compatibilityTokens(value: unknown) {
  const source = text(value);
  const output = new Set<string>();
  for (const match of source.matchAll(COMPATIBILITY_CONTEXT)) {
    for (const token of modelTokens(match[1] || "")) output.add(token.toUpperCase());
  }
  return output;
}

function parseNumber(value: unknown) {
  const match = text(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function stableWords(value: unknown) {
  return normalized(value).split(" ").filter((word) => word.length >= 3 && !MARKETING_WORDS.has(word));
}


function derivedNamedModelPhrase(productName: unknown, brand: unknown) {
  const source = text(productName);
  const brandText = text(brand);

  if (!source || !brandText) return null;

  const sourceTokens = source.split(/\s+/).filter(Boolean);
  const brandTokens = normalized(brandText)
    .split(" ")
    .filter(Boolean);

  if (!brandTokens.length) return null;

  let start = 0;

  for (const brandToken of brandTokens) {
    const current = normalized(sourceTokens[start] || "");

    if (current !== brandToken) {
      return null;
    }

    start += 1;
  }

  const stopWords = new Set([
    // Product categories / generic descriptors.
    "smart",
    "ring",
    "rings",

    // Appliance configuration/descriptors are product-family context,
    // never named model identity.
    "front",
    "top",
    "load",
    "electric",
    "gas",
    "robot",
    "vacuum",
    "mop",
    "cleaner",
    "dryer",
    "washer",
    "airfryer",
    "fryer",
    "cooker",
    "camera",
    "doorbell",
    "speaker",
    "headphones",
    "headphone",
    "monitor",
    "television",
    "tv",
    "laptop",
    "tablet",
    "phone",
    "smartphone",
    "product", "countertop", "cordless", "bluetooth", "pressure",
    "power", "station", "generator", "security", "video", "basket",
    "for", "with", "featuring", "compatible", "ultra",

    // Specification / marketing boundaries.
    "ai",
    "artificial",
    "intelligence",
    "ultra thin",
    "battery",
    "powered",
    "wireless",
    "portable",
    "rechargeable",
    "protection",
    "waterproof",
    "sleep",
    "fitness",
    "health",
    "tracking",
    "tracker",
    "ultra-thin",
    "thin",
  ]);

  const phrase: string[] = [];

  for (let i = start; i < sourceTokens.length; i += 1) {
    const raw = sourceTokens[i];
    const token = normalized(raw);

    if (!token) continue;

    // Years and ordinary specification values do not belong to the model.
    if (/^(?:19|20)\d{2}$/.test(token) || raw === "|") break;

    if (
      /^\d+(?:\.\d+)?-?(?:day|days|hour|hours|hr|hrs)$/i.test(token) ||
      /^ip\d{2,3}$/i.test(token) ||
      /^\d[\d,]*(?:\.\d+)?(?:pa|kpa|mah|wh|w|v|gb|tb|ml|oz|qt|lb|kg|cm|mm)$/i.test(token)
    ) {
      break;
    }

    if (
      stopWords.has(token) ||
      MARKETING_WORDS.has(token)
    ) {
      break;
    }

    phrase.push(raw.replace(/[,:;]+$/, ""));

    // Product model names should remain bounded. This is deliberately
    // conservative so marketing copy cannot become identity.
    if (phrase.length >= 5) break;
  }

  if (!phrase.length) return null;

  const joined = phrase.join(" ").trim();

  // A single ordinary word is more likely a family/category than a model.
  // Multi-word names such as "Gen 2 Air" and "Qrevo S Pro" are useful
  // identity phrases.
  const hasDigit = /\d/.test(joined);

  if (phrase.length < 2 && !hasDigit) {
    return null;
  }

  return joined;
}

export function extractProductIdentityTokenRoles(input: {
  brand?: string | null;
  productName?: string | null;
  model?: string | null;
  productKey?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  color?: string | null;
  categoryBreadcrumbs?: string[];
  marketingText?: string[];
  compatibilityText?: string[];
}): ProductIdentityTokenRoles {
  const rawTitle = text(input.productName);
  const capacityPattern = /\b\d+(?:\.\d+)?\s*(?:cu\.?\s*ft\.?|cubic\s+feet|ml|oz|inch(?:es)?|cm|mm|gb|tb|quarts?|qts?|pounds?|lbs?|kg|gal(?:lons?)?|lit(?:er|re)s?)\b\.?/gi;
  const capacityOrSize = Array.from(new Set((rawTitle.match(capacityPattern) || []).map((v) => text(v).toLowerCase().replace(/cubic\s+feet|cu\.?\s*ft\.?/i, "cu. ft."))));
  const specifications = Array.from(new Set(rawTitle.match(SPECIFICATION) || []));
  const title = rawTitle
    .replace(/[$£€]\s*\d[\d,.]*/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:out of\s*5|stars?|ratings?|reviews?)\b/gi, " ")
    .replace(/\b(?:rating|price|review count|sales rank)\s*[:=]?\s*#?\d[\d,.]*/gi, " ");
  const stableTitle = title.replace(SPECIFICATION, " ").replace(COMPATIBILITY_CONTEXT, " ");
  const modelField = text(input.model).replace(SPECIFICATION, " ").trim();
  const key = text(input.productKey);
  const allText = [title, modelField, key, ...(input.compatibilityText || [])].filter(Boolean).join(" ");
  const compatibility = compatibilityTokens(allText);
  const allModels = Array.from(new Set(modelTokens(allText.replace(capacityPattern, " ")).map((token) => token.toUpperCase())))
    .filter((token) => !numericToken(token));
  const titleModels = new Set(modelTokens((stableTitle || key).replace(capacityPattern, " ")).map((token) => token.toUpperCase()));
  const primaryModels = allModels.filter((token) => titleModels.has(token) && !compatibility.has(token));
  const secondaryModels = allModels.filter((token) => !primaryModels.includes(token));

  // If there is no explicit model field, derive a bounded named model
  // phrase from the product title before allowing numeric/spec fragments
  // such as "10-Day" or "IP68" to masquerade as model identity.
  const derivedModel = modelField
    ? null
    : derivedNamedModelPhrase(
        title.replace(capacityPattern, " ").replace(SPECIFICATION, " | "),
        input.brand,
      );

  // If a model field contains several codes but only one appears in the
  // recognized product title, the title-bearing code is the product model;
  // the remaining codes are compatibility/accessory context, not identity.
  const explicitModels = modelTokens(modelField).filter((token) => !compatibility.has(token.toUpperCase()));
  const explicitPhrase = modelField && !/^(?:pro|max|plus|ultra|new|front load electric)$/i.test(modelField)
    && (explicitModels.length === 1 || /^\D+\s+\d+(?:\s+\D+)?$/.test(modelField)
      || (explicitModels.length === 0 && /^[a-z][a-z0-9]*(?:[-_/][a-z0-9]+)+$/i.test(modelField))
      || (explicitModels.length === 0 && /^[a-z]+(?:[ -][a-z]+){1,4}$/i.test(modelField)
        && derivedNamedModelPhrase(`${text(input.brand)} ${modelField}`, input.brand)))
    ? modelField.toUpperCase()
    : null;
  const finalPrimaryModels = explicitPhrase
    ? [explicitPhrase]
    : derivedModel
    ? [derivedModel.toUpperCase()]
    : primaryModels.length
      ? primaryModels
      : allModels
          .filter((token) => !compatibility.has(token))
          .slice(0, 1);

  const finalSecondaryModels = Array.from(new Set([...secondaryModels, ...compatibility])).filter(
    (token) => !finalPrimaryModels.some((model) => normalized(model).includes(normalized(token))),
  );

  const brandWords = stableWords(input.brand);
  const titleWords = normalized(stableTitle.replace(capacityPattern, " ")).split(" ").filter((word) => word.length >= 3);
  const manufacturerOrParent = normalized(input.brand) || null;
  // An explicit upstream brand is authoritative. Never replace it with
  // the next product-title token (for example RingConn -> "gen").
  // Secondary title tokens belong to product family/model context, not brand.
  const primaryBrand = manufacturerOrParent;

  const excluded = new Set([
    ...brandWords,
    ...(primaryBrand ? [primaryBrand] : []),
    ...finalPrimaryModels.flatMap((model) =>
      normalized(model).split(" ").filter(Boolean),
    ),
    ...finalSecondaryModels.flatMap((model) =>
      normalized(model).split(" ").filter(Boolean),
    ),
    ...VARIANT_WORDS,
  ]);
  const primaryProductFamily = titleWords.filter((word) => !excluded.has(word) && !numericToken(word) && !MARKETING_WORDS.has(word)).slice(0, 6);
  const modelWords = new Set(finalPrimaryModels.flatMap((model) => normalized(model).split(" ")));
  const primaryVariants = titleWords.filter((word) => VARIANT_WORDS.has(word) && !modelWords.has(word)).slice(0, 6);

  return {
    primaryBrand: primaryBrand || null,
    manufacturerOrParent,
    primaryProductFamily,
    primaryModels: finalPrimaryModels,
    primaryVariants,
    capacityOrSize,
    colors: Array.from(new Set([text(input.color).toLowerCase(), ...titleWords.filter((word) => ["white", "black", "blue", "red", "silver", "gold", "gray", "grey"].includes(word))].filter(Boolean))),
    categoryBreadcrumbs: input.categoryBreadcrumbs || [],
    compatibleWith: finalSecondaryModels,
    accessoryModels: finalSecondaryModels,
    price: parseNumber(input.price),
    rating: parseNumber(input.rating),
    reviewCount: parseNumber(input.reviewCount),
    marketingText: [...titleWords.filter((word) => MARKETING_WORDS.has(word)), ...(input.marketingText || [])],
    specifications,
  };
}

export function stableProductSearchTerms(input: Parameters<typeof extractProductIdentityTokenRoles>[0]) {
  const roles = extractProductIdentityTokenRoles(input);
  return {
    roles,
    brands: Array.from(new Set([roles.primaryBrand, roles.manufacturerOrParent].filter(Boolean))) as string[],
    family: roles.primaryProductFamily.join(" "),
    models: roles.primaryModels,
    variants: roles.primaryVariants,
  };
}
