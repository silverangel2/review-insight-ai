export type SourceLink = {
  label: string;
  url: string;
  domain?: string;
};

export function storeSearchTarget(store?: string | null) {
  const value = String(store || "").toLowerCase();

  if (value.includes("walmart")) return "site:walmart.ca OR site:walmart.com";
  if (value.includes("amazon")) return "site:amazon.ca OR site:amazon.com";
  if (value.includes("best buy") || value.includes("bestbuy")) return "site:bestbuy.ca OR site:bestbuy.com";
  if (value.includes("costco")) return "site:costco.ca OR site:costco.com";
  if (value.includes("target")) return "site:target.com";

  return "";
}

export function normalizeSourceLinks(value: unknown): SourceLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.startsWith("http")
          ? { label: item.replace(/^https?:\/\//, "").slice(0, 80), url: item }
          : null;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const url = typeof record.url === "string" ? record.url : "";
        if (!url.startsWith("http")) return null;

        return {
          label:
            typeof record.label === "string"
              ? record.label
              : typeof record.title === "string"
                ? record.title
                : url.replace(/^https?:\/\//, "").slice(0, 80),
          url,
          domain: typeof record.domain === "string" ? record.domain : undefined,
        };
      }

      return null;
    })
    .filter((item): item is SourceLink => Boolean(item))
    .slice(0, 12);
}

export function humanVerdictRules(input: {
  rating?: number | null;
  reviewCount?: number | null;
  aiLikeRisk?: number | null;
  commentsAnalyzed?: number | null;
  severeComplaints?: boolean;
}) {
  const rating = input.rating ?? null;
  const reviewCount = input.reviewCount ?? null;
  const aiLikeRisk = input.aiLikeRisk ?? null;
  const commentsAnalyzed = input.commentsAnalyzed ?? 0;
  const severeComplaints = Boolean(input.severeComplaints);

  const hasReviewVolume =
    typeof rating === "number" &&
    typeof reviewCount === "number" &&
    reviewCount >= 10;

  if (!hasReviewVolume && commentsAnalyzed < 5) {
    return {
      verdict: "CONSIDER",
      confidence: 50,
      score: 5,
      value: "Needs review evidence",
      reason: "Review evidence is not enough. Do not downgrade to Avoid based only on a screenshot.",
    };
  }

  if (
    typeof rating === "number" &&
    rating >= 4.6 &&
    typeof reviewCount === "number" &&
    reviewCount >= 200 &&
    !severeComplaints &&
    (aiLikeRisk === null || aiLikeRisk < 40)
  ) {
    return {
      verdict: "BUY",
      confidence: 80,
      score: 8,
      value: "Strong",
      reason: "Good buy. Strong rating, strong review volume, and low AI-like review risk.",
    };
  }

  if (
    typeof rating === "number" &&
    rating >= 4.2 &&
    typeof reviewCount === "number" &&
    reviewCount >= 100 &&
    !severeComplaints &&
    (aiLikeRisk === null || aiLikeRisk < 60)
  ) {
    return {
      verdict: "CONSIDER",
      confidence: 64,
      score: 7,
      value: "Good",
      reason: "Cautious buy. Rating and review volume are strong enough to avoid an Avoid verdict, but complaints and return terms should still be checked.",
    };
  }

  if (
    (typeof rating === "number" && rating < 3.6 && typeof reviewCount === "number" && reviewCount >= 20) ||
    (severeComplaints && typeof rating === "number" && rating < 4.0) ||
    (typeof aiLikeRisk === "number" && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "AVOID",
      confidence: 35,
      score: 3,
      value: "Poor",
      reason: "Avoid based on weak rating, serious complaint signals, or high AI-like review risk.",
    };
  }

  return {
    verdict: "CONSIDER",
    confidence: 60,
    score: 6,
    value: "Fair",
    reason: "Mixed but not enough to avoid. Check complaints, alternatives, and return terms before buying.",
  };
}

export function explainVerdictChange(previous?: string | null, current?: string | null, reason?: string | null) {
  if (!previous || !current || previous === current) {
    return "Verdict remained stable because ReviewIntel matched this product to stored product memory.";
  }

  return `Verdict changed from ${previous} to ${current} because ${reason || "new review evidence or product memory changed the decision basis."}`;
}
