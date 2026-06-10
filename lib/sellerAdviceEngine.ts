export type SellerSignalCategory =
  | "trust"
  | "reliability"
  | "value"
  | "quality"
  | "support"
  | "packaging"
  | "compatibility"
  | "fakeReview"
  | "listing"
  | "delivery"
  | "durability"
  | "pricing"
  | "excellent"
  | "warning"
  | "opportunity";

export type SellerAdviceTone =
  | "excellent"
  | "encouraging"
  | "watch"
  | "concerned"
  | "urgent";

export type SellerAdviceInput = {
  category: SellerSignalCategory;
  score?: number;
  evidence?: string[];
  complaint?: string;
  praise?: string;
  productName?: string;
  used?: Set<string>;
};

const openings: Record<SellerAdviceTone, string[]> = {
  excellent: [
    "This is a strong seller signal.",
    "This is the kind of feedback that can help a product grow.",
    "Customers are already giving you something valuable here.",
    "This is not just a good review pattern — it is a sales asset.",
    "There is real momentum in this signal.",
    "This part of the product is earning trust.",
    "This is a bright spot worth protecting.",
    "The review pattern is giving you a clear advantage.",
    "This is exactly the kind of buyer reaction sellers want to see.",
    "There is a positive customer truth here that should not be hidden."
  ],
  encouraging: [
    "The product has potential, but the message needs to work harder.",
    "This is fixable, and that is good news.",
    "The reviews are pointing to a clear improvement path.",
    "There is enough signal here to make a smarter next move.",
    "This is not a failure signal — it is a direction signal.",
    "The product can look stronger if the listing answers the right doubt.",
    "This is where a small improvement can change buyer confidence.",
    "The customer feedback is giving you useful guidance.",
    "You do not need to guess here; the reviews are showing the next step.",
    "This is a good moment to turn feedback into better conversion."
  ],
  watch: [
    "This area deserves close attention.",
    "The signal is not alarming yet, but it should not be ignored.",
    "Buyers may not complain loudly, but hesitation can still hurt conversion.",
    "This is the kind of issue that can quietly reduce trust.",
    "The pattern is moderate, but it can become expensive if ignored.",
    "This is worth monitoring before scaling traffic.",
    "The concern is manageable, but sellers should treat it seriously.",
    "This is not a panic point, but it is a buyer-confidence checkpoint.",
    "There is enough friction here to slow a purchase decision.",
    "This signal should be watched because it touches buyer expectations."
  ],
  concerned: [
    "This is a trust problem, not just a review problem.",
    "Buyers may hesitate if this is not fixed.",
    "This issue can weaken confidence before checkout.",
    "This feedback suggests a real customer concern.",
    "This is where the product promise may be losing credibility.",
    "The reviews are showing a gap between expectation and experience.",
    "This problem can make buyers second-guess the product.",
    "This should be treated as a serious conversion blocker.",
    "The concern is strong enough to affect the buying decision.",
    "This is the kind of feedback sellers should respond to quickly."
  ],
  urgent: [
    "Fix this before pushing more traffic.",
    "This is the first issue I would correct.",
    "This can damage trust if it keeps repeating.",
    "This deserves immediate seller attention.",
    "Do not ignore this signal.",
    "This is a high-impact trust blocker.",
    "This should be corrected before the product is promoted harder.",
    "This is the kind of issue that can turn interested buyers away.",
    "This needs a clear response in the listing, support flow, or product experience.",
    "This is not cosmetic feedback — it can affect revenue."
  ]
};

