# Turnover: review collection and the result page

This file is the handover for the next session. It is the state on 2026-10-14. Read it before changing the scraper or the result page. Do not merge. Do not deploy. The Owner has not said yes.

## Owner's rules

These apply to every change, including a "small" follow-up.

- Zero OpenAI. Collection and the Buying Score do not call it. `openAiCalls` on these scans stays 0.
- No CAPTCHA solving. No sign-in bypass. A challenge page is a failed attempt, not a puzzle to beat.
- No paid proxies. The Owner refused. Do not add Bright Data, Oxylabs, IPRoyal, ScraperAPI, ScrapingBee, or any other paid egress. A proxy env var already exists (`REVIEWINTEL_HTTP_PROXY` / `HTTPS_PROXY`). Production has none. Leave it that way.
- Never show a shopper how many reviews were read. The public rating count on the store page is allowed. A sentence like "12 reviews read" is not.
- Rules are general. Do not special-case one ASIN, one product name, or one store listing.
- Shoppers never see "Vercel", a host name, `evidenceState`, `NOT_ENOUGH`, "Not scored", "Review evidence not enough", or "OpenAI review analysis failed". Internal logs may keep those words.
- Rollback is only a temporary measure. Production is on an old deploy because the newer one made scans worse. The job is still to collect real reviews, not to stay rolled back.
- No deploy and no merge without the Owner's yes. A green test run is not that yes.

## Today's timeline (2026-10-14)

Times below are the times recorded with each event. They are not a reconstructed timezone.

1. **PR #14** merged at 13:42 UTC as `687b041` ("Show live v2 scans and keep zero-review scores as a leaning"). https://github.com/silverangel2/review-insight-ai/pull/14
   Before the layered headers, link scans from this deployment could read reviews. AirPods `B0D1XD1ZV3` read 10 reviews at 09:31. Across that earlier window, 5 of 8 link scans read 7–12 reviews each.

2. **PR #15** merged at 19:09 UTC as `646d8f6` ("Collect real reviews across Amazon, Walmart, Best Buy, Target, and Home Depot"). https://github.com/silverangel2/review-insight-ai/pull/15
   It was deployed. It routed every store fetch through a layered ladder with browser-imitation headers. AirPods `B0D1XD1ZV3` then read 0 reviews at 16:15 (`native-page dp status 200 rawReviews 0`, then `layered-collection blocked:true`). The live check after that deploy was 7 of 7 link scans, HTTP 200, `x-reviewintel-openai-calls: 0`, under 60 seconds, and 0 real reviews.

   | Store | Link | What the shopper saw | Ladder |
   | --- | --- | --- | --- |
   | amazon.com | `/dp/B00002X2GQ` | Stanley 33-425, provisional score, no written reviews | attempts 3, blocked |
   | amazon.com | `/dp/B0D1XD1ZV3` | AirPods Pro 2, provisional score, no written reviews | blocked after the first profiles |
   | amazon.ca | `/dp/B00002X2GQ` | same Stanley, provisional score | blocked |
   | walmart.com | `/ip/...FMHT74038.../147784490` | "Unknown product" | ladder never ran |
   | bestbuy.com | `/site/.../6447382.p` | "Unknown product" | ladder never ran |
   | target.com | `/p/.../A-1000747659` | "Unknown product" | ladder never ran |
   | homedepot.com | `/p/...FMHT33338L/204624581` | wrong Amazon battery | ladder never ran; search was `site:amazon.ca "unknown product"` |

   `B00002X2GQ` is the Stanley 33-425 Chrome, not FatMax. That was a bad test input. Production was rolled back after this.

3. **PR #16** merged at 20:57 UTC as `e3eeffa` ("Fix live link scans that returned the wrong product or no reviews"). https://github.com/silverangel2/review-insight-ai/pull/16
   On main. Not what production is running.

4. **PR #17** merged at 21:07 UTC as `c079607` ("Read visible product-page reviews in the shopper's browser"). https://github.com/silverangel2/review-insight-ai/pull/17
   This is `origin/main`. Not what production is running.

5. **PR #18** is an open draft, not merged: https://github.com/silverangel2/review-insight-ai/pull/18 on `cursor/plain-first-fetch-1af3`. Its preview deployment went Ready. `vercel curl` was not authenticated here (the CLI started a device login and never returned). The AirPods link was not scanned on that preview. Reviews read: not measured. Do not retry the device login.

## Current production state

Live production is the rollback target:

- Deployment: `dpl_CmUN4s7qSkheBdjH6y2HBtEjafBV`
- Code: PR #14, commit `687b041`

That rollback is temporary. It is not a fix. A live AirPods scan on that same PR #14 deployment also read 0 reviews at 18:52. Putting the old headers back is necessary and it is not sufficient. Do not tell the Owner that Amazon reads work because the headers match `687b041`.

## Root cause

Two separate facts. Both are true.

