/**
 * Product identity: canonical marketplace keying with variant separation.
 *
 * The library's key space is `marketplace:identifier` (see
 * lib/productReviewLibrary.ts `libraryProductKeyFor`). This module is the
 * identity authority in front of it: it parses marketplace product links
 * into that key, strips tracking/variant query noise, and extracts variant
 * attributes (color/size/model) SEPARATELY so evidence stays attributable
 * per variant.
 *
 * Why variants are separate: a past live defect surfaced a pink-variant
 * quote on the black product's result page — variant evidence pooled
 * without attribution. Variants of one product share the canonical key for
 * identity, but every sorted record carries its variant attribution so
 * downstream rendering can keep them apart.
 *
 * Deterministic, zero OpenAI, zero network.
 */

export type VariantAttributes = {
  color?: string | null;
  size?: string | null;
  model?: string | null;
  style?: string | null;
  /** Non-tracking query params that were kept (source of truth for odd shapes). */
  raw: Record<string, string>;
};

export type ParsedProductLink =
  | {
      ok: true;
      /** Normalized marketplace host, e.g. "amazon.ca". */
      marketplace: string;
      /** Canonical identifier: ASIN / SKU / item number, uppercased. */
      identifier: string;
      /** The library key space: "marketplace:identifier". */
      canonicalKey: string;
      variant: VariantAttributes;
      /** The same URL with tracking params stripped. */
      cleanedUrl: string;
    }
  | {
      ok: false;
      reason: string;
      input: string;
    };

export type IdentityVerdict = "same_product" | "same_product_different_variant" | "different_product";

export type IdentityDecision = {
  verdict: IdentityVerdict;
  /** Machine-readable reason, e.g. "same_marketplace_identifier". */
  reason: string;
};

/** Query params that never identify the product — always stripped. */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "ref", "ref_", "reftag", "srs", "qid", "sr", "keywords", "sprefix",
  "th", "psc", "smid", "colid", "coliid", "me", "aaxitk", "cv_ct_id",
  "dchild", "ve", "smt", "creative", "camp", "adid", "gclid", "fbclid",
  "msclkid", "mc", "nic", "nid", "ni", "_encoding", "pd_rd_r", "pd_rd_w",
  "pd_rd_wg", "linkcode", "tag", "ascsubtag", "mkevt", "mkcid", "mkrid",
  "campid", "toolid", "customid", "affid", "afftrack", "ranmid", "raneta",
  "ran_site_id", "t", "psc", "crid", "dib", "dib_tag", "pf", "pf_rd_p",
  "pf_rd_r", "pf_rd_s", "pf_rd_t", "pf_rd_i", "pf_rd_m", "ufe",
  "tcref", "tcin", "intl", "skuid",
]);

/** Query params that may name a variant — extracted, never dropped silently. */
const VARIANT_PARAMS: Record<string, "color" | "size" | "model" | "style"> = {
  color: "color",
  colour: "color",
  size: "size",
  model: "model",
  style: "style",
  variant: "style",
};

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

/**
 * Canonical library key — must match lib/productReviewLibrary.ts
 * `libraryProductKeyFor` exactly: lowercase www-stripped marketplace,
 * uppercased identifier, joined with ":".
 */
export function canonicalKey(marketplace: string, identifier: string): string {
  const mp = String(marketplace ?? "").toLowerCase().replace(/^www\./, "");
  const id = String(identifier ?? "").toUpperCase();
  return `${mp}:${id}`;
}

type Extractor = (url: URL, path: string) => string | null;