const categoryBodies: Record<SellerSignalCategory, string[]> = {
  trust: [
    "Buyers need to feel that the product will match what the listing promises.",
    "Trust improves when the listing proves the product through real buyer language, not generic claims.",
    "The seller should remove doubt before the buyer reaches the checkout button.",
    "Trust is built when the listing answers the questions a nervous buyer is already asking.",
    "The reviews should make the product feel believable, specific, and safe to choose.",
    "When trust is weak, buyers look for a reason to delay or compare another product.",
    "A stronger trust signal can turn hesitation into confidence.",
    "The product needs proof that feels human, specific, and connected to real use.",
    "Confidence rises when buyers see honest strengths and clear limitations.",
    "Trust is not created by saying the product is good; it is created by showing why customers believe it."
  ],
  reliability: [
    "Customers are judging whether the product performs consistently after delivery.",
    "Reliability complaints should be answered with proof of real-use performance.",
    "If buyers worry the product may fail, they need stronger evidence before purchasing.",
    "The listing should show how the product holds up under normal daily use.",
    "Reliability is where the product promise becomes real.",
    "A buyer may forgive a small flaw, but they rarely forgive a product that feels unreliable.",
    "The seller should explain durability, expected use, and limitations clearly.",
    "Performance confidence should be supported with specific examples from reviews.",
    "If reliability feels uncertain, buyers may choose the safer competitor.",
    "This signal should be handled with practical proof, not marketing language."
  ],
  value: [
    "Buyers need a clear reason to believe the product is worth the price.",
    "Value becomes stronger when the listing connects price to outcome, quality, and usefulness.",
    "If the price feels higher than expected, the listing must justify it with proof.",
    "The seller should make the buyer feel smart for choosing this product.",
    "A good value story explains what the customer gets beyond the basic item.",
    "Price resistance drops when buyers can see materials, benefits, and real customer satisfaction.",
    "The listing should show why this product is not just another cheaper option.",
    "Value is not only about being affordable; it is about feeling worth it.",
    "Buyers want to know what makes the product a good decision.",
    "The seller should turn positive value comments into stronger buying confidence."
  ],
  quality: [
    "Quality concerns must be addressed before they become the product’s reputation.",
    "Buyers are watching for signs that the product feels cheap, weak, or inconsistent.",
    "The listing should show the materials, finish, and real customer experience clearly.",
    "Quality proof works best when it is specific and visible.",
    "If quality is praised, make that strength impossible to miss.",
    "If quality is questioned, the seller should clarify expectations honestly.",
    "The product needs evidence that it feels as good in real life as it looks online.",
    "A vague quality claim is weaker than one specific review-based proof point.",
    "Buyers are more confident when quality is described in real customer terms.",
    "Quality should be shown through details, not broad promises."
  ],
  support: [
    "Support clarity can reduce buyer anxiety before purchase.",
    "Returns, warranty, replacement, and response expectations should be easy to find.",
    "A buyer is more likely to purchase when they know what happens if something goes wrong.",
    "Support promises should feel calm, simple, and reliable.",
    "If customers mention support problems, the seller should fix the trust gap immediately.",
    "Good support can turn a product weakness into a confidence signal.",
    "Support language should reassure buyers without sounding defensive.",
    "The listing should make the seller feel reachable and responsible.",
    "If the product has risk, support proof becomes even more important.",
    "Buyers do not only buy the product; they buy the confidence that they will be helped."
  ],
  packaging: [
    "Packaging shapes the first emotional reaction after delivery.",
    "A product can lose trust before it is even used if the unboxing feels careless.",
    "Packaging complaints should be treated as part of the customer experience.",
    "If buyers expect a premium product, the packaging must support that feeling.",
    "Clear packaging expectations can prevent disappointment.",
    "Missing parts, weak presentation, or poor protection can damage the product story.",
    "The seller should make the arrival experience feel controlled and reliable.",
    "Packaging is not just a shipping detail; it is part of perceived quality.",
    "A better unboxing experience can improve reviews and reduce preventable complaints.",
    "If packaging is already praised, use it as a confidence booster."
  ],
  compatibility: [
    "Compatibility must be obvious before checkout.",
    "Buyers should not have to guess whether the product fits their exact need.",
    "Model, size, version, dimensions, and use-case limits should be impossible to miss.",
    "Most compatibility problems start when the listing leaves room for assumption.",
    "The seller should answer fit questions before they become returns.",
    "Clear compatibility language reduces refunds and frustrated reviews.",
    "If buyers are unsure, they may abandon the product or choose a safer option.",
    "Compatibility proof should appear in the title, images, bullets, and FAQ.",
    "The product should guide the right customer in and the wrong customer out.",
    "A precise fit message can protect both conversion and review quality."
  ],
  fakeReview: [
    "Review language should feel natural, specific, and believable.",
    "Overly polished reviews can make buyers suspicious even when the product is good.",
    "The seller should avoid leaning on review wording that sounds forced or repetitive.",
    "Authenticity improves when reviews include real details, small imperfections, and specific use cases.",
    "Fake-review suspicion can damage trust faster than a normal complaint.",
    "The best proof usually sounds like a real customer, not an advertisement.",
    "If review patterns look too similar, buyers may question the entire product.",
    "The seller should highlight honest, grounded reviews instead of perfect-sounding praise.",
    "Natural review evidence is more persuasive than exaggerated enthusiasm.",
    "Trust improves when the review story feels human."
  ],
  listing: [
    "The listing should turn review insight into clearer buying confidence.",
    "The title, images, bullets, and FAQ should answer the strongest customer doubts.",
    "A good listing does not just describe the product; it reduces hesitation.",
    "The seller should move the strongest proof closer to the top of the page.",
    "Buyer objections should be answered before the buyer scrolls too far.",
    "The listing should speak to real review themes, not generic selling points.",
    "If customers love something, the listing should make that benefit visible.",
    "If customers complain about something, the listing should set expectations clearly.",
    "A stronger listing makes the product feel easier to trust.",
    "Every review insight should become a listing improvement."
  ],
  delivery: [
    "Delivery issues can affect the product experience even when the product itself is good.",
    "The seller should reduce anxiety around shipping, arrival condition, and timing.",
    "If delivery is mentioned negatively, expectations need to be clearer.",
    "Buyers care about the full experience from purchase to first use.",
    "A late, damaged, or confusing delivery can turn a good product into a bad review.",
    "The seller should separate product quality from shipping risk and address both.",
    "Clear delivery expectations can prevent avoidable disappointment.",
    "If arrival experience is strong, use it as part of the trust story.",
    "Delivery reliability supports buyer confidence.",
    "The product promise starts before the box is opened."
  ],
  durability: [
    "Durability is one of the strongest long-term trust signals.",
    "Buyers want to know the product can survive normal real use.",
    "If durability is uncertain, the listing should explain expected use and limitations.",
    "Repeated durability complaints should be treated as a product or expectation problem.",
    "Durability proof should come from real customer outcomes.",
    "A durable product deserves stronger visibility in the listing.",
    "If the product wears out quickly, buyers will feel misled.",
    "The seller should show how the product performs after days, weeks, or repeated use.",
    "Durability concerns can hurt repeat sales and reviews.",
    "This is where long-term customer satisfaction is created."
  ],
  pricing: [
    "The price must feel connected to proof.",
    "Buyers should understand why the product costs what it costs.",
    "If the price feels high, the seller needs stronger comparison points.",
    "The listing should explain value in plain customer language.",
    "Price confidence rises when buyers see quality, usefulness, and fewer regrets.",
    "The seller should reduce the feeling of risk around the purchase.",
    "A higher price can work if the reason feels believable.",
    "Buyers do not always need cheap; they need justified.",
    "The product should feel like a smart purchase, not a gamble.",
    "Strong pricing proof can turn hesitation into commitment."
  ],
  excellent: [
    "Amplify this strength because customers are already validating it.",
    "This is a feature worth putting closer to the top of the listing.",
    "The seller should use this praise as proof, not hide it deep in the page.",
    "This positive signal can become a stronger conversion hook.",
    "Buyers need to see this benefit before they compare alternatives.",
    "This is a customer-approved advantage.",
    "The product should lead with what customers already love.",
    "This strength can support ads, images, bullets, and comparison sections.",
    "Do not let this praise stay buried in reviews.",
    "This is a winning message that should be repeated visually, not word-for-word."
  ],
  warning: [
    "This issue can quietly weaken the product’s conversion rate.",
    "The seller should respond before this becomes the main review story.",
    "This warning deserves a practical fix, not a vague reassurance.",
    "If ignored, this can become the reason buyers choose another product.",
    "The listing should address this concern directly and calmly.",
    "This is the kind of signal that should change the next product update.",
    "A small fix here may prevent a larger trust problem later.",
    "Do not let this concern define the product.",
    "This warning should become a checklist item for the seller team.",
    "The seller should make the improvement visible once it is fixed."
  ],
  opportunity: [
    "This is a chance to turn customer feedback into stronger growth.",
    "The seller can use this insight to improve conversion and reduce hesitation.",
    "This is where the product can feel more professional and easier to trust.",
    "The next improvement should be specific, visible, and review-driven.",
    "This opportunity can make the product feel more reliable to new buyers.",
    "A clear action here can turn reviews into revenue.",
    "The seller should treat this as a growth lever, not just a dashboard note.",
    "This insight can improve listing clarity, customer confidence, and future reviews.",
    "The product can become stronger if this feedback is acted on quickly.",
    "This is the kind of improvement that makes sellers look more serious."
  ]
};

