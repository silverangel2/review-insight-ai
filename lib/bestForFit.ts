/**
 * Best For / Not Ideal For derivation (defect batch 2, rule 6).
 *
 * The old code matched keyword regexes against the strength/complaint text
 * with no product awareness — so a moisturizing cream got "People who want
 * strong everyday performance for the product's size" and "People expecting
 * heavy-duty or large-area performance". Every rule here is gated on the
 * product's category (detected from its name); a size/performance trope can
 * never render for a non-sized product. When the server/LLM supplied a
 * product-specific list it wins; otherwise rules run; otherwise the lines
 * derive from the product's OWN top evidence themes; otherwise they are
 * omitted (the UI already has an empty state for that).
 *
 * Display-layer only: no scores, no verdicts, no invented data — every line
 * traces to the product's own name or its own evidence themes.
 */

import { detectProductCategory, type ProductCategory } from "./evidenceConsistency";

export type BuyerFitInput = {
  strengths: string[];
  complaints: string[];
  suppliedBestFor: string[];
  suppliedNotIdealFor: string[];
  productName: string;
};

type Rule = {
  test: RegExp;
  categories: ProductCategory[];
  line: string;
};

const BEST_FOR_RULES: Rule[] = [
  {
    test: /portable|compact|lightweight|travel|small/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "Travelers, commuters, and anyone who wants a compact portable product.",
  },
  {
    test: /battery|rechargeable|cordless|runtime|charge/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "People who value rechargeable convenience and longer cordless use.",
  },
  {
    // Size is a real dimension only for devices — never for personal care.
    test: /strong airflow|powerful|strong performance|effective|works well/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "People who want strong everyday performance for the product's size.",
  },
  {
    test: /speed|setting|adjustable|control/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "People who prefer adjustable settings for different situations.",
  },
  {
    test: /durable|sturdy|build quality|well made/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "Buyers who care about sturdy construction and practical build quality.",
  },
];

const NOT_IDEAL_RULES: Rule[] = [
  {
    test: /noise|noisy|loud/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "People who are very sensitive to operating noise, especially at higher settings.",
  },
  {
    test: /battery|runtime|charge|charging/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "Buyers who require the maximum advertised battery runtime on every use.",
  },
  {
    // Power/size expectations only make sense where power is a dimension.
    test: /weak|airflow|power|not powerful/,
    categories: ["kitchen_appliance", "speaker_audio", "cleaning"],
    line: "People expecting heavy-duty or large-area performance.",
  },
  {
    test: /broken|stopped working|durability|failed|defect/,
    categories: ["kitchen_appliance", "speaker_audio", "smart_home", "cleaning"],
    line: "Buyers who need proven long-term durability with minimal failure risk.",
  },
  {
    test: /small|size|capacity|limited/,
    categories: ["kitchen_appliance", "cleaning"],
    line: "People who need a larger-capacity or full-size product.",
  },
];

function lowerFirst(text: string): string {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/**
 * Product-specific fallback from the product's OWN evidence themes — used
 * only when no supplied list and no category rule matched. "People who
 * prioritize easy cleanup" (Instant Pot) is honest; a trope is not.
 */
function themeFallback(
  themes: string[],
  make: (theme: string) => string,
  category: ProductCategory
): string[] {
  if (category === "unknown" || !themes.length) return [];
  const theme = lowerFirst(themes[0]).replace(/\s*\(one-off report\)\s*$/i, "").trim();
  if (!theme || theme.length < 4) return [];
  return [make(theme)];
}

export function deriveBestForNotIdeal(input: BuyerFitInput): { bestFor: string[]; notIdealFor: string[] } {
  const strengthText = (input.strengths || []).join(" ").toLowerCase();
  const complaintText = (input.complaints || []).join(" ").toLowerCase();
  const category = detectProductCategory(input.productName || "");

  const genericBestFor = (input.suppliedBestFor || []).some((item) =>
    /match the product strengths|compare alternatives|current buying evidence/i.test(item)
  );
  const genericNotIdealFor = (input.suppliedNotIdealFor || []).some((item) =>
    /not enough evidence|features not shown|proven long-term reliability/i.test(item)
  );

  let bestFor: string[] = [];
  if (input.suppliedBestFor.length > 0 && !genericBestFor) {
    bestFor = input.suppliedBestFor.slice(0, 4);
  } else {
    for (const rule of BEST_FOR_RULES) {
      if (rule.test.test(strengthText) && rule.categories.includes(category)) {
        bestFor.push(rule.line);
      }
    }
    if (!bestFor.length) {
      bestFor = themeFallback(input.strengths, (theme) => `People who prioritize ${theme}.`, category);
    }
  }

  let notIdealFor: string[] = [];
  if (input.suppliedNotIdealFor.length > 0 && !genericNotIdealFor) {
    notIdealFor = input.suppliedNotIdealFor.slice(0, 4);
  } else {
    for (const rule of NOT_IDEAL_RULES) {
      if (rule.test.test(complaintText) && rule.categories.includes(category)) {
        notIdealFor.push(rule.line);
      }
    }
    if (!notIdealFor.length) {
      notIdealFor = themeFallback(
        input.complaints,
        (theme) => `People for whom ${theme} would be a dealbreaker.`,
        category
      );
    }
  }

  return { bestFor: bestFor.slice(0, 4), notIdealFor: notIdealFor.slice(0, 4) };
}
