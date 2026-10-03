export type GuideSection = {
  heading: string;
  paragraphs: string[];
};

export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingMinutes: number;
  sections: GuideSection[];
};

export const guides: Guide[] = [
  {
    slug: "spot-fake-amazon-reviews",
    title: "How to Spot Fake Amazon Reviews: 7 Patterns Worth Checking",
    excerpt:
      "Fake reviews rarely announce themselves — but they leave patterns. Here are seven signals real shoppers check before trusting a star rating.",
    publishedAt: "2026-10-03",
    readingMinutes: 4,
    sections: [
      {
        heading: "1. The same phrases keep repeating",
        paragraphs: [
          "Read enough Amazon reviews and you'll notice something: genuine reviewers write differently from one another. One person talks about how a blender handles frozen fruit, another complains about the noise, a third mentions the lid seal. Real experience is specific and varied. So when several five-star reviews on a product use the same distinctive phrases — \"excellent quality product\", \"highly recommend to everyone\" — repeated word for word, treat it as a pattern worth noting.",
          "Copy-pasted wording usually means the text came from one source: a review template, a seller's suggested script, or a paid review batch. One match can be coincidence; three or more reviewers with nearly identical sentences is a risk signal. Scroll through the most recent reviews and search the page for a distinctive phrase to see how often it shows up."
        ]
      },
      {
        heading: "2. The language sounds like marketing, not a buyer",
        paragraphs: [
          "Genuine buyers describe what they did with the product. Suspicious reviews describe how the product made them feel, in the language of an advertisement: \"This revolutionary gadget exceeded all my expectations!\" or \"An absolute game-changer for my lifestyle.\" That is ad copy, not a review.",
          "Look for concrete detail. A real headphone review mentions clamping force, cable length, or how the earbuds sound on calls. A vague review stays at the level of superlatives — \"amazing quality\", \"works perfectly\" — with nothing you could only know from owning the item. The less a review says about actual use, the less you should lean on it."
        ]
      },
      {
        heading: "3. Reviews arrive in bursts",
        paragraphs: [
          "Check the dates. A healthy product accumulates reviews at a roughly steady pace, sometimes rising after a sale or a product launch. A product that sat quiet for months and then received forty five-star reviews in a single week is showing a burst — and bursts are worth understanding.",
          "Not every burst is suspicious. A product launch, a holiday sale, or a mention by a popular creator can all drive real review surges. The suspicious version looks different: dozens of reviews appearing within days of each other, many using similar wording, with no visible cause. We cover this in depth in our guide on review velocity spikes."
        ]
      },
      {
        heading: "4. Reviewer profiles look manufactured",
        paragraphs: [
          "Click through to a reviewer's profile. A real reviewer usually has a mix of products, a spread of ratings, and reviews written over months or years. A profile where every review is five stars, covers wildly unrelated products, and was posted within a few days looks like an account built for reviewing rather than shopping.",
          "There are honest explanations — some people only review when delighted, and Amazon lets reviewers keep profiles private, so you can't always see the history. A thin profile alone proves nothing. But when the same thin profile keeps appearing across products from the same seller, the pattern strengthens."
        ]
      },
      {
        heading: "5. Incentivized or discounted reviews",
        paragraphs: [
          "Reviews that say \"I received this product at a discount in exchange for my honest review\" deserve extra scrutiny. A discount doesn't make a review fake, but it changes the incentive: people who got something cheap tend to rate it higher, and some sellers hand out discounts specifically to generate positive coverage.",
          "Amazon has restricted incentivized reviews over the years, which is why you see fewer of these disclosures than you once did. When you spot one, treat the review as marketing-influenced. Ask whether the same praise would have been written by someone who paid full price — and give extra weight to reviews that show no connection to the seller."
        ]
      },
      {
        heading: "6. A wall of extremes with nothing in between",
        paragraphs: [
          "Scan the rating distribution. Some products carry hundreds of five-star reviews, dozens of one-star reviews, and almost nothing in between. That polarized shape often means the reviews are arguing about different things — or that the positives were boosted while the negatives come from genuinely disappointed buyers.",
          "A hollow middle is a reason to dig, not a verdict. Read the one-star reviews carefully: if they describe the same specific problem the five-star reviews never mention, the positives may be telling a partial story. Real products usually earn at least some three- and four-star reviews from buyers who liked the product with reservations."
        ]
      },
      {
        heading: "7. These are risk signals, not proof",
        paragraphs: [
          "Everything in this article is a risk signal, not proof. There is no checklist — manual or automated — that can definitively declare a review fake. Sellers sometimes get targeted by fake negative reviews from competitors, too, so the same skepticism applies in both directions.",
          "The practical move is to stack signals: repeated phrases plus a burst plus thin reviewer profiles tells a much stronger story than any one pattern alone. And if a product shows several of these patterns at once, consider it a reason to look at a competing product — not a reason to accuse anyone publicly."
        ]
      }
    ]
  },
  {
    slug: "review-velocity-spikes",
    title: "What Review Velocity Spikes Mean (and When to Worry)",
    excerpt:
      "A product that gains 200 reviews in a week is telling you something. Learn to tell a launch surge from a pattern that deserves suspicion.",
    publishedAt: "2026-10-02",
    readingMinutes: 3,
    sections: [
      {
        heading: "What review velocity actually is",
        paragraphs: [
          "Review velocity is simply the rate at which reviews accumulate: how many new reviews a product gets per week or month. On a product page you can see it indirectly — the dates on recent reviews tell you whether the product is collecting a handful of reviews a week or a flood every day.",
          "Velocity matters because reviews are supposed to reflect buying behavior over time. A product that sells steadily collects reviews steadily. When the review rate suddenly jumps — or stalls — something changed, and figuring out what changed tells you a lot about how much to trust the current rating."
        ]
      },
      {
        heading: "Normal reasons reviews surge",
        paragraphs: [
          "The most common honest cause of a spike is a launch. New products often get a burst of reviews in their first weeks as early buyers report back, especially when the seller runs a launch promotion or the product gets featured. That early surge usually settles into a steadier rhythm.",
          "Big sales events do it too. Prime Day, Black Friday, and holiday seasons push more units out the door, and a share of those buyers leave reviews in the following weeks. If a spike lines up with a major sale you remember, it's probably just volume.",
          "External attention is the third honest driver. A product mentioned by a popular creator, featured in a gift guide, or discussed in a community can sell out overnight — and the review curve follows the sales curve. When a spike has a visible public cause, it usually isn't a manipulation story."
        ]
      },
      {
        heading: "Patterns that should make you pause",
        paragraphs: [
          "The suspicious version looks different: a product with almost no review history suddenly collects dozens of reviews in a few days, with no launch, no sale, and no public attention to explain it. Reviews appearing out of nowhere need an explanation, and \"nothing happened\" isn't one.",
          "Look at what the spike reviews say. In manipulated surges, the new reviews often share wording, length, and enthusiasm — they read like they came from the same template. A genuine surge from a sale brings variety: different use cases, different complaints, different writing styles.",
          "Also check what the spike reviews don't say. Real buyers in a surge mention the context — \"bought this on Prime Day\", \"saw this recommended online\". A wall of five-star reviews that never mentions why everyone bought at once is missing the detail you'd expect from real purchasing behavior."
        ]
      },
      {
        heading: "How to read the review timeline yourself",
        paragraphs: [
          "You can do this check yourself in about a minute. Sort reviews by \"most recent\" and scroll back through the dates. You're looking at the shape: a healthy curve ramps up gradually or rises around visible events; a suspicious one looks like a cliff — flat for months, then a vertical wall of reviews.",
          "Pay attention to the mix during the spike. If nearly every review in the burst is five stars while the product's older reviews are mixed, the surge may be drowning out a less flattering baseline. A genuine popularity surge usually lifts all ratings, not just the perfect ones."
        ]
      },
      {
        heading: "Putting velocity in context",
        paragraphs: [
          "Velocity is one signal among several, and it works best combined with the others. A spike plus repeated phrases plus thin reviewer profiles is a strong pattern; a spike alone, especially with a visible cause, is usually just business.",
          "When you're unsure, the practical answer is patience: wait a few weeks and check whether the rating holds once the burst passes. Manipulated spikes tend to fade back to the product's real baseline; genuine popularity usually sticks around. And if the pattern still bothers you, a competing product with a steadier history is often the safer buy."
        ]
      }
    ]
  },
  {
    slug: "read-complaint-patterns",
    title: "How to Read Complaint Patterns Before You Buy",
    excerpt:
      "Every product has complaints. The skill is telling a real durability problem apart from shipping gripes and one-off bad luck.",
    publishedAt: "2026-10-01",
    readingMinutes: 3,
    sections: [
      {
        heading: "Concentration is the signal; volume is noise",
        paragraphs: [
          "Every product with more than a handful of reviews has complaints — that's normal and even healthy. The question isn't whether complaints exist; it's whether they concentrate. Ten reviews complaining about the same hinge breaking in the same spot is a pattern. Ten reviews complaining about ten different things is just the background noise of mass manufacturing.",
          "Concentration is what separates a real problem from bad luck. When you read the critical reviews, keep a mental tally of the specific issue each one names. If the same defect keeps appearing — a battery that dies in weeks, a zipper that splits, an app that won't connect — you're looking at something the product actually does, not something that happened once."
        ]
      },
      {
        heading: "Durability complaints vs. one-off bad luck",
        paragraphs: [
          "Durability complaints have a tell: they describe the product failing after a period of normal use. \"Stopped holding a charge after three weeks\" or \"the handle snapped during regular use\" point at the product itself. These are the complaints that deserve the most weight, because they'll likely happen to you too.",
          "One-off complaints look different. A single report of a strange defect nobody else mentions — a scratched lens, a missing part, a weird smell — is usually a quality-control escape or shipping damage. It tells you something about the seller's handling, but not much about what your unit will be like. Don't let a single vivid horror story outweigh a hundred quiet successes."
        ]
      },
      {
        heading: "Shipping and service complaints aren't product complaints",
        paragraphs: [
          "Many one-star reviews aren't about the product at all. \"Arrived two days late\", \"the box was damaged\", \"customer service never replied\" — these are fulfillment and service complaints, and they often get mixed into the product's rating where they don't belong. A late package says nothing about the item inside it.",
          "When a product's complaints are mostly about delivery, packaging, or a seller's responsiveness, the rating is punishing the logistics, not the product. That's still useful information — it tells you to buy from a different seller or expect a hassle — but it shouldn't scare you off a product that owners otherwise love."
        ]
      },
      {
        heading: "Match complaints to your own use",
        paragraphs: [
          "Not every real complaint is relevant to you. A laptop reviewer furious about gaming performance doesn't matter if you're buying it for spreadsheets. A tent reviewer complaining it's too small for a family of five doesn't matter if you're camping solo. Filter complaints through your own use case before deciding they apply.",
          "This is where reading beats skimming. The star rating aggregates everyone else's priorities; your priorities are your own. A product with a 4.2 rating whose complaints are all about features you don't need can be a better buy for you than a 4.6 product whose one recurring complaint hits exactly how you'll use it."
        ]
      },
      {
        heading: "The reviews sellers hope you skip",
        paragraphs: [
          "Two- and three-star reviews are the most useful real estate on a product page, and they're also the least promoted. Review sections surface the most 'helpful' reviews first, which often means the most enthusiastic ones. Scroll past them deliberately. The middle of the distribution is where buyers are honest about trade-offs instead of performing delight or outrage.",
          "Read these reviews for the word 'but'. 'Great sound quality, but the ear tips fall out during runs' tells you more in one sentence than five glowing reviews. A product whose middle reviews all contain the same 'but' has a known weakness — and knowing it before you buy is the whole point of reading reviews at all."
        ]
      },
      {
        heading: "When the pattern says walk away",
        paragraphs: [
          "Walk away when the same specific failure shows up across many reviews, especially when reviewers describe it happening under normal use. That's not bad luck — it's the product's actual behavior, and no discount makes a known defect a good deal.",
          "Also walk away when complaints cluster around safety: overheating batteries, fraying cords, products that smell of chemicals. Even a handful of safety complaints deserves more weight than a hundred cosmetic ones. Your threshold for risk should be lowest exactly where the stakes are highest."
        ]
      }
    ]
  },
  {
    slug: "verified-purchase-vine-badges",
    title: "What Verified Purchase, Vine, and Unverified Badges Actually Mean",
    excerpt:
      "Those little badges under Amazon reviews aren't decoration. Here's what each one actually verifies — and how much trust each deserves.",
    publishedAt: "2026-09-30",
    readingMinutes: 3,
    sections: [
      {
        heading: "Verified Purchase: what Amazon actually checked",
        paragraphs: [
          "A \"Verified Purchase\" badge means Amazon's own records confirm the reviewer bought the product through Amazon — same account, full price, no funny business with the order. It's the strongest basic trust signal on the platform, because it ties the review to a real transaction Amazon can see.",
          "What it doesn't mean: that the review is honest, unbiased, or even about the right product. Verified buyers can still be incentivized off-platform, and some sellers merge old reviews onto new product listings — a practice Amazon has fought for years. The badge proves a purchase happened. It proves nothing about the reviewer's motives."
        ]
      },
      {
        heading: "Vine: free products, professional reviewers",
        paragraphs: [
          "Vine reviews come from Amazon's Vine program: Amazon invites trusted reviewers and sends them products for free, and the reviewer posts an honest review. You'll see a \"Vine Customer Review of Free Product\" badge. These reviewers didn't pay, which removes the \"I need to justify my purchase\" bias — but it adds a different one.",
          "Free products create goodwill. Vine reviewers know more free products arrive if they keep reviewing, and while the program asks for honesty, nobody is immune to being a little kinder to something they got for nothing. Treat Vine reviews as useful — Vine reviewers tend to write detailed, careful reviews — but read them with the free-product context in mind."
        ]
      },
      {
        heading: "Unverified reviews aren't automatically fake",
        paragraphs: [
          "Reviews without a badge aren't automatically fake. People buy products as gifts (the purchase sits on someone else's account), buy the same item from another store, or wrote their review before badges existed. Some of the most thoughtful, detailed reviews on Amazon carry no badge at all.",
          "The risk with unverified reviews is that there's no transaction tying the reviewer to the product — anyone with an account can post one. So give them a fair reading, but look harder at the content: specific detail about real use is what separates a genuine unverified review from a manufactured one."
        ]
      },
      {
        heading: "How much weight each badge deserves",
        paragraphs: [
          "A practical hierarchy: Verified Purchase reviews are your baseline — real transactions, real buyers. Vine reviews are worth reading for their detail, discounted slightly for the free-product effect. Unverified reviews are fine as supporting color but shouldn't carry a decision on their own.",
          "And remember that no badge fixes the other patterns. A Verified Purchase review can still be copy-pasted marketing text, and a product can accumulate hundreds of verified reviews in a suspicious burst. Badges tell you about the transaction. The review's content still has to earn your trust on its own."
        ]
      },
      {
        heading: "The badge gaming sellers try",
        paragraphs: [
          "Badges matter because shoppers trust them, which is exactly why some sellers try to game them. The classic move is the review merge: an old, well-reviewed product listing gets merged with a new, unrelated product, and the old reviews — badges and all — transfer over. Suddenly a brand-new phone case has 2,000 glowing verified reviews that were originally written about a garden hose.",
          "When a product's reviews seem disconnected from the product — reviews mentioning a different item, or praising features this product doesn't have — merged reviews are the likely explanation. The badges are real; they just belong to a different product. Reading a few reviews for product-name mismatches is the fastest way to catch it."
        ]
      },
      {
        heading: "Putting badges together with everything else",
        paragraphs: [
          "Badges answer one question — was there a real transaction? — and say nothing about the other questions that matter: did reviews arrive in a burst, do they repeat the same phrases, do the reviewer profiles look real? A Verified Purchase badge on a copy-pasted review is still a copy-pasted review.",
          "So use badges as a starting filter, not a finishing one. Prefer products whose review sections are built mostly on verified purchases, then run the rest of your checks on top: rating shape, complaint concentration, timing, and photos. No single signal carries a buying decision — but stacked together, they get you close."
        ]
      }
    ]
  },
  {
    slug: "same-star-rating-different-meaning",
    title: "Why the Same Star Rating Can Mean Very Different Things",
    excerpt:
      "Two products can both show 4.3 stars and be completely different bets. The average hides the shape — here's how to read what's underneath.",
    publishedAt: "2026-09-28",
    readingMinutes: 3,
    sections: [
      {
        heading: "The average hides the distribution",
        paragraphs: [
          "A star rating is an average, and averages hide as much as they reveal. Two products can both sit at 4.3 stars while telling completely different stories: one might be loved by almost everyone with a few detractors, while the other is a battlefield of five-star praise and one-star fury. The number is identical. The risk is not.",
          "This is why the rating histogram — that little bar chart of how many 5-star, 4-star, and 3-star reviews a product has — is more useful than the headline number. It takes five seconds to read, and it changes what 4.3 means. Make it a habit to glance at the shape before you read a single review."
        ]
      },
      {
        heading: "Polarized 4.3 vs. consistent 4.3",
        paragraphs: [
          "A polarized 4.3 — heavy on five stars, heavy on one stars, hollow in the middle — usually means buyers are experiencing two different products. Maybe quality control is inconsistent, maybe the product works great for some use cases and fails at others, or maybe the positives were boosted. Either way, your odds look like a coin flip, not a 4.3-star certainty.",
          "A consistent 4.3 — a big mound of four- and five-star reviews, a reasonable tail of threes, a few ones — is the shape of a solid product with normal trade-offs. Nobody's product is perfect; a healthy middle of the distribution means buyers are engaging honestly with what the product is and isn't. This 4.3 is a much safer bet than the polarized one."
        ]
      },
      {
        heading: "Categories have their own norms",
        paragraphs: [
          "Star ratings also mean different things in different categories. Shoppers tend to rate phone cases and kitchen gadgets generously, while they grade mattresses, skincare, and anything with a subscription component harshly. A 4.1 in a tough category can represent a better product than a 4.6 in an easy one.",
          "So compare within categories, not across them. When you're choosing between two blenders, the relative ratings matter; when you're comparing a blender's 4.5 to a moisturizer's 4.2, the numbers aren't speaking the same language. Category norms are the invisible context behind every rating."
        ]
      },
      {
        heading: "Old ratings can describe a different product",
        paragraphs: [
          "Ratings have a memory problem: they accumulate over the product's whole life, but products change. A listing that's been live for three years might show a 4.4 built on an older version — before the manufacturer quietly changed the materials, the supplier, or the formula. The rating describes the product's history, not necessarily the unit you'd receive.",
          "Sort reviews by \"most recent\" and check whether the tone has shifted. If recent reviews are noticeably harsher than older ones, the product may have changed for the worse — and the headline rating is lagging behind reality. Recency is the correction factor the average doesn't apply."
        ]
      },
      {
        heading: "Read the shape, not the number",
        paragraphs: [
          "The practical routine is simple: check the histogram shape, compare against category norms, and skim the most recent reviews for shifts. Three quick checks, and a 4.3 stops being a shrug and starts being information.",
          "Star ratings are a starting point, never a verdict. They're most useful as a filter — ruling out the obvious duds — and least useful as a tiebreaker between two decent options. For the final call, the distribution and the actual words in the reviews will always tell you more than the number."
        ]
      },
      {
        heading: "A quick worked example",
        paragraphs: [
          "Imagine two blenders, both rated 4.3. Blender A's histogram shows 70% five-star reviews, a solid block of fours, and a thin tail of lower ratings — buyers broadly agree it's good with minor flaws. Blender B shows 55% five-star, 25% one-star, and almost nothing between — half of buyers love it and a quarter think it's broken.",
          "The headline number can't tell them apart, but your money should. Blender A is the safer buy for almost everyone; Blender B is a gamble that pays off only if you happen to land in the happy half. Same rating, different meaning — and now you know which questions to ask."
        ]
      }
    ]
  },
  {
    slug: "pre-purchase-cross-check-routine",
    title: "A 5-Minute Cross-Checking Routine Before You Buy",
    excerpt:
      "A practical checklist for any product page: badges, rating shape, complaint patterns, review timing, and photos — in five minutes flat.",
    publishedAt: "2026-09-27",
    readingMinutes: 4,
    sections: [
      {
        heading: "Why a routine beats gut feeling",
        paragraphs: [
          "Most bad purchases aren't caused by bad products — they're caused by fast decisions. A product page is designed to convert you: the rating is prominent, the best reviews are surfaced first, and the buy button is one click away. A short, repeatable routine is the simplest defense, because it forces you to look at the parts of the page the design doesn't emphasize.",
          "This routine takes about five minutes and works on any product page. You don't need tools or accounts — just the discipline to check five things in order before you click buy. Think of it as a pre-flight checklist: boring, fast, and the reason planes don't crash."
        ]
      },
      {
        heading: "Minute 1: badges and reviewer basics",
        paragraphs: [
          "Start with the badges. Skim the top reviews and note how many carry a Verified Purchase badge versus Vine or no badge at all. A review section dominated by unverified reviews — or by Vine reviews for a product that isn't new — is a weaker foundation than it looks. You're not disqualifying anything yet, just calibrating how much to trust what follows.",
          "While you're there, click one or two reviewer profiles. You're looking for the obvious tells: every review is five stars, the account reviewed a dozen unrelated products in a single day, or the profile is brand new. One thin profile means nothing; a pattern of them means the review section is partly manufactured."
        ]
      },
      {
        heading: "Minute 2: the rating shape",
        paragraphs: [
          "Next, read the rating histogram instead of the headline number. A consistent mound of fours and fives is healthy. A polarized split — tons of fives, tons of ones, nothing between — means buyers are having two different experiences, and you need to figure out which one you'd get. Compare the rating against similar products in the same category, since some categories simply rate harsher than others.",
          "Then sort by most recent. If the last month of reviews is noticeably worse than the overall average, the product may have changed — a new supplier, cheaper materials, a firmware update gone wrong. The headline rating remembers the good old days; the recent reviews describe what you'd actually receive."
        ]
      },
      {
        heading: "Minute 3: complaint patterns",
        paragraphs: [
          "Now read the critical reviews — specifically the two- and three-star ones, which tend to be the most honest. Tally the specific complaints. One issue mentioned by many reviewers (\"the battery dies in a month\") is a real defect pattern; ten different complaints from ten reviewers is normal noise. Give durability complaints the most weight, and discount shipping and customer-service gripes — those are about the seller, not the product.",
          "Filter what you find through your own use. A complaint about heavy gaming performance doesn't matter if you're buying a laptop for email. But if the recurring complaint hits exactly how you'll use the product, that's your answer — no further checking needed."
        ]
      },
      {
        heading: "Minute 4: timing and velocity",
        paragraphs: [
          "Check the dates on recent reviews. A healthy product collects reviews at a steady pace; a product that went quiet for months and then gained fifty five-star reviews in a week deserves a closer look. If the surge lines up with a launch, a sale, or visible public attention, it's probably genuine volume.",
          "If there's no visible cause — and especially if the surge reviews share wording or enthusiasm — treat the current rating as inflated. Suspicious timing doesn't prove manipulation, but it does mean the rating is telling you less than it appears to."
        ]
      },
      {
        heading: "Minute 5: photos and the final call",
        paragraphs: [
          "Finish with customer photos. Real buyer photos show the product in real homes, with real lighting and real flaws. Compare them against the listing images: if the product in buyer photos looks cheaper, smaller, or different in color, believe the buyers. A listing whose customer photos consistently contradict the marketing images is a listing you shouldn't trust.",
          "Now make the call. If the badges check out, the distribution is healthy, complaints are noise or irrelevant to you, timing looks natural, and buyer photos match the listing — buy with confidence. If two or more checks raised flags, look at a competing product. And when a purchase matters and you want a second opinion, a ReviewIntel scan reads the review language, complaint concentration, and trust signals for you — your first three scans are free, no account needed."
        ]
      }
    ]
  }
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
