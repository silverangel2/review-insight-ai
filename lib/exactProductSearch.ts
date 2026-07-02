import { storeSearchTarget } from "@/lib/reviewToolHelpers";
type ExactProductSearchInput = {
  productName: string;
  brand?: string;
  store?: string;
  price?: number;
  rating?: number | null;
  reviewCount?: number | null;

};

export type ExactProductSearchResult = {
  exactListingUrl: string | null;
  exactListingTitle: string | null;
  store: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  confidence: "none" | "low" | "medium" | "high";
  sourcesChecked: string[];
  notes: string[];
};

function emptyExactResult(reason: string): ExactProductSearchResult {
  return {
    exactListingUrl: null,
    exactListingTitle: null,
    store: null,
    price: null,
    rating: null,
    reviewCount: null,
    confidence: "none",
    sourcesChecked: [],
    notes: [reason],
  };
}

function cleanJsonText(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function clampRating(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

function parsePositiveNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function parsePositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}


function acceptedExactDomainForStore(store: unknown): string | null {
  const value = String(store || "").toLowerCase();

  if (value.includes("walmart.ca") || value.includes("walmart canada")) return "walmart.ca";
  if (value.includes("walmart.com") || value === "walmart") return "walmart.com";
  if (value.includes("amazon.ca")) return "amazon.ca";
  if (value.includes("amazon.com")) return "amazon.com";
  if (value.includes("bestbuy.ca") || value.includes("best buy canada")) return "bestbuy.ca";
  if (value.includes("bestbuy.com")) return "bestbuy.com";
  if (value.includes("costco.ca") || value.includes("costco canada")) return "costco.ca";
  if (value.includes("costco.com")) return "costco.com";

  return null;
}

function urlHostMatchesAcceptedDomain(url: string | null, acceptedDomain: string | null): boolean {
  if (!acceptedDomain) return true;
  if (!url) return false;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === acceptedDomain || host.endsWith(`.${acceptedDomain}`);
  } catch {
    return false;
  }
}

function parseConfidence(value: unknown): ExactProductSearchResult["confidence"] {
  if (value === "high" || value === "medium" || value === "low" || value === "none") {
    return value;
  }
  return "none";
}

export async function findExactProductListing(
  input: ExactProductSearchInput
): Promise<ExactProductSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return emptyExactResult("OPENAI_API_KEY is missing.");
  }

  const product = [
    input.store,
    input.brand,
    input.productName,
    input.price ? `$${input.price}` : "",
    input.rating ? `${input.rating} rating` : "",
    input.reviewCount ? `${input.reviewCount} reviews` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!product || product.length < 3) {
    return emptyExactResult("Product identity was not clear enough for exact listing search.");
  }

  const storeTarget = storeSearchTarget(input.store);

  const prompt = `
You are ReviewIntel's exact product listing finder.

Find the most likely exact public product listing for:
"${product}"

Preferred store targeting:
${storeTarget || "No specific store target. Search broadly."}

Known screenshot/listing clues:
- Store: ${input.store || "not provided"}
- Price: ${input.price ?? "not provided"}
- Rating: ${input.rating ?? "not provided"}
- Review count: ${input.reviewCount ?? "not provided"}

Use these clues as identity signals. Prefer listings where title, store, price, rating, and review count match. Do not invent missing rating or review count.

Priority:
1. Exact store listing if store is known, especially Walmart, Amazon, Best Buy, Costco, Target.
2. Match brand, title, product type, price, rating, and review count.
3. Avoid broad category pages.
4. Avoid unrelated products.
5. Do not invent URLs, ratings, review counts, or prices.

Return ONLY valid JSON. No markdown.

JSON shape:
{
  "exactListingUrl": null,
  "exactListingTitle": null,
  "store": null,
  "price": null,
  "rating": null,
  "reviewCount": null,
  "confidence": "none | low | medium | high",
  "sourcesChecked": [],
  "notes": [],
  "sourceLinks": [
    {
      "label": "source title",
      "url": "https://example.com",
      "domain": "example.com"
    }
  ]
}

Rules:
- If you find Walmart listing with visible rating/review count, include them.
- If only search snippets are available, include values only if visible in evidence.
- If not confident it is the same product, confidence must be low or none.
- Do not guess rating or review count.
`;

  try {
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
      const errorText = await response.text().catch(() => "");
      return emptyExactResult(`Exact listing search failed: ${response.status} ${errorText.slice(0, 180)}`);
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join("\n") ||
      "";

    if (!outputText.trim()) {
      return emptyExactResult("Exact listing search returned no usable result.");
    }

    const parsed = JSON.parse(cleanJsonText(outputText)) as Record<string, unknown>;

    const exactListingUrl =
      typeof parsed.exactListingUrl === "string" && parsed.exactListingUrl.trim()
        ? parsed.exactListingUrl.trim()
        : null;

    const acceptedDomain = acceptedExactDomainForStore(input.store);

    if (!urlHostMatchesAcceptedDomain(exactListingUrl, acceptedDomain)) {
      return {
        exactListingUrl: null,
        exactListingTitle:
          typeof parsed.exactListingTitle === "string" && parsed.exactListingTitle.trim()
            ? parsed.exactListingTitle.trim()
            : null,
        store:
          typeof parsed.store === "string" && parsed.store.trim()
            ? parsed.store.trim()
            : null,
        price: null,
        rating: null,
        reviewCount: null,
        confidence: "low",
        sourcesChecked: Array.isArray(parsed.sourcesChecked)
          ? parsed.sourcesChecked.map(String).slice(0, 12)
          : exactListingUrl
            ? [exactListingUrl]
            : [],
        notes: [
          `Rejected returned listing because requested store requires ${acceptedDomain}, but the returned URL was ${exactListingUrl || "missing"}.`,
          "ReviewIntel did not use this as exact product evidence.",
        ],
      };
    }

    return {
      exactListingUrl,
      exactListingTitle:
        typeof parsed.exactListingTitle === "string" && parsed.exactListingTitle.trim()
          ? parsed.exactListingTitle.trim()
          : null,
      store:
        typeof parsed.store === "string" && parsed.store.trim()
          ? parsed.store.trim()
          : null,
      price: parsePositiveNumber(parsed.price),
      rating: clampRating(parsed.rating),
      reviewCount: parsePositiveInteger(parsed.reviewCount),
      confidence: parseConfidence(parsed.confidence),
      sourcesChecked: Array.isArray(parsed.sourcesChecked)
        ? parsed.sourcesChecked.map(String).slice(0, 12)
        : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 8) : [],
    };
  } catch (error: unknown) {
    return emptyExactResult(
      error instanceof Error ? error.message : "Exact listing search failed."
    );
  }
}
