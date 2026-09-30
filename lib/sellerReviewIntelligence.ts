/**
 * Deterministic seller review intelligence.
 *
 * Pure functions over the seller's own uploaded CSV rows. No network calls,
 * no AI, no invented data: every number, quote, and flag below derives from
 * the actual input rows. This layer exists so the LLM reasons over computed
 * facts (aspect frequencies, rating breakdowns, trends, anomaly signals)
 * instead of a flattened text sample, and so the report stays useful even
 * when the AI pass is unavailable.
 *
 * Honesty rules enforced here:
 * - Missing columns are reported as missing, never synthesized.
 * - Anomaly findings are framed as *signals*, never as accusations.
 * - Quotes are verbatim excerpts from the uploaded reviews.
 */

export type SellerReviewRow = Record<string, unknown>;

export type NormalizedSellerReview = {
  index: number;
  rating: number | null;
  date: string | null;
  timestamp: number | null;
  text: string;
  title: string;
  author: string | null;
  verified: boolean | null;
};

export type AspectFixType = "product" | "listing" | "support";

export type AspectSignal = {
  id: string;
  label: string;
  mentions: number;
  mentionShare: number;
  positive: number;
  negative: number;
  complaintShare: number;
  severity: 1 | 2 | 3;
  fixType: AspectFixType;
  sampleQuotes: string[];
};

export type PriorityAction = {
  rank: number;
  theme: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  evidenceCount: number;
  complaintShare: number;
  why: string;
  sampleQuote: string | null;
};

export type AnomalySignal = {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  evidenceCount: number;
};

export type SellerDeepIntel = {
  reviewCount: number;
  reviewsWithText: number;
  reviewsWithRatings: number;
  reviewsWithDates: number;
  averageRating: number | null;
  ratingDist: Array<{ stars: number; count: number; share: number }>;
  overallSentiment: number;
  positiveShare: number;
  aspects: AspectSignal[];
  trend: { direction: "improving" | "declining" | "stable" | "unknown"; note: string };
  anomalies: AnomalySignal[];
  authenticity: { score: number | null; label: string; reasons: string[] };
  priorityActions: PriorityAction[];
  executiveSummary: string;
  evidenceBrief: string;
};

/** View-friendly subset serialized into the API response. */
export type SellerDeepInsightsView = {
  executiveSummary: string;
  ratingBreakdownNote: string;
  aspectHighlights: Array<{
    label: string;
    mentions: number;
    mentionShare: number;
    complaintShare: number;
    severity: 1 | 2 | 3;
    fixType: AspectFixType;
    sampleQuote: string | null;
  }>;
  trendNote: string;
  anomalyNotes: Array<{ severity: string; title: string; detail: string }>;
  authenticityNote: string;
  priorityActions: Array<{
    rank: number;
    theme: string;
    impact: string;
    effort: string;
    why: string;
    sampleQuote: string | null;
  }>;
};

const POSITIVE_WORDS = [
  "great", "excellent", "love", "loved", "perfect", "awesome", "amazing",
  "good", "easy", "recommend", "recommended", "comfortable", "durable",
  "sturdy", "fast", "value", "worth", "happy", "satisfied", "impressed",
  "works well", "works great", "high quality", "fantastic", "brilliant",
];

const NEGATIVE_WORDS = [
  "bad", "poor", "terrible", "awful", "hate", "disappointed", "disappointing",
  "broken", "defect", "defective", "damaged", "cheap", "flimsy", "weak",
  "return", "refund", "late", "missing", "wrong", "horrible", "useless",
  "waste", "regret", "stopped working", "does not work", "doesn't work",
  "not working", "failed", "unhappy", "frustrated",
];

type AspectDef = {
  id: string;
  label: string;
  severity: 1 | 2 | 3;
  fixType: AspectFixType;
  pattern: RegExp;
  actionHint: string;
};

