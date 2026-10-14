# Handoff: layered review collection

## Goal

Link-only scans should collect real written reviews for arbitrary products on Amazon, Walmart, Best Buy, Target, and Home Depot. The screenshot fallback should be rare. The live failure this is aimed at: an Amazon.com link returns HTTP 200 with a stripped shell (about 250KB, no `#productTitle`, no review blocks) on both `/dp` and the reviews page, while a normal browser shows the reviews.

Collection is general. There are no product-specific hacks. The first request for every store is the pre-layered polite fetch. The ladder runs only when that response has no written reviews. One challenge does not skip the rest of the product-page attempts. There is no CAPTCHA solving, no sign-in, and no OpenAI in this path. Only real review text is kept. The same review text or review id is kept once across storefronts. Unreadable text does not raise confidence. Shoppers are not shown review counts. The shopper payload must not say "Not scored" or "Review evidence not enough". All of this stays inside `lib/scanDeadline.ts` (default 50s collection budget, 8s per request).

## Live test of the first multi-store deploy (2026-10-14)

PR #15 merged as `646d8f6` and was rolled back. Production is PR #14 (`687b041`). Seven link-only scans, all HTTP 200, `x-reviewintel-openai-calls: 0`, all under 60s. Zero real reviews. The Home Depot scan showed a different product, which is why it was rolled back.

| Store | Link | What the shopper saw | Ladder |
| --- | --- | --- | --- |
| amazon.com | `/dp/B00002X2GQ` | Stanley 33-425, provisional score, no written reviews | `{tier:null, strippedPage:false, attempts:3, blocked:true}` |
| amazon.com | `/dp/B0D1XD1ZV3` | AirPods Pro 2, provisional score, no written reviews | blocked after the first profiles |
| amazon.ca | `/dp/B00002X2GQ` | same Stanley, provisional score | blocked |
| walmart.com | `/ip/...FMHT74038.../147784490` | "Unknown product" | ladder never ran |
| bestbuy.com | `/site/.../6447382.p` | "Unknown product" | ladder never ran |
| target.com | `/p/.../A-1000747659` | "Unknown product" | ladder never ran |
| homedepot.com | `/p/...FMHT33338L/204624581` | wrong Amazon battery titled "Unknown Product" | ladder never ran; search was `site:amazon.ca "unknown product"` |

`B00002X2GQ` is the Stanley 33-425 Chrome, not FatMax. That was a test-input error. Bing and DuckDuckGo returned "search page unavailable" on every scan. The API still contained `suspiciousReviewRisk: "Not scored"` and the label "Review evidence not enough".

## Fix in this branch

- Placeholder names (`unknown`, `unknown product`, `product`, `item`) are not search queries and are not match terms.
- When the store page cannot be read, the product id and name come from the link: Walmart `/ip/<slug>/<id>`, Home Depot `/p/<slug>/<id>`, Target `/p/<slug>/-/A-<tcin>`, Best Buy `/site/<slug>/<sku>.p`, Amazon `/dp/<asin>` plus its slug. That identity is what starts collection.
- The first request for every store is `fetchTextOnce` with the user agent and `BROWSER_HEADERS` from `687b041`. The layered ladder runs only when that response has no written reviews.
- Ladder profiles do not send `sec-ch-ua*`, `sec-fetch-*`, or an explicit `accept-encoding`.
- One challenge or 401/403/429/503 does not skip the rest of the product-page attempts on that host. Review endpoints and sibling domains are still requested. A review path that already returned a challenge is not fetched again for another query, another page number, or a later sibling listing. The log field `tierAttempts` records each tier and why it stopped (`blocked-challenge`, `blocked-http-403`, `reviews`, `stripped`, `stopped-budget`, and the others).
- A candidate on another listing is accepted only when its title contains the model or id tokens from the link, or it is the same store product id. Otherwise the shopper gets the couldn't-read result and the scan does not charge a credit.
- Shopper-facing authenticity text no longer uses "Not scored" or "Review evidence not enough".

Before `646d8f6`, the same Amazon link read reviews from this deployment (AirPods `B0D1XD1ZV3` read 10 reviews, then 0 after the layered headers). The bot-check page was the new header set, not only the address. The first request is that older request again. The Owner still refuses paid proxies. See Open risks.

## What's done

