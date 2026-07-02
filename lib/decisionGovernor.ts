export type GovernedDecision = {
  verdict: string;
  buyerConfidence: number;
  buyScore: number;
  valueForMoney: string;
  bottomLine: string;
};

function hasActualDangerSignal(text: string) {
  const value = text.toLowerCase();

  return [
    "unsafe",
    "dangerous",
    "fire",
    "smoke",
    "exploded",
    "injury",
    "counterfeit",
    "scam",
    "fraud",
    "broken on arrival",
    "arrived broken",
    "defective",
    "does not work",
    "stopped working",
    "leaking",
    "mold",
  ].some((term) => value.includes(term));
}

export function governBuyerDecision(input: {
  rating?: number | null;
  reviewCount?: number | null;
  aiLikeRisk?: number | null;
  commentsAnalyzed?: number | null;
  severeComplaints?: boolean;
  currentVerdict?: string | null;
  bottomLine?: string | null;
  productText?: string | null;
}): GovernedDecision | null {
  const rating = typeof input.rating === "number" ? input.rating : null;
  const reviewCount = typeof input.reviewCount === "number" ? input.reviewCount : null;
  const aiLikeRisk = typeof input.aiLikeRisk === "number" ? input.aiLikeRisk : null;
  const commentsAnalyzed = input.commentsAnalyzed ?? 0;

  const text = `${input.currentVerdict || ""} ${input.bottomLine || ""} ${input.productText || ""}`;
  const actualDanger = hasActualDangerSignal(text);

  // Strong public evidence should beat screenshot weakness.
  if (
    rating !== null &&
    rating >= 4.2 &&
    reviewCount !== null &&
    reviewCount >= 100 &&
    !actualDanger &&
    (aiLikeRisk === null || aiLikeRisk < 75)
  ) {
    return {
      verdict: "CONSIDER",
      buyerConfidence: 74,
      buyScore: 7,
      valueForMoney: "Good",
      bottomLine:
        "Cautious buy. Public review evidence is strong enough to avoid an Avoid verdict, but check complaints and return terms first.",
    };
  }

  // Excellent rating + strong review count can become Buy.
  if (
    rating !== null &&
    rating >= 4.6 &&
    reviewCount !== null &&
    reviewCount >= 300 &&
    !actualDanger &&
    (aiLikeRisk === null || aiLikeRisk < 45)
  ) {
    return {
      verdict: "BUY",
      buyerConfidence: 84,
      buyScore: 8,
      valueForMoney: "Strong",
      bottomLine:
        "Good buy. Rating, review volume, and available evidence are strong.",
    };
  }

  // Screenshot missing rating/review count must never become Avoid by itself.
  if (
    (rating === null || reviewCount === null) &&
    !actualDanger &&
    !(aiLikeRisk !== null && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "CONSIDER",
      buyerConfidence: 55,
      buyScore: 5,
      valueForMoney: "Needs evidence",
      bottomLine:
        "Review evidence is not enough from this screenshot alone. Do not treat missing rating or review count as an Avoid signal.",
    };
  }

  // Only avoid when there is actual negative evidence.
  if (
    actualDanger ||
    (rating !== null && rating < 3.6 && reviewCount !== null && reviewCount >= 20) ||
    (aiLikeRisk !== null && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "AVOID",
      buyerConfidence: 35,
      buyScore: 3,
      valueForMoney: "Poor",
      bottomLine:
        "Avoid based on actual negative review signals, weak rating, or high AI-like review risk.",
    };
  }

  return null;
}