const ASPECT_DEFS: AspectDef[] = [
  {
    id: "quality",
    label: "Quality & durability",
    severity: 3,
    fixType: "product",
    pattern: /\b(quality|durable|durability|sturdy|flimsy|broke|broken|breaks|crack|cracked|defect|defective|poorly made|cheaply made|fell apart|stopped working|quit working|lasted|wore out|rust|peel|peeling|shoddy|material)\b/i,
    actionHint: "tighten quality control and add durability proof to the listing",
  },
  {
    id: "fit",
    label: "Fit, sizing & compatibility",
    severity: 2,
    fixType: "listing",
    pattern: /\b(fit|fits|fitting|sizing|size|too small|too big|compatible|compatibility|model|serial|version|variant|dimensions|measurement)\b/i,
    actionHint: "publish a clear size/compatibility guide with photos near the top of the listing",
  },
  {
    id: "shipping",
    label: "Shipping & delivery",
    severity: 2,
    fixType: "support",
    pattern: /\b(shipping|delivery|deliver|arrived|late|delay|delayed|carrier|tracking|package arrived|shipment|dispatch)\b/i,
    actionHint: "set accurate delivery expectations and fix the handoff that causes late arrivals",
  },
  {
    id: "packaging",
    label: "Packaging & unboxing",
    severity: 1,
    fixType: "product",
    pattern: /\b(packaging|package|packaged|box|unboxing|wrapped|wrapping|plastic wrap|dented box|packing)\b/i,
    actionHint: "improve protective packaging and show the unboxing in listing images",
  },
  {
    id: "support",
    label: "Support, returns & warranty",
    severity: 3,
    fixType: "support",
    pattern: /\b(support|customer service|seller|refund|return|returned|returns|warranty|guarantee|replacement|contacted seller|no response|response)\b/i,
    actionHint: "create fast, consistent support macros and state the return promise up front",
  },
  {
    id: "value",
    label: "Price & value",
    severity: 2,
    fixType: "listing",
    pattern: /\b(price|pricing|value|worth|overpriced|expensive|cheap|budget|affordable|cost|money|paid)\b/i,
    actionHint: "justify the price with comparison proof or adjust the value story",
  },
  {
    id: "instructions",
    label: "Instructions & setup",
    severity: 1,
    fixType: "listing",
    pattern: /\b(instruction|instructions|manual|setup|install|installation|assemble|assembly|guide|unclear|confusing)\b/i,
    actionHint: "add a short visual setup guide and a before-you-buy note",
  },
  {
    id: "performance",
    label: "Performance & features",
    severity: 2,
    fixType: "product",
    pattern: /\b(performance|feature|features|works|working|battery|power|speed|noise|noisy|quiet|leak|leaking|motor|sensor|accuracy|function)\b/i,
    actionHint: "verify the claimed performance and demonstrate it with real proof",
  },
];

const SEVERE_TERMS = [
  "broken", "defect", "defective", "stopped working", "does not work",
  "doesn't work", "not working", "refund", "return", "dangerous", "unsafe",
  "scam", "fake", "counterfeit", "injury", "fire", "mold",
];

function cleanText(value: unknown, maxLen = 2000): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectColumns(headers: string[]): {
  rating: string | null;
  date: string | null;
  text: string[];
  title: string | null;
  author: string | null;
  verified: string | null;
} {
  const find = (candidates: string[]): string | null => {
    for (const header of headers) {
      const key = normalizeKey(header);
      if (candidates.some((c) => key === c || key.includes(c))) return header;
    }
    return null;
  };

  const textCols = headers.filter((header) => {
    const key = normalizeKey(header);
    return ["review text", "review body", "review", "body", "comment", "comments", "content", "text", "feedback", "description", "message"].some(
      (c) => key === c || key.endsWith(" " + c) || key.startsWith(c + " ")
    );
  });

  return {
    rating: find(["rating", "stars", "star rating", "score"]),
    date: find(["review date", "date", "created at", "published", "timestamp"]),
    text: textCols.length ? textCols : [],
    title: find(["review title", "title", "headline", "subject"]),
    author: find(["reviewer", "author", "customer", "user name", "buyer"]),
    verified: find(["verified purchase", "verified"]),
  };
}

function parseRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1 && value <= 5 ? Math.round(value) : null;
  }
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 5) return Math.round(direct);
  const match = text.match(/([1-5])(?:\.\d+)?\s*(?:\/\s*5|out of 5|stars?)?/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 5) return n;
  }
  return null;
}

function parseReviewDate(value: unknown): { iso: string; timestamp: number } | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  const earliest = Date.parse("2000-01-01");
  const latest = Date.now() + 24 * 60 * 60 * 1000;
  if (timestamp < earliest || timestamp > latest) return null;
  return { iso: new Date(timestamp).toISOString().slice(0, 10), timestamp };
}

function sentenceSentiment(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  let positive = 0;
  let negative = 0;
  for (const word of POSITIVE_WORDS) {
    const matches = lower.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
    positive += matches ? matches.length : 0;
  }
  for (const word of NEGATIVE_WORDS) {
    const matches = lower.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
    negative += matches ? matches.length : 0;
  }
  const total = positive + negative;
  if (total === 0) return 0;
  return (positive - negative) / total;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && s.length <= 220 && /[a-zA-Z]{3,}/.test(s));
}

