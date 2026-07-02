type EvidenceBundleInput = {
  rating?: number | null;
  reviewCount?: number | null;
  commentsAnalyzed?: number | null;
  sourcesChecked?: number | null;
  exactListingMatched?: boolean;
  memoryMatched?: boolean;
  hasComplaints?: boolean;
  hasPraise?: boolean;
  aiLikeRisk?: number | null;
};

export function scoreEvidenceBundle(input: EvidenceBundleInput) {
  let evidenceScore = 0;
  const reasons: string[] = [];

  if (input.exactListingMatched) {
    evidenceScore += 25;
    reasons.push("Exact product listing matched.");
  }

  if (input.memoryMatched) {
    evidenceScore += 20;
    reasons.push("Same product matched previous scan memory.");
  }

  if (typeof input.reviewCount === "number" && input.reviewCount >= 100) {
    evidenceScore += 20;
    reasons.push("Review volume is strong.");
  } else if (typeof input.reviewCount === "number" && input.reviewCount >= 20) {
    evidenceScore += 12;
    reasons.push("Review volume is usable.");
  }

  if (typeof input.rating === "number" && input.rating >= 4.2) {
    evidenceScore += 15;
    reasons.push("Public rating is acceptable.");
  } else if (typeof input.rating === "number" && input.rating < 3.7) {
    evidenceScore -= 20;
    reasons.push("Public rating is weak.");
  }

  if (typeof input.commentsAnalyzed === "number" && input.commentsAnalyzed >= 10) {
    evidenceScore += 15;
    reasons.push("Written review/comment evidence was analyzed.");
  } else if (typeof input.sourcesChecked === "number" && input.sourcesChecked > 0) {
    evidenceScore += 8;
    reasons.push("Public sources were checked.");
  }

  if (input.hasPraise) {
    evidenceScore += 5;
    reasons.push("Repeated praise was found.");
  }

  if (input.hasComplaints) {
    evidenceScore -= 15;
    reasons.push("Complaint patterns were found.");
  }

  if (typeof input.aiLikeRisk === "number" && input.aiLikeRisk >= 75) {
    evidenceScore -= 25;
    reasons.push("AI-like review risk is high.");
  }

  const evidenceLevel =
    evidenceScore >= 65 ? "strong" :
    evidenceScore >= 45 ? "usable" :
    evidenceScore >= 25 ? "limited" :
    "weak";

  return {
    evidenceScore,
    evidenceLevel,
    reasons,
    hasEnoughEvidence: evidenceScore >= 35,
  };
}
