import { scoreEvidenceBundle } from "@/lib/evidenceBundle";
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


function textHasPraise(text: string) {
  const value = text.toLowerCase();

  return [
    "good quality",
    "great value",
    "worth it",
    "sturdy",
    "durable",
    "lightweight",
    "works well",
    "recommended",
    "love it",
    "easy to use",
    "good for the price",
  ].some((term) => value.includes(term));
}

function countSources(payload: unknown) {
  const text = JSON.stringify(payload || {});
  const matches = text.match(/https?:\/\//g);
  return matches ? matches.length : 0;
}

function hasExactListing(payload: unknown) {
  const text = JSON.stringify(payload || {}).toLowerCase();

  return (
    text.includes("exactlisting") ||
    text.includes("exact listing") ||
    text.includes("listingevidence") ||
    text.includes("exactlistingurl") ||
    text.includes("exactlistingtitle")
  );
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
  const text = `${input.currentVerdict || ""} ${input.bottomLine || ""} ${input.productText || ""}`;
  const actualDanger = hasActualDangerSignal(text);

  const hasListingIdentity = hasExactListing(input.productText);
  const sourcesChecked = countSources(input.productText);

  const evidenceBundle = scoreEvidenceBundle({
    rating,
    reviewCount,
    aiLikeRisk,
    commentsAnalyzed: input.commentsAnalyzed ?? null,
    sourcesChecked,

    // Important:
    // Exact listing and memory prove product identity only.
    // They are NOT review evidence and must not inflate the buy score.
    exactListingMatched: false,
    memoryMatched: false,

    hasComplaints: actualDanger || Boolean(input.severeComplaints),
    hasPraise: textHasPraise(text),
  });

  const hasVerifiedReviewEvidence =
    (rating !== null && rating > 0) ||
    (reviewCount !== null && reviewCount > 0) ||
    (typeof input.commentsAnalyzed === "number" && input.commentsAnalyzed >= 10);

  // Product identity without readable reviews is not a product recommendation.
  // It is an evidence-limited state.
  if (
    hasListingIdentity &&
    !hasVerifiedReviewEvidence &&
    !actualDanger &&
    !(aiLikeRisk !== null && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "REVIEW EVIDENCE NOT ENOUGH",
      buyerConfidence: 82,
      buyScore: 0,
      valueForMoney: "Unknown",
      bottomLine:
        "ReviewIntel found the product listing, but did not find enough readable review evidence to judge the product quality. This is not an Avoid verdict; it means the review evidence is limited.",
    };
  }

  // Enough review evidence can support a cautious Consider.
  // Listing identity or memory alone cannot trigger this.
  if (
    evidenceBundle.hasEnoughEvidence &&
    hasVerifiedReviewEvidence &&
    !actualDanger &&
    !(aiLikeRisk !== null && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "CONSIDER",
      buyerConfidence: Math.min(82, Math.max(60, evidenceBundle.evidenceScore)),
      buyScore:
        rating !== null && rating >= 4.5 && reviewCount !== null && reviewCount >= 300
          ? 8
          : 6,
      valueForMoney: "Fair",
      bottomLine:
        "ReviewIntel found usable review evidence, but not enough for a strong Buy. Check repeated complaints, current price, and return policy before purchasing.",
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

  // Incomplete screenshot is not negative evidence.
  // The app should search/match memory first. If no evidence is found after tools run,
  // return an honest no-decision state, not fake Consider and not fake Avoid.
  if (
    (rating === null || reviewCount === null) &&
    !actualDanger &&
    !(aiLikeRisk !== null && aiLikeRisk >= 75)
  ) {
    return {
      verdict: "REVIEW EVIDENCE NOT ENOUGH",
      buyerConfidence: 0,
      buyScore: 0,
      valueForMoney: "Unknown",
      bottomLine:
        "ReviewIntel could not confirm enough public review evidence after the available product match/search. This is not an Avoid verdict; it means the app needs stronger listing or review evidence before recommending.",
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