function normalizeReviews(rows: SellerReviewRow[]): {
  reviews: NormalizedSellerReview[];
  columns: ReturnType<typeof detectColumns>;
} {
  const headers = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const columns = detectColumns(headers);

  const reviews: NormalizedSellerReview[] = rows.map((row, index) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const textParts: string[] = [];
    for (const col of columns.text) {
      const part = cleanText(record[col], 1500);
      if (part) textParts.push(part);
    }
    // Fallback: if no text column was detected, join all long string values.
    let text = textParts.join(" ").trim();
    if (!text) {
      text = Object.entries(record)
        .map(([, v]) => cleanText(v, 800))
        .filter((v) => v.length > 40)
        .join(" ")
        .slice(0, 2000);
    }
    const title = columns.title ? cleanText(record[columns.title], 200) : "";
    const author = columns.author ? cleanText(record[columns.author], 80) || null : null;
    const verifiedRaw = columns.verified ? String(record[columns.verified] ?? "").toLowerCase() : "";
    const verified = columns.verified
      ? /^(yes|true|1|verified|y)$/.test(verifiedRaw.trim())
        ? true
        : /^(no|false|0|n)$/.test(verifiedRaw.trim())
          ? false
          : null
      : null;
    const parsedDate = columns.date ? parseReviewDate(record[columns.date]) : null;

    return {
      index,
      rating: columns.rating ? parseRating(record[columns.rating]) : null,
      date: parsedDate ? parsedDate.iso : null,
      timestamp: parsedDate ? parsedDate.timestamp : null,
      text,
      title,
      author,
      verified,
    };
  });

  return { reviews, columns };
}

function analyzeAspects(reviews: NormalizedSellerReview[]): AspectSignal[] {
  const textReviews = reviews.filter((r) => r.text.length >= 20);
  const total = Math.max(1, textReviews.length);

  return ASPECT_DEFS.map((def) => {
    const matched = textReviews.filter((r) => def.pattern.test(r.text));
    let positive = 0;
    let negative = 0;
    const quotes: string[] = [];
    const seenQuotes = new Set<string>();

    for (const review of matched) {
      const sentiment = sentenceSentiment(review.text);
      if (sentiment > 0.15) positive += 1;
      else if (sentiment < -0.15) negative += 1;

      if (quotes.length < 3 && sentiment < -0.1) {
        const candidate =
          splitSentences(review.text).find((s) => def.pattern.test(s)) ||
          splitSentences(review.text)[0];
        if (candidate) {
          const key = candidate.toLowerCase();
          if (!seenQuotes.has(key)) {
            seenQuotes.add(key);
            quotes.push(candidate.length > 180 ? candidate.slice(0, 177) + "..." : candidate);
          }
        }
      }
    }

    const complaintShare = matched.length ? negative / matched.length : 0;

    return {
      id: def.id,
      label: def.label,
      mentions: matched.length,
      mentionShare: matched.length / total,
      positive,
      negative,
      complaintShare,
      severity: def.severity,
      fixType: def.fixType,
      sampleQuotes: quotes,
    };
  })
    .filter((a) => a.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);
}

function analyzeTrend(reviews: NormalizedSellerReview[]): SellerDeepIntel["trend"] {
  const dated = reviews
    .filter((r) => r.timestamp !== null && r.text.length >= 20)
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));

  if (dated.length < 10) {
    return {
      direction: "unknown",
      note:
        dated.length === 0
          ? "No review dates were found in the CSV, so trend analysis was skipped."
          : `Only ${dated.length} dated reviews were found; at least 10 are needed for a trend signal.`,
    };
  }

  const half = Math.floor(dated.length / 2);
  const early = dated.slice(0, half);
  const recent = dated.slice(half);

  const earlyRated = early.filter((r) => r.rating !== null);
  const recentRated = recent.filter((r) => r.rating !== null);

  const avg = (list: NormalizedSellerReview[]) =>
    list.reduce((sum, r) => sum + (r.rating as number), 0) / list.length;
  const negShare = (list: NormalizedSellerReview[]) =>
    list.filter((r) => sentenceSentiment(r.text) < -0.15).length / Math.max(1, list.length);

  if (earlyRated.length >= 4 && recentRated.length >= 4) {
    const earlyAvg = avg(earlyRated);
    const recentAvg = avg(recentRated);
    const delta = recentAvg - earlyAvg;
    const direction = delta >= 0.75 ? "improving" : delta <= -0.75 ? "declining" : "stable";
    const first = early[0].date as string;
    const last = recent[recent.length - 1].date as string;
    return {
      direction,
      note:
        direction === "stable"
          ? `Average rating held steady (${earlyAvg.toFixed(1)} → ${recentAvg.toFixed(1)} stars) across ${dated.length} dated reviews from ${first} to ${last}.`
          : `Average rating moved ${earlyAvg.toFixed(1)} → ${recentAvg.toFixed(1)} stars across ${dated.length} dated reviews from ${first} to ${last}: ${direction}.`,
    };
  }

  const earlyNeg = negShare(early);
  const recentNeg = negShare(recent);
  const delta = recentNeg - earlyNeg;
  const direction = delta <= -0.2 ? "improving" : delta >= 0.2 ? "declining" : "stable";
  return {
    direction,
    note: `No usable star ratings by date, so the trend uses complaint language instead: negative-share moved ${(earlyNeg * 100).toFixed(0)}% → ${(recentNeg * 100).toFixed(0)}% across ${dated.length} dated reviews (${direction}).`,
  };
}

