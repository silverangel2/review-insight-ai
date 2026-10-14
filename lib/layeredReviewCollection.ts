// Layered public-page collection for one product URL.
// Order: primary browser profile, one alternate profile, alternate URL forms,
// mobile page, public review endpoints, sibling storefronts, then optional
// Chromium. A CAPTCHA or sign-in page stops the ladder. Nothing here solves
// a challenge or submits a login.

import { headersForAttempt, ScanCookieJar, type FetchTier } from "./browserProfiles";
import { maybeSparticuzChromium } from "./layeredChromium";
import { isBlockedOrSignInReviewPage } from "./reviewCollector";
import { scanCollectionRemainingMs } from "./scanDeadline";
import {
  buildAttemptPlan,
  collectorForUrl,
  normalizeReviewPayload,
  type StoreAttempt,
  type StoreCollector,
  type StoreId,
} from "./storeCollectors";

export const STRIPPED_MIN_BYTES = 400;
export const STRIPPED_MAX_BYTES = 2_000_000;
export const LAYERED_MAX_ATTEMPTS = 12;
export const LAYERED_ATTEMPT_MIN_REMAINING_MS = 1_500;
export const LAYERED_CHROMIUM_MIN_REMAINING_MS = 15_000;

export type LayeredPage = {
  status: number | null;
  ok: boolean;
  text: string;
  finalUrl: string;
  error?: string;
  robotsBlocked?: boolean;
  setCookies?: string[];
};

export type PageAssessment = {
  blocked: boolean;
  challenge: boolean;
  hasTitle: boolean;
  hasReviews: boolean;
  stripped: boolean;
  bytes: number;
  text: string;
};

export type LayeredResult = {
  ok: boolean;
  text: string;
  finalUrl: string;
  status: number | null;
  error?: string;
  store: StoreId | null;
  tier: FetchTier | null;
  profileId: string | null;
  strippedPage: boolean;
  blocked: boolean;
  hasReviews: boolean;
  attempts: number;
  chromium: "not-needed" | "skipped-budget" | "skipped-disabled" | "unavailable" | "used" | "blocked" | "empty";
};

export type LayeredScanSummary = {
  tier: string | null;
  profileId: string | null;
  strippedPage: boolean;
  attempts: number;
  stores: string[];
  blocked: boolean;
  chromium: string;
};

export function emptyLayeredScan(): LayeredScanSummary {
  return { tier: null, profileId: null, strippedPage: false, attempts: 0, stores: [], blocked: false, chromium: "not-used" };
}

export function mergeLayeredScan(log: LayeredScanSummary, result: LayeredResult) {
  log.attempts += result.attempts;
  if (result.strippedPage) log.strippedPage = true;
  if (result.blocked) log.blocked = true;
  if (result.store && !log.stores.includes(result.store)) log.stores.push(result.store);
  if (result.hasReviews && !log.tier) {
    log.tier = result.tier;
    log.profileId = result.profileId;
  }
  if (result.chromium !== "not-needed") log.chromium = result.chromium;
}

export function pageHasProductTitle(html: string, titleMarkers: RegExp): boolean {
  if (titleMarkers.test(html)) return true;
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
    || "";
  const text = og.replace(/\s+/g, " ").trim();
  if (text.length < 8) return false;
  return !/^(?:amazon|walmart|best buy|target|the home depot)(?:\.[a-z.]+)?$/i.test(text);
}

export function assessStorePage(collector: StoreCollector, input: {
  html: string;
  requestedUrl: string;
  finalUrl: string;
  status: number | null;
}): PageAssessment {
  const text = normalizeReviewPayload(input.html);
  const challenge = isBlockedOrSignInReviewPage({
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    html: input.html,
  });
  const httpDenied = input.status === 401 || input.status === 403 || input.status === 429;
  const hasTitle = pageHasProductTitle(input.html, collector.titleMarkers);
  const hasReviews = collector.reviewMarkers.test(text) || collector.reviewMarkers.test(input.html);
  const bytes = input.html.length;
  // The live failure is HTTP 200 with neither a product title nor review
  // markers, including a fat ~250KB shell. A real review or title page is not stripped.
  const stripped = !challenge && !httpDenied && input.status === 200 && !hasTitle && !hasReviews
    && bytes >= STRIPPED_MIN_BYTES && bytes <= STRIPPED_MAX_BYTES;
  return { blocked: challenge || httpDenied, challenge, hasTitle, hasReviews, stripped, bytes, text };
}

function laterResultsPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get("pageNumber") || parsed.searchParams.get("page") || "1");
    return Number.isFinite(page) && page > 1;
  } catch { return false; }
}

function remainingOf(remainingMs?: () => number): number {
  if (remainingMs) return remainingMs();
  const left = scanCollectionRemainingMs();
  return left == null ? Number.POSITIVE_INFINITY : left;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ""; }
}

type Held = { text: string; finalUrl: string; status: number | null; error?: string; tier: FetchTier; profileId: string; hasReviews: boolean; hasTitle: boolean };

export async function runLayeredStoreFetch(input: {
  url: string;
  fetchPage: (attempt: StoreAttempt, headers: Record<string, string>) => Promise<LayeredPage>;
  jar?: ScanCookieJar;
  remainingMs?: () => number;
  maxAttempts?: number;
  chromiumFetch?: ((url: string) => Promise<LayeredPage | null>) | null;
}): Promise<LayeredResult> {
  const collector = collectorForUrl(input.url);
  const jar = input.jar || new ScanCookieJar();
  const maxAttempts = input.maxAttempts ?? LAYERED_MAX_ATTEMPTS;
  const none = (partial: Partial<LayeredResult> = {}): LayeredResult => ({
    ok: false,
    text: "",
    finalUrl: input.url,
    status: null,
    store: collector?.id || null,
    tier: null,
    profileId: null,
    strippedPage: false,
    blocked: false,
    hasReviews: false,
    attempts: 0,
    chromium: "not-needed",
    ...partial,
  });
  if (!collector) return none({ error: "not a supported store product URL" });

  const queue = collector.plan(input.url, !laterResultsPage(input.url));
  const seen = new Set(queue.map((attempt) => `${attempt.profileId} ${attempt.url}`));
  const deniedHosts = new Set<string>();
  let attempts = 0;
  let strippedPage = false;
  let sawHealthyPage = false;
  const bestPage: { current: Held | null } = { current: null };
  let lastError: string | undefined;

  const consider = (held: Held) => {
    const current = bestPage.current;
    if (!current) { bestPage.current = held; return; }
    if (held.hasReviews && !current.hasReviews) bestPage.current = held;
    else if (held.hasTitle && !current.hasTitle && !current.hasReviews) bestPage.current = held;
  };

  for (let index = 0; index < queue.length; index += 1) {
    const attempt = queue[index];
    if (attempts >= maxAttempts) break;
    if (remainingOf(input.remainingMs) < LAYERED_ATTEMPT_MIN_REMAINING_MS) break;
    if (deniedHosts.has(hostOf(attempt.url))) continue;
    attempts += 1;
    const headers = headersForAttempt({
      url: attempt.url,
      tier: attempt.tier,
      profileId: attempt.profileId,
      jar,
      referer: input.url,
    });
    let page: LayeredPage;
    try {
      page = await input.fetchPage(attempt, headers);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
      if (/time budget|aborted/i.test(lastError)) break;
      continue;
    }
    if (page.setCookies?.length) jar.addFromSetCookie(page.finalUrl || attempt.url, page.setCookies);
    if (page.robotsBlocked) { lastError = page.error || "robots_disallowed"; continue; }
    if (/retrieval ceiling|time budget/i.test(page.error || "")) { lastError = page.error; break; }
    if (/host access stopped/i.test(page.error || "")) { deniedHosts.add(hostOf(attempt.url)); lastError = page.error; continue; }

    const assessment = assessStorePage(collector, {
      html: page.text,
      requestedUrl: attempt.url,
      finalUrl: page.finalUrl || attempt.url,
      status: page.status,
    });
    if (assessment.stripped) strippedPage = true;
    if (assessment.challenge) {
      return none({
        ok: false,
        text: page.text,
        finalUrl: page.finalUrl || attempt.url,
        status: page.status,
        error: "challenge or sign-in page",
        tier: attempt.tier,
        profileId: attempt.profileId,
        strippedPage,
        blocked: true,
        attempts,
        chromium: "not-needed",
      });
    }
    if (page.status === 401 || page.status === 403 || page.status === 429) {
      deniedHosts.add(hostOf(attempt.url));
      lastError = page.error || `HTTP ${page.status}`;
      continue;
    }
    if (!assessment.challenge && collector.extraFromHtml) {
      for (const extra of collector.extraFromHtml(page.text, page.finalUrl || attempt.url)) {
        const key = `${extra.profileId} ${extra.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(extra);
      }
    }
    const held: Held = {
      text: assessment.text,
      finalUrl: page.finalUrl || attempt.url,
      status: page.status,
      error: page.error,
      tier: attempt.tier,
      profileId: attempt.profileId,
      hasReviews: assessment.hasReviews,
      hasTitle: assessment.hasTitle,
    };
    consider(held);
    if (assessment.hasReviews) {
      return {
        ok: true,
        text: held.text,
        finalUrl: held.finalUrl,
        status: held.status,
        store: collector.id,
        tier: held.tier,
        profileId: held.profileId,
        strippedPage,
        blocked: false,
        hasReviews: true,
        attempts,
        chromium: "not-needed",
      };
    }
    // A real product page (title, or any non-stripped 200) is not a lite shell.
    // Leave its review pagination to the existing candidate list.
    if (page.status === 200 && !assessment.stripped) {
      sawHealthyPage = true;
      break;
    }
  }

  let chromium: LayeredResult["chromium"] = "not-needed";
  const best = bestPage.current;
  if (!best?.hasReviews && !sawHealthyPage) {
    const remaining = remainingOf(input.remainingMs);
    if (remaining < LAYERED_CHROMIUM_MIN_REMAINING_MS) chromium = "skipped-budget";
    else if (input.chromiumFetch) {
      const rendered = await input.chromiumFetch(input.url);
      if (rendered) {
        const assessment = assessStorePage(collector, {
          html: rendered.text,
          requestedUrl: input.url,
          finalUrl: rendered.finalUrl || input.url,
          status: rendered.status,
        });
        if (assessment.challenge || rendered.status === 401 || rendered.status === 403 || rendered.status === 429) {
          chromium = "blocked";
          return none({
            text: rendered.text,
            finalUrl: rendered.finalUrl || input.url,
            status: rendered.status,
            error: "challenge or sign-in page",
            tier: "chromium",
            strippedPage,
            blocked: true,
            attempts,
            chromium,
          });
        }
        if (assessment.hasReviews) {
          return {
            ok: true,
            text: assessment.text,
            finalUrl: rendered.finalUrl || input.url,
            status: rendered.status,
            store: collector.id,
            tier: "chromium",
            profileId: null,
            strippedPage,
            blocked: false,
            hasReviews: true,
            attempts,
            chromium: "used",
          };
        }
        chromium = "empty";
      } else chromium = "empty";
    } else {
      const rendered = await maybeSparticuzChromium(input.url, Math.min(12_000, Math.max(1_000, remaining - 500)));
      if (rendered.state === "disabled") chromium = "skipped-disabled";
      else if (rendered.state === "unavailable") chromium = "unavailable";
      else {
        const assessment = assessStorePage(collector, {
          html: rendered.html,
          requestedUrl: input.url,
          finalUrl: rendered.finalUrl,
          status: rendered.status,
        });
        if (assessment.challenge || rendered.status === 401 || rendered.status === 403 || rendered.status === 429) {
          return none({
            text: rendered.html,
            finalUrl: rendered.finalUrl,
            status: rendered.status,
            error: "challenge or sign-in page",
            tier: "chromium",
            strippedPage,
            blocked: true,
            attempts,
            chromium: "blocked",
          });
        }
        if (assessment.hasReviews) {
          return {
            ok: true,
            text: assessment.text,
            finalUrl: rendered.finalUrl,
            status: rendered.status,
            store: collector.id,
            tier: "chromium",
            profileId: null,
            strippedPage,
            blocked: false,
            hasReviews: true,
            attempts,
            chromium: "used",
          };
        }
        chromium = "empty";
      }
    }
  }

  if (best && best.status === 200 && best.text.trim()) {
    return {
      ok: true,
      text: best.text,
      finalUrl: best.finalUrl,
      status: best.status,
      error: best.error,
      store: collector.id,
      tier: best.tier,
      profileId: best.profileId,
      strippedPage,
      blocked: false,
      hasReviews: best.hasReviews,
      attempts,
      chromium,
    };
  }
  return none({
    text: best?.text || "",
    finalUrl: best?.finalUrl || input.url,
    status: best?.status ?? null,
    error: lastError || best?.error,
    tier: best?.tier || null,
    profileId: best?.profileId || null,
    strippedPage,
    attempts,
    chromium,
    store: collector.id,
  });
}

export { buildAttemptPlan };
