/**
 * Client-safe clause-level evidence machinery (defect batch 2).
 *
 * Extracted VERBATIM from lib/reviewEvidenceDeterminism.ts so shopper
 * display code can resolve theme claims to their matching clause without
 * dragging server-only modules (node:crypto, devScanCapture -> node:fs/path)
 * into the client bundle. Same patterns, same guards, same rules — no
 * scoring math changed.
 */
import { semanticText } from "./reviewSemanticSignals";

const positive = /\b(awesome|lifesaver|game[- ]changer|perfect|perfection|delicious|juicy|best|nice|beautiful|love|loved|enjoying|impressed|comfortable|insightful|fantastic|great|good|excellent|works|worked|working|reliable|durable|easy|useful|worth|recommend|recommended|stable|bright|fast|portable|lasts|lasting|solid|happy|satisfied)\b/gi;
const negative = /\b(overpriced|waste of money|crack|cracked|cracking|broke|breaks|bad|poor|broken|failed|fails|stopped|died|dies|dead|refund|return|returned|disappointed|weak|slow|hard|difficult|unusable|useless|overheat|overheats|unsafe|defective|problem|problems|complaint|complaints|not enough)\b/gi;
const severe = /\b(cracked|cracking|breaks|broke|broken|failed|stopped|died|dies|dead|defective|unsafe|overheat|overheats)\b/gi;

// Splitting is punctuation-based and case-independent, so the raw-text
// clause at index i is the original-casing twin of the semantic clause at
// index i (semanticText only substitutes characters, never adds or removes
// split delimiters).
function splitIntoClauses(text: string) {
  const clauses: string[] = [];
  let previousProduct = false;
  for (const sentence of text.split(/[!?;]|\.(?!\d)/)) {
    // Discourse, not brand names, identifies a previously owned product.
    // Its failure must not become evidence against the replacement product.
    const introducesPrevious = /\b(?:used to (?:own|have|use)|(?:i|we) (?:had|owned) (?:a|an) (?!problem|issue|complaint|failure|defect|question|refund|return|great|good|bad)\b)/i.test(sentence);
    if (introducesPrevious) previousProduct = true;
    const transitionsToCurrent = /\b(?:replaced (?:it|that|them) with (?:this|the new)|decided on|switched to|upgraded to|bought this|(?:i|we) have had|this (?:version|one|unit|product))\b/i.test(sentence);
    if (previousProduct) {
      if (transitionsToCurrent) {
        previousProduct = false;
        if (introducesPrevious || /\b(?:replaced|decided on|switched to|upgraded to)\b/i.test(sentence)) continue;
      } else continue;
    }
    clauses.push(...sentence.split(/\b(?:but|however|until)\b/i));
  }
  return clauses;
}

export function reviewClauses(body: string) {
  return splitIntoClauses(semanticText(body));
}

/** Original-casing twin of reviewClauses: same segmentation, raw text. */
export function rawReviewClauses(body: string) {
  return splitIntoClauses(String(body ?? ""));
}