function detectAnomalies(reviews: NormalizedSellerReview[]): AnomalySignal[] {
  const anomalies: AnomalySignal[] = [];
  const textReviews = reviews.filter((r) => r.text.length >= 40);

  // 1. Duplicated review text (copy-paste / farm signal — never an accusation).
  const clusters = new Map<string, number[]>();
  for (const review of textReviews) {
    const key = review.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length < 40) continue;
    const list = clusters.get(key) || [];
    list.push(review.index);
    clusters.set(key, list);
  }
  const duplicateClusters = [...clusters.values()].filter((list) => list.length >= 3);
  const duplicateCount = duplicateClusters.reduce((sum, list) => sum + list.length, 0);
  if (duplicateClusters.length > 0) {
    anomalies.push({
      type: "duplicate_text",
      severity: "high",
      title: "Repeated identical review text",
      detail: `${duplicateCount} reviews share identical wording across ${duplicateClusters.length} text cluster${duplicateClusters.length === 1 ? "" : "s"}. Identical wording can come from copy-paste, incentivized batches, or a template — worth a manual look, not proof of anything.`,
      evidenceCount: duplicateCount,
    });
  }

  // 2. Rating/text mismatch.
  let mismatches = 0;
  for (const review of textReviews) {
    if (review.rating === null) continue;
    const sentiment = sentenceSentiment(review.text);
    if ((review.rating >= 4 && sentiment <= -0.4) || (review.rating <= 2 && sentiment >= 0.4)) {
      mismatches += 1;
    }
  }
  if (mismatches >= 3) {
    anomalies.push({
      type: "rating_text_mismatch",
      severity: "medium",
      title: "Star rating contradicts the written review",
      detail: `${mismatches} reviews have a star rating that contradicts their own text (high stars with angry wording, or low stars with happy wording). This can signal rushed, mistaken, or manipulated reviews.`,
      evidenceCount: mismatches,
    });
  }

  // 3. Thin 5-star concentration.
  const rated = reviews.filter((r) => r.rating !== null);
  if (rated.length >= 10) {
    const fiveStar = rated.filter((r) => r.rating === 5);
    const fiveShare = fiveStar.length / rated.length;
    const avgLen =
      fiveStar.reduce((sum, r) => sum + r.text.length, 0) / Math.max(1, fiveStar.length);
    if (fiveShare >= 0.8 && avgLen < 100) {
      anomalies.push({
        type: "thin_five_star",
        severity: "medium",
        title: "Low-information 5-star concentration",
        detail: `${Math.round(fiveShare * 100)}% of rated reviews are 5 stars, but those reviews average only ${Math.round(avgLen)} characters of text. Thin praise at scale is a classic low-trust pattern — check whether these reviewers bought or used the product.`,
        evidenceCount: fiveStar.length,
      });
    }
  }

  // 4. Sudden rating drop (uses trend math, needs dates).
  const dated = reviews
    .filter((r) => r.timestamp !== null && r.rating !== null)
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
  if (dated.length >= 12) {
    const recent = dated.slice(-Math.max(4, Math.floor(dated.length / 3)));
    const earlier = dated.slice(0, dated.length - recent.length);
    const avgRecent = recent.reduce((s, r) => s + (r.rating as number), 0) / recent.length;
    const avgEarlier = earlier.reduce((s, r) => s + (r.rating as number), 0) / earlier.length;
    if (avgEarlier - avgRecent >= 1.0) {
      anomalies.push({
        type: "rating_drop",
        severity: "high",
        title: "Sudden recent rating drop",
        detail: `The most recent ${recent.length} dated reviews average ${avgRecent.toFixed(1)} stars versus ${avgEarlier.toFixed(1)} for the ${earlier.length} before them. A drop this sharp often follows a product, packaging, or supplier change.`,
        evidenceCount: recent.length,
      });
    }
  }

  // 5. Review burst (volume spike in a single week).
  const datedAny = reviews.filter((r) => r.timestamp !== null);
  if (datedAny.length >= 20) {
    const weeks = new Map<string, number>();
    for (const review of datedAny) {
      const week = new Date((review.timestamp as number)).toISOString().slice(0, 7) +
        "-W" + Math.ceil(new Date(review.timestamp as number).getUTCDate() / 7);
      weeks.set(week, (weeks.get(week) || 0) + 1);
    }
    const counts = [...weeks.values()].sort((a, b) => a - b);
    if (counts.length >= 4) {
      const median = counts[Math.floor(counts.length / 2)];
      const max = counts[counts.length - 1];
      if (median > 0 && max >= Math.max(6, median * 3)) {
        anomalies.push({
          type: "review_burst",
          severity: "medium",
          title: "Unusual review volume spike",
          detail: `One week collected ${max} reviews against a median of ${median} per week. Spikes can follow promotions — or coordinated review activity. Compare against your ad and promo calendar.`,
          evidenceCount: max,
        });
      }
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  return anomalies.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function scoreAuthenticity(
  reviews: NormalizedSellerReview[],
  anomalies: AnomalySignal[]
): SellerDeepIntel["authenticity"] {
  const textReviews = reviews.filter((r) => r.text.length >= 20);
  if (textReviews.length < 5) {
    return { score: null, label: "Not scored", reasons: ["Fewer than 5 text reviews — not enough to assess trust signals."] };
  }

  let score = 100;
  const reasons: string[] = [];

  for (const anomaly of anomalies) {
    if (anomaly.type === "duplicate_text") {
      score -= Math.min(30, 10 * anomaly.evidenceCount);
      reasons.push(`${anomaly.evidenceCount} reviews share identical wording (duplicated-text signal).`);
    } else if (anomaly.type === "rating_text_mismatch") {
      score -= Math.min(18, 3 * anomaly.evidenceCount);
      reasons.push(`${anomaly.evidenceCount} reviews have star ratings that contradict their own text.`);
    } else if (anomaly.type === "thin_five_star") {
      score -= 14;
      reasons.push("Heavy 5-star concentration with very thin review text.");
    } else if (anomaly.type === "review_burst") {
      score -= 8;
      reasons.push("One week shows an unusual spike in review volume.");
    }
  }

  const uniqueAuthors = new Set(
    textReviews.map((r) => (r.author || "").toLowerCase()).filter(Boolean)
  );
  if (uniqueAuthors.size >= 3 && uniqueAuthors.size >= textReviews.length * 0.6) {
    reasons.push("Review authors look varied across the sample.");
  } else if (uniqueAuthors.size > 0 && uniqueAuthors.size < textReviews.length * 0.4) {
    score -= 8;
    reasons.push("A small set of author names repeats across many reviews.");
  }

  const variedLengths = textReviews.some((r) => r.text.length > 300);
  if (variedLengths && score >= 85) {
    reasons.push("Review lengths vary naturally, including detailed write-ups.");
  }

  score = Math.max(5, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "High" : score >= 60 ? "Moderate" : "Low";

  return {
    score,
    label,
    reasons: [
      `Review trust signals: ${label} (${score}/100). These are statistical signals from your uploaded reviews, not proof of fake reviews.`,
      ...reasons.slice(0, 5),
    ],
  };
}

function prioritizeActions(
  aspects: AspectSignal[],
  textCount: number
): PriorityAction[] {
  const effortRank: Record<AspectFixType, number> = { listing: 0, support: 1, product: 2 };
  const effortLabel: Record<AspectFixType, PriorityAction["effort"]> = {
    listing: "low",
    support: "medium",
    product: "high",
  };

  const scored = aspects
    .filter((a) => a.mentions >= 2)
    .map((a) => {
      const impactScore = a.mentions * a.severity * (0.35 + 0.65 * a.complaintShare);
      return { aspect: a, impactScore };
    })
    .sort((x, y) => {
      if (y.impactScore !== x.impactScore) return y.impactScore - x.impactScore;
      return effortRank[x.aspect.fixType] - effortRank[y.aspect.fixType];
    })
    .slice(0, 6);

  return scored.map(({ aspect, impactScore }, i) => {
    const impact: PriorityAction["impact"] =
      impactScore >= 10 ? "high" : impactScore >= 4 ? "medium" : "low";
    const complaintPct = Math.round(aspect.complaintShare * 100);
    const hint = ASPECT_DEFS.find((d) => d.id === aspect.id)?.actionHint;
    return {
      rank: i + 1,
      theme: aspect.label,
      impact,
      effort: effortLabel[aspect.fixType],
      evidenceCount: aspect.mentions,
      complaintShare: aspect.complaintShare,
      why:
        `${aspect.label} came up in ${aspect.mentions} of ${textCount} text reviews (${complaintPct}% negative).` +
        (hint ? ` Suggested move: ${hint}.` : ""),
      sampleQuote: aspect.sampleQuotes[0] || null,
    };
  });
}

function buildExecutiveSummary(
  intel: Omit<SellerDeepIntel, "executiveSummary" | "evidenceBrief">
): string {
  const parts: string[] = [];
  const n = intel.reviewsWithText;
  const rated = intel.reviewsWithRatings;

  const top = intel.aspects[0];
  const topNegative = [...intel.aspects].sort(
    (a, b) => b.complaintShare * b.mentions - a.complaintShare * a.mentions
  )[0];

  let head = `Analyzed ${n} text review${n === 1 ? "" : "s"}`;
  head += rated > 0 && intel.averageRating !== null
    ? ` (${rated} with star ratings, averaging ${intel.averageRating.toFixed(1)}/5)`
    : " (no star-rating column detected)";
  head += ".";
  parts.push(head);

  if (top && top.mentions >= 2) {
    parts.push(
      `The most discussed theme is ${top.label.toLowerCase()} (${top.mentions} mention${top.mentions === 1 ? "" : "s"}).`
    );
  }
  if (topNegative && topNegative.mentions >= 2 && topNegative.complaintShare >= 0.4) {
    parts.push(
      `The sharpest pain is ${topNegative.label.toLowerCase()}: ${Math.round(topNegative.complaintShare * 100)}% of its ${topNegative.mentions} mentions are negative.`
    );
  }
  if (intel.trend.direction === "declining") {
    parts.push("The trend is declining — recent reviews score worse than earlier ones.");
  } else if (intel.trend.direction === "improving") {
    parts.push("The trend is improving — recent reviews score better than earlier ones.");
  }
  const highAnomalies = intel.anomalies.filter((a) => a.severity === "high");
  if (highAnomalies.length > 0) {
    parts.push(
      `${highAnomalies.length} high-severity data-quality signal${highAnomalies.length === 1 ? "" : "s"} deserve${highAnomalies.length === 1 ? "s" : ""} a manual check (${highAnomalies.map((a) => a.title.toLowerCase()).join("; ")}).`
    );
  }
  if (intel.priorityActions.length > 0) {
    parts.push(
      `Top priority: ${intel.priorityActions[0].theme} — ${intel.priorityActions[0].impact} impact, ${intel.priorityActions[0].effort} effort.`
    );
  }

  return parts.join(" ");
}

function buildEvidenceBrief(intel: SellerDeepIntel): string {
  const lines: string[] = [];
  lines.push("DETERMINISTIC EVIDENCE BRIEF (computed from the actual CSV rows — these numbers are facts; use them, cite them as \"N of M reviews\", and never contradict them):");

  const ratingLine = intel.reviewsWithRatings > 0 && intel.averageRating !== null
    ? `Average rating ${intel.averageRating.toFixed(1)}/5 across ${intel.reviewsWithRatings} rated reviews. Distribution: ${intel.ratingDist.map((d) => `${d.stars}★ ${Math.round(d.share * 100)}%`).join(" · ")}.`
    : "No star-rating column was detected in the CSV.";
  lines.push(`- Reviews: ${intel.reviewsWithText} with text out of ${intel.reviewCount} rows. ${ratingLine} ${intel.reviewsWithDates} reviews have dates.`);

  if (intel.aspects.length > 0) {
    const aspectLine = intel.aspects
      .slice(0, 8)
      .map((a) => `${a.label}: ${a.mentions} mention${a.mentions === 1 ? "" : "s"} (${Math.round(a.complaintShare * 100)}% negative)`)
      .join("; ");
    lines.push(`- Aspect frequency: ${aspectLine}.`);
  } else {
    lines.push("- Aspect frequency: no clear product theme met the mention threshold.");
  }

  lines.push(`- Trend: ${intel.trend.note}`);

  if (intel.anomalies.length > 0) {
    lines.push(
      `- Data-quality signals: ${intel.anomalies.map((a) => `${a.title} (${a.severity}): ${a.detail}`).join(" ")}`
    );
  } else {
    lines.push("- Data-quality signals: none detected in this sample.");
  }

  lines.push(
    `- Review trust signals: ${intel.authenticity.label}${intel.authenticity.score !== null ? ` (${intel.authenticity.score}/100)` : ""}. These are statistical signals, never accusations.`
  );

  if (intel.priorityActions.length > 0) {
    lines.push(
      `- Evidence-ranked priorities: ${intel.priorityActions.map((p) => `${p.rank}. ${p.theme} [impact ${p.impact}, effort ${p.effort}] — ${p.why}`).join(" ")}`
    );
  }

  lines.push(
    "GROUNDING RULES: every claim about frequency must cite the brief counts; every nextAction must map to one of the ranked priorities; never invent frequencies, quotes, or trends not present above."
  );

  return lines.join("\n");
}

export function analyzeSellerReviews(rows: SellerReviewRow[]): SellerDeepIntel {
  const { reviews } = normalizeReviews(rows);
  const textReviews = reviews.filter((r) => r.text.length >= 20);
  const rated = reviews.filter((r) => r.rating !== null);
  const dated = reviews.filter((r) => r.timestamp !== null);

  const averageRating = rated.length
    ? rated.reduce((sum, r) => sum + (r.rating as number), 0) / rated.length
    : null;

  const ratingDist = [5, 4, 3, 2, 1].map((stars) => {
    const count = rated.filter((r) => r.rating === stars).length;
    return { stars, count, share: rated.length ? count / rated.length : 0 };
  });

  const sentiments = textReviews.map((r) => sentenceSentiment(r.text));
  const overallSentiment = sentiments.length
    ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
    : 0;
  const positiveShare = sentiments.length
    ? sentiments.filter((s) => s > 0.15).length / sentiments.length
    : 0;

  const aspects = analyzeAspects(reviews);
  const trend = analyzeTrend(reviews);
  const anomalies = detectAnomalies(reviews);
  const authenticity = scoreAuthenticity(reviews, anomalies);
  const priorityActions = prioritizeActions(aspects, textReviews.length);

  const partial: Omit<SellerDeepIntel, "executiveSummary" | "evidenceBrief"> = {
    reviewCount: reviews.length,
    reviewsWithText: textReviews.length,
    reviewsWithRatings: rated.length,
    reviewsWithDates: dated.length,
    averageRating,
    ratingDist,
    overallSentiment,
    positiveShare,
    aspects,
    trend,
    anomalies,
    authenticity,
    priorityActions,
  };

  const executiveSummary = buildExecutiveSummary(partial);
  const withSummary = { ...partial, executiveSummary };
  const evidenceBrief = buildEvidenceBrief({ ...withSummary, evidenceBrief: "" });

  return { ...withSummary, evidenceBrief };
}

export function toDeepInsightsView(intel: SellerDeepIntel): SellerDeepInsightsView {
  return {
    executiveSummary: intel.executiveSummary,
    ratingBreakdownNote:
      intel.reviewsWithRatings > 0 && intel.averageRating !== null
        ? `Average ${intel.averageRating.toFixed(1)}/5 from ${intel.reviewsWithRatings} rated reviews — ` +
          intel.ratingDist.map((d) => `${d.stars}★ ${d.count}`).join(" · ")
        : "No star-rating column was detected in the uploaded CSV.",
    aspectHighlights: intel.aspects.slice(0, 8).map((a) => ({
      label: a.label,
      mentions: a.mentions,
      mentionShare: a.mentionShare,
      complaintShare: a.complaintShare,
      severity: a.severity,
      fixType: a.fixType,
      sampleQuote: a.sampleQuotes[0] || null,
    })),
    trendNote: intel.trend.note,
    anomalyNotes: intel.anomalies.map((a) => ({
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    })),
    authenticityNote: intel.authenticity.reasons.join(" "),
    priorityActions: intel.priorityActions.map((p) => ({
      rank: p.rank,
      theme: p.theme,
      impact: p.impact,
      effort: p.effort,
      why: p.why,
      sampleQuote: p.sampleQuote,
    })),
  };
}

function clampScore(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Deterministic fallback report used only when the AI pass fails.
 * Same response shape as the AI path, every value derived from the CSV.
 */
export function buildDeterministicSellerResult(
  rows: SellerReviewRow[],
  intel: SellerDeepIntel,
  fileName: string
): Record<string, unknown> {
  const textCount = Math.max(1, intel.reviewsWithText);
  const highAnomalies = intel.anomalies.filter((a) => a.severity === "high").length;
  const mediumAnomalies = intel.anomalies.filter((a) => a.severity === "medium").length;

  const healthScore = clampScore(
    55 + intel.overallSentiment * 22 +
      (intel.averageRating !== null ? (intel.averageRating - 3) * 8 : 0) -
      highAnomalies * 6 - mediumAnomalies * 3,
    8,
    90
  );
  const buyerSatisfaction = clampScore(50 + intel.overallSentiment * 40, 5, 95);

  const supportAspect = intel.aspects.find((a) => a.id === "support");
  const refundRisk = clampScore(
    25 +
      (supportAspect ? supportAspect.complaintShare * 45 : 0) +
      (1 - intel.positiveShare) * 20 +
      highAnomalies * 4,
    5,
    95
  );

  const confidence = clampScore(
    intel.reviewsWithText >= 50 ? 75 : intel.reviewsWithText >= 25 ? 62 : intel.reviewsWithText >= 10 ? 50 : 38,
    5,
    95
  );

  const complaintAspects = [...intel.aspects].sort(
    (a, b) => b.complaintShare * b.mentions - a.complaintShare * a.mentions
  );
  const praiseAspects = [...intel.aspects]
    .filter((a) => a.positive > a.negative)
    .sort((a, b) => b.positive - a.positive);

  const complaintLine = (a: AspectSignal) =>
    `${a.label} — mentioned in ${a.mentions} of ${textCount} text reviews (${Math.round(a.complaintShare * 100)}% negative).${a.sampleQuotes[0] ? ` Example: "${a.sampleQuotes[0]}"` : ""}`;
  const praiseLine = (a: AspectSignal) =>
    `${a.label} — praised in ${a.positive} of ${a.mentions} mentions.`;

  const productFixAspects = complaintAspects.filter((a) => a.fixType === "product").slice(0, 4);
  const listingFixAspects = complaintAspects.filter((a) => a.fixType === "listing").slice(0, 4);

  const fixLine = (a: AspectSignal) => {
    const def = ASPECT_DEFS.find((d) => d.id === a.id);
    return `${a.label}: ${def ? def.actionHint : "investigate and fix"} — raised in ${a.mentions} reviews.`;
  };

  return {
    summary: intel.executiveSummary,
    reviewsAnalyzed: rows.length,
    healthScore,
    buyerSatisfaction,
    refundRisk,
    confidence,
    dataQuality: "Limited",
    evidenceSummary: [
      `${intel.reviewsWithText} of ${intel.reviewCount} rows contained usable review text.`,
      intel.reviewsWithRatings > 0 && intel.averageRating !== null
        ? `Average rating ${intel.averageRating.toFixed(1)}/5 across ${intel.reviewsWithRatings} rated reviews.`
        : "No star-rating column was detected, so scores lean on review language.",
      intel.trend.note,
      intel.anomalies.length > 0
        ? `${intel.anomalies.length} data-quality signal(s) detected: ${intel.anomalies.map((a) => a.title.toLowerCase()).join("; ")}.`
        : "No data-quality signals were detected in this sample.",
      `Review trust signals: ${intel.authenticity.label}${intel.authenticity.score !== null ? ` (${intel.authenticity.score}/100)` : ""}.`,
    ],
    topComplaints: complaintAspects.filter((a) => a.negative > 0).slice(0, 6).map(complaintLine),
    topPraise: praiseAspects.slice(0, 6).map(praiseLine),
    buyerObjections: complaintAspects.slice(0, 4).map(
      (a) => `Shoppers hesitate because ${a.label.toLowerCase()} keeps coming up (${a.mentions} mentions, ${Math.round(a.complaintShare * 100)}% negative).`
    ),
    productFixes: productFixAspects.length
      ? productFixAspects.map(fixLine)
      : ["No product-side theme met the evidence threshold in this sample."],
    listingFixes: listingFixAspects.length
      ? listingFixAspects.map(fixLine)
      : ["No listing-side theme met the evidence threshold in this sample."],
    adAngles: praiseAspects.slice(0, 4).map(
      (a) => `Lead with "${a.label.toLowerCase()}" — ${a.positive} reviewers praised this theme.`
    ),
    nextActions: intel.priorityActions.map(
      (p) => `${p.rank}. [${p.impact} impact · ${p.effort} effort] ${p.theme} — ${p.why}`
    ),
    deepInsights: toDeepInsightsView(intel),
    notice:
      "The AI insight pass was unavailable for this scan, so ReviewIntel built this report deterministically from your CSV. " +
      `Scores are conservative. Re-run the scan for the full AI analysis of "${fileName}".`,
  };
}
