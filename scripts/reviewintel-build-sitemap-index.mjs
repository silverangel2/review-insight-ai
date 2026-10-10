// Offline sitemap index builder (manual, owner-run only; not used by scans or tests).
// Robots-compliant (checks every sitemap URL against the host's robots.txt), paced 1.5s/host, bounded.
// Usage: node scripts/reviewintel-build-sitemap-index.mjs https://www.bestbuy.ca/sitemap_index.xml [maxFiles=40]
import { mkdirSync, writeFileSync, createWriteStream, rmSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/x.js");
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() }, cache: false });
const { parseRobotsTxt, robotsAllows, BROWSER_HEADERS } = jiti("./lib/politeFetch.ts");
const { decodeSitemapBody, parseSitemap, indexEntries } = jiti("./lib/sitemapProductIndex.ts");
const [root, maxFilesArg] = process.argv.slice(2);
const maxFiles = Number(maxFilesArg || 40);
const headers = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", ...BROWSER_HEADERS };
const origin = new URL(root).origin;
const robotsRes = await fetch(`${origin}/robots.txt`, { headers });
const rules = robotsRes.status >= 500 ? { allow: [], disallow: ["/"] } : robotsRes.ok ? parseRobotsTxt(await robotsRes.text()) : { allow: [], disallow: [] };
const queue = [root], seen = new Set(), entries = [], skipped = [];
while (queue.length && seen.size < maxFiles) {
  const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
  if (new URL(url).origin !== origin || !robotsAllows(rules, url)) { skipped.push(url); continue; }
  await new Promise(r => setTimeout(r, 1500));
  const res = await fetch(url, { headers }).catch(() => null);
  if (!res || [401, 403, 429].includes(res.status)) { skipped.push(url); if (res) break; continue; }
  if (!res.ok) continue;
  const parsed = parseSitemap(decodeSitemapBody(Buffer.from(await res.arrayBuffer())));
  queue.push(...parsed.sitemaps); entries.push(...indexEntries(parsed.urls));
}
mkdirSync("/tmp/reviewintel-sitemap-index", { recursive: true });
const host = new URL(root).host;
// NDJSON (one entry per line): large retailer indexes exceed V8's max string length as one JSON blob.
rmSync(`/tmp/reviewintel-sitemap-index/${host}.json`, { force: true });
const out = createWriteStream(`/tmp/reviewintel-sitemap-index/${host}.ndjson`);
out.write(JSON.stringify({ meta: { builtAt: new Date().toISOString(), root, files: seen.size, skipped } }) + "\n");
for (const entry of entries) out.write(JSON.stringify(entry) + "\n");
await new Promise(r => out.end(r));
console.log(JSON.stringify({ host, files: seen.size, skipped: skipped.length, productUrls: entries.length }));
