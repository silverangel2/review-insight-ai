// Deterministic follow-up answers from the result's own real-review data (no OpenAI, no invented facts).
import { deriveShopperAnswer } from "./shopperAnswer";

export function freeFollowUpAnswer(action: string, product: unknown): string {
  const a = deriveShopperAnswer(product);
  const pts = (list: typeof a.complaints) => list.slice(0, 3).map(p => `• ${p.claim}${p.quote ? ` (a buyer wrote: "${p.quote}")` : ""}`).join("\n");
  if (a.kind === "not_enough") return "There aren't enough real written reviews yet to answer this honestly. Try uploading review screenshots or another listing of the same product.";
  switch (action) {
    case "show_complaints": return a.complaints.length ? `What buyers complained about most:\n${pts(a.complaints)}` : "Buyers didn't repeat any complaint often enough to call it a pattern.";
    case "why_not_buy": return a.complaints.length ? `${a.label}: ${a.why}\n\nThe main reasons buyers hesitated:\n${pts(a.complaints)}` : `${a.label}: ${a.why}`;
    case "explain_verdict": return `${a.label}: ${a.why}${a.loves.length ? `\n\nBuyers liked:\n${pts(a.loves)}` : ""}${a.complaints.length ? `\n\nBuyers complained about:\n${pts(a.complaints)}` : ""}\n\n${a.trustLine}`;
    case "find_better_option": return "See \"Where to buy\" on this page. We only call something better when our own real-review scans back it up.";
    case "is_good_for_travel": return "The reviews we analyzed don't give a reliable answer about travel use. Check the product's size and weight on the listing.";
    default: return a.why;
  }
}
