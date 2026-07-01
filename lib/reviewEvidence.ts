type ReviewEvidenceInput = {
  productName: string;
  brand?: string;
  model?: string;
};

export type ReviewEvidenceResult = {
  sourcesChecked: string[];
  reviewsFound: number;
  commentsAnalyzed: number;
  evidenceStrength: "none" | "weak" | "limited" | "usable" | "strong";
  sourceNotes: string[];
  reviewAuthenticity: {
    score: number | null;
    label: string;
    suspiciousReviewRisk: "Not scored" | "Low" | "Medium" | "High" | "Very high";
    reasons: string[];
    suspiciousComments: Array<{
      source: string;
      snippet: string;
      riskScore: number;
      reason: string;
    }>;
  };
};

function emptyEvidence(reason = "No review evidence collected."): ReviewEvidenceResult {
  return {
    sourcesChecked: [],
    reviewsFound: 0,
    commentsAnalyzed: 0,
    evidenceStrength: "none",
    sourceNotes: [reason],
    reviewAuthenticity: {
      score: null,
      label: "Review scan not verified",
      suspiciousReviewRisk: "Not scored",
      reasons: [reason],
      suspiciousComments: [],
    },
  };
}

function cleanJsonText(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function collectAndAnalyzeReviewEvidence(
  input: ReviewEvidenceInput
): Promise<ReviewEvidenceResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return emptyEvidence("OPENAI_API_KEY is missing, so ReviewIntel could not search review evidence.");
  }

  const product = [input.brand, input.productName, input.model]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!product || product.length < 3) {
    return emptyEvidence("Product name was not clear enough to search reviews.");
  }

  const prompt = `
You are ReviewIntel's review-evidence scanner.

Task:
Search the web for public review evidence about this product:
"${product}"

Search intent:
- buyer reviews
- complaints
- product review comments
- Reddit/user discussions
- marketplace review snippets
- repeated praise/complaint patterns
- fake-review or AI-like review signals

Important:
Do not invent reviews.
Only analyze review snippets, comments, complaints, or buyer statements that you can find from search-accessible sources.
If you cannot find enough review/comment evidence, return score null.

Analyze each collected review/comment snippet for suspicious or AI-like signals:
- generic praise with no product-specific detail
- repeated wording
- overly polished marketing tone
- same structure across comments
- rating/text mismatch
- vague "highly recommend" style
- no real usage details
- clustered complaints or suspicious patterns

Return ONLY valid JSON. No markdown.

Required JSON shape:
{
  "sourcesChecked": ["source name or domain"],
  "reviewsFound": 0,
  "commentsAnalyzed": 0,
  "evidenceStrength": "none | weak | limited | usable | strong",
  "sourceNotes": ["short notes"],
  "reviewAuthenticity": {
    "score": null,
    "label": "Review scan not verified",
    "suspiciousReviewRisk": "Not scored",
    "reasons": ["short reasons"],
    "suspiciousComments": [
      {
        "source": "source name or domain",
        "snippet": "short review/comment snippet only",
        "riskScore": 0,
        "reason": "why suspicious or not"
      }
    ]
  }
}

Scoring rules:
- score means AI-like/fake-review RISK, not credibility.
- 0 means very low fake-review risk.
- 100 means very high fake-review risk.
- Do NOT give a high score because sources are reputable.
- Reputable sources, verified purchases, diverse user feedback, and specific complaints should LOWER the score.
- Only give score above 60 when there are actual suspicious review snippets or repeated suspicious patterns.
- commentsAnalyzed = 0: score must be null, risk must be "Not scored"
- commentsAnalyzed 1-4: evidenceStrength = "weak"
- commentsAnalyzed 5-14: evidenceStrength = "limited"
- commentsAnalyzed 15-29: evidenceStrength = "usable"
- commentsAnalyzed 30+: evidenceStrength = "strong"
- Do NOT use 50 as a fallback.
- Only return suspiciousComments when riskScore is 60 or higher.
- Only return a number score if real review/comment snippets were analyzed.
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
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return emptyEvidence(`OpenAI web review search failed: ${response.status} ${errorText.slice(0, 180)}`);
    }

    const data = await response.json();

    const outputText =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("\n") ||
      "";

    if (!outputText.trim()) {
      return emptyEvidence("OpenAI web review search returned no review evidence.");
    }

    const parsed = JSON.parse(cleanJsonText(outputText));

    const commentsAnalyzed = Number(parsed.commentsAnalyzed || 0);
    const parsedScore =
      typeof parsed.reviewAuthenticity?.score === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.reviewAuthenticity.score)))
        : null;

    const suspiciousComments = Array.isArray(parsed.reviewAuthenticity?.suspiciousComments)
      ? parsed.reviewAuthenticity.suspiciousComments
          .filter((comment: { riskScore?: number }) => typeof comment.riskScore === "number" && comment.riskScore >= 60)
          .slice(0, 8)
      : [];

    const reasonText = Array.isArray(parsed.reviewAuthenticity?.reasons)
      ? parsed.reviewAuthenticity.reasons.join(" ").toLowerCase()
      : "";

    const saysNoSuspiciousSignals =
      reasonText.includes("no significant signs") ||
      reasonText.includes("no significant patterns") ||
      reasonText.includes("no signs of inauthentic") ||
      reasonText.includes("no significant signs of inauthentic") ||
      reasonText.includes("no significant patterns of suspicious") ||
      reasonText.includes("no suspicious") ||
      reasonText.includes("not suspicious") ||
      reasonText.includes("no ai-like") ||
      reasonText.includes("no patterns of suspicious") ||
      reasonText.includes("no evidence of suspicious");

    const positiveCredibilitySignals =
      reasonText.includes("reputable") ||
      reasonText.includes("established sources") ||
      reasonText.includes("high credibility") ||
      reasonText.includes("verified purchase") ||
      reasonText.includes("diverse sources") ||
      reasonText.includes("genuine user") ||
      reasonText.includes("authentic reviews");

    const hasHighRiskComments = suspiciousComments.some(
      (comment: { riskScore?: number }) =>
        typeof comment.riskScore === "number" && comment.riskScore >= 60
    );

    const score =
      commentsAnalyzed > 0 && parsedScore !== null
        ? !hasHighRiskComments && (saysNoSuspiciousSignals || positiveCredibilitySignals)
          ? Math.min(parsedScore, 15)
          : !hasHighRiskComments && parsedScore >= 60
            ? 25
            : parsedScore
        : null;

    return {
      sourcesChecked: Array.isArray(parsed.sourcesChecked) ? parsed.sourcesChecked : [],
      reviewsFound: Number(parsed.reviewsFound || commentsAnalyzed || 0),
      commentsAnalyzed,
      evidenceStrength:
        commentsAnalyzed >= 30
          ? "strong"
          : commentsAnalyzed >= 15
            ? "usable"
            : commentsAnalyzed >= 5
              ? "limited"
              : commentsAnalyzed > 0
                ? "weak"
                : "none",
      sourceNotes: Array.isArray(parsed.sourceNotes) ? parsed.sourceNotes : [],
      reviewAuthenticity: {
        score: commentsAnalyzed > 0 ? score : null,
        label:
          commentsAnalyzed > 0
            ? score === null
              ? "Review evidence analyzed"
              : score >= 76
                ? "Very high AI-like review risk"
                : score >= 51
                  ? "High AI-like review risk"
                  : score >= 26
                    ? "Moderate AI-like review risk"
                    : "Low AI-like review risk"
            : "Review scan not verified",
        suspiciousReviewRisk:
          commentsAnalyzed === 0 || score === null
            ? "Not scored"
            : score >= 76
              ? "Very high"
              : score >= 51
                ? "High"
                : score >= 26
                  ? "Medium"
                  : "Low",
        reasons: Array.isArray(parsed.reviewAuthenticity?.reasons)
          ? parsed.reviewAuthenticity.reasons
          : [],
        suspiciousComments,
      },
    };
  } catch (error: unknown) {
    return emptyEvidence(`Review evidence scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