function amazonIdentifier(url: URL, path: string): string | null {
  const m =
    path.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    path.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    path.match(/\/gp\/aw\/d\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    path.match(/\/exec\/obidos\/ASIN\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function walmartIdentifier(url: URL, path: string): string | null {
  // /ip/<slug>/<numeric-id> or /ip/<numeric-id>
  const segs = path.split("/").filter(Boolean);
  const ipAt = segs.findIndex((s) => s.toLowerCase() === "ip");
  if (ipAt < 0) return null;
  const tail = segs.slice(ipAt + 1).reverse();
  const numeric = tail.find((s) => /^\d{5,}$/.test(s));
  if (numeric) return numeric;
  const last = tail[0];
  return last && /^[A-Za-z0-9_-]{4,64}$/.test(last) ? last.toUpperCase() : null;
}

function bestbuyIdentifier(url: URL, path: string): string | null {
  // bestbuy.com: /site/<slug>/J79234567.p?skuId=...  — path carries the J-sku.
  const jm = path.match(/\/(J[A-Z0-9]{6,})(?:[./?]|$)/i);
  if (jm) return jm[1].toUpperCase();
  // bestbuy.ca: /en-ca/product/<slug>/J12345678 or .../10426413
  const q = url.searchParams.get("skuId");
  if (q && /^\d{5,}$/.test(q)) return q;
  const segs = path.split("/").filter(Boolean);
  const tail = [...segs].reverse().find((s) => /^\d{5,}$/.test(s));
  return tail || null;
}

function targetIdentifier(url: URL, path: string): string | null {
  // /p/<slug>/-/A-12345678
  const m = path.match(/\/A-(\d{5,})(?:[/?]|$)/i);
  return m ? m[1] : null;
}

function homedepotIdentifier(url: URL, path: string): string | null {
  // /p/<slug>/<9-10 digit store sku>
  const segs = path.split("/").filter(Boolean);
  const pAt = segs.findIndex((s) => s.toLowerCase() === "p");
  if (pAt < 0) return null;
  const tail = segs.slice(pAt + 1).reverse();
  const numeric = tail.find((s) => /^\d{8,}$/.test(s));
  return numeric || null;
}

type MarketplaceShape = {
  match: (host: string) => boolean;
  name: (host: string) => string;
  extract: Extractor;
};

const SHAPES: MarketplaceShape[] = [
  {
    match: (h) => /(^|\.)amazon\.[a-z.]+$/.test(h),
    name: (h) => h,
    extract: amazonIdentifier,
  },
  {
    match: (h) => /(^|\.)walmart\.(com|ca)$/.test(h),
    name: (h) => h,
    extract: walmartIdentifier,
  },
  {
    match: (h) => /(^|\.)bestbuy\.(com|ca)$/.test(h),
    name: (h) => h,
    extract: bestbuyIdentifier,
  },
  {
    match: (h) => /(^|\.)target\.com$/.test(h),
    name: (h) => h,
    extract: targetIdentifier,
  },
  {
    match: (h) => /(^|\.)homedepot\.com$/.test(h),
    name: (h) => h,
    extract: homedepotIdentifier,
  },
];

function normalizeVariantValue(value: string): string {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse a marketplace product link into its canonical identity.
 * Returns { ok: false, reason } for non-product links, unsupported
 * marketplaces, or links whose identifier cannot be found — never a guess.
 */
export function parseProductLink(link: unknown): ParsedProductLink {
  const input = String(link ?? "").trim();
  if (!input) return { ok: false, reason: "empty_link", input };
  let url: URL;
  try {
    url = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: "not_a_url", input };
  }
  const host = cleanHost(url.hostname);
  const shape = SHAPES.find((s) => s.match(host));
  if (!shape) return { ok: false, reason: "unsupported_marketplace", input };
  const marketplace = shape.name(host);
  const identifier = shape.extract(url, url.pathname);
  if (!identifier) return { ok: false, reason: "no_identifier_in_url", input };

  // Strip tracking params; keep variant + unknown-but-kept params.
  const kept = new URLSearchParams();
  const variant: VariantAttributes = { raw: {} };
  for (const [key, value] of url.searchParams) {
    const lower = key.toLowerCase();
    const slot = VARIANT_PARAMS[lower];
    if (slot) {
      const normalized = normalizeVariantValue(value);
      if (normalized) {
        if (!variant[slot]) variant[slot] = normalized;
        variant.raw[lower] = normalized;
      }
      kept.set(key, value);
      continue;
    }
    if (TRACKING_PARAMS.has(lower)) continue;
    kept.set(key, value);
    variant.raw[lower] = value;
  }
  // Amazon buries /ref=... in the path — cut it; the identifier is enough.
  const cleanPath = url.pathname.replace(/\/ref=[^/?]*/i, "");
  const query = kept.toString();
  const cleanedUrl = `${url.protocol}//${url.hostname}${cleanPath}${query ? `?${query}` : ""}`;

  return {
    ok: true,
    marketplace,
    identifier,
    canonicalKey: canonicalKey(marketplace, identifier),
    variant,
    cleanedUrl,
  };
}

function variantAttrsDiffer(a: VariantAttributes, b: VariantAttributes): string | null {
  for (const slot of ["color", "size", "model", "style"] as const) {
    const av = a[slot];
    const bv = b[slot];
    if (av && bv && av !== bv) return slot;
  }
  return null;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Same product via title when identifiers differ (variant ASINs on Amazon). */
function titlesMatch(a: string, b: string): boolean {
  const ta = normalizeTitle(a);
  const tb = normalizeTitle(b);
  if (!ta || !tb) return false;
  if (ta === tb) return true;
  const setA = new Set(ta.split(" ").filter((w) => w.length > 2));
  const setB = new Set(tb.split(" ").filter((w) => w.length > 2));
  if (setA.size < 4 || setB.size < 4) return false;
  const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  let overlap = 0;
  for (const w of small) if (big.has(w)) overlap++;
  return overlap / small.size >= 0.8;
}

export type IdentityInput = ParsedProductLink & { titleHint?: string | null };

/**
 * Decide whether two parsed links name the same product.
 * Same key = same product (variant attrs decide the same-vs-variant call);
 * same marketplace + different identifiers = different product UNLESS both
 * titles are supplied and clearly match (Amazon variant ASINs).
 */
export function decideIdentity(a: IdentityInput, b: IdentityInput): IdentityDecision {
  if (!a.ok || !b.ok) return { verdict: "different_product", reason: "unparseable_link" };
  if (a.marketplace !== b.marketplace)
    return { verdict: "different_product", reason: "different_marketplace" };
  if (a.identifier === b.identifier) {
    const differing = variantAttrsDiffer(a.variant, b.variant);
    if (differing)
      return {
        verdict: "same_product_different_variant",
        reason: `variant_attribute_mismatch:${differing}`,
      };
    return { verdict: "same_product", reason: "same_marketplace_identifier" };
  }
  const ta = a.titleHint ? String(a.titleHint) : "";
  const tb = b.titleHint ? String(b.titleHint) : "";
  if (ta && tb && titlesMatch(ta, tb))
    return { verdict: "same_product_different_variant", reason: "same_title_different_identifier" };
  return { verdict: "different_product", reason: "different_identifier" };
}
