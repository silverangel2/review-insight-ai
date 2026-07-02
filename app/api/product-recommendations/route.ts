import { NextRequest, NextResponse } from "next/server";
import { attachAffiliateUrl, getAffiliateDisclosure } from "@/lib/affiliate";

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
  return typeof value === "number" ? value : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bodyRecord = asRecord(body);
    const result = asRecord(bodyRecord.result);
    const productIdentity = asRecord(result.productIdentity);
    const productIdentitySnake = asRecord(result.product_identity);

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

Scanned product:
${JSON.stringify({ productName, brand, verdict, result }, null, 2)}

Find up to 3 better Amazon.ca product alternatives when possible:
1. Best Overall
2. Best Budget
3. Best Reviewed

Rules:
- This is for shopper results only, not seller analytics.
- Prefer Amazon.ca links.
- Do not invent exact rating, review count, price, or product URLs.
- Do not recommend random unrelated products.
- Recommendations must be the same category or a very close substitute.
- Only say a product is better if the public evidence appears stronger.
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
      "rating": 4.5,
      "reviewCount": 1200,
      "price": "$99.99",
      "badge": "Best Overall",
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

    const recommendations = rawRecommendations
      .filter((item: unknown) => {
        const record = asRecord(item);
        return getString(record.title) && getString(record.url).startsWith("http");
      })
      .slice(0, 3)
      .map((item: unknown) => {
        const record = asRecord(item);

        return attachAffiliateUrl({
          title: getString(record.title),
          store: getString(record.store) || "Amazon.ca",
          url: getString(record.url),
          rating: getNumber(record.rating),
          reviewCount: getNumber(record.reviewCount),
          price: getString(record.price) || null,
          badge: getString(record.badge) || "Better Pick",
          whyBetter:
            getString(record.whyBetter) ||
            "Potentially stronger alternative based on available public evidence.",
          aiLikeRisk: getString(record.aiLikeRisk) || "Unknown",
        });
      });

    return NextResponse.json({
      ok: true,
      shopperOnly: true,
      affiliateReady: Boolean(process.env.AMAZON_ASSOCIATE_TAG),
      disclosure: getAffiliateDisclosure(),
      recommendations,
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
