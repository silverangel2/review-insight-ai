# ReviewIntel Buying Score: Spec v2 FINAL (Owner-approved 2026-10-12)

Author: Luca Bennett (COO). Revised from v1 per the Owner's feedback. For review before any code change.

## 0. What changed from v1
1. The Bayesian marketplace baseline is kept. Written reviews can lower the score much more than they can raise it.
2. **All t-tests, ANOVA and p-values are removed.** The visible Amazon sample is biased and non-random, so we use deterministic discrepancy rules instead.
3. **0 written reviews gives a Provisional Marketplace Score**, never a full Buying Score. The full Buying Score needs at least 1 real written review (and gets stronger from 3).
4. **Safety has three tiers:** one customer report, repeated independent reports, and an official recall.
5. **The prior comes from no historical scan data.** It's a fixed, documented neutral prior that we'll recalibrate later on clean future data only.
6. Retrieval stays simple: real public reviews, strict exact-model matching, second-store evidence when available. We stop chasing hundreds of reviews.

## Plain-language rules (Owner)
1. If ReviewIntel can see that a review exists but cannot actually read its text, that review does not increase confidence. It can count toward the marketplace total, but not toward confidence in the written-review analysis.
2. ReviewIntel never says "there is no recall" unless it actually checked an official recall source during that scan. If it didn't check, it only says the safety complaint is from one customer and has not been verified.
3. If the same review appears on Amazon, Walmart or Best Buy, it counts only once. Copied or syndicated reviews are never treated as separate people.
4. Written reviews can lower the score much more than they can raise it.

## 1. Hard rules (unchanged)
- Real public data only. No fake or AI-written reviews, and no invented opinions.
- Zero OpenAI calls (guard enforced, count reported per scan).
- Every result states what was read, e.g. "8 written reviews read · 4.5★ from 2,143 ratings". We never imply we analyzed the whole marketplace.
- All inputs (rating, count, written reviews) must match the exact model and variant. Anything mismatched is dropped.

## 2. Inputs
| Symbol | Meaning |
|---|---|
| R̄ | Marketplace average rating (1–5) |
| N | Marketplace rating count |
| n | Real written reviews retrieved (all stores, exact model) |
| sᵢ | Per-review sentiment in [-1, 1], rule-based (no OpenAI) |
| r̄ | Mean star rating of the written reviews we read |
| Rel | # written reviews reporting a reliability failure (stopped working, defective on arrival, broke, returned for defect) |
| Saf | # independent written reviews reporting a safety hazard (fire, burn, shock, injury, choking, toxic) |
| Min | # written reviews with a minor complaint (counted up to 3) |
| T | # recurring complaint themes (a theme counts if it appears in ≥ 2 reviews) |

Independent means different reviewers and different dates, with no near-duplicate text (similarity < 0.8). Duplicates count once.

**Cross-store deduplication (mandatory):** syndicated reviews (e.g. Bazaarvoice/PowerReviews) often appear at several retailers. Deduplication runs across ALL sources combined (Amazon, Walmart, Best Buy, brand sites), before n, Rel, Saf, Min and T are counted. Two reviews are the same if their normalized text similarity is ≥ 0.8, or if they share the same reviewer name plus a date within 3 days plus the same star rating. Only deduplicated reviews count toward n, toward "second-store evidence" for confidence, or as an independent second safety or reliability report.

## 3. Marketplace baseline (Bayesian shrinkage)
**Prior (fixed, documented):** C = 4.0 stars, m = 500 ratings.
C = 4.0 is a neutral "typical-good" point. Marketplace averages cluster around 4 to 4.5, so 4.0 is deliberately a little skeptical. m = 500 means a product needs a few hundred ratings before its own average dominates.
These values do NOT come from old ReviewIntel scans. We'll recalibrate per category only after about 90 days of clean data from the new engine.

  R* = (N·R̄ + m·C) / (N + m)
  B  = 100 · (R* − 1) / 4        (0–100 baseline)

## 4. Written-evidence adjustment A (range −30 to +10)
  w   = n / (n + 10)                                (small samples count less)
  Pos = 10 · s̄ · w                                  (s̄ = mean sentiment; ≤ +10, negative if s̄ < 0)
  Neg = 6·Rel + 10·Saf + 4·T + 3·min(Min, 3)
  If DiscrepancyFlag: Neg = 1.5 · Neg
  A   = clamp( Pos − Neg , −30 , +10 )

**DiscrepancyFlag** (deterministic, no statistics; needs n ≥ 3) is true if either:
- R̄ − r̄ ≥ 1.0 star (the visible reviews are much worse than the marketplace rating), or
- the share of 1–2★ among the visible reviews is ≥ 40% and at least 2× the marketplace 1–2★ share (when the star histogram is available).