Shared interface in `lib/storeCollectors.ts`, engine in `lib/layeredReviewCollection.ts`, profiles and cookie jar in `lib/browserProfiles.ts`. `runNativeReviewRetrieval` tries the pre-layered fetch first for product URLs on those five stores, then the engine when that page has no written reviews. Other fetches are unchanged.

The first request sends only the old user agent plus `accept`, `accept-language`, and `upgrade-insecure-requests` from `BROWSER_HEADERS`. Ladder profiles send a user agent, `accept`, `Accept-Language` matched to the host, and `cache-control`. They do not send `sec-ch-ua*`, `sec-fetch-*`, or `accept-encoding`. The polite fetcher still decompresses gzip, deflate, and brotli when a caller set `accept-encoding` and the runtime left the body compressed. A per-scan cookie jar stores `Set-Cookie` and sends it on later ladder requests. The response cache key includes the profile id, so a stripped page is not reused as the answer for a different profile. The internal `x-ri-profile` header is removed before the request is sent. The first request is not rewritten into a `Headers` object.

Stripped page: HTTP 200, not a challenge, no product-title marker, no review marker, and body length between 400 bytes and 2MB. That covers both a small lite shell and the fat ~250KB shell. A page with a title or with review markers is not stripped, and the ladder stops so existing pagination tests stay one request per URL.

Ladder order, stopping at the first page that contains review markers:

1. `primary-profile` — Chrome on Windows, requested URL
2. `alternate-profile` — Chrome on Mac, same URL
3. `alternate-url` — store-specific product URL forms
4. `mobile-url` — mobile page or the product URL with the Android profile
5. `reviews-endpoint` — public review HTML or JSON that does not need a signed-in session
6. `sibling-domain` — same product id on a sibling storefront, where that id is actually shared
7. `chromium` — optional, only after the HTTP ladder found no reviews and did not see a healthy page

A challenge (`isBlockedOrSignInReviewPage`, including CAPTCHA and sign-in URLs) or HTTP 401/403/429/503 stops that attempt only. It does not solve the challenge and it does not sign in. Later product-page profiles, `reviews-endpoint`, and `sibling-domain` still run until the collection budget or the 12-attempt cap. Chromium stays off, and it is not launched when the only answers were blocks. Page 2+ only tries the two desktop profiles, so pagination does not fan out. A page that already has written reviews does not enter the ladder. `tierAttempts` is included on `result.layeredCollection` and on the `[ReviewIntel PIPELINE] layered-collection` line.

Amazon forms: `/dp/ASIN`, `/gp/product/ASIN`, `/dp/ASIN?th=1&psc=1`, `/gp/aw/d/ASIN`, `/product-reviews/ASIN?reviewerType=all_reviews&sortBy=recent`, and the public `GET /hz/reviews-render/ajax/reviews/get/` fragment endpoint. Siblings: `.com`, `.ca`, `.co.uk`. Same-host ajax and mobile URLs count as the same ASIN (`amazonStableId`), so their reviews are accepted without a second title check. A sibling host still has to pass the existing title check.

Walmart: `/ip/{id}`, `/reviews/product/{id}`, mobile profile, and the other of `.com` / `.ca`. Item ids are not guaranteed to be the same product across countries; identity verification still applies.

Best Buy: product page, reviews page, and the public reviews JSON the site loads (`bestbuy.com/ugc/v2/reviews` or `bestbuy.ca/api/reviews/v2/...`). No sibling domain. SKUs are not shared between `.com` and `.ca`.

Target: canonical `/p/-/A-{tcin}`, mobile profile, and the public reviews summary on `r2d2.target.com` using the storefront key already shipped in Target's web client (`TARGET_PUBLIC_STOREFRONT_KEY`). That key is not an account secret.

Home Depot: product page, `/p/reviews/...`, mobile profile, and a Bazaarvoice reviews URL only when the fetched HTML itself contains a public `passkey`. No hardcoded passkey.

JSON review payloads are renamed into `{ reviews: [{ reviewBody, rating, title, date }] }` and then run through the existing extractor. Review text is copied, not written. Generic `"text"` fields count only when the object also has a date or review id, so product blurbs are not promoted.

Cross-listing dedup in native retrieval drops a repeated review id or the same normalized body.