const closings: Record<SellerAdviceTone, string[]> = {
  excellent: [
    "Use this strength proudly, but keep the wording honest.",
    "Make this advantage visible in the first few seconds of the listing.",
    "This should become part of the product’s main selling story.",
    "Protect this strength because it is already earning buyer trust.",
    "Turn this into a clean proof point for future customers."
  ],
  encouraging: [
    "A clear update here can make the product feel more trustworthy.",
    "This is a practical improvement with real sales value.",
    "Use the review evidence to guide the next listing change.",
    "The seller does not need more noise here — just clearer proof.",
    "This is a good opportunity to make the buying decision easier."
  ],
  watch: [
    "Monitor this signal and adjust before it becomes louder.",
    "Keep an eye on new reviews to see if the pattern grows.",
    "This should be reviewed again after more customer feedback.",
    "Treat this as a warning light, not a disaster.",
    "Small changes now can prevent bigger concerns later."
  ],
  concerned: [
    "Address this clearly so buyers do not create their own negative assumptions.",
    "This should be fixed with specific proof, not vague promises.",
    "The seller should make the solution visible before checkout.",
    "This needs a calm, direct answer in the product experience.",
    "Do not let this concern sit unanswered in the reviews."
  ],
  urgent: [
    "Fix this first because it can directly affect trust and conversion.",
    "This should become the next seller action item.",
    "Do not scale ads until this concern is controlled.",
    "Make the correction visible so buyers know the issue is being handled.",
    "This deserves priority because it touches buyer confidence."
  ]
};

