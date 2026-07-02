type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

function normalizedVerdict(record: AnyRecord) {
  return (
    getString(record.stableVerdict) ||
    getString(record.finalVerdict) ||
    getString(record.verdict) ||
    getString(record.recommendation) ||
    ""
  ).toUpperCase();
}

export function enforceFinalVerdictConsistency<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  const record = asRecord(value);
  const verdict = normalizedVerdict(record);

  if (!verdict) return value;

  const currentScore =
    getNumber(record.buyScore) ??
    getNumber(record.score) ??
    getNumber(record.ratingScore);

  const currentConfidence =
    getNumber(record.buyerConfidence) ??
    getNumber(record.confidence) ??
    getNumber(record.confidenceScore);

  let nextScore = currentScore ?? 0;
  let nextConfidence = currentConfidence ?? 0;
  let nextValue = getString(record.valueForMoney) || getString(record.value) || "Unknown";
  let nextBottomLine =
    getString(record.stableVerdictReason) ||
    getString(record.bottomLine) ||
    getString(record.summary);

  if (verdict === "BUY") {
    nextScore = Math.max(nextScore, 8);
    nextConfidence = Math.max(nextConfidence, 75);
    nextValue = nextValue === "Poor" || nextValue === "Unknown" ? "Strong" : nextValue;
    nextBottomLine =
      nextBottomLine ||
      "Good buy. ReviewIntel found enough positive evidence to support a confident purchase.";
  }

  if (verdict === "CONSIDER") {
    // CONSIDER cannot show 1-4/10 or Poor. That contradicts the verdict.
    nextScore = Math.min(7, Math.max(nextScore || 6, 6));
    nextConfidence = Math.min(82, Math.max(nextConfidence || 60, 60));
    nextValue = nextValue === "Poor" || nextValue === "Unknown" ? "Fair" : nextValue;
    nextBottomLine =
      nextBottomLine && !nextBottomLine.toLowerCase().includes("avoid")
        ? nextBottomLine
        : "Decent option for the price, but not strong enough for a confident Buy. Check common complaints, review details, and return policy before purchasing.";
  }

  if (verdict === "AVOID") {
    nextScore = Math.min(nextScore || 3, 4);
    nextConfidence = Math.min(nextConfidence || 40, 55);
    nextValue = "Poor";
    nextBottomLine =
      nextBottomLine ||
      "Avoid based on negative evidence, weak product signals, or high review-risk concerns.";
  }

  if (verdict === "REVIEW EVIDENCE NOT ENOUGH" || verdict === "NOT ENOUGH EVIDENCE") {
    nextScore = 0;
    nextConfidence = Math.min(nextConfidence || 25, 35);
    nextValue = "Unknown";
    nextBottomLine =
      "ReviewIntel could not confirm enough review evidence to score this product honestly. This is not an Avoid verdict; it means stronger listing/review evidence is needed.";
  }

  return {
    ...record,

    verdict,
    recommendation: verdict,
    finalVerdict: verdict,
    stableVerdict: verdict,

    buyScore: nextScore,
    score: nextScore,
    ratingScore: nextScore,

    buyerConfidence: nextConfidence,
    confidence: nextConfidence,
    confidenceScore: nextConfidence,

    valueForMoney: nextValue,
    value: nextValue,

    bottomLine: nextBottomLine,
    summary: nextBottomLine,
    stableVerdictReason: nextBottomLine,

    displayConsistencyApplied: true,
  } as T;
}
