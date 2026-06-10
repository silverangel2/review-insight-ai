import type { ReviewAnalysis } from "./types";

const POSITIVE_TERMS = [
  "great",
  "excellent",
  "love",
  "loved",
  "perfect",
  "good",
  "easy",
  "quality",
  "recommend",
  "comfortable",
  "durable",
  "works",
  "fast",
  "value",
  "sturdy"
];

const NEGATIVE_TERMS = [
  "bad",
  "poor",
  "broken",
  "cheap",
  "return",
  "refund",
  "defect",
  "defective",
  "damaged",
  "late",
  "missing",
  "hard",
  "difficult",
  "weak",
  "stopped",
  "disappointed"
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "was",
  "were",
  "are",
  "you",
  "your",
  "but",
  "not",
  "have",
  "has",
  "had",
  "from",
  "they",
  "them",
  "its",
  "it",
  "very",
  "just",
  "one",
  "use",
  "used",
  "product",
  "item",
  "amazon",
  "walmart",
  "etsy",
  "ebay"
]);

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function includesAny(sentence: string, terms: string[]) {
  const lower = sentence.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function pick(sentences: string[], terms: string[], fallback: string) {
  const matches = sentences.filter((sentence) => includesAny(sentence, terms));
  return (matches.length ? matches : [fallback]).slice(0, 5);
}

function topKeywords(text: string) {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
}

function scoreText(text: string) {
  const lower = text.toLowerCase();
  const positive = POSITIVE_TERMS.reduce((sum, term) => sum + (lower.match(new RegExp(`\\b${term}\\b`, "g"))?.length ?? 0), 0);
  const negative = NEGATIVE_TERMS.reduce((sum, term) => sum + (lower.match(new RegExp(`\\b${term}\\b`, "g"))?.length ?? 0), 0);
  const total = Math.max(1, positive + negative);
  return Math.max(-1, Math.min(1, Number(((positive - negative) / total).toFixed(2))));
}

function normalizeReviewCountKey(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:verified purchase|verified buyer|helpful votes?|report abuse)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isCountableReviewLine(line: string) {
  const clean = line.trim();
  const lower = clean.toLowerCase();
  if (!clean) return false;
  if (/^(rating|stars?|score|review|reviews?|review text|review body|comment|comments?|feedback|body|content|title|headline|date|user|customer|reviewer|asin|sku|product|variant|verified|helpful|country|marketplace)(\s*[,|\t]|$)/i.test(clean)) return false;
  if (/^[\d\s.,$%:/#-]+$/.test(clean) && clean.length < 28) return false;
  if (/^(yes|no|true|false|null|n\/a|na)$/i.test(lower)) return false;
  return normalizeReviewCountKey(clean).length > 20;
}

export function estimateReviewCount(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const uniqueReviewLines = new Set(
    normalized
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => /^review\s+\d+\s*:/i.test(line))
      .map((line) => line.replace(/^review\s+\d+\s*:\s*/i, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
      .filter((line) => line.length > 20)
  );
  const countableLines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(isCountableReviewLine);
  const uniqueLooseLines = new Set(countableLines.map(normalizeReviewCountKey).filter((line) => line.length > 20));
  const explicitReviewBlocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => isCountableReviewLine(block) && block.length > 40).length;
  const ratingLineCount = normalized
    .split(/\n+/)
    .filter((line) => isCountableReviewLine(line) && /^\s*(review\s*)?([1-5](?:\.\d)?\s*(star|stars|\/5)|rating\s*[:\-]?\s*[1-5])/i.test(line.trim())).length;
  const starredCount = (normalized.match(/\b[1-5](?:\.\d)?\s*(star|stars|\/5)\b/gi) ?? []).length;
  const titledReviewCount = (normalized.match(/(?:^|\n)\s*(review|customer|buyer)\s*#?\d+\s*[:.-]/gi) ?? []).length;
  const sentenceCount = splitSentences(text).length;

  if (uniqueReviewLines.size > 0) return uniqueReviewLines.size;
  if (ratingLineCount > 1) return ratingLineCount;
  if (titledReviewCount > 0) return titledReviewCount;
  if (uniqueLooseLines.size > 1 && countableLines.length <= uniqueLooseLines.size + 2) return uniqueLooseLines.size;
  if (starredCount > 0) return Math.max(starredCount, ratingLineCount);
  if (explicitReviewBlocks > 1) return explicitReviewBlocks;

  return Math.max(1, Math.round(sentenceCount / 5));
}

export function analyzeReviewsLocally(reviews: string): ReviewAnalysis {
  const sentences = splitSentences(reviews);
  const sentiment = scoreText(reviews);
  const keywords = topKeywords(reviews);
  const positives = pick(sentences, POSITIVE_TERMS, "Positive themes are present but need more review volume to separate clearly.");
  const negatives = pick(sentences, NEGATIVE_TERMS, "Negative themes are limited in the pasted sample.");
  const complaintHints = ["broken", "damaged", "missing", "stopped", "defect", "return", "refund", "cheap", "late"];
  const praisedHints = ["quality", "easy", "comfortable", "sturdy", "fast", "value", "works", "perfect"];
  const shippingHints = ["shipping", "package", "packaging", "box", "delivery", "damaged", "late"];
  const refundHints = ["return", "refund", "broken", "defective", "stopped working", "missing"];
  const valueText = sentiment >= 0.35
    ? "Most signals point to acceptable value for money, assuming the price is competitive."
    : sentiment <= -0.25
      ? "Value for money is questionable because complaints outweigh praise in the pasted reviews."
      : "Value for money looks mixed; shoppers may need to compare alternatives.";

  const verdict = sentiment >= 0.35 ? "Buy" : sentiment <= -0.35 ? "Avoid" : "Maybe";
  const recommendation = {
    verdict,
    rationale:
      verdict === "Buy"
        ? "Praise appears stronger than risk signals in the supplied reviews."
        : verdict === "Avoid"
          ? "Complaint and refund-risk language appears too strong for a confident buy."
          : "The review sample is mixed, so the product needs closer comparison before purchase."
  } as const;
  const featureRequests = pick(sentences, ["wish", "need", "could", "should", "feature", "version"], "No explicit feature requests were detected.");
  const packagingIssues = pick(sentences, shippingHints, "No clear shipping or packaging pattern was detected.");
  const durabilityIssues = pick(sentences, ["stopped", "broke", "broken", "durable", "weak", "lasted"], "Durability evidence is limited in this sample.");
  const supportIssues = pick(sentences, ["support", "service", "seller", "warranty", "replacement", "response"], "Customer support evidence is limited in this sample.");
  const productScore = Math.max(0, Math.min(100, Math.round(55 + sentiment * 35 + Math.min(10, reviews.length / 1200))));
  const keywordAnalysis = keywords.slice(0, 8).map((keyword) => ({
    keyword,
    mentions: reviews.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, "g"))?.length ?? 1,
    sentiment: includesAny(keyword, NEGATIVE_TERMS) ? "negative" as const : includesAny(keyword, POSITIVE_TERMS) ? "positive" as const : "neutral" as const,
    context: `Mentioned in the supplied review sample.`
  }));

  const complaintThemes = pick(
    sentences,
    complaintHints,
    "No strong repeated complaint pattern was detected in the pasted sample."
  );

  const praiseThemes = pick(
    sentences,
    praisedHints,
    "No single praised feature dominates the pasted sample."
  );

  return {
    overall_summary:
      "Local fallback analysis found a " +
      (sentiment > 0.25 ? "mostly positive" : sentiment < -0.25 ? "mostly negative" : "mixed") +
      " review pattern. Add an OpenAI API key for deeper theme extraction and better seller insights.",
    positive_points: positives,
    negative_points: negatives,
    common_complaints: complaintThemes,
    praised_features: praiseThemes,
    quality_concerns: pick(sentences, ["quality", "cheap", "broken", "defect", "stopped", "weak"], "Quality concern evidence is limited in the pasted sample."),
    product_quality_concerns: pick(sentences, ["quality", "cheap", "broken", "defect", "stopped", "weak"], "Quality concern evidence is limited in the pasted sample."),
    value_for_money_opinion: valueText,
    buyer_recommendation: recommendation,
    customer_recommendation: recommendation,
    product_score: productScore,
    fake_review_indicators: [
      "Local fallback cannot reliably detect fake-review patterns.",
      "Use OpenAI vision/text analysis for stronger review authenticity signals."
    ],
    seller_insights: {
      main_customer_pain_points: pick(sentences, NEGATIVE_TERMS, "Collect more reviews to identify repeatable pain points."),
      complaint_clusters: complaintThemes,
      product_improvement_recommendations: [
        "Prioritize the most repeated defect, setup, or expectation mismatch first.",
        "Turn recurring support questions into listing content and onboarding inserts."
      ],
      listing_improvement_suggestions: [
        "Clarify size, materials, compatibility, and what is included in the box.",
        "Add expectation-setting bullets around limitations mentioned by customers.",
        "Use review language to rewrite benefits in customer terms."
      ],
      packaging_shipping_issues: packagingIssues,
      shipping_complaint_detection: packagingIssues,
      sentiment_trends: ["Local fallback does not have dated review trend data. Upload batches by date for trend analysis."],
      refund_risk_issues: pick(sentences, refundHints, "Refund risk appears low or unclear from this sample."),
      feature_requests: featureRequests,
      competitor_opportunity_insights: [
        "Compare complaints against competitor listings and address the top recurring weakness first.",
        "Use praised features as ad copy only when the product reliably delivers them."
      ],
      seller_recommendations: [
        "Create a weekly review operations loop: cluster complaints, assign owners, and update listing copy after fixes.",
        "Escalate refund-risk language to product and support teams before paid traffic is increased."
      ],
      seller_action_cards: [
        {
          card_type: "competitor_edge",
          title: "What customers respond to",
          finding: `Reviews show buyer response around ${praiseThemes[0]}.`,
          review_evidence_theme: praiseThemes.slice(0, 3).join("; "),
          seller_meaning: `This shows what buyers may already value and what competitors may also use as proof.`,
          recommended_action: `Use ${praiseThemes[0]} as a proof point only if your product consistently delivers it.`,
          confidence: Math.min(85, 45 + praiseThemes.length * 8)
        },
        {
          card_type: "your_product_risk",
          title: "What may hurt conversion",
          finding: `Reviews show risk around ${complaintThemes[0]}.`,
          review_evidence_theme: complaintThemes.slice(0, 3).join("; "),
          seller_meaning: `This can create buyer hesitation, lower trust, refund risk, or weaker conversion.`,
          recommended_action: `Fix, clarify, or add proof around ${complaintThemes[0]} before increasing paid traffic.`,
          confidence: Math.min(90, 50 + complaintThemes.length * 8)
        },
        {
          card_type: "attack_opportunity",
          title: "Weakness to attack",
          finding: `A repeated complaint theme is ${complaintThemes[0]}.`,
          review_evidence_theme: complaintThemes.slice(0, 3).join("; "),
          seller_meaning: `If competitors have the same weakness, this becomes a positioning opportunity.`,
          recommended_action: `Show how your product handles ${complaintThemes[0]} better, but only if the claim is true.`,
          confidence: Math.min(82, 42 + complaintThemes.length * 7)
        },
        {
          card_type: "fix_first",
          title: "Fix first",
          finding: `${complaintThemes[0]} appears to be the first issue to investigate.`,
          review_evidence_theme: complaintThemes.slice(0, 3).join("; "),
          seller_meaning: `The most repeated complaint should be fixed before pushing more sales traffic.`,
          recommended_action: `Assign an owner, update the product or listing, and track whether future reviews still mention ${complaintThemes[0]}.`,
          confidence: Math.min(88, 48 + complaintThemes.length * 8)
        },
        {
          card_type: "advertise_this",
          title: "What to advertise",
          finding: `Positive review themes point to ${praiseThemes[0]}.`,
          review_evidence_theme: praiseThemes.slice(0, 3).join("; "),
          seller_meaning: `Buyer-approved language is stronger than generic marketing claims.`,
          recommended_action: `Turn ${praiseThemes[0]} into listing bullets, images, comparison copy, or ad hooks.`,
          confidence: Math.min(86, 46 + praiseThemes.length * 8)
        },
        {
          card_type: "next_seller_move",
          title: "Next seller move",
          finding: `The clearest move is to protect ${praiseThemes[0]} while fixing ${complaintThemes[0]}.`,
          review_evidence_theme: [...complaintThemes.slice(0, 2), ...praiseThemes.slice(0, 2)].join("; "),
          seller_meaning: `This balances product improvement with stronger sales positioning.`,
          recommended_action: `Update the offer around ${praiseThemes[0]}, then reduce buyer doubt around ${complaintThemes[0]}.`,
          confidence: Math.min(84, 45 + complaintThemes.length * 5 + praiseThemes.length * 5)
        }
      ],
      customer_satisfaction_score: productScore
    },
    improvement_suggestions: [
      "Prioritize fixes for the highest-frequency complaint theme.",
      "Improve listing images and bullets where expectations are unclear.",
      "Track refund-risk language weekly as new reviews arrive."
    ],
    feature_requests: featureRequests,
    packaging_issues: packagingIssues,
    durability_issues: durabilityIssues,
    support_issues: supportIssues,
    sentiment_score: sentiment,
    confidence_score: Math.min(0.72, Math.max(0.32, Number((reviews.length / 8000).toFixed(2)))),
    keywords,
    keyword_analysis: keywordAnalysis
  };
}
