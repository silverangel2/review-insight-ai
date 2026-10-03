export type SEOLandingPage = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  audience: "Shopper" | "Seller" | "Platform";
  primaryCta: string;
  secondaryCta: string;
  keywords: string[];
  highlights: string[];
  sections?: Array<{
    title: string;
    body: string;
  }>;
};

export const seoLandingPages: Record<string, SEOLandingPage> = {
  "consumer-review-analyzer": {
    slug: "consumer-review-analyzer",
    title: "Shopper Review Analyzer",
    metaTitle: "Shopper Review Analyzer | ReviewIntel",
    description:
      "Upload a product screenshot or use a product link to get a fast shopper verdict, risk signals, value score, best-for match, and biggest complaint.",
    audience: "Shopper",
    primaryCta: "Run Shopper Analysis",
    secondaryCta: "See Pricing",
    keywords: ["shopper review analyzer", "product review checker", "AI product review checker", "worth buying verdict"],
    highlights: ["Worth buying verdict", "Fake review risk", "Value for money", "Top complaint"],
    sections: [
      {
        title: "How to read the Buy, Maybe, or Avoid verdict",
        body:
          "The verdict is the scan's plain-English bottom line. Buy means the review evidence supports the purchase for most people — genuine praise, few concentrated complaints, and a value story that holds up at the current price. Maybe means the product has real trade-offs: read the biggest complaint and decide whether that trade-off touches how you would actually use it.\n\nAvoid means the evidence points away — a dominant complaint pattern, a value mismatch with the price, or a fake-review risk high enough to discount the rating. The verdict never replaces your judgment; it tells you where to look before your money leaves your wallet."
      },
      {
        title: "The three numbers that matter most: value, risk, and fit",
        body:
          "A review scan produces a lot of signals, but three do most of the work. The value score asks whether buyers feel they got their money's worth at the price you would actually pay — not the crossed-out list price. The fake-review risk asks how much you should trust the rating itself, since a five-star average built on thin evidence is worth less than a four-star average built on thousands of detailed reviews.\n\nThe best-for match asks whether the happy reviewers resemble you: same use case, same expectations, same deal-breakers. A product can be genuinely excellent and still wrong for you. When all three agree, the decision is easy; when they disagree, the complaint section explains why."
      },
      {
        title: "Screenshot tips that get you a better scan",
        body:
          "The scan reads what you show it, so show it the parts that matter. Capture the rating breakdown and the total review count, plus a mix of top positive and top critical reviews — both sides, not just the flattering half. Include the listing title, the current price, and any size or variant selector so the analysis matches exactly what you would buy.\n\nAvoid heavy cropping that cuts sentences in half, and skip the sponsored carousel at the top. If the review list is long, two or three screenshots covering different pages beat one giant unreadable capture. A phone screenshot works fine as long as the review text stays legible."
      },
      {
        title: "Why the biggest complaint section is your shortcut",
        body:
          "You do not need to read four hundred reviews; you need to know what the unhappy minority keeps repeating. The biggest-complaint section surfaces the issue that appears most often, in the reviewers' own phrasing. One recurring defect tells you more than fifty scattered grumbles about unrelated things.\n\nThen apply the personal filter: does this complaint apply to your situation? A noise complaint matters if you work from home and means nothing if the product lives in a garage. Complaints about slow shipping matter less than complaints about the product itself. The section saves the reading time; you still make the call."
      },
      {
        title: "When the verdict disagrees with the star rating",
        body:
          "A 4.8-star product can still earn an Avoid verdict, and that disagreement is the feature. Star ratings can be inflated by incentivized reviews, launch-day campaigns, or a flood of ratings from people who never describe actually using the product. The scan weighs the words behind the stars, not just the stars.\n\nPay special attention when a product has few reviews and a near-perfect rating — there is simply less evidence to trust. And when critical reviews describe the same specific failure in the same words, believe the pattern over the average. Ratings tell you how people felt; the verdict tells you what they experienced."
      }
    ]
  },
  "amazon-review-analyzer": {
    slug: "amazon-review-analyzer",
    title: "Amazon Review Analyzer",
    metaTitle: "Amazon Review Analyzer | ReviewIntel",
    description:
      "Analyze Amazon product screenshots, links, or review evidence to understand product quality, risk signals, complaints, and value before buying.",
    audience: "Shopper",
    primaryCta: "Analyze Amazon Reviews",
    secondaryCta: "Run Analysis",
    keywords: ["Amazon review analyzer", "Amazon fake review checker", "Amazon product review AI", "Amazon complaint summary"],
    highlights: ["Product screenshot scan", "Review quality indicators", "Complaint patterns", "Best-for match"],
    sections: [
      {
        title: "What the Verified Purchase badge actually tells you",
        body:
          "On Amazon, the Verified Purchase badge means Amazon's records confirm the reviewer bought the item through the platform. That raises the evidence quality of a review — the person at least held the product — but it is not a guarantee of honesty. Sellers have been known to refund buyers off-platform in exchange for positive reviews, badge and all.\n\nReviews without the badge are not automatically fake either; long-time customers sometimes review products bought elsewhere, and Vine reviewers carry a program disclosure instead. Treat the badge as one signal among many: useful in aggregate, weak as a single-review verdict."
      },
      {
        title: "Variant-level reviews: why the headline rating can mislead",
        body:
          "Amazon pools reviews across every variant of a product — every color, size, and bundle shares one rating. That 4.8-star average might belong mostly to the blue medium, while the red large you are eyeing has a dozen one-star reviews about faulty zippers. Always filter reviews to your exact variant before trusting the number.\n\nThe scan looks for variant-specific complaint language, but double-check it yourself: open the review filters, select your variant, and read what remains. If the variant filter empties the review list, you are buying on the reputation of a different product entirely."
      },
      {
        title: "Reading review velocity before you buy",
        body:
          "Review velocity — how fast reviews accumulate — is one of the most honest signals on a listing. A healthy product gathers reviews steadily over months. A sudden burst of dozens of five-star reviews in a single week, especially on an older product, often traces back to a discount-for-review campaign or something less innocent.\n\nA brand-new product with hundreds of glowing reviews deserves the same skepticism: real adoption takes time. None of this proves fakery on its own — launches and viral moments create genuine spikes too — but unusual velocity is a reason to weight the critical reviews more heavily in your decision."
      },
      {
        title: "The screenshot fields that improve your Amazon scan",
        body:
          "For Amazon listings, five captures cover nearly everything the scan needs: the rating histogram and total review count, the product information block with the seller name and current price, the top critical reviews, the top positive reviews, and any answered questions that mention defects or sizing.\n\nInclude the variant selector in at least one capture so the analysis matches the version you would buy. Skip the 'frequently bought together' and sponsored sections — they add noise. If reviews span multiple pages, capture page one and the most critical page; the scan handles the rest."
      },
      {
        title: "From scan to decision: a five-minute Amazon checklist",
        body:
          "Run the scan, then work through five checks. First, the verdict: Buy, Maybe, or Avoid. Second, the biggest complaint — does it affect your use case? Third, the variant filter — do the reviews match what you are buying? Fourth, the fake-review risk — is the rating itself trustworthy?\n\nFifth, the value question — would you still be happy at this price if the rosiest reviews turned out to be exaggerated? If the answer is yes across all five, buy with confidence. If two or more raise doubts, keep shopping. Five minutes now beats a return label later."
      }
    ]
  },
  "fake-review-detector": {
    slug: "fake-review-detector",
    title: "Fake Review Detector",
    metaTitle: "Fake Review Detector | ReviewIntel",
    description:
      "Estimate fake-review risk from repeated phrases, unnatural language, low evidence quality, review clusters, and confidence signals.",
    audience: "Shopper",
    primaryCta: "Detect Review Risk",
    secondaryCta: "Read Disclaimer",
    keywords: ["fake review detector", "fake review risk", "AI fake review checker", "review authenticity signals"],
    highlights: ["Risk score", "Confidence level", "Pattern detection", "Evidence quality"],
    sections: [
      {
        title: "What this tool actually estimates: risk, not proof",
        body:
          "No tool can look at review text and certify that a review is fake — that is the first thing to understand. What the detector estimates is risk: how closely the language, timing, and reviewer patterns resemble known manipulation tactics. A high risk score means 'treat this rating with caution,' not 'these reviews are lies.'\n\nThat distinction matters because acting on certainty you do not have leads to bad decisions — dismissing a good product over a false alarm, or trusting a manipulated rating because the score felt reassuring. Use the risk score as one weighted input alongside the critical reviews and your own reading. The disclaimer page lays out the full caveats."
      },
      {
        title: "Repeated-phrase patterns and how they form",
        body:
          "Genuine reviewers describe the same product in wildly different words — that is what makes repetition suspicious. When a dozen reviews all praise the 'exceptional build quality and outstanding customer service' in nearly identical phrasing, the writers were likely working from a common script rather than independent experience.\n\nThe scan clusters near-duplicate phrasing across reviews and weighs how unlikely that overlap is by chance. A few shared adjectives are normal; whole sentences in lockstep are not. This pattern shows up most in incentivized-review campaigns, where participants are coached on what to say."
      },
      {
        title: "Unnatural language the scan flags",
        body:
          "Real customers write like people: specific, uneven, occasionally grumpy about small things. Manipulated reviews often read like marketing copy — strings of superlatives with no concrete detail, phrases like 'highly recommend to everyone' attached to products the reviewer barely describes using. Excessive polish is itself a signal.\n\nThe scan also watches for generic praise that could apply to any product in the category, and for odd phrasing that suggests translated or templated text. None of these markers is decisive alone; the risk score rises when several appear together inside the same review cluster."
      },
      {
        title: "Reviewer-profile checks you can do yourself",
        body:
          "The strongest checks take thirty seconds and a click. Open a suspicious reviewer's profile: a real account usually shows a mix of ratings across different products over time. A profile with nothing but five-star reviews, or a burst of twenty reviews posted on a single day, deserves skepticism.\n\nAlso note how many of their reviews carry Verified Purchase status, and whether their reviews ever mention a downside — even happy customers usually notice something. Profiles can be deleted or made private, which limits this method, but when the data is visible it is often the most telling evidence you will find."
      },
      {
        title: "How to combine the risk score with your own judgment",
        body:
          "Treat the risk score as a dial on the rating, not a verdict on the product. High risk plus high stars means the rating is doing the selling and the evidence is thin — read the critical reviews first and look for variant-level detail. Low risk means the rating is more likely earned, so the complaint patterns become the deciding factor.\n\nThe confidence level tells you how much evidence the score rests on: more reviews, more certain. With only a handful of reviews, even a low score is provisional. The honest use of this tool is narrowing where you spend your attention, not outsourcing the decision."
      }
    ]
  },
  "seller-review-analytics": {
    slug: "seller-review-analytics",
    title: "Seller Review Analytics",
    metaTitle: "Seller Review Analytics | ReviewIntel",
    description:
      "Seller Pro review analytics for complaint mining, sentiment trends, feature requests, positioning, and product improvement actions.",
    audience: "Seller",
    primaryCta: "Open Seller Analytics",
    secondaryCta: "View Seller Plans",
    keywords: ["seller review analytics", "ecommerce review analytics", "seller feedback dashboard", "customer complaint mining"],
    highlights: ["Complaint clusters", "Sentiment trends", "Feature requests", "Action plan"],
    sections: [
      {
        title: "From review pile to decision: the complaint-mining loop",
        body:
          "Seller review analytics exists to close a loop: collect what customers are saying, cluster it into themes, prioritize the themes by cost, and act. Most sellers stall at step one — they glance at the star average and move on. The average hides everything; the loop is where the money is.\n\nRun the loop on a fixed cadence, weekly or monthly depending on review volume. Each pass should end with a short list of named themes and one owner per theme. If a scan produces no actions, the cadence is too frequent or the clustering is too shallow — adjust the process, not the goal."
      },
      {
        title: "Clustering complaints into fixable themes",
        body:
          "A hundred complaints become manageable when they collapse into five or six themes, each with a shared root cause. Durability themes point at materials or manufacturing. Sizing themes point at the size chart or the listing copy. Shipping themes point at packaging or the carrier, not the product.\n\nThe key discipline is naming the theme after the cause, not the symptom: 'hinge cracks after three weeks' beats 'poor quality' because only the first suggests a fix. Good clustering turns a wall of angry text into a punch list your supplier, designer, or copywriter can actually execute."
      },
      {
        title: "Refund-risk themes deserve first attention",
        body:
          "Not all complaints cost the same. Themes tied to refunds, chargebacks, and safety reports — items arriving broken, products that do not match the listing, anything that overheats — should jump the queue regardless of volume. A small complaint rate that drives refunds hurts more than a large rate of mild annoyance.\n\nThe scan flags themes by refund language: 'returning,' 'refund,' 'chargeback,' 'dangerous.' When those appear, the question is not whether to act but how fast. Sometimes the honest fix is delisting a variant until the defect is resolved — painful this quarter, cheaper than the review spiral next quarter."
      },
      {
        title: "Turning themes into listing fixes",
        body:
          "Many complaint themes never require touching the product — they require touching the listing. If buyers keep saying the item 'runs small,' the size chart is wrong. If they complain about a missing feature shown in the photos, the photos are misleading. Listing fixes are the cheapest wins in ecommerce and the most skipped.\n\nRewrite bullet points to answer the top three complaints preemptively, add a photo with a ruler or a hand for scale, and state plainly what the product does not do. Then watch the next thirty days of reviews: the theme's share should shrink. If it does not, the problem was never the listing."
      },
      {
        title: "Tracking whether the fix worked",
        body:
          "A fix without a follow-up scan is a guess. After any product or listing change, note the date and re-run the analytics on the reviews that arrive afterward. The theme's complaint share and the sentiment trend are your scoreboard — direction matters more than any single week.\n\nKeep a simple log: what changed, when, and what the numbers did. Over a few cycles this becomes an institutional memory of what actually moves the needle for your catalog, which is worth more than any single insight. Products improve in iterations, and the analytics make each iteration visible."
      }
    ]
  },
  "product-complaint-analyzer": {
    slug: "product-complaint-analyzer",
    title: "Product Complaint Analyzer",
    metaTitle: "Product Complaint Analyzer | ReviewIntel",
    description:
      "Find the repeated complaints customers care about most, including durability, support, shipping, packaging, and listing mismatch issues.",
    audience: "Seller",
    primaryCta: "Mine Complaints",
    secondaryCta: "See Seller Pro",
    keywords: ["product complaint analyzer", "complaint mining", "customer pain points", "review pain point analysis"],
    highlights: ["Pain point map", "Refund-risk issues", "Packaging signals", "Fix priority"],
    sections: [
      {
        title: "Three complaint families every seller should separate",
        body:
          "Before fixing anything, sort complaints into three families. Durability complaints say the product broke or wore out. Shipping and packaging complaints say it arrived broken, late, or missing parts. Expectation-mismatch complaints say the product works fine but was not what the buyer imagined.\n\nEach family demands a different response: durability needs engineering or a supplier change, shipping needs better packaging, and mismatch needs better listing copy. Mixing them up is how sellers redesign a product that was never broken, or rewrite copy for a defect that is real. Sort first, spend second."
      },
      {
        title: "Durability complaints: signal versus noise",
        body:
          "A single 'broke after a month' is noise; twenty reviews describing the same hinge cracking in week three is signal. The analyzer looks for failure-mode specificity: what broke, how, and after how long. Vague one-star rants without a mechanism carry less weight than detailed failure reports, even when the detailed ones are fewer.\n\nUsage context matters too. A complaint about a budget tool failing under professional workloads is a positioning problem, not a quality problem — the product was sold to the wrong buyer. Separate genuine defect patterns from misuse before committing engineering budget to a fix nobody needed."
      },
      {
        title: "Shipping and packaging complaints point at the box, not the product",
        body:
          "Crushed corners, rattling parts, items arriving in a bag instead of a box — these complaints describe the journey, not the product. They cluster by region and carrier, spike during holiday volume, and disappear when packaging improves. Treating them as product defects sends your engineers chasing a problem the warehouse created.\n\nThe fix is usually unglamorous: sturdier boxes, better void fill, fragile labeling that survives the sort line. Because these complaints rarely reflect the product itself, they are also the easiest to eliminate quickly — and buyers forgive fast shipping-issue resolutions more readily than product defects."
      },
      {
        title: "Expectation-mismatch complaints are listing problems",
        body:
          "The product works exactly as designed, and the buyer is still unhappy — because the listing promised something else. Wrong size expectations, colors that look different in person, features visible in photos but absent in the box: every one of these is a listing failure wearing a product complaint's clothes.\n\nThese are the cheapest complaints to fix and among the most common. Add real measurements, show the product next to everyday objects for scale, photograph the actual color in daylight, and write copy that says what the product does not do. Each clarified expectation removes a future one-star review before it is written."
      },
      {
        title: "Weighting complaints before you spend a dollar",
        body:
          "Fix budgets are finite, so complaints need weighting: frequency times severity times refund cost. A rare complaint about a safety issue outranks a common complaint about packaging aesthetics, because the first carries liability and the second carries mild annoyance. Severity beats volume when the stakes are real.\n\nIgnore the loudest single review if no pattern backs it — outliers without a cluster are usually personal, not systemic. Rank the themes, estimate the fix cost for each, and start where impact per dollar is highest. The analyzer's job is to make that ranking obvious; the spending decision stays yours."
      }
    ]
  },
  "product-feedback-dashboard": {
    slug: "product-feedback-dashboard",
    title: "Product Feedback Dashboard",
    metaTitle: "Product Feedback Dashboard | ReviewIntel",
    description:
      "Turn product reviews into a daily feedback command center with ratings, sentiment, complaints, positive feedback, and improvement notes.",
    audience: "Seller",
    primaryCta: "Open Feedback Dashboard",
    secondaryCta: "View Calendar",
    keywords: ["product feedback dashboard", "product improvement dashboard", "customer feedback analytics", "review dashboard"],
    highlights: ["Daily scan calendar", "Sentiment overview", "Progress notes", "Improvement tracking"],
    sections: [
      {
        title: "Why sentiment needs a timeline, not a snapshot",
        body:
          "A 4.3-star average tells you where a product stands; a twelve-week sentiment line tells you where it is going. Suppliers change materials, warehouses change packers, competitors change the reference point — and the average hides all of it until the damage is done. Trends surface problems while they are still small.\n\nWatch for slope changes, not just levels: a product sliding from 4.6 to 4.3 over two months is a louder alarm than a stable 4.0. The dashboard's timeline view exists for exactly this — catching the drift early, when a packaging tweak or a listing edit can still reverse it."
      },
      {
        title: "A weekly cadence that fits a busy seller",
        body:
          "Feedback systems die when they demand too much time, so keep the ritual small: twenty minutes, once a week, same day. Open the dashboard, scan the new reviews since last time, note any complaint theme that grew, and flag one positive review worth quoting. Then close it and get back to selling.\n\nThe calendar view makes the cadence visible — gaps in your review coverage show up as blank days, which is its own reminder. Sellers with high review volume can shift to twice weekly; sellers with slow catalogs can go monthly. The right cadence is the one you will actually keep."
      },
      {
        title: "Reading the positive feedback, not just the complaints",
        body:
          "Complaints get the attention, but praise pays the bills. The phrases happy customers repeat — 'survived two toddlers,' 'setup took ten minutes' — are positioning copy written for you, free of charge. Lift them into bullet points, ad headlines, and the product's hero description, where they convert better than anything invented in a brainstorm.\n\nPositive themes also tell you what to protect. When a redesign or a supplier switch is on the table, the dashboard's praise map shows which features customers actually value — the ones that must survive the change. Companies break beloved products by 'improving' the parts nobody complained about but everybody loved."
      },
      {
        title: "Progress notes: writing the story of each fix",
        body:
          "Every product improvement should leave a paper trail: what changed, the date it shipped, and which complaint theme it targeted. Progress notes turn the dashboard from a reporting tool into a lab notebook — six months later you can see exactly which changes moved the sentiment line and which ones did nothing.\n\nThis matters most for teams, where the person who fixed the packaging is not the person reading the reviews. Notes make the reasoning visible and stop the same debate from restarting every quarter. They also give you honest material for listing copy: 'redesigned hinge, March' beats vague claims of 'new and improved.'"
      },
      {
        title: "From dashboard to product roadmap",
        body:
          "Feature requests that appear month after month are a roadmap writing itself. When dozens of reviewers ask for a larger size, a different color, or a missing accessory, the dashboard is showing you demand with the research already done. Bundle the requests, estimate the margin, and you have a business case without hiring a consultant.\n\nThe same data feeds a kill list: variants whose complaint share never improves despite fixes are telling you to cut them. Data informs these calls but judgment makes them — the dashboard's role is to make the evidence impossible to ignore, not to replace the person who knows the business."
      }
    ]
  },
  "ai-review-intelligence-tool": {
    slug: "ai-review-intelligence-tool",
    title: "AI Review Intelligence Tool",
    metaTitle: "AI Review Intelligence Tool | ReviewIntel",
    description:
      "ReviewIntel combines shopper verdicts and seller intelligence so reviews become decisions, not walls of text.",
    audience: "Platform",
    primaryCta: "Start AI Analysis",
    secondaryCta: "Explore Features",
    keywords: ["AI review intelligence tool", "AI review analysis", "review intelligence platform", "review summarizer"],
    highlights: ["Shopper verdict", "Seller report", "Fake-risk confidence", "Shareable results"],
    sections: [
      {
        title: "Two modes, one evidence base",
        body:
          "ReviewIntel runs in two modes because shoppers and sellers ask different questions of the same reviews. Shopper mode answers 'should I buy this' — a verdict, a risk read, and the complaints that matter. Seller mode answers 'what should I fix' — complaint clusters, sentiment trends, and an action plan.\n\nBoth modes read the same underlying evidence, so the two sides of a marketplace stay honest with each other: the complaint a shopper is warned about is the complaint a seller is told to fix. Switching workspaces changes the output, never the underlying review data."
      },
      {
        title: "What the AI actually reads in your reviews",
        body:
          "The analysis starts with language, not stars: repeated phrasing that suggests templates, specific failure descriptions versus vague praise, sentiment shifts across review recency, and how complaints concentrate around particular variants or time periods. Rating distributions and review velocity add context the words alone cannot give.\n\nWhat it does not do is invent. If the evidence is thin — a handful of reviews, all vague — the output says so through low confidence scores rather than filling the gaps with plausible-sounding guesses. An honest 'there is not enough here to judge' is a feature, not a failure."
      },
      {
        title: "What the outputs look like in practice",
        body:
          "Shopper outputs are built for speed: a Buy, Maybe, or Avoid verdict up top, the fake-review risk beside it, and the biggest complaints summarized in the reviewers' own phrasing. Everything fits on one screen and screenshots cleanly, because buying decisions happen on phones in store aisles.\n\nSeller outputs are built for action: complaint themes ranked by frequency and refund risk, sentiment tracked over time, and a prioritized fix list. Results can be shared with a team or supplier without exporting spreadsheets — the report is the deliverable, ready to forward."
      },
      {
        title: "The honest limits of AI review analysis",
        body:
          "Every AI review tool has edges, and you should know ours. The analysis cannot verify that a reviewer actually bought the product, cannot prove any single review is fake, and struggles with sarcasm, idioms, and non-English nuance. A scan of twelve thin reviews will be less reliable than a scan of four hundred detailed ones — volume and specificity are the fuel.\n\nTreat the outputs as a skilled assistant's briefing, not a judge's ruling. The verdicts, scores, and clusters narrow where your attention goes; the final call stays human. Any review tool that hides these limits is selling certainty it does not have — we would rather you use the tool with eyes open."
      },
      {
        title: "When ReviewIntel earns its place in your workflow",
        body:
          "For shoppers, the natural slot is the pre-purchase check: paste the link or screenshot before the money moves, especially on unfamiliar brands and big-ticket items. It takes less time than reading the reviews manually and catches the patterns that skimming misses.\n\nFor sellers, the slot is the weekly review pass and the pre-launch listing audit — catching expectation mismatches before they become one-star themes. The tool fits inside habits you already have rather than demanding new ones, which is the only way software like this actually gets used."
      }
    ]
  }
};

export function getSEOLandingPage(slug: string) {
  return seoLandingPages[slug];
}