1. **PR #15 headers caused Amazon bot checks.** `fetchText` sent every store URL through `runLayeredStoreFetch`. Those requests added `sec-ch-ua*`, `sec-fetch-*`, `accept-encoding: br`, a cookie jar, and new user agents from `lib/browserProfiles.ts`. Amazon answered HTTP 200 with a bot-check page. The ladder then marked the whole host blocked after the first challenge, so later product-page attempts never ran. That is why AirPods went from 10 reviews at 09:31 to 0 at 16:15, and why the post-deploy check was 0 of 7.

2. **The rolled-back deploy also read nothing later the same day.** The live AirPods scan on PR #14 (`dpl_CmUN4s7qSkheBdjH6y2HBtEjafBV`) read 0 reviews at 18:52. The old request is not a proven live read from this deployment anymore.

Walmart, Best Buy, Target, and Home Depot are a third problem. A preview found that those four stores challenge requests from this deployment or disallow the review URL in robots.txt. Paid proxies are refused, so they were not given another IP.

## What is in main but not live

`origin/main` is `c079607`. Production is `687b041`. Main contains three merges that the live deployment is not running:

- **#15** (`646d8f6`) — the layered ladder. This is the change that was deployed and rolled back. It is still in the git history of main.
- **#16** (`e3eeffa`) — link identity and shopper-safe results. Placeholder names (`unknown`, `unknown product`, `product`, `item`) are not search queries. When the page fetch fails, the name and id come from the link (Walmart `/ip/<slug>/<id>`, Home Depot `/p/<slug>/<id>`, Target `/-/A-<tcin>` including a 10-digit TCIN, Best Buy `/site/<slug>/<sku>.p`, Amazon `/dp/<asin>` plus a slug). A cross-store match requires the title to contain the model or id tokens. Shopper strings no longer say "Not scored" or "Review evidence not enough". A blocked but identified listing does not ask the shopper to add the link again. Shoppers do not see "Vercel".
- **#17** (`c079607`) — shopper page-capture. The page-capture API, the extension, and the bookmarklet let the shopper's own browser send the product page they can already see. This does not scrape past a challenge from the server.

## What is on the #18 branch

Draft PR only. Branch `cursor/plain-first-fetch-1af3`, based on main `c079607`. Not merged. Not deployed over production.

Collection changes already on the branch before the result-page work:

- For every store, the first attempt is `fetchTextOnce` with the `687b041` user agent and `BROWSER_HEADERS`, as a plain object, not wrapped in `Headers`. The ladder runs only when that response has no written reviews.
- Ladder profiles do not send `sec-ch-ua*`, `sec-fetch-*`, or an explicit `accept-encoding`.
- One challenge or 401/403/429/503 does not skip the rest of the product-page attempts. Review endpoints and sibling domains still run. A review path that already returned a challenge is not fetched again.
- #16 and #17 behavior is kept: link identity, placeholder guard, shopper-safe text, no "Vercel" in shopper text, page-capture API, extension, bookmarklet.
- `tests/layeredReviewCollection.test.mjs` asserts the first Amazon `/dp/` request headers equal the `687b041` headers.

Result-page changes added after that, still on this branch:

A scan that read no written reviews was showing Low confidence, "LEANING BUY – mixed signals", and empty boxes ("No clear strengths found", "No repeated praise") even when the store showed a strong public rating. AirPods Pro 2 was the live example: 4.6 stars from 46,944 ratings. The rules are general. They are not an AirPods exception.

- The Bayesian score is unchanged (`C = 4.0`, `m = 500`, Buy at 75, Wait at 50). The too-new cap (`N < 50` caps the raw score at 74) still applies.
- Clear Buy: rating at least 4.5 and at least 5,000 ratings. Floor is about B 86, more than 10 points above 75, and the prior is under 10% of the weight. Shoppers see **BUY** with **Medium** confidence. Written text was not read, so this is never High. This is the only zero-review case that is a firm BUY. It is never AVOID.
- Supported: rating at least 4.3 and at least 1,000 ratings, when the Bayesian score is a Buy. Shoppers see **Leaning Buy** with **Medium** confidence. The prior is still about a third of the weight, so this is not a firm BUY.
- Below either gate, a Bayesian Buy is shown as Wait. Examples: 4.2 from 20,000 and 4.0 from 1,000. Confidence is Medium when the count is at least 1,000, otherwise Low. A strong rating is never labeled Low.
- Saved scans that stored Low are recomputed at render time by `provisionalShopperFacing`. The page does not trust the stored Low.
- One sentence replaces the empty boxes and the failure line: `Based on 46,944 Amazon ratings averaging 4.6★`. The store name is Amazon, Walmart, Best Buy, Target, Home Depot, or "marketplace".
- Strengths, complaints, praise, Top Strengths, Top Complaints, Best For, and Not Ideal are omitted when no written reviews were read. Empty-state sentences are not rendered.
- "There are mixed signals" is used only when written evidence conflicts (`discrepancyFlag`, or written reviews that contain both a strength and a complaint). Zero written reviews is not a conflict.
- The shopper phrase "could not access enough public review evidence" is replaced with "Written reviews were not available for a verdict." Old stored copies of that phrase are mapped to the same sentence.