It shows on screen as: "The reviews we could read are noticeably worse than the overall rating."

## 5. Final Buying Score
  S = clamp( B + A , 0 , 100 )

Then apply these caps in order. The lowest cap wins.
| Condition | Cap | Shown as |
|---|---|---|
| Official recall or safety notice for this exact model (government source, e.g. CPSC / Health Canada) | 30 (Skip) | Red banner, "Official recall", link to source |
| Saf ≥ 2 independent reports of the same hazard | 54 (Wait) | Strong warning, "Several customers independently report…", quotes |
| Saf = 1 | 74 (Wait) | Warning, "One customer reported…", quote. Plainly labelled as a single unverified report |
| Rel ≥ 2 with the same failure theme | 74 (Wait) | "Repeated reports of …", quotes |
| N < 50 and n < 10 (too new to trust) | 74 (Wait) | "Few ratings so far" |

The "too new" cap also applies to the Provisional Marketplace Score (section 7): if N < 50 and n = 0, the provisional score is min(B, 74), so it shows "Leaning Wait" with "Few ratings so far". Example: 5.0★ from 12 ratings with 0 written reviews gives Provisional 74, Leaning Wait. (Owner amendment, 2026-10-12.)

**Classifiable reviews (n_eff).** A written review is *classifiable* if the rules find a sentiment word or a reliability, safety or minor-complaint signal in its text. Non-English or very terse reviews with no such signal are not classifiable. They still count in the "N written reviews read" total (n), but NOT in n_eff. n_eff replaces n in w = n_eff / (n_eff + 10), in s̄ (mean over classifiable reviews), in the DiscrepancyFlag's n ≥ 3 requirement, in EvidenceConf and in the second-store threshold (≥ 3 classifiable reviews there). The "too new" cap still uses n. (Owner amendment, 2026-10-12.)

Verdict bands: **Buy ≥ 75 · Wait 50–74 · Skip < 50.**

**Effective weights:** the marketplace rating sets the baseline, about 60–70% of the outcome. Written evidence can move the score down by up to 30 points (more through caps) and up by at most 10. Rating volume N affects only the shrinkage and confidence. It never raises the score on its own.

## 6. Confidence
  Confidence = min(MarketConf, EvidenceConf), then downgrades

- **MarketConf:** N ≥ 1,000 is High · 100–999 is Medium · < 100 is Low
- **EvidenceConf** (uses n_eff, the classifiable reviews): n_eff = 0 is Low · n_eff = 1–2 is Low · n_eff = 3–9 is Medium · n_eff ≥ 10, or ≥ 3 classifiable written reviews from a second store, is High
- If n ≥ 1 but n_eff = 0, it is still a full Buying Score, confidence Low, and the reason says so honestly, e.g. "Low · 3 written reviews read, none detailed enough to analyze".
- **Downgrade one level** (not below Low) for each of: DiscrepancyFlag, or variant not fully resolved.
- Display it as a label plus the reason, e.g. "Medium · 8 written reviews read · 4.5★ from 2,143 ratings".

## 7. Output modes
| Data available | Output |
|---|---|
| n ≥ 1 and rating exists | **Buying Score** (S, verdict, confidence, quotes, strengths and complaints from real reviews only). If n_eff = 0, confidence is Low with the reason "N written reviews read, none detailed enough to analyze". |
| n = 0, rating exists | **Provisional Marketplace Score** = B rounded, capped at 74 when N < 50 ("Few ratings so far"). Labelled "Provisional · based on marketplace rating only · 0 written reviews read". Shows "Leaning Buy / Leaning Wait / Leaning Skip", never a plain verdict. No strengths, complaints or quotes. Confidence is always Low. Main button: "Paste the exact product link for a full Buying Score" (retries on that exact listing). |
| n ≥ 1, no rating | Buying Score from written evidence only: S = clamp(50 + 40·s̄·w − Neg, 0, 100) with w from n_eff, same caps, confidence Low. |
| n = 0, no rating | No score (the only case). Ask for the exact product link or a review screenshot. |

## 8. Worked examples
**1. High rating, but the visible reviews show repeated failures.** 4.8★ from 10,000 · 8 written reviews · 2 report "stopped working after a month" · visible mean 3.4★ · s̄ = 0.1
- R* = (48,000 + 2,000) / 10,500 = 4.762, so B = 94.0
- w = 0.444, so Pos = 0.4
- DiscrepancyFlag (4.8 − 3.4 = 1.4), so Neg = (6·2 + 4·1) × 1.5 = 24
- A = −23.6, so S = 70.4. The Rel ≥ 2 cap (74) doesn't bind. Result: **70, Wait**
- Confidence: Market High, Evidence Medium, downgraded for the discrepancy, so **Low**
- Shown: "Repeated reports of the product stopping after about a month (2 of 8 reviews read). The reviews we could read are noticeably worse than the 4.8★ overall rating."

