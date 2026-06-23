export type ProductMemoryTrend = "new" | "improving" | "declining" | "stable";

export type ProductMemoryBrain = {
  seenBefore: boolean;
  previousScanCount: number;
  trend: ProductMemoryTrend;
  scoreChange: number | null;
  previousScore: number | null;
  latestScore: number | null;
  recurringSignals: string[];
  newSignals: string[];
  resolvedSignals: string[];
  reevaluationNote: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    const key = normalizeText(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }

  return output;
}

export function productMemoryName(value: unknown): string {
  const record = asRecord(value);
  const nestedResult = asRecord(record.result);
  const meta = asRecord(record.meta);
  const analysis = asRecord(record.analysis);

  return String(
    record.productName ||
      record.fileName ||
      record.title ||
      record.name ||
      nestedResult.productName ||
      nestedResult.fileName ||
      nestedResult.title ||
      meta.fileName ||
      meta.productName ||
      analysis.product_name ||
      "Unknown product"
  ).replace(/\.[^/.]+$/, "").trim();
}

export function productMemoryKey(value: unknown): string {
  return normalizeText(productMemoryName(value));
}

function scoreOf(value: unknown): number | null {
  const record = asRecord(value);
  const nestedResult = asRecord(record.result);
  const analysis = asRecord(record.analysis);

  const raw =
    record.productScore ??
    record.score ??
    record.healthScore ??
    record.confidenceScore ??
    record.rating ??
    nestedResult.productScore ??
    nestedResult.score ??
    nestedResult.healthScore ??
    nestedResult.confidenceScore ??
    analysis.product_score ??
    analysis.sentiment_score;

  const numberValue = Number(raw);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null;
}

function signalsOf(value: unknown): string[] {
  const record = asRecord(value);
  const nestedResult = asRecord(record.result);
  const analysis = asRecord(record.analysis);
  const seller = asRecord(analysis.seller_insights);

  return unique([
    ...asArray(record.topComplaints),
    ...asArray(record.commonComplaints),
    ...asArray(record.common_complaints),
    ...asArray(record.painPoints),
    ...asArray(record.main_customer_pain_points),
    ...asArray(record.buyerObjections),
    ...asArray(record.negativeSignals),
    ...asArray(nestedResult.topComplaints),
    ...asArray(nestedResult.commonComplaints),
    ...asArray(nestedResult.painPoints),
    ...asArray(nestedResult.buyerObjections),
    ...asArray(analysis.common_complaints),
    ...asArray(analysis.negative_points),
    ...asArray(seller.main_customer_pain_points),
    ...asArray(seller.complaint_clusters)
  ]);
}

function sameProduct(current: unknown, previous: unknown) {
  const currentKey = productMemoryKey(current);
  const previousKey = productMemoryKey(previous);

  if (!currentKey || !previousKey) return false;
  if (currentKey === "unknown product" || previousKey === "unknown product") return false;

  return currentKey === previousKey;
}

export function buildProductMemoryBrain(current: unknown, history: unknown[] = []): ProductMemoryBrain {
  const previous = history.filter((item) => sameProduct(current, item));
  const latestScore = scoreOf(current);
  const previousScore = previous.length ? scoreOf(previous[0]) : null;
  const scoreChange =
    latestScore !== null && previousScore !== null ? latestScore - previousScore : null;

  const currentSignals = signalsOf(current);
  const previousSignals = unique(previous.flatMap((item) => signalsOf(item)));

  const currentKeys = new Set(currentSignals.map(normalizeText));
  const previousKeys = new Set(previousSignals.map(normalizeText));

  const recurringSignals = currentSignals.filter((signal) => previousKeys.has(normalizeText(signal))).slice(0, 4);
  const newSignals = currentSignals.filter((signal) => !previousKeys.has(normalizeText(signal))).slice(0, 4);
  const resolvedSignals = previousSignals.filter((signal) => !currentKeys.has(normalizeText(signal))).slice(0, 4);

  const trend: ProductMemoryTrend =
    !previous.length ? "new" :
    scoreChange === null ? "stable" :
    scoreChange >= 5 ? "improving" :
    scoreChange <= -5 ? "declining" :
    "stable";

  const productName = productMemoryName(current);
  const reevaluationNote =
    !previous.length
      ? `First saved scan for ${productName}. ReviewIntel will compare future scans against this baseline.`
      : trend === "improving"
        ? `ReviewIntel has seen ${productName} before. The latest scan improved by ${scoreChange} points versus the previous saved scan.`
        : trend === "declining"
          ? `ReviewIntel has seen ${productName} before. The latest scan declined by ${Math.abs(scoreChange || 0)} points, so the product should be rechecked.`
          : `ReviewIntel has seen ${productName} before. The latest scan is stable versus the previous saved scan.`;

  return {
    seenBefore: previous.length > 0,
    previousScanCount: previous.length,
    trend,
    scoreChange,
    previousScore,
    latestScore,
    recurringSignals,
    newSignals,
    resolvedSignals,
    reevaluationNote
  };
}
