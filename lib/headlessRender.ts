// Free local headless-browser render path (Playwright Chromium), used ONLY as a
// fallback for already-verified exact-product pages whose reviews render
// client-side after a plain fetch found none.
// Rules: robots + host-stop decisions come from the scan's polite fetcher;
// 401/403/429, CAPTCHA and sign-in pages are terminal (host stopped); no
// stealth/fingerprint evasion, no CAPTCHA solving, no logins, the browser's own
// honest user agent; per-host pacing; bounded timeouts and page counts.
import { isBlockedOrSignInReviewPage } from "./reviewCollector";

export const HEADLESS_RENDER_VERSION = "headless-render-v1";

export type RenderResult = { url: string; ok: boolean; status: number | null; html: string; finalUrl: string; error?: string; blocked?: boolean; waitedFor?: string | null };

type PageLike = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<{ status: () => number } | null>;
  waitForSelector: (selector: string, options?: Record<string, unknown>) => Promise<unknown>;
  evaluate: (fn: string) => Promise<unknown>;
  content: () => Promise<string>;
  url: () => string;
  close: () => Promise<void>;
};
type BrowserLike = { newPage: (options?: Record<string, unknown>) => Promise<PageLike>; close: () => Promise<void> };

export type RenderGate = {
  allows: (url: string) => Promise<{ allowed: boolean; reason?: string }>;
  stopHost: (host: string, status: number) => void;
};

/** Default ON locally; OFF on serverless (Vercel/Lambda/Netlify) and under node --test unless explicitly enabled. */
export function headlessRenderEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = String(env.REVIEWINTEL_HEADLESS_RENDER || "").toLowerCase();
  if (["on", "1", "true"].includes(flag)) return true;
  if (["off", "0", "false"].includes(flag)) return false;
  if (env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY || env.NODE_TEST_CONTEXT) return false;
  return true;
}

/** Containers that indicate rendered review content (generic, not site-specific). */
export const REVIEW_CONTAINER_SELECTOR = [
  '[itemprop="review"]', '[data-hook="review"]', '[itemtype*="schema.org/Review"]',
  '[data-testid*="review" i]', '[class*="review-item" i]', '[class*="reviewItem" i]', '[class*="ReviewItem"]',
  '[id*="review" i] li', '[class*="review" i] article', '.bv-content-item', '.pr-review', '.yotpo-review',
].join(", ");

const CHALLENGE = /captcha|verify you are human|are you a robot|press (?:&amp; |and )?hold|automated access|access denied|unusual traffic/i;

export function createHeadlessRenderer(options: {
  gate: RenderGate;
  launch?: () => Promise<BrowserLike>;
  maxPages?: number; navTimeoutMs?: number; waitTimeoutMs?: number; minHostIntervalMs?: number;
}) {
  const maxPages = options.maxPages ?? 3;
  const navTimeoutMs = options.navTimeoutMs ?? 20000;
  const waitTimeoutMs = options.waitTimeoutMs ?? 8000;
  const minInterval = options.minHostIntervalMs ?? 3000;
  const lastHit = new Map<string, number>();
  const stats = { renders: 0, ok: 0, blocked: [] as string[], refused: [] as string[], byHost: {} as Record<string, number>, launchError: null as string | null };
  let browser: Promise<BrowserLike> | null = null;

  const defaultLaunch = async (): Promise<BrowserLike> => {
    const mod = await import("playwright") as unknown as { chromium: { launch: (o: Record<string, unknown>) => Promise<BrowserLike> } };
    return mod.chromium.launch({ headless: true });
  };

  async function render(url: string): Promise<RenderResult> {
    const host = new URL(url).host;
    const none = (error: string, extra: Partial<RenderResult> = {}): RenderResult => ({ url, ok: false, status: null, html: "", finalUrl: url, error, ...extra });
    if (stats.renders >= maxPages) return none("headless page budget reached");
    const gate = await options.gate.allows(url);
    if (!gate.allowed) { stats.refused.push(url); return none(gate.reason || "not allowed"); }
    const wait = (lastHit.get(host) || 0) + minInterval - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastHit.set(host, Date.now());
    stats.renders += 1; stats.byHost[host] = (stats.byHost[host] || 0) + 1;
    try {
      browser ||= (options.launch || defaultLaunch)();
      const b = await browser;
      const page = await b.newPage({ locale: "en-CA" });
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeoutMs });
        const status = response ? response.status() : null;
        if (status === 401 || status === 403 || status === 429) {
          options.gate.stopHost(host, status); stats.blocked.push(url);
          return none(`HTTP ${status}`, { status, blocked: true, finalUrl: page.url() });
        }
        // Lazy review widgets load near the bottom; scroll like a reader, then wait for containers.
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)").catch(() => undefined);
        let waitedFor: string | null = null;
        await page.waitForSelector(REVIEW_CONTAINER_SELECTOR, { timeout: waitTimeoutMs, state: "attached" }).then(() => { waitedFor = "review-container"; }).catch(() => undefined);
        const html = await page.content();
        const finalUrl = page.url();
        if (CHALLENGE.test(html.slice(0, 200_000)) && !waitedFor || isBlockedOrSignInReviewPage({ requestedUrl: url, finalUrl, html })) {
          options.gate.stopHost(host, 403); stats.blocked.push(url);
          return none("challenge or sign-in page", { status, blocked: true, finalUrl });
        }
        const ok = Boolean(status && status < 400 && html.trim().length > 0);
        if (ok) stats.ok += 1;
        return { url, ok, status, html, finalUrl, waitedFor, error: ok ? undefined : `HTTP ${status}` };
      } finally { await page.close().catch(() => undefined); }
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "render failed";
      if (/Executable doesn't exist|Cannot find (?:module|package)/i.test(message)) stats.launchError = message;
      return none(message);
    }
  }

  async function close() { if (browser) { const b = await browser.catch(() => null); browser = null; await b?.close().catch(() => undefined); } }
  return { render, close, stats };
}
