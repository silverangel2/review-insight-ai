// Free (zero OpenAI) shopper comparison from two real scans' review evidence.
// A winner is only named when both sides have a real-review score and the gap is meaningful.
import { deriveShopperAnswer } from "./shopperAnswer";

export function freeShopperCompare(a: unknown, b: unknown) {
  const A = deriveShopperAnswer(a), B = deriveShopperAnswer(b);
  const rated = (x: typeof A) => x.kind !== "not_enough" && x.score !== null;
  if (!rated(A) || !rated(B)) {
    return { winner: "INCOMPARABLE", directSubstitutes: false, confidence: null, verdictHeadline: "Comparison not scored",
      summary: "At least one product doesn't have enough real written reviews to compare honestly.",
      reasons: ["At least one product lacks enough verified written reviews."], nextSteps: ["Scan another listing of the same product or upload review screenshots."] };
  }
  const sa = A.score as number, sb = B.score as number, gap = Math.abs(sa - sb);
  const winner = gap < 0.5 ? "TIE" : sa > sb ? "A" : "B";
  const conf = Math.min(A.confidencePercent ?? 50, B.confidencePercent ?? 50);
  const firstC = (x: typeof A) => x.complaints[0]?.claim, firstL = (x: typeof A) => x.loves[0]?.claim;
  const reasons = [
    `Real-review score: Product A ${sa.toFixed(1)} vs Product B ${sb.toFixed(1)} (${A.reviewCount} vs ${B.reviewCount} reviews read).`,
    firstL(A) || firstL(B) ? `Most praised: A "${firstL(A) ?? "nothing repeated"}", B "${firstL(B) ?? "nothing repeated"}".` : null,
    firstC(A) || firstC(B) ? `Most repeated complaint: A "${firstC(A) ?? "none repeated"}", B "${firstC(B) ?? "none repeated"}".` : null,
    `Value from reviews: A ${A.value}, B ${B.value}.`,
  ].filter((r): r is string => Boolean(r));
  const loser = winner === "A" ? B : A, w = winner === "A" ? A : B;
  return {
    winner, directSubstitutes: true, confidence: conf,
    verdictHeadline: winner === "TIE" ? "Too close to call" : `Product ${winner} has the stronger reviews`,
    summary: winner === "TIE" ? "Both products score about the same from real buyer reviews; decide on price and the complaints below."
      : `Product ${winner} scores higher from what real buyers wrote (${(w.score as number).toFixed(1)} vs ${(loser.score as number).toFixed(1)}). We can't confirm both serve the exact same need.`,
    reasons: reasons.slice(0, 4),
    nextSteps: [firstC(w) ? `Before buying ${winner === "TIE" ? "either" : `Product ${winner}`}, check whether "${firstC(w)}" matters to you.` : "Check recent reviews for any new issues.", "Confirm the exact model, size and warranty on the listing."],
    analysisEngine: "deterministic-free", openAiCalls: 0,
  };
}