**2. Perfect rating, few ratings.** 5.0★ from 12 · 6 written reviews · all positive, s̄ = 0.6
- R* = (60 + 2,000) / 512 = 4.023, so B = 75.6
- w = 0.375, so Pos = 2.3. Neg = 0, so S = 77.9
- "Too new" cap (N < 50, n < 10) sets it to 74. Result: **74, Wait**
- Confidence: Market Low, Evidence Medium, so **Low**
- Shown: "Early reviews are positive, but there are only 12 ratings so far."

**3. Popular, solid product.** 4.4★ from 20,000 · 9 written reviews · s̄ = 0.3 · 1 minor complaint (cord length)
- R* = (88,000 + 2,000) / 20,500 = 4.390, so B = 84.8
- w = 0.474, so Pos = 1.4. Neg = 3, so A = −1.6, S = 83.2. Result: **83, Buy**
- Confidence: Market High, Evidence Medium, so **Medium** ("9 written reviews read · 4.4★ from 20,000 ratings")

**4. Middling rating, mixed reviews.** 3.9★ from 50,000 · 8 written reviews · s̄ = 0.0 · 2 reviews mention the same minor issue (noisy)
- R* = (195,000 + 2,000) / 50,500 = 3.901, so B = 72.5
- Pos = 0. Neg = 4·1 (theme) + 3·2 (minor) = 10, so S = 62.5. Result: **63, Wait**
- Confidence: **Medium**
- Shown: "Buyers are split. The most common complaint is noise (2 of 8 reviews read)."

**5. Single safety report.** 4.6★ from 3,000 · 10 written reviews · s̄ = 0.4 · 1 reports "charger overheated and melted"
- R* = (13,800 + 2,000) / 3,500 = 4.514, so B = 87.9
- w = 0.5, so Pos = 2.0. Neg = 10, so S = 79.9
- Saf = 1 cap sets it to 74. Result: **74, Wait**
- Confidence: Market High, Evidence High, so **High**
- Shown: "One customer reported the charger overheating (single unverified report)." With 2+ independent reports (after cross-store deduplication), the cap would be 54. A verified recall would cap it at 30 (Skip).
- Recall wording rule: ReviewIntel may say "No official recall found" ONLY if, during that scan, it actually queried an authoritative recall source (e.g. Health Canada Recalls, CPSC) for the exact model, and that query succeeded. Otherwise it says nothing about recalls. An authoritative recall lookup is optional for v2. If it isn't built, the recall cap simply never fires and no recall statement is shown.

**6. Zero written reviews.** 4.5★ from 2,143 · 0 written reviews
- R* = (9,643.5 + 2,000) / 2,643 = 4.405, so B = 85.1
- Output: **Provisional Marketplace Score 85 · Leaning Buy · Low confidence**
- Shown: "Based on the marketplace rating only. We couldn't read any written reviews yet. Paste the exact product link for a full Buying Score."

## 9. Retrieval (kept simple)
- Real public written reviews from the exact listing, plus the rating, count and star histogram from the product page.
- Strict exact-model and variant matching on every input, so the AF100C/AF101C problem can't recur.
- Add second-store written reviews (Walmart first, then Best Buy) when the exact model matches.
- No more effort on scraping hundreds of reviews. Longer term, get the rating data from Amazon's official Product Advertising API once Associates eligibility allows.

## 10. Validation plan (before and after launch)
- Unit tests for every worked example and edge case: N = 0, n = 0, histogram missing, duplicate reviews within one store and across stores (the same syndicated review at two retailers counts once), a variant mismatch being dropped, and no recall statement unless an authoritative source was queried.
- Every scan logs: N, R̄, R*, n, s̄, Rel, Saf, Min, T, DiscrepancyFlag, caps applied, S, confidence and the OpenAI count (= 0).
- After about 90 days of clean data, review C, m, the weights and the bands per category. No calibration from pre-v2 scan history.

## 11. Known limits (stated plainly)
- The visible Amazon reviews are a biased sample. We use them for themes and failures, not as a precise measure of satisfaction.
- The star average reflects Amazon's own weighting and possible incentivized reviews. That's mitigated by shrinkage and by this rule: Written reviews can lower the score much more than they can raise it. (Up to −30 plus caps, versus at most +10.)
- Rule-based sentiment misses sarcasm and nuance. Quotes are always shown so shoppers can judge for themselves.
- Starting parameters are judgement calls until clean data allows calibration.
