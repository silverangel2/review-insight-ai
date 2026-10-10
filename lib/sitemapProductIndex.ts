// Public product sitemaps (robots-advertised) as a discovery source that does
// not depend on search engines. Sitemaps are fetched by an offline index
// builder (scripts/reviewintel-build-sitemap-index.mjs) through the polite,
// robots-compliant fetcher; scans only read the local index. Candidates found
// here are fetched and accepted only after barcode/model verification.
import { gunzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync } from "node:fs";

export type SitemapEntry = { url: string; tokens: string[] };

export function decodeSitemapBody(body: Buffer | string): string {
  const buf = typeof body === "string" ? Buffer.from(body, "binary") : body;
  return buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
}

export function parseSitemap(xml: string): { sitemaps: string[]; urls: string[] } {
  const locs = (tag: string) => [...xml.matchAll(new RegExp(`<${tag}>[\\s\\S]*?<loc>\\s*([^<\\s]+)\\s*</loc>[\\s\\S]*?</${tag}>`, "gi"))].map(m => m[1].replace(/&amp;/g, "&"));
  return { sitemaps: locs("sitemap"), urls: locs("url") };
}

const PRODUCT_PATH = /\/(?:product|products|p|ip|dp)\/|\/p\d|[-/]\d{6,}(?:[/?.]|$)|\.html$/i;
export function isLikelyProductUrl(url: string) {
  try { return PRODUCT_PATH.test(new URL(url).pathname); } catch { return false; }
}

export function slugTokens(url: string): string[] {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length >= 2);
  } catch { return []; }
}

export function indexEntries(urls: string[]): SitemapEntry[] {
  return urls.filter(isLikelyProductUrl).map(url => ({ url, tokens: slugTokens(url) }));
}

/**
 * Candidates whose slug carries the brand AND either a discriminative model id
 * (compact form) or every family token. Ranked by model match first.
 */
export function findSitemapCandidates(entries: SitemapEntry[], query: { brand?: string | null; models?: string[]; familyTokens?: string[] }, limit = 6): string[] {
  const brandTokens = String(query.brand || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const models = (query.models || []).map(m => m.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(m => m.length >= 4 && /\d/.test(m) && /[a-z]/.test(m));
  const family = (query.familyTokens || []).map(t => t.toLowerCase()).filter(t => t.length >= 2);
  if (!brandTokens.length) return [];
  const scored: Array<{ url: string; score: number }> = [];
  for (const entry of entries) {
    if (!brandTokens.every(token => entry.tokens.includes(token))) continue;
    const compact = entry.tokens.join("");
    const modelHit = models.some(model => compact.includes(model));
    const familyHit = family.length >= 2 && family.every(token => entry.tokens.includes(token));
    if (modelHit || familyHit) scored.push({ url: entry.url, score: (modelHit ? 2 : 0) + (familyHit ? 1 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(item => item.url);
}

/** NDJSON index: one SitemapEntry per line; a leading {"meta":...} line and bad lines are skipped. */
export function parseNdjsonIndex(text: string, keepLine?: (lowerLine: string) => boolean): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (keepLine && !keepLine(line.toLowerCase())) continue;
    try { const row = JSON.parse(line); if (row && typeof row.url === "string") out.push(row as SitemapEntry); } catch { /* skip */ }
  }
  return out;
}

/**
 * Explicit env dir wins. Under `node --test` (NODE_TEST_CONTEXT) the machine's
 * local index is NOT read implicitly, so test results never depend on local state.
 */
export function defaultSitemapIndexDir(): string {
  if (process.env.REVIEWINTEL_SITEMAP_INDEX_DIR) return process.env.REVIEWINTEL_SITEMAP_INDEX_DIR;
  return process.env.NODE_TEST_CONTEXT ? "" : "/tmp/reviewintel-sitemap-index";
}

/** Reads locally built indexes (if any). Missing/unreadable indexes yield none. */
export function loadLocalSitemapIndexes(dir = defaultSitemapIndexDir(), options: { brand?: string | null } = {}): SitemapEntry[] {
  // Optional brand prefilter: only parse lines that mention every brand token (keeps memory small on huge indexes).
  const brandTokens = String(options.brand || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const keepLine = brandTokens.length ? (line: string) => brandTokens.every(token => line.includes(token)) : undefined;
  try {
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir).filter(name => name.endsWith(".json") || name.endsWith(".ndjson")).flatMap(name => {
      try {
        const buf = readFileSync(`${dir}/${name}`);
        if (name.endsWith(".json")) return (JSON.parse(buf.toString("utf8")).entries || []) as SitemapEntry[];
        // Decode in newline-aligned slices: a big retailer index can exceed V8's max string length.
        const out: SitemapEntry[] = [];
        const SLICE = 32 * 1024 * 1024;
        for (let start = 0; start < buf.length;) {
          let end = Math.min(buf.length, start + SLICE);
          if (end < buf.length) { const nl = buf.indexOf(10, end); end = nl < 0 ? buf.length : nl + 1; }
          for (const row of parseNdjsonIndex(buf.subarray(start, end).toString("utf8"), keepLine)) out.push(row);
          start = end;
        }
        return out;
      } catch { return []; }
    });
  } catch { return []; }
}