function toneFromScore(score?: number): SellerAdviceTone {
  if (typeof score !== "number") return "encouraging";
  if (score >= 85) return "excellent";
  if (score >= 70) return "encouraging";
  if (score >= 50) return "watch";
  if (score >= 35) return "concerned";
  return "urgent";
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickUnique(options: string[], seed: string, used?: Set<string>): string {
  if (!options.length) return "";
  const start = hashText(seed) % options.length;

  for (let i = 0; i < options.length; i++) {
    const item = options[(start + i) % options.length];
    if (!used?.has(item)) {
      used?.add(item);
      return item;
    }
  }

  const fallback = options[start];
  used?.add(fallback);
  return fallback;
}

function cleanEvidence(value?: string): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .trim();
}

export function makeSellerAdvice(input: SellerAdviceInput): string {
  const used = input.used;
  const tone = toneFromScore(input.score);

  const evidenceSeed = [
    input.category,
    input.score ?? "",
    input.complaint ?? "",
    input.praise ?? "",
    ...(input.evidence ?? [])
  ].join("|");

  const opening = pickUnique(openings[tone], `${evidenceSeed}:opening`, used);
  const body = pickUnique(categoryBodies[input.category], `${evidenceSeed}:body`, used);
  const closing = pickUnique(closings[tone], `${evidenceSeed}:closing`, used);

  const praise = cleanEvidence(input.praise);
  const complaint = cleanEvidence(input.complaint);

  let emotionalBridge = "";

  if (tone === "excellent" && praise) {
    emotionalBridge = `The strongest positive signal is: “${praise.slice(0, 140)}${praise.length > 140 ? "..." : ""}”`;
  } else if ((tone === "concerned" || tone === "urgent") && complaint) {
    emotionalBridge = `The concern to respect is: “${complaint.slice(0, 140)}${complaint.length > 140 ? "..." : ""}”`;
  } else if (complaint) {
    emotionalBridge = `The review pattern points toward this concern: “${complaint.slice(0, 140)}${complaint.length > 140 ? "..." : ""}”`;
  } else if (praise) {
    emotionalBridge = `The positive review signal is: “${praise.slice(0, 140)}${praise.length > 140 ? "..." : ""}”`;
  }

  return [opening, emotionalBridge, body, closing].filter(Boolean).join(" ");
}

