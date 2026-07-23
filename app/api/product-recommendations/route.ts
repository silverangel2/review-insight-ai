import { NextRequest, NextResponse } from "next/server";
import {
  attachAffiliateUrl,
  getAffiliateDisclosure,
  getAmazonAssociateTag,
  isSupportedAffiliateUrl,
} from "@/lib/affiliate";
import {
  affiliatePartnerCanShowInGroup,
  normalizeAffiliatePartnerPlacement,
} from "@/lib/adConfig";
import { readAdSettings } from "@/lib/adSettingsStore";
import { localeLabel, normalizeLocale } from "@/lib/i18n";

function safeJsonParse(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getHttpsUrl(value: unknown) {
  const text = getString(value).trim();
  if (!text.startsWith("http")) return "";

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function absoluteUrl(value: string, base: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

type RecommendationBase = {
  title: string;
  store: string;
  url: string;
  imageUrl: string;
  rating: number | null;
  reviewCount: number | null;
  price: string | null;
  badge: string;
  whyBetter: string;
  aiLikeRisk: string;
};

function amazonStoreForUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon.com") && !host.includes("amazon.ca")) return "Amazon.com";
  } catch {
    // Keep the Canadian store label as the shopper default when parsing fails.
  }

  return "Amazon.ca";
}

async function extractOpenGraphImage(url: string) {
  if (!isSupportedAffiliateUrl(url)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (compatible; ReviewIntelBot/1.0; +https://getreviewintel.com)",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return "";

    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/"large":"([^"]+)"/i) ||
      html.match(/"hiRes":"([^"]+)"/i);

    const raw = match?.[1]?.replace(/\\u002F/g, "/").replace(/\\\//g, "/") || "";
    const resolved = raw.startsWith("http") ? raw : absoluteUrl(raw, url);

    return resolved.startsWith("http") ? resolved : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}


function amazonSearchUrlForRecommendation(title: string, marketplace = "amazon.ca") {
  const host = marketplace.includes("amazon.com") ? "www.amazon.com" : "www.amazon.ca";
  const query = encodeURIComponent(title.replace(/\s+/g, " ").trim());
  return `https://${host}/s?k=${query}`;
}

function normalizeRecommendationUrls(
  items: Awaited<ReturnType<typeof attachAffiliateUrl>>[],
  marketplace = "amazon.ca",
  fallbackProductName = "",
  fallbackBrand = "",
): Awaited<ReturnType<typeof attachAffiliateUrl>>[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const normalized = [];

  for (const item of items) {
    const title = item.title || "Amazon product recommendation";
    const titleKey = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenTitles.has(titleKey)) continue;

    const url = item.url || amazonSearchUrlForRecommendation(title, marketplace);

    const looksPlaceholder =
      /B09N1X1X1X|B07Z5Y5Y5Y/i.test(url) ||
      seenUrls.has(url);

    const safeUrl = looksPlaceholder
      ? amazonSearchUrlForRecommendation(title, marketplace)
      : url;

    if (seenUrls.has(safeUrl)) continue;

    seenTitles.add(titleKey);
    seenUrls.add(safeUrl);

    normalized.push(
      attachAffiliateUrl({
        ...item,
        url: safeUrl,
      }),
    );

    if (normalized.length >= 3) break;
  }

  const baseProductName = String(
    fallbackProductName || items[0]?.title || "Amazon product alternative"
  )
    .replace(/\s+/g, " ")
    .trim();
  const baseBrand = String(fallbackBrand || "").replace(/\s+/g, " ").trim();

  // Always provide useful Amazon alternatives. When a unique verified product
  // page is unavailable, return honest Amazon search links based on the actual
  // scanned product instead of unrelated or hard-coded product names.
  const fallbackTitles = [
    [baseBrand, baseProductName, "alternative"].filter(Boolean).join(" "),
    [baseProductName, "best rated"].filter(Boolean).join(" "),
    [baseProductName, "better value"].filter(Boolean).join(" "),
    [baseProductName, "premium quality"].filter(Boolean).join(" "),
  ];

  for (const title of fallbackTitles) {
    if (normalized.length >= 3) break;

    const cleanTitle = title.replace(/\s+/g, " ").trim();
    const titleKey = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!cleanTitle || seenTitles.has(titleKey)) continue;

    const safeUrl = amazonSearchUrlForRecommendation(cleanTitle, marketplace);
    if (seenUrls.has(safeUrl)) continue;

    seenTitles.add(titleKey);
    seenUrls.add(safeUrl);

    normalized.push(
      attachAffiliateUrl({
        title: cleanTitle,
        store: marketplace.includes("amazon.com") ? "Amazon.com" : "Amazon.ca",
        url: safeUrl,
        imageUrl: null,
        rating: null,
        reviewCount: null,
        price: null,
        badge: normalized.length === 0 ? "Primary Pick" : normalized.length === 1 ? "Better Value" : "Stronger Quality",
        whyBetter: "Search-based Amazon recommendation link generated because a unique verified product URL was not available.",
        aiLikeRisk: "Not scored",
      }),
    );
  }

  return normalized.slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bodyRecord = asRecord(body);
    const result = asRecord(bodyRecord.result);
    const resultMeta = asRecord(result.meta);
    const scanId =
      getString(bodyRecord.scanId) ||
      getString(result.scanId) ||
      getString(resultMeta.scanId);
    const productIdentity = asRecord(result.productIdentity);
    const productIdentitySnake = asRecord(result.product_identity);
    const locale = normalizeLocale(bodyRecord.locale);
    const outputLanguage = localeLabel(locale);
    const affiliatePlacement = normalizeAffiliatePartnerPlacement(
      bodyRecord.affiliatePlacement,
      "results",
    );
    const settings = await readAdSettings();

    if (
      !settings.adsEnabled ||
      !affiliatePartnerCanShowInGroup(
        "amazon",
        affiliatePlacement,
        settings.affiliatePartners,
      )
    ) {
      return NextResponse.json({
        ok: true,
        shopperOnly: true,
        scanId,
        resultSource: "recommendations",
        locale,
        outputLanguage,
        affiliateDisabled: true,
        affiliateReady: false,
        affiliateProviders: {
          amazonReady: false,
        },
        disclosure: getAffiliateDisclosure(),
        recommendations: [],
      });
    }

    const productName =
      getString(result.productName) ||
      getString(result.name) ||
      getString(result.title) ||
      getString(result.productTitle) ||
      getString(productIdentity.title) ||
      getString(productIdentitySnake.title) ||
      getString(bodyRecord.productName);

    const brand =
      getString(result.brand) ||
      getString(productIdentity.brand) ||
      getString(productIdentitySnake.brand) ||
      getString(bodyRecord.brand);

    const verdict =
      getString(result.verdict) ||
      getString(result.finalVerdict) ||
      getString(result.recommendation);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    if (!productName) {
      return NextResponse.json({ ok: false, error: "Missing product name." }, { status: 400 });
    }

    const prompt = `
You are ReviewIntel's shopper-only Better Picks recommendation engine.

Output language:
- Write badge, whyBetter, and aiLikeRisk in ${outputLanguage}.
- Keep product titles, brand names, store names, URLs, ratings, prices, and JSON keys unchanged.
- If ${outputLanguage} is English, use natural concise English.

Scanned product:
${JSON.stringify({ productName, brand, verdict, result }, null, 2)}

Find up to 3 visible Amazon product alternatives when possible:
1. Primary Pick
2. Better Value
3. Stronger Quality

Rules:
- This is for shopper results only, not seller analytics.
- Prefer Amazon.ca for Canadian shoppers. Use Amazon.com only when a Canadian listing is not visible.
- If the scanned product came from Walmart or another store, still recommend close Amazon substitutes only.
- Every recommendation must be an Amazon link.
- Do not invent exact rating, review count, price, or product URLs.
- Include imageUrl only if you can see a real Amazon/product image URL. Do not invent image URLs.
- Do not recommend random unrelated products.
- Recommendations must be the same category or a very close substitute.
- If scanned verdict is BUY: suggest cheaper or better-quality Amazon alternatives, but do not claim the scanned item is bad.
- If scanned verdict is CONSIDER: suggest cleaner, nicer, or more proven alternatives.
- If scanned verdict is AVOID: suggest safer replacement products.
- Only say a product is better if public evidence appears stronger.
- If evidence is weak, explain that briefly.
- Return strict JSON only.

JSON format:
{
  "ok": true,
      "recommendations": [
    {
      "title": "product title",
      "store": "Amazon.ca",
      "url": "https://www.amazon.ca/...",
      "imageUrl": "https://...",
      "rating": 4.5,
      "reviewCount": 1200,
      "price": "$99.99",
      "badge": "Primary Pick",
      "whyBetter": "short reason",
      "aiLikeRisk": "Low/Medium/Unknown"
    }
  ]
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1-mini",
        tools: [{ type: "web_search" }],
        input: prompt,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Recommendation search failed: ${response.status} ${text.slice(0, 180)}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const output =
      data.output_text ||
      data.output
        ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("\n") ||
      "";

    const parsed = safeJsonParse(output);
    const rawRecommendations = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
      : [];

    const baseRecommendations: RecommendationBase[] = rawRecommendations
      .filter((item: unknown) => {
        const record = asRecord(item);
        return getString(record.title) && isSupportedAffiliateUrl(getString(record.url));
      })
      .slice(0, 3)
      .map((item: unknown) => {
        const record = asRecord(item);

        return {
          title: getString(record.title),
          store: amazonStoreForUrl(getString(record.url)),
          url: getString(record.url),
          imageUrl: getHttpsUrl(record.imageUrl) || getHttpsUrl(record.image),
          rating: getNumber(record.rating),
          reviewCount: getNumber(record.reviewCount),
          price: getString(record.price) || null,
          badge: getString(record.badge) || "Better Pick",
          whyBetter:
            getString(record.whyBetter) ||
            "Potentially stronger alternative based on available public evidence.",
          aiLikeRisk: getString(record.aiLikeRisk) || "Unknown",
        };
      });

    const recommendations = await Promise.all(
      baseRecommendations.map(async (item) => {
        const imageUrl = item.imageUrl || (await extractOpenGraphImage(item.url));

        return attachAffiliateUrl({
          ...item,
          imageUrl: imageUrl || null,
        });
      })
    );

    return NextResponse.json({
      ok: true,
      shopperOnly: true,
      scanId,
      resultSource: "recommendations",
      locale,
      outputLanguage,
      affiliateReady: Boolean(getAmazonAssociateTag()),
      affiliateProviders: {
        amazonReady: Boolean(getAmazonAssociateTag()),
      },
      disclosure: getAffiliateDisclosure(),
      recommendations: normalizeRecommendationUrls(
        recommendations,
        "amazon.ca",
        productName,
        brand,
      ),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Product recommendations failed.",
      },
      { status: 500 }
    );
  }
}