Per scan, `result.layeredCollection` and one log line `[ReviewIntel PIPELINE] layered-collection` record:

- `tier` — the tier that first produced review markers, or null
- `profileId`
- `strippedPage` — true if any attempt was a stripped shell
- `attempts`
- `stores`
- `blocked`
- `chromium` — `not-used`, `skipped-budget`, `skipped-disabled`, `skipped-blocked`, `unavailable`, `used`, `blocked`, or `empty`
- `tierAttempts` — each tier that was considered, with `stop` set to why it ended (`reviews`, `stripped`, `blocked-challenge`, `blocked-http-403`, `blocked-http-503`, `skipped-host-blocked`, `stopped-budget`, and the others)

`scanCollectionRemainingMs()` exposes the active collection deadline. The ladder will not start an HTTP attempt with under 1.5s left, or Chromium with under 15s left. Default cap is 12 HTTP attempts per product URL.

### Chromium

Implemented in `lib/layeredChromium.ts` as a dynamic import of `playwright-core` and `@sparticuz/chromium`. It is off unless `REVIEWINTEL_LAYERED_CHROMIUM=on`. The packages are not installed. `@sparticuz/chromium` is about 50MB compressed, and `/api/analyze` already traces tesseract into the same function, so adding the binary is likely to blow the serverless unzipped function limit. A cold start can also eat the rest of the 50s budget. When the flag is on and the packages are missing, the tier records `unavailable` and the scan continues. Tests inject `chromiumFetch` instead of launching a browser.

## What's left

- Live-prove the ladder against a current stripped Amazon response (see below). The fixtures simulate that shell; they are not a copy of Amazon's HTML.
- If the ajax fragment and the sibling storefronts are also stripped, the remaining step is the Chromium tier. Measure the function size before installing `@sparticuz/chromium` and `playwright-core`, then set the flag only if the unzipped function stays within the serverless size limit and a launch-plus-navigation still fits in the leftover budget.
- Confirm Target's public storefront key still works. If Target rotates it, read the key from the product HTML instead of the constant.
- Confirm Walmart.ca review paths. The plan uses `/reviews/product/{id}` and `/en/ip/{id}`. If Canada uses a different public path, add that form in `walmartCollector.plan`.
- Home Depot reviews that are not in the HTML and not accompanied by a passkey still need a public endpoint discovered from the page. Do not invent a passkey.
- Best Buy.com `ugc/v2/reviews` may start requiring extra public headers. If it returns a challenge, the ladder already stops that path.
- Wire the same ladder into `collectWrittenReviewsFromListing` only if a caller still uses that path for link-only scans. Link-only evidence collection goes through `runNativeReviewRetrieval`.
- Fallback-rate dashboard: the log line is the measurement. Nothing aggregates it yet.

## How to test

Fake env only. Do not point tests or the build at the production database.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
OPENAI_API_KEY= \
node --test tests/layeredReviewCollection.test.mjs

# then the existing suite, same fake env
npm test
npx tsc --noEmit
npm run build
```

Fixtures live in `tests/fixtures/layered-reviews/`: `stripped.html`, `full.html`, `mobile.html`, `reviews.html`, `captcha.html`.

The new tests cover stripped vs full vs mobile vs reviews vs captcha, a fat 250KB shell, tier order, cookie reuse, Accept-Language, gzip, budget stop, Chromium last and skipped when time is short, captcha does not continue, Amazon ajax after a stripped `/dp` and reviews page, Walmart reviews page, Best Buy and Target JSON, Home Depot passkey discovery, and cross-domain body dedup.

`tests/productPipelineHardening.test.mjs` still expects exactly 7 Amazon.ca page fetches for the pagination fixture. A page that already contains written reviews does not enter the ladder. An HTTP-200 sign-in redirect is not review evidence; the other product-page attempts, the reviews endpoint, and the sibling domains still run, and no reviews are kept.

## Live-test plan

Do not run this from the agent against production shopper traffic. A human or a later session with an explicit live check can:

1. Paste one Amazon.com `/dp` URL that previously returned the stripped shell (the Stanley FatMax case, plus two unrelated ASINs in other categories).
2. Confirm the scan log's `layered-collection` line. Success is `tier` of `reviews-endpoint`, `alternate-profile`, `mobile-url`, or `sibling-domain`, with `strippedPage: true` if the first response was the shell, and `reviewsCollected` greater than 0.
3. Repeat for one Walmart, one Best Buy, one Target, and one Home Depot product URL.
4. Confirm a known captcha or sign-in response logs `blocked: true`. Other product-page attempts on that host still run. The same review path is not fetched again.
5. Confirm `openAiCalls` stays 0 on these scans.
6. After deploy (not part of this change), compare the share of scans with `strippedPage: true` and `tier: null` week over week. That is the fallback rate.

## Preview of this branch

A preview of `a7af8f0` found two more bugs, fixed here. A bare Amazon link such as `https://www.amazon.com/dp/B00FLYWNYQ` (and the same path on amazon.ca) was stored with an empty ASIN and the name "Amazon product", so collection stopped with "Product name was not clear enough to search reviews" and fetched nothing. The ASIN is read again from `/dp/`, `/gp/product/`, and a slug in front of those paths, the listing page fetch runs, and the shopper name comes from that page.

