# FINDINGS-REPORT — RI Native Findings Engine

**Branch:** `dylan/ri-findings` (from `dylan/ri-strip-frames` @ `b5da0d89`)
**Date:** 2026-10-17 ~04:00 ADT
**Status:** LOCAL PROOF ONLY — nothing deploys without Junel's satisfaction.

## What was built

`lib/themeFindings.ts` — RI's deterministic, zero-external-AI findings engine. Per theme, it:
1. Splits reviews into clauses (sentences + comma-clauses), keeps only COMPLETE clauses (subject + verb).
2. Clusters near-duplicate clauses (buyers saying the same specific count together).
3. Renders ONE bullet: RI's own sentence frame + winning specific + tally.
4. Honesty gates: numerals trace to evidence, specifics require ≥2 reviews, banned frames rejected, grammatical well-formedness.

Wired into `composeSignal` in `lib/reviewAnalysis.ts`. Wordsmith stays dead. Scoring/verdict untouched. `lib/socialReelGenerator.ts` untouched.

## Proof corpora

**Regression (hand-fed library):**
- (a) Apple AirPods 4 Wireless Earbuds — 80 owner-fed amazon.ca reviews (62 usable), aggregate 4.4/2,341. Score: 73 WAIT.
- (b) DREO Space Heater 1500W — 50 owner-fed amazon.ca reviews (44 usable), aggregate 4.5/28,820. Score: 54 WAIT.

**Fresh (never used before, different categories):**
- (c) Fullstar Vegetable Chopper PRO 4-in-1 (kitchen) — 35 verbatim buyer-review excerpts harvested from the public search index (amazon.ca/.com/.co.uk/.au product-page snippets + reseller quotes). Amazon review pages are bot-walled for this VM's curl (verified on amazon.ca AND amazon.com). Aggregate 4.4/118,335 from amazon.ca listing. Score: 79 BUY.
- (d) CeraVe Moisturizing Cream 19 oz (beauty) — 30 verbatim excerpts (amazon.com, target.com, cvs.com, desertcart.tn quoting Amazon). Aggregate 4.7/137,653 from amazon.com. Score: 92 BUY.

## Rendered proof blocks (VERBATIM)

### (a) Apple AirPods 4 Wireless Earbuds — 73/100 WAIT — 62 reviews

WHY YOU'D BUY IT
• Clear sound quality — Buyers praise it — mentioned in 19 of 62 reviews.
• Strong battery life — Buyers praise it — up to 30 hours, mentioned in 8 of 62 reviews.
• Pairing and connectivity — Buyers praise it — mentioned in 8 of 62 reviews.

WHY YOU MIGHT NOT
• Fit problems — Buyers flag it — mentioned in 6 of 62 reviews.
• Fit isn't secure for everyone — Buyers flag it — mentioned in 2 of 62 reviews.

### (b) DREO Space Heater 1500W — 54/100 WAIT — 44 reviews

WHY YOU'D BUY IT
• Temperature control — Buyers praise it — thermostat works perfectly, mentioned in 25 of 44 reviews.
• Heats quickly — Buyers praise it — 1500W, mentioned in 25 of 44 reviews.
• Quiet operation — Buyers praise it — mentioned in 10 of 44 reviews.

WHY YOU MIGHT NOT
(No qualifying findings.)

### (c) Fullstar Vegetable Chopper PRO 4-in-1 — 79/100 BUY — 35 reviews

WHY YOU'D BUY IT
• Easy to use — Buyers praise it — mentioned in 7 of 35 reviews.
• Chops fast — Buyers praise it — mentioned in 6 of 35 reviews.
• Sharp blades — Buyers praise it — mentioned in 6 of 35 reviews.

WHY YOU MIGHT NOT
• Hard to clean — Buyers flag it — mentioned in 4 of 35 reviews.
• Blades too sharp — finger cuts — Buyers flag it — mentioned in 3 of 35 reviews.
• Durability issues — Buyers flag it — mentioned in 2 of 35 reviews.

### (d) CeraVe Moisturizing Cream 19 oz — 92/100 BUY — 29 reviews

WHY YOU'D BUY IT
• Deep hydration — Buyers praise it — mentioned in 10 of 29 reviews.
• Good for eczema and sensitive skin — Buyers praise it — mentioned in 6 of 29 reviews.
• Absorbs without grease — Buyers praise it — mentioned in 4 of 29 reviews.

