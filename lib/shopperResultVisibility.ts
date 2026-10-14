/**
 * Results-page gate. A Buying Score v2 result is shown. The only v2 case that
 * is flagged is a firm BUY with zero written reviews. Legacy results keep the
 * old impossible-BUY checks.
 */

type Rec = Record<string, unknown>;

function record(value: unknown): Rec | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Rec : null;
}

export function isBuyingScoreV2Result(value: unknown): boolean {
  const source = record(value);
  if (!source) return false;
  if (String(source.finalDecisionSource || "") === "buyingScoreV2") return true;
  const card = record(source.buyingScoreV2);
  return Boolean(card && (card.version === "buying-score-v2" || card.mode));
}

export function buyingScoreWrittenCount(value: unknown): number | null {
  const source = record(value);
  const audit = record(record(source?.buyingScoreV2)?.audit);
  const n = audit?.n;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function clampScore(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function governedVerdict(source: Rec) {
  return String(source.stableVerdict || source.finalVerdict || source.verdict || source.recommendation || "").toUpperCase();
}

function hasContradictoryNegativeLanguage(text: string) {
  return /\b(hard to recommend|not recommended|not a clean buy|compare alternatives|weak satisfaction|heavy complaint|complaint pressure|risk signals|poor value|avoid|skip|unreliable|not enough strong buying evidence)\b/i.test(text);
}

/**
 * True when a cached shopper result should not be shown as a firm Buy.
 * v2: only a BUY whose written-review count is 0. Legacy: the old score and copy checks.
 */
export function isImpossibleCachedShopperResult(value: unknown): boolean {
  const source = record(value);
  if (!source) return false;
  const verdict = governedVerdict(source);
  if (isBuyingScoreV2Result(source)) {
    return verdict === "BUY" && buyingScoreWrittenCount(source) === 0;
  }
  if (verdict !== "BUY") return false;
  const productScore = clampScore(source.productScore, 0);
  const buyingConfidence = clampScore(source.buyingConfidence, productScore);
  const evidenceText = [
    source.bottomLine,
    ...(Array.isArray(source.topComplaints) ? source.topComplaints : []),
    ...(Array.isArray(source.notIdealFor) ? source.notIdealFor : []),
  ].join(" ");
  return (
    productScore < 75 ||
    buyingConfidence < 60 ||
    String(source.valueForMoney || "").toLowerCase() === "poor" ||
    hasContradictoryNegativeLanguage(evidenceText)
  );
}

/** The results page never drops a v2 result. Legacy impossible Buys are still dropped. */
export function resultsPageHidesScan(value: unknown): boolean {
  if (isBuyingScoreV2Result(value)) return false;
  return isImpossibleCachedShopperResult(value);
}
