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
  const verdict = (
    getString(record.stableVerdict) ||
    getString(record.finalVerdict) ||
    getString(record.verdict) ||
    getString(record.recommendation) ||
    ""
  ).toUpperCase();

  if (verdict === "CONSIDER" || verdict === "MAYBE") return "WAIT";
  if (verdict === "AVOID") return "SKIP";
  return verdict;
}

export function enforceFinalVerdictConsistency<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  const record = asRecord(value);
  // Canonical evidence scores, unknown value, and confidence must never be
  // rewritten to fit an older display band.
  if (typeof record.scorerVersion === "string" && record.scorerVersion.startsWith("deterministic-evidence-scorer-") && record.finalResultHash) return value;
  const verdict = normalizedVerdict(record);

  if (!verdict) return value;

  const currentScore =
    getNumber(record.buyScore) ??
    getNumber(record.score) ??
    getNumber(record.ratingScore);

  // Buy-57 scale-aware guard: the legacy 0–10 engines (governor, deterministic,
  // review-evidence scorers) all emit scores of 10 or below; the v2 0–100 engine
  // can emit anything up to 100. A score above 10 is unambiguously 0–100, and a
  // v2 decision source or stored v2 card marks a 0–100 record even when the
  // numeric score is low. On the 0–100 scale the score is authoritative and the
  // word is derived, so a BUY/WAIT/SKIP word is clamped to the score's band
  // (Buy ≥ 75, Wait 50–74, Skip < 50 — the same bands as lib/buyingScore.ts
  // BUY_THRESHOLD / WAIT_THRESHOLD) and the 0–10 branch clamps below do NOT run.
  // Genuine 0–10-scale legacy records keep the exact prior behavior.
  const v2Card = asRecord(record.buyingScoreV2);
  const isHundredScale =
    (currentScore !== null && currentScore > 10) ||
    getString(record.finalDecisionSource) === "buyingScoreV2" ||
    getString(v2Card.version) === "buying-score-v2" ||
    getString(v2Card.mode) === "buying_score" ||
    getString(v2Card.mode) === "provisional_marketplace";
  if (isHundredScale && (verdict === "BUY" || verdict === "WAIT" || verdict === "SKIP")) {
    const bandVerdict =
      currentScore === null ? verdict : currentScore >= 75 ? "BUY" : currentScore >= 50 ? "WAIT" : "SKIP";
    if (bandVerdict === verdict) return value;
    return {
      ...record,
      verdict: bandVerdict,
      recommendation: bandVerdict,
      finalVerdict: bandVerdict,
      stableVerdict: bandVerdict,
      displayConsistencyApplied: true,
    } as T;
  }

  const currentConfidence =
    getNumber(record.buyerConfidence) ??
    getNumber(record.confidence) ??
    getNumber(record.confidenceScore);

  let nextScore: number | null = currentScore;
  let nextConfidence: number | null = currentConfidence;
  let nextValue = getString(record.valueForMoney) || getString(record.value) || "Unknown";
  let nextBottomLine =
    getString(record.stableVerdictReason) ||
    getString(record.bottomLine) ||
    getString(record.summary);

  if (verdict === "BUY") {
    nextScore = nextScore === null ? null : Math.max(nextScore, 8);
    nextConfidence = nextConfidence === null ? null : Math.max(nextConfidence, 75);
    nextValue = nextValue === "Poor" || nextValue === "Unknown" ? "Strong" : nextValue;
    nextBottomLine =
      nextBottomLine ||
      "Good buy. ReviewIntel found enough positive evidence to support a confident purchase.";
  }

  if (verdict === "WAIT") {
    // Mixed evidence can legitimately sit anywhere in the WAIT band.
    nextScore = nextScore === null ? null : nextScore > 0 ? Math.min(7, Math.max(nextScore, 4)) : null;
    nextConfidence = nextConfidence === null ? null : Math.min(82, Math.max(nextConfidence, 60));
    nextValue = nextValue === "Poor" || nextValue === "Unknown" ? "Unknown" : nextValue;
    nextBottomLine =
      nextBottomLine && !nextBottomLine.toLowerCase().includes("avoid")
        ? nextBottomLine
        : "Decent option for the price, but not strong enough for a confident Buy. Check common complaints, review details, and return policy before purchasing.";
  }

  if (verdict === "SKIP") {
    nextScore = nextScore === null ? null : Math.min(nextScore, 4);
    nextConfidence = nextConfidence === null ? null : Math.min(nextConfidence, 55);
    nextValue = "Poor";
    nextBottomLine =
      nextBottomLine ||
      "Avoid based on negative evidence, weak product signals, or high review-risk concerns.";
  }

  if (verdict === "REVIEW EVIDENCE NOT ENOUGH" || verdict === "NOT ENOUGH EVIDENCE") {
    nextScore = null;
    nextConfidence = null;
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