WHY YOU MIGHT NOT
• Breakouts and irritation — Buyers flag it — mentioned in 5 of 29 reviews.
• No safety seal — Buyers flag it — mentioned in 2 of 29 reviews.

## Screenshots

Full-page renders in `proof/`:
- [airpods4.png](sandbox://workspace/ri-findings/proof/airpods4.png) / [airpods4.html](sandbox://workspace/ri-findings/proof/airpods4.html)
- [dreo1500w.png](sandbox://workspace/ri-findings/proof/dreo1500w.png) / [dreo1500w.html](sandbox://workspace/ri-findings/proof/dreo1500w.html)
- [fullstar.png](sandbox://workspace/ri-findings/proof/fullstar.png) / [fullstar.html](sandbox://workspace/ri-findings/proof/fullstar.html)
- [cerave.png](sandbox://workspace/ri-findings/proof/cerave.png) / [cerave.html](sandbox://workspace/ri-findings/proof/cerave.html)

## Honest self-grade vs the Takki standard

**The Takki bar:** Every bullet carries a CONCRETE specific ("around 2.2-2.3 lbs", "separate MC4 cable purchase", "~5 hours").

**What works:**
- "up to 30 hours" (battery) — real measurement, repeated, traced. PASS.
- "1500W" (heats quickly) — real spec, repeated. PASS.
- "thermostat works perfectly" (temperature control) — real repeated phrase. PASS.
- All bullets are grammatical, honest tallies, no banned frames, no polarity flips, no untraceable numerals. No bullet is vague, fragmentary, or false.

**The gap (honest):**
- 16 of 19 bullets are fallback gloss+tally ("mentioned in X of Y") with no concrete specific. They are HONEST (the tally is real, the theme is real), but they do NOT meet the Takki standard of "concrete specifics in every bullet."
- Root cause: buyers describe themes with diverse vocabulary ("crisp highs" / "deep bass" / "vocals sound crisp" for sound quality). Deterministic extraction finds specifics only when the SAME wording repeats across ≥2 reviews. Measurements ("30 hours") and product specs ("1500W") repeat; descriptive praise often doesn't.
- I attempted two Tier-2 approaches (anchor-proximity mining, word-clustering) to capture non-repeating descriptive specifics. Both produced worse-than-fallback outputs ("headset mode altogether", "feel kind") and were disabled. The fallback is honest; a bad specific is not.

**Verdict:** The engine is CORRECT and HONEST, but NOT YET Takki-perfect. It delivers Takki-grade bullets when review language repeats (3 of 19 here). For diverse phrasing, it falls back to honest tallies rather than inventing specifics.

**Recommended next step (for Junel's call):** Ship this honest version, OR invest in a "representative illustration" mode (Tier-2 done right: pick the most central clause's best descriptive phrase, clearly marked as illustrative, not repeated). The latter risks Junel's "no invented specifics" trust rule if done poorly.

## Gates

- `tests/themeFindings.test.mjs`: 11/11 pass.
- Targeted suites (themeFindings, frameStrip, decisionBrief, verdictGuard, wordsmithDormant, wordsmith, wordsmithHotfix): 65/65 pass.
- Full `npm test`: 978 tests, 957 pass, 20 fail — the 20 are the known pre-existing failures (unchanged from baseline).
- `tsc --noEmit`: CLEAN.
- `npm run build`: GREEN.
- `lib/socialReelGenerator.ts`: untouched (md5 `c7195ca300fd7e8dbb25973cf111fa33`).
- Scoring/verdict: untouched.
- `components/HeroProofCard.tsx`: refreshed to findings format (layout kept).

## Files changed

- `lib/themeFindings.ts` (new engine)
- `lib/reviewAnalysis.ts` (seam at composeSignal)
- `components/HeroProofCard.tsx` (findings format)
- `tests/themeFindings.test.mjs` (11 tests)
- `scripts/proof-render.mjs`, `scripts/proof-corpus.mjs` (proof-only)
- `proof-corpus/fresh-fullstar.md`, `proof-corpus/fresh-cerave.md` (fresh corpora)
- `proof/*.html`, `proof/*.png`, `proof/*.txt` (renders)