export function makeSellerAdviceSet(items: SellerAdviceInput[]): string[] {
  const used = new Set<string>();

  return items.map((item, index) =>
    makeSellerAdvice({
      ...item,
      used,
      evidence: [...(item.evidence ?? []), `card-${index}`]
    })
  );
}

export function makeSellerAction(category: SellerSignalCategory, score?: number, used = new Set<string>()): string {
  const tone = toneFromScore(score);

  const actionBanks: Record<SellerSignalCategory, string[]> = {
    trust: [
      "Move the strongest trust proof higher on the page.",
      "Add one clear proof point that answers the buyer’s biggest doubt.",
      "Use real customer wording to make the product promise believable.",
      "Show what buyers can expect before, during, and after purchase.",
      "Add a trust-building section near the buying button."
    ],
    reliability: [
      "Show real-use performance proof in images, bullets, or FAQ.",
      "Explain expected use limits honestly so buyers do not feel misled.",
      "Add durability details that match how customers actually use the product.",
      "Highlight reviews that prove the product performs consistently.",
      "Fix unclear promises that make reliability expectations too high."
    ],
    value: [
      "Explain why the product is worth the price in plain buyer language.",
      "Add comparison points that make the value easier to understand.",
      "Show what the customer receives, saves, avoids, or improves.",
      "Turn value praise into a clear headline or image callout.",
      "Support the price with real quality and outcome proof."
    ],
    quality: [
      "Make material, finish, and build details visible.",
      "Use customer proof to support quality claims.",
      "Remove vague quality wording and replace it with specifics.",
      "Clarify what makes the product feel better than cheaper alternatives.",
      "Address repeated quality complaints directly in the product promise."
    ],
    support: [
      "Make return, warranty, replacement, and support expectations easy to find.",
      "Add a short reassurance note for buyers worried about problems after delivery.",
      "Clarify how customers can get help if something goes wrong.",
      "Turn support clarity into a confidence signal before checkout.",
      "Reduce refund fear by making the support path simple."
    ],
    packaging: [
      "Improve or clarify packaging expectations before checkout.",
      "Add packaging photos if the arrival experience matters.",
      "Prevent unboxing disappointment with clearer product-in-box details.",
      "Fix missing-part confusion with a visible included-items section.",
      "Treat packaging as part of the product experience."
    ],
    compatibility: [
      "Add exact model, size, version, and fit information.",
      "Create a compatibility checklist before the buy button.",
      "Use images or tables to show who the product is and is not for.",
      "Answer fit questions before they become returns.",
      "Clarify product limits so the right buyer chooses it."
    ],
    fakeReview: [
      "Use natural, specific reviews instead of perfect-sounding praise.",
      "Remove repetitive proof language from customer-facing sections.",
      "Highlight reviews with real use cases and honest details.",
      "Avoid exaggerated claims that make buyers suspicious.",
      "Let authentic customer wording carry the proof."
    ],
    listing: [
      "Rewrite the first screen around the strongest buyer need.",
      "Move repeated complaints into FAQ answers.",
      "Convert the best review theme into a visual proof card.",
      "Make the product promise more specific and less generic.",
      "Use reviews to decide what the listing should say first."
    ],
    delivery: [
      "Clarify delivery timing, package condition, and arrival expectations.",
      "Separate shipping issues from product quality in your customer message.",
      "Add arrival reassurance if delivery anxiety appears in reviews.",
      "Improve delivery communication before it becomes a review problem.",
      "Make the arrival experience feel predictable."
    ],
    durability: [
      "Add long-term use proof where buyers can see it.",
      "Clarify expected lifespan, care, and normal-use limits.",
      "Highlight reviews that mention repeated use or lasting performance.",
      "Fix durability claims that are too broad or unsupported.",
      "Make durability evidence specific and believable."
    ],
    pricing: [
      "Connect price to materials, results, convenience, or reduced risk.",
      "Show why paying for this product is a smart decision.",
      "Add proof that makes the product feel worth the money.",
      "Use comparison language carefully without sounding desperate.",
      "Make the value story visible before price resistance starts."
    ],
    excellent: [
      "Amplify this strength in the headline, images, and bullets.",
      "Turn this praise into a main selling angle.",
      "Protect this advantage and use it as proof.",
      "Make this positive signal visible earlier.",
      "Build future ads around this customer-approved strength."
    ],
    warning: [
      "Fix the issue and make the correction visible.",
      "Do not let this concern become the product’s main story.",
      "Create a specific answer for this buyer worry.",
      "Treat this as a seller priority before scaling.",
      "Use the warning as a checklist for the next update."
    ],
    opportunity: [
      "Turn this insight into one clear listing improvement.",
      "Use the review pattern to guide the next product update.",
      "Make the buying decision easier with one visible proof point.",
      "Convert feedback into a stronger customer promise.",
      "Use this opportunity to increase trust and reduce hesitation."
    ]
  };

  return pickUnique(actionBanks[category], `${category}:${score}:${tone}:action`, used);
}

export function makeSellerHeadline(category: SellerSignalCategory, score?: number): string {
  const tone = toneFromScore(score);

  const headlines: Record<SellerAdviceTone, string[]> = {
    excellent: [
      "A strength worth amplifying",
      "Customer praise you should lead with",
      "A trust signal already working",
      "A selling point buyers believe",
      "A positive pattern to protect"
    ],
    encouraging: [
      "A fixable growth opportunity",
      "A clearer message can lift trust",
      "A useful signal for your next improvement",
      "A buyer doubt you can answer",
      "A practical path to stronger conversion"
    ],
    watch: [
      "A signal to monitor closely",
      "A quiet friction point",
      "A buyer concern starting to form",
      "A trust area worth watching",
      "A moderate risk to manage"
    ],
    concerned: [
      "A concern that may slow buyers down",
      "A trust gap that needs attention",
      "A product promise buyers may question",
      "A conversion blocker forming",
      "A serious review signal"
    ],
    urgent: [
      "Fix this first",
      "A high-impact trust blocker",
      "A priority before more traffic",
      "A problem buyers may not forgive",
      "A critical seller action"
    ]
  };

  return headlines[tone][hashText(`${category}:${score}`) % headlines[tone].length];
}
