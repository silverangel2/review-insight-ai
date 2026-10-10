// Request hygiene for ReviewIntel's own scraper (per scan):
// robots.txt compliance (User-agent: * group, Allow/Disallow with * and $,
// longest-match wins), per-host pacing, retries on 5xx/network errors only
// with backoff, and a per-scan response cache. 401/403/429 and sign-in pages
// are terminal for the caller; they are never retried here.

export type RobotsRules = { allow: string[]; disallow: string[] };
export type PoliteResult = { status: number | null; ok: boolean; text: string; finalUrl: string; error?: string; robotsBlocked?: boolean; fromCache?: boolean; attempts: number };

export function parseRobotsTxt(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let inStar = false, sawRuleInGroup = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === "user-agent") {
      if (sawRuleInGroup) { inStar = false; sawRuleInGroup = false; }
      if (value === "*") inStar = true;
    } else if (key === "allow" || key === "disallow") {
      sawRuleInGroup = true;
      if (inStar && value) (key === "allow" ? rules.allow : rules.disallow).push(value);
    }
  }
  return rules;
}

function ruleMatches(rule: string, path: string) {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule).split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

export function robotsAllows(rules: RobotsRules, url: string): boolean {
  let path: string;
  try { const u = new URL(url); path = `${u.pathname}${u.search}`; } catch { return false; }
  const best = (list: string[]) => list.filter(rule => ruleMatches(rule, path)).reduce((max, rule) => Math.max(max, rule.length), -1);
  const allow = best(rules.allow), disallow = best(rules.disallow);
  return disallow < 0 || allow >= disallow;
}

export const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
  "accept-language": "en-CA,en-US;q=0.9,en;q=0.8,fr-CA;q=0.6",
  "upgrade-insecure-requests": "1",
};

export function createPoliteFetcher(options: { enforceRobots?: boolean; minHostIntervalMs?: number; maxRetries?: number; fetchImpl?: typeof fetch } = {}) {
  const enforceRobots = options.enforceRobots ?? (process.env.REVIEWINTEL_ROBOTS_POLICY || "enforce") !== "off";
  const minInterval = options.minHostIntervalMs ?? 400;
  const maxRetries = options.maxRetries ?? 2;
  const robots = new Map<string, Promise<RobotsRules>>();
  const lastHit = new Map<string, number>();
  const cache = new Map<string, PoliteResult>();
  // Hard stop: once a host answers 401/403/429, no further requests go to it this scan.
  const stoppedHosts = new Map<string, number>();
  const stats = { accessStopped: [] as string[], requests: 0, robotsFetches: 0, robotsBlocked: [] as string[], cacheHits: 0, retries: 0, byHost: {} as Record<string, number> };
  const doFetch = (url: string, init: RequestInit) => (options.fetchImpl || globalThis.fetch)(url, init);

  async function pace(host: string) {
    const wait = (lastHit.get(host) || 0) + minInterval - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastHit.set(host, Date.now());
  }

  async function rulesFor(origin: string, init: RequestInit): Promise<RobotsRules> {
    if (!robots.has(origin)) {
      robots.set(origin, (async () => {
        stats.robotsFetches += 1;
        try {
          const response = await doFetch(`${origin}/robots.txt`, { ...init, method: "GET" });
          // RFC 9309: 4xx = no restrictions; 5xx/unreachable = assume full disallow.
          if (response.status >= 500) return { allow: [], disallow: ["/"] };
          if (!response.ok) return { allow: [], disallow: [] };
          return parseRobotsTxt(await response.text());
        } catch { return { allow: [], disallow: ["/"] }; }
      })());
    }
    return robots.get(origin)!;
  }

  async function get(url: string, init: RequestInit = {}): Promise<PoliteResult> {
    const u = new URL(url);
    const cached = cache.get(url);
    if (cached) { stats.cacheHits += 1; return { ...cached, fromCache: true }; }
    if (enforceRobots && !robotsAllows(await rulesFor(u.origin, init), url)) {
      stats.robotsBlocked.push(url);
      return { status: null, ok: false, text: "", finalUrl: url, error: "robots_disallowed", robotsBlocked: true, attempts: 0 };
    }
    if (stoppedHosts.has(u.host)) {
      stats.accessStopped.push(url);
      return { status: stoppedHosts.get(u.host)!, ok: false, text: "", finalUrl: url, error: `host access stopped after HTTP ${stoppedHosts.get(u.host)}`, attempts: 0 };
    }
    let attempts = 0, last: PoliteResult = { status: null, ok: false, text: "", finalUrl: url, error: "not attempted", attempts: 0 };
    while (attempts <= maxRetries) {
      attempts += 1;
      await pace(u.host);
      stats.requests += 1; stats.byHost[u.host] = (stats.byHost[u.host] || 0) + 1;
      try {
        const response = await doFetch(url, init);
        const text = await response.text().catch(() => "");
        last = { status: response.status, ok: response.ok && text.trim().length > 0, text, finalUrl: response.url || url, error: response.ok ? undefined : `HTTP ${response.status}`, attempts };
        if (response.status < 500) break; // 2xx/3xx/4xx (incl. 401/403/429) are final
      } catch (error) {
        last = { status: null, ok: false, text: "", finalUrl: url, error: error instanceof Error ? error.message : "fetch failed", attempts };
        if ((error as { name?: string })?.name === "AbortError") break;
      }
      if (attempts <= maxRetries) { stats.retries += 1; await new Promise(resolve => setTimeout(resolve, Math.min(4000, 300 * 2 ** (attempts - 1)))); }
    }
    if (last.status === 401 || last.status === 403 || last.status === 429) stoppedHosts.set(u.host, last.status);
    if (last.ok) cache.set(url, last);
    return last;
  }
  /** Robots + host-stop decision for another client (e.g. the headless renderer). */
  async function allows(url: string, init: RequestInit = {}): Promise<{ allowed: boolean; reason?: string }> {
    const u = new URL(url);
    if (stoppedHosts.has(u.host)) return { allowed: false, reason: `host access stopped after HTTP ${stoppedHosts.get(u.host)}` };
    if (enforceRobots && !robotsAllows(await rulesFor(u.origin, init), url)) { stats.robotsBlocked.push(url); return { allowed: false, reason: "robots_disallowed" }; }
    return { allowed: true };
  }
  function stopHost(host: string, status: number) { stoppedHosts.set(host, status); }
  return { get, stats, allows, stopHost };
}
