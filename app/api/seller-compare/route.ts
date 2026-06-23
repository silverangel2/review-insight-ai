import { NextResponse } from "next/server";
import { rateLimitRequest, rejectSuspiciousInput } from "@/lib/security";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function compareOutputLanguage(locale: string) {
  switch (locale) {
    case "fr":
      return "French";
    case "es":
      return "Spanish";
    case "zh":
      return "Chinese";
    case "de":
      return "German";
    case "hi":
      return "Hindi";
    default:
      return "English";
  }
}


function textArray(value: unknown, limit = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 70) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalize(raw: Record<string, unknown>) {
  const oldProductPlan = textArray(raw.productImprovementPlan);
  const oldListingPlan = textArray(raw.listingImprovementPlan);
  const oldAdPlan = textArray(raw.adAnglePlan);
  const oldGaps = textArray(raw.buyerPainPointGaps);
  const oldActionPlan = textArray(raw.sellerActionPlan);

  return {
    competitivePosition: readText(raw.competitivePosition, "Close but needs fixes"),
    confidence: readNumber(raw.confidence, 70),
    executiveSummary: readText(raw.executiveSummary, "AI comparison completed."),
    marketMove: readText(raw.marketMove, readText(raw.fixFirst, "Close the strongest competitor advantage first.")),
    fixFirst: readText(raw.fixFirst, "Fix the most repeated buyer objection first."),
    outgrowStrategy: textArray(raw.outgrowStrategy).length ? textArray(raw.outgrowStrategy, 4) : oldActionPlan.slice(0, 4),
    competitorAdvantages: textArray(raw.competitorAdvantages, 4),
    yourAdvantages: textArray(raw.yourAdvantages, 4),
    conversionGaps: textArray(raw.conversionGaps).length ? textArray(raw.conversionGaps, 4) : oldGaps.slice(0, 4),
    productMoves: textArray(raw.productMoves).length ? textArray(raw.productMoves, 4) : oldProductPlan.slice(0, 4),
    listingMoves: textArray(raw.listingMoves).length ? textArray(raw.listingMoves, 4) : oldListingPlan.slice(0, 4),
    adAngles: textArray(raw.adAngles).length ? textArray(raw.adAngles, 4) : oldAdPlan.slice(0, 4),
    riskWarnings: textArray(raw.riskWarnings, 4),
    thirtyDayPlan: textArray(raw.thirtyDayPlan, 4),
    ninetyDayPlan: textArray(raw.ninetyDayPlan, 4),
    comparabilityWarning: readText(raw.comparabilityWarning),
  };
}

async function callOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      input: prompt
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI seller comparison failed.");
  }

  const outputRecord = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  const outputText =
    outputRecord.output_text ||
    outputRecord.output
      ?.flatMap((item) => item.content || [])
      ?.map((item) => item.text || "")
      ?.join("") ||
    "";

  const cleaned = outputText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  try {
    const limit = await rateLimitRequest(request, {
      key: "seller_compare_api",
      limit: 8,
      windowMs: 10 * 60 * 1000,
      eventType: "seller_compare_rate_limited"
    });

    if (!limit.allowed) {
      return limit.response ?? NextResponse.json({ error: "Too many seller comparison requests." }, { status: 429 });
    }

    const body = await request.json();
    const securityResponse = await rejectSuspiciousInput(
      request,
      JSON.stringify(body).slice(0, 120000),
      "seller competitor comparison"
    );

    if (securityResponse) return securityResponse;

    const yourProduct = body?.yourProduct;
    const competitorProduct = body?.competitorProduct;
    const yourLabel = String(body?.yourLabel || "Your product");
    const competitorLabel = String(body?.competitorLabel || "Competitor");
    const locale = normalizeLocale(body?.locale);
    const outputLanguage = compareOutputLanguage(locale);

    if (!yourProduct || !competitorProduct) {
      return NextResponse.json({ error: "Your product and competitor analysis are required." }, { status: 400 });
    }

    const prompt = `
You are ReviewIntel Seller Pro Compare.

This is the seller's product versus a competitor.

Your job:
- Give a premium Seller Pro strategy, not a generic comparison.
- Focus on how the seller can outgrow the competitor.
- Be concise. Every array item must be 5 to 14 words.
- Avoid vague lines like "improve quality" unless tied to a review signal.
- Use only the evidence in both review-analysis results.
- If products are not directly comparable, warn clearly.
- Return JSON only.
- Write every customer-visible JSON string in this language: ${outputLanguage}.
- Keep JSON keys exactly in English, but translate all values users will read.

Your product label:
${yourLabel}

Your product analysis:
${JSON.stringify(yourProduct, null, 2)}

Competitor label:
${competitorLabel}

Competitor analysis:
${JSON.stringify(competitorProduct, null, 2)}

Return JSON only:
{
  "competitivePosition": "Ahead" | "Behind" | "Close fight" | "Attack opportunity" | "Not directly comparable",
  "confidence": 0-100,
  "executiveSummary": "one short seller-facing summary, max 32 words",
  "marketMove": "one decisive strategy headline, max 12 words",
  "fixFirst": "first priority fix, max 16 words",
  "outgrowStrategy": ["how to beat or outgrow competitor"],
  "competitorAdvantages": ["what competitor does better"],
  "yourAdvantages": ["what your product can own"],
  "conversionGaps": ["buyer hesitation gaps to close"],
  "productMoves": ["product or quality moves"],
  "listingMoves": ["title, image, bullets, FAQ moves"],
  "adAngles": ["ads or positioning angles"],
  "riskWarnings": ["risks that could hurt growth"],
  "thirtyDayPlan": ["fast fixes in 30 days"],
  "ninetyDayPlan": ["bigger roadmap in 90 days"],
  "comparabilityWarning": "warning if not directly comparable, otherwise empty string"
}
`;

    const raw = await callOpenAI(prompt);
    return NextResponse.json(normalize(raw));
  } catch (error) {
    console.error("Seller compare failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seller comparison failed." },
      { status: 500 }
    );
  }
}