## Open problems

- Amazon from this deployment is unproven. The old headers failed live at 18:52 on PR #14. The new headers failed live after PR #15. PR #18 restores the old first request and still has no live screenshot of review quotes.
- The #18 preview was Ready and was not scanned. `vercel curl` had no token. Do not start another device login from the agent.
- Walmart, Best Buy, Target, and Home Depot challenge this deployment or block the review URL in robots.txt. Paid proxies are refused. Chromium (`REVIEWINTEL_LAYERED_CHROMIUM`) is off. The packages are not installed. Turning Chromium on is not a CAPTCHA bypass and it is likely to exceed the serverless function size.
- #16 and #17 are on main and are not live. They do not, by themselves, make Amazon return review text.
- The result-page bands are on the #18 branch only. Production still shows the old Low / Leaning Buy / mixed-signals page for a strong rating with no written reviews.
- There is no live screenshot of real review quotes. That is the proof bar below. A log line is not it.

## Exact next steps

Do these in order. Stop when a step is not allowed.

1. Stay on draft PR #18. Do not open a second PR for this work. Do not merge. Do not deploy. Rollback stays in place until the Owner says otherwise. Rollback is temporary, not the destination.
2. Do not add a proxy, a CAPTCHA solver, a sign-in flow, or an OpenAI call. Do not tune a threshold to one product.
3. The collection change on this branch is the right first request (plain `687b041` headers, then the ladder, and one challenge does not cancel the host). It is not proof. PR #14 already used those headers and read 0 AirPods reviews at 18:52.
4. **Proof bar.** The work is not finished until there is a live screenshot of a link-only scan whose result shows real review quotes: the actual words a shopper wrote, visible on the page. A `reviewsCollected` number in a log is not the bar. A rating sentence with no quotes is not the bar. Do not show the shopper how many reviews were read. Do not deploy to get that screenshot unless the Owner says yes. A preview the Owner approves is the place to take it. The AirPods link used in the failed checks is `https://www.amazon.com/dp/B0D1XD1ZV3`. One product is not enough for a general claim. After that screenshot exists, repeat with one product each on Walmart, Best Buy, Target, and Home Depot, still with no paid proxy.
5. If the preview returns a challenge page, record the status and stop that attempt. Do not solve it. Tell the Owner the screenshot does not exist yet.
6. Page capture (#17) is the shopper-browser path for a page the shopper can already see. It is on main, not live. It is not a server-side bypass. Mention it to the Owner as an option. Do not ship it without a yes.
7. When a live scan does return written reviews, the result page should show those quotes in the strength and complaint sections. The provisional BUY / Leaning Buy bands apply only when the written count is 0.

## Where the code is

- First fetch and ladder: `lib/nativeReviewRetrieval.ts` (`fetchText`, `plainPageHasWrittenReviews`), `lib/politeFetch.ts` (`requestInitForFetch` leaves the plain header object alone), `lib/browserProfiles.ts`, `lib/layeredReviewCollection.ts`.
- Buying Score bands: `lib/buyingScore.ts` (`provisionalShopperFacing`, `marketplaceRatingSentence`, `customerFacingDecision`, `shopperBottomLineForBuyingScore`).
- Result page: `components/ResultsClient.tsx`, `components/BuyingScoreV2Card.tsx`, `components/ShopperAnswerCard.tsx`, `lib/shopperAnswer.ts`, `lib/shopperResultVisibility.ts`.
- A cached firm BUY with zero written reviews is still flagged, except a clear provisional Buy (`isClearProvisionalBuy`). The results page does not hide v2 results.
- Header regression: `tests/layeredReviewCollection.test.mjs`. Band and render coverage: `tests/buyingScoreV2.test.mjs`, `tests/liveScanV2Results.test.mjs`.

## How to test

Fake env only. Do not point tests or the build at the production database.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
OPENAI_API_KEY= \
npm test
npx tsc --noEmit
npm run build
```

On this branch that suite is 636 tests, 616 pass, 19 fail, 1 skipped. `tsc` and `next build` pass. The 19 failures are the known set. Do not "fix" them:

- email sending retries temporary failures
- general ReviewIntel architecture development, holdout, and reserve (missing `.reviewintel-captures/scan_*.json`, including `route-envelope-*` and `holdout-capture-0` through `holdout-capture-6`)
- after the collection deadline, new fetches fail immediately (early stop)
- Facebook Reel publisher `video_reels` in `tests/socialAutoPost`

Node on this VM is 22. `engines` says 24. The `EBADENGINE` warning is expected. Tests still run.