When collection was blocked on a product the link had already identified, the shopper saw REVIEW FIRST and "Add the exact product link". That wording is gone when the link was already supplied. A marketplace rating and count stay on the result when the page actually had them. If nothing on the page was readable, the scan does not use a credit. Shoppers do not see `evidenceState`, `NOT_ENOUGH`, review-analysis failure notes, or the name of the host.

The same preview showed that Walmart, Best Buy, Target, and Home Depot all challenge requests from this deployment or disallow the review URL in robots.txt. The Owner refuses paid proxies, so those stores are not given a different IP in this change. Shopper-facing pages, API messages, result notes, and emails do not name the host.

## Open risks

- Before the layered headers, Amazon link scans from this deployment read 7–12 reviews (5 of 8). After `646d8f6` the same AirPods link (`B0D1XD1ZV3`) went from 10 reviews to 0, with `native-page dp status 200 rawReviews 0` and then `layered-collection blocked:true`. The first request is the older one again. That is not the same as a live proof until a preview scan reads reviews.
- Amazon can still answer with a challenge. The ladder does not solve a CAPTCHA. Chromium is off and is not a way around that.
- The preview also found that Walmart, Best Buy, Target, and Home Depot challenge requests from this deployment or block the review URL in robots.txt. The Owner refuses paid proxies, so this branch does not add one.
- Link-only scans from this deployment are unlikely to read real review text without a paid egress change, and that option is refused. For the record, public 2026 list prices were about $3–$8 per GB for residential proxies, with monthly minimums from about $50 to a few hundred dollars. Datacenter proxies are the class of address these stores already block. Fetch APIs that only change the IP start around $49/month and must not solve CAPTCHAs. Store product APIs do not return the written review text this scanner needs.
- Sibling Amazon domains sometimes list a different variant under the same ASIN. Title verification is unchanged and must keep rejecting those.
- Walmart.com and Walmart.ca item ids are not a reliable pair. A sibling hit still has to match the product title.
- The Target storefront key is public but can be rotated.
- Robots.txt is still enforced. If a store disallows a review URL for `User-agent: *`, that URL is skipped.
- The polite fetcher still stops a host for the rest of the scan after 401/403/429.
- Module-level scan state (`scanCookieJar`, `layeredScan`, the polite fetcher) matches the existing one-scan-at-a-time pattern. Overlapping scans in one process would share that state.
- This change does not deploy and does not merge.

## Multi-store status

| Store | Profiles + cookie jar | Stripped detection | Alternate URLs | Public reviews endpoint | Sibling domain | Native wiring |
| --- | --- | --- | --- | --- | --- | --- |
| Amazon | yes | yes | `/dp`, `/gp/product`, `?th=1&psc=1`, `/gp/aw/d` | reviews HTML + ajax fragment | `.com` `.ca` `.co.uk` | yes |
| Walmart | yes | yes | `/ip/{id}` | `/reviews/product/{id}` | `.com` / `.ca`, id not guaranteed | yes |
| Best Buy | yes | yes | product + reviews page | US `ugc/v2`, CA `api/reviews/v2` | no (SKUs differ) | yes |
| Target | yes | yes | `/p/-/A-{tcin}` | `r2d2` public summary | no | yes |
| Home Depot | yes | yes | product + `/p/reviews` | Bazaarvoice only if the page exposes a passkey | no | yes |