export function negatedAt(clause: string, index: number) {
  const prefix = clause.slice(0, index).replace(/[,]/g, " ");
  return /\b(?:no|not|never|without|pas|nicht|isn't|isnt|doesn't|doesnt|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent|shouldn't|shouldnt|wouldn't|wouldnt|couldn't|couldnt|won't|wont|can't|cant|cannot|wasn't|wasnt|aren't|arent)\b(?:\s+[a-z]+){0,3}\s*$/i.test(prefix)
    && !/\bnot\s+(?:only|just)\b[^.!?;]*$/i.test(prefix);
}

export function expectationAt(clause: string, index: number) {
  return /\b(?:supposed to|expected to|advertised as|claimed to|promised to|should be|would be|might be|could be)\b(?:\s+[a-z]+){0,3}\s*$/i.test(clause.slice(0, index));
}

export function reviewSentiment(body: string) {
  let praise = 0;
  let complaints = 0;
  let hasSevereComplaint = false;
  let hasSafetyComplaint = false;
  for (const clause of reviewClauses(body)) {
    if (/\b(?:support|customer service)\b.{0,55}\b(?:hasn't|has not|never|no)\b.{0,30}\b(?:responded|replied|messaged|response|reply)\b/i.test(clause)) complaints += 1;
    for (const match of clause.matchAll(positive)) {
      if (expectationAt(clause, match.index || 0)) continue;
      if (negatedAt(clause, match.index || 0)) complaints += 1;
      else praise += 1;
    }
    for (const match of clause.matchAll(negative)) {
      if (negatedAt(clause, match.index || 0)) praise += 1;
      else complaints += 1;
    }
    for (const match of clause.matchAll(/\b(?:caught fire|fire hazard|electric shock|burned me|unsafe|exploded|explosion)\b/gi)) {
      if (!negatedAt(clause, match.index || 0)) { hasSafetyComplaint = true; hasSevereComplaint = true; complaints += 1; }
    }
    for (const match of clause.matchAll(severe)) {
      if (!negatedAt(clause, match.index || 0)) hasSevereComplaint = true;
    }
    if (/\b(?:doesn't|doesnt|does not|won't|wont|will not|can't|cannot)\s+(?:work|charge|turn on|last)\b/i.test(clause)) {
      complaints += 1;
      hasSevereComplaint = true;
    }
  }
  return { praise, complaints, hasSevereComplaint, hasSafetyComplaint };
}

export type ReviewClaimRule = {
  kind: "strength" | "complaint";
  claim: string;
  pattern: RegExp;
};

export const claimRules: ReviewClaimRule[] = [
  { kind: "strength", claim: "useful tracking or app insights", pattern: /\b(?:app|metrics|sleep stats|tracking)\b.{0,45}\b(?:insightful|great|fantastic|useful)\b|\b(?:great|fantastic|useful)\b.{0,30}\b(?:app|metrics|sleep stats|tracking)\b/i },
  { kind: "complaint", claim: "unanswered customer support", pattern: /\b(?:support|customer service)\b.{0,55}\b(?:hasn't|has not|never|no)\b.{0,30}\b(?:responded|replied|messaged|response|reply)\b/i },

  { kind: "complaint", claim: "app or connectivity problems", pattern: /\b(?:don't|do not|doesn't|does not)\b.{0,30}\b(?:love|work|like)\b.{0,30}\bapp\b|\b(?:app|connection|connectivity)\b.{0,40}\b(?:problems?|failed|unusable|difficult)\b/i },

  { kind: "strength", claim: "comfortable fit", pattern: /\bcomfortable\b/i },
  { kind: "strength", claim: "long battery life", pattern: /\b(?:battery|charge)\b.{0,60}\b(?:great|good|lasts|week|days)\b|\b(?:lasts|charge)\b.{0,40}\b(?:week|days)\b/i },
  { kind: "complaint", claim: "battery failure or charge retention problems", pattern: /\bbattery\b.{0,100}\b(?:failed|died|dead|lost|stopped)\b|\b(?:failed|died|dead|lost)\b.{0,60}\bbattery\b|\bwon't keep.{0,20}charge\b/i },
  { kind: "complaint", claim: "material safety warnings", pattern: /\b(?:caught fire|fire hazard|electric shock|burned me|unsafe|exploded|explosion)\b/i },

  // Strengths: every displayed claim still requires support from an
  // accepted exact-product written review. These rules only improve the
  // customer-facing taxonomy; they do not affect scoring.
  {
    kind: "strength",
    claim: "reliable or durable performance",
    pattern: /\b(reliable|reliably|durable)\b/i,
  },
  {
    kind: "strength",
    claim: "easy to use or set up",
    pattern: /\b(easy|simple|straightforward)\b.{0,50}\b(use|using|setup|set up|operate|operation|controls?|instructions?)\b|\b(use|using|setup|set up|operate|operation|controls?|instructions?)\b.{0,50}\b(easy|simple|straightforward)\b/i,
  },
  {
    kind: "strength",
    claim: "works well or performs as expected",
    pattern: /\b(works|working|reliable|stable)\b/i,
  },
  {
    kind: "strength",
    claim: "good value for the price",
    pattern: /\b(?:good|great|excellent)\b(?:\s+[a-z]+){0,3}\s+value\b|\bvalue\b(?:\s+[a-z]+){0,3}\s+(?:good|great|excellent)\b|\bworth\s+(?:(?:the|my|our|every|extra)\s+)?(?:it|money|price|cost|penny|dollar|paying)\b/i,
  },
  {
    kind: "strength",
    claim: "good cooking results",
    pattern: /\b(cook|cooked|cooking|chicken|steak|roast|roasting)\b.{0,90}\b(perfect|perfection|juicy|delicious|excellent|great|best|nice|right)\b|\b(perfect|perfection|juicy|delicious|excellent|great|best|nice|right)\b.{0,90}\b(cook|cooked|cooking|chicken|steak|roast|roasting)\b/i,
  },
  {
    kind: "strength",
    claim: "fast or efficient performance",
    pattern: /\b(fast|quick|quickly|speedy)\b/i,
  },
  {
    kind: "strength",
    claim: "easy to clean or maintain",
    pattern: /\b(easy|simple|straightforward)\b.{0,50}\b(clean|cleaning|cleanup|maintain|maintenance)\b|\b(clean|cleaning|cleanup|maintain|maintenance)\b.{0,50}\b(easy|simple|straightforward)\b/i,
  },
  {
    kind: "strength",
    claim: "solid build or product quality",
    pattern: /\b(?:sturdy|well[- ]built)\b|\b(?:solid|durable|reliable)\b.{0,30}\b(?:build|body|materials?|housing|quality|plastic|construction|metal|unit)\b|\b(?:build|body|materials?|housing|quality|plastic|construction|metal|unit)\b.{0,30}\b(?:solid|durable|reliable)\b/i,
  },
  {
    kind: "strength",
    claim: "attractive design or appearance",
    pattern: /\b(looks?|colour|color|pink|counter|kitchen)\b.{0,60}\b(nice|great|beautiful|love|matches?|awesome)\b|\b(nice|great|beautiful|love|matches?|awesome)\b.{0,60}\b(looks?|colour|color|pink|counter|kitchen)\b/i,
  },
  {
    kind: "strength",
    claim: "useful features or functions",
    pattern: /\b(useful|love|great|game[- ]changer|game changer)\b.{0,60}\b(feature|features|function|functions|mode|modes|option|options|container|containers|glass)\b|\b(feature|features|function|functions|mode|modes|option|options|container|containers|glass)\b.{0,60}\b(useful|love|great|game[- ]changer|game changer|size options?)\b/i,
  },

  // Complaints. Low-frequency accepted-review observations may remain in
  // the result with supportCount=1 instead of disappearing merely because
  // they are not recurring.
  {
    kind: "complaint",
    claim: "reliability or failure problems",
    pattern: /\b(broke|breaks|broken|failed|fails|stopped|died|dies|dead|defective|unusable)\b|\b(?:doesn't|doesnt|won't|wont|does not)\s+(?:work|charge|turn on)\b/i,
  },
  {
    kind: "complaint",
    claim: "weak, slow, or overheating performance",
    pattern: /\b(weak|slow|not enough|overheat|overheats|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "return or refund problems",
    pattern: /\b(refund|return|returned|complaint|complaints)\b/i,
  },
  {
    kind: "complaint",
    claim: "difficult or confusing use or setup",
    pattern: /\b(hard|difficult|unusable|problem|problems)\b.{0,50}\b(use|using|setup|set up|instructions?|manual)\b|\b(use|using|setup|set up|instructions?|manual)\b.{0,50}\b(hard|difficult|unusable|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "cracking or material durability problems",
    pattern: /\b(crack|cracked|cracking)\b.{0,80}\b(plastic|material|housing|body|part|parts|unit|product)\b|\b(plastic|material|housing|body|part|parts|unit|product)\b.{0,80}\b(crack|cracked|cracking)\b/i,
  },
  {
    kind: "complaint",
    claim: "build or product quality problems",
    pattern: /\b(broken|defective|failed|fails|dead|unusable|crack|cracked|cracking)\b.{0,50}\b(build|quality|part|parts|unit|product)\b|\b(build|quality|part|parts|unit|product)\b.{0,50}\b(broken|defective|failed|fails|dead|unusable|crack|cracked|cracking)\b/i,
  },
  {
    kind: "complaint",
    claim: "difficult cleaning or maintenance",
    pattern: /\b(hard|difficult|problem|problems)\b.{0,50}\b(clean|cleaning|cleanup|maintain|maintenance)\b|\b(clean|cleaning|cleanup|maintain|maintenance)\b.{0,50}\b(hard|difficult|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "capacity or performance is not enough",
    pattern: /\b(not enough)\b.{0,50}\b(capacity|power|performance|space|size)\b|\b(capacity|power|performance|space|size)\b.{0,50}\b(not enough)\b/i,
  },
];

export function supportingClauseForClaim(body: string, claim: string): string | null {
  const rule = claimRules.find((candidate) => candidate.claim === claim);
  if (!rule) return null;
  const text = String(body ?? "");
  const semanticClauses = reviewClauses(text);
  const rawClauses = rawReviewClauses(text);
  for (let index = 0; index < semanticClauses.length; index++) {
    const clause = String(semanticClauses[index] || "").trim();
    if (!clause) continue;
    const match = rule.pattern.exec(clause);
    if (!match || expectationAt(clause, match.index) || negatedAt(clause, match.index)) continue;
    const sentiment = reviewSentiment(clause);
    const praiseCount = sentiment.praise + Array.from(clause.matchAll(/\b(nice|beautiful|best|perfect|perfection|delicious|juicy)\b|to die for/gi)).filter((hit) => !negatedAt(clause, hit.index || 0) && !expectationAt(clause, hit.index || 0)).length;
    const complaintCount = sentiment.complaints;
    if (rule.kind === "strength") {
      const undermined = /\b(?:not|never|isn't|isnt|doesn't|doesnt|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent|shouldn't|shouldnt|wouldn't|wouldnt|couldn't|couldnt|won't|wont|can't|cant|cannot)\b.{0,24}\b(?:good|great|easy|reliable|durable|worth|works?|fast|useful)\b/i.test(clause);
      if (undermined || !(praiseCount > complaintCount)) continue;
    } else {
      const denied = /\b(?:no|never|without|not|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent)\b.{0,16}\b(?:problems?|complaints?|cracks?|cracked|broken|broke|failed|refund)\b/i.test(clause);
      if (denied || !(complaintCount > 0)) continue;
    }
    // Return the clause in the review's ORIGINAL casing: the raw-text
    // clause at the same index is the display twin of the matched semantic
    // clause. Fall back to the semantic text only if segmentation diverged.
    const rawTwin = String(rawClauses[index] || "").replace(/\s+/g, " ").trim();
    const cleaned = rawTwin.length >= 8 ? rawTwin : clause.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 8) return cleaned;
  }
  return null;
}
