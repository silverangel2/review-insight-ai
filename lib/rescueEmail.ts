/**
 * One-off service email for the rescue lane: the shopper asked for a scan,
 * we couldn't score it at the time, the owner researched it personally, and
 * now the verdict is ready. Verdict purpose ONLY — no marketing content,
 * no compensation, no upsell.
 */

export const RESCUE_EMAIL_TYPE = "rescue_verdict";

type RescueEmailInput = {
  productName: string;
  verdict: "BUY" | "REVIEW FIRST" | "AVOID";
  buyingScore: number | null;
  confidence: "High" | "Medium" | "Low";
  quotes: string[];
  reviewCount: number;
};

function verdictLine(verdict: RescueEmailInput["verdict"]): string {
  if (verdict === "BUY") return "our verdict is <strong>BUY</strong> — shoppers rate it well.";
  if (verdict === "AVOID") return "our verdict is <strong>AVOID</strong> — shoppers report real problems.";
  return "our verdict is <strong>REVIEW FIRST</strong> — read the reviews before deciding.";
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the rescue verdict email. Never returns shopper-forbidden copy:
 * no "Vercel", no evidence-state internals, no "Not scored", no model names.
 */
export function buildRescueEmail(input: RescueEmailInput): { subject: string; html: string; text: string } {
  const productName = String(input.productName || "the product you scanned").trim() || "the product you scanned";
  const subject = `We dug deeper on your scan: ${productName}`;
  const scoreLine =
    typeof input.buyingScore === "number"
      ? `Buying Score <strong>${input.buyingScore}/100</strong> (${esc(input.confidence)} confidence, from ${input.reviewCount} shopper reviews).`
      : `Based on ${input.reviewCount} shopper reviews (${esc(input.confidence)} confidence).`;

  const quoteHtml =
    input.quotes.length > 0
      ? `<p>What shoppers said:</p><ul>${input.quotes
          .slice(0, 2)
          .map((q) => `<li>“${esc(q)}”</li>`)
          .join("")}</ul>`
      : "";
  const quoteText =
    input.quotes.length > 0
      ? `\n\nWhat shoppers said:\n${input.quotes
          .slice(0, 2)
          .map((q) => `- "${q}"`)
          .join("\n")}`
      : "";

  const html = [
    `<p>Hi there,</p>`,
    `<p>You scanned <strong>${esc(productName)}</strong> with ReviewIntel and we couldn't give you a verdict at the time — there wasn't enough review evidence to score it fairly.</p>`,
    `<p>We didn't leave it there. Someone on our team researched this product by hand and added what shoppers actually said to our records. As promised, ${verdictLine(input.verdict)}</p>`,
    `<p>${scoreLine}</p>`,
    quoteHtml,
    `<p><a href="https://getreviewintel.com">See how ReviewIntel works</a></p>`,
    `<p>Thanks for being an early shopper — this is exactly the kind of thing we built ReviewIntel to do.<br/>The ReviewIntel team</p>`,
  ].join("\n");

  const text = [
    `Hi there,`,
    ``,
    `You scanned ${productName} with ReviewIntel and we couldn't give you a verdict at the time - there wasn't enough review evidence to score it fairly.`,
    ``,
    `We didn't leave it there. Someone on our team researched this product by hand and added what shoppers actually said to our records. As promised:`,
    ``,
    input.verdict === "BUY"
      ? `Our verdict is BUY - shoppers rate it well.`
      : input.verdict === "AVOID"
        ? `Our verdict is AVOID - shoppers report real problems.`
        : `Our verdict is REVIEW FIRST - read the reviews before deciding.`,
    ``,
    typeof input.buyingScore === "number"
      ? `Buying Score ${input.buyingScore}/100 (${input.confidence} confidence, from ${input.reviewCount} shopper reviews).`
      : `Based on ${input.reviewCount} shopper reviews (${input.confidence} confidence).`,
    quoteText,
    ``,
    `https://getreviewintel.com`,
    ``,
    `Thanks for being an early shopper - this is exactly the kind of thing we built ReviewIntel to do.`,
    `The ReviewIntel team`,
  ].join("\n");

  return { subject, html, text };
}
