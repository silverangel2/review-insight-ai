# Handoff: shopper-side review reading

## Status

Servers still cannot be relied on to read written reviews. Amazon, Walmart, Best Buy, Target, and Home Depot block or challenge requests from Vercel's servers, or refuse those URLs in robots.txt. This change does not add a proxy, does not solve a CAPTCHA, and does not sign in to a store.

The shopper's own browser reads the reviews already visible on the product page and submits that text to ReviewIntel. Scoring is the existing Buying Score v2 pipeline. The existing free-scan allowance applies (3 a day on the free plan; paid plans are not capped by that daily claim). There is no OpenAI call on this path.

Not merged. Not deployed. No database migration.

## What shipped

- `extension/` — Chrome and Edge, Manifest V3. Permissions are `activeTab` plus host access only for `amazon.*` (the country sites the shop already supports), `walmart.com` / `walmart.ca`, `bestbuy.com` / `bestbuy.ca`, `target.com`, and `homedepot.com` / `homedepot.ca`.
- `POST /api/page-capture` — signed-in only. Checks size, that the product id matches the URL, drops duplicate reviews, and strips HTML. Then it claims a scan and scores the submitted reviews.
- `/tools/analyze-page` — install steps in plain language, plus an **Analyze this page** bookmark for phones and computers.
- `/tools/page-capture` — receives the page text and opens `/results`.
- The results page shows **Get real reviews read: add the free extension** when a link-only scan was blocked (or the listing page came back unreadable). A result that already came from the shopper's browser does not show it.
- Shoppers are not shown how many written reviews were read. The marketplace rating count can still show. The page does not say "Vercel", "Not scored", "Not enough evidence", or "no reviews analyzed".

## Load the unpacked extension

1. Sign in to ReviewIntel in Chrome or Edge.
2. Open `extension/config.js`. For a local server, set `REVIEWINTEL_ORIGIN` to `http://localhost:3000`. Leave `https://getreviewintel.com` to talk to the live site once this is deployed (this handoff does not deploy it).
3. Go to `chrome://extensions` or `edge://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and choose the `extension` folder in this repo.
6. Reload the product page. Click **Analyze with ReviewIntel** (on the page, or the toolbar button).
7. A new tab opens the usual results page.

Local server, fake env, no OpenAI key:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
OPENAI_API_KEY= \
npm run dev
```

With that fake database, a free account still stops at 3 scans a day inside this server process. A real database is required before this is deployed. Point the extension at localhost and sign in on localhost before clicking Analyze.

The bookmark on `http://localhost:3000/tools/analyze-page` is the same API. Drag **Analyze this page** to the bookmarks bar, open a product page, and click the bookmark.

## Chrome Web Store (Owner, one time)

The Owner pays the one-time **$5** Chrome Web Store developer registration fee. ReviewIntel does not pay it from the product, and this handoff does not submit the listing.

1. Sign in at `https://chrome.google.com/webstore/devconsole` with the Owner's Google account.
2. Pay the one-time $5 developer registration fee if that account has not registered before.
3. Zip the contents of `extension/` (`manifest.json`, `config.js`, `extractors.js`, `content.js`, `content.css`, `popup.html`, `popup.js`, `popup.css`, `icons/`). Do not zip the parent folder itself; `manifest.json` must be at the root of the zip.
4. Click **New item** and upload the zip.
5. Store listing:
   - Single purpose: read the reviews already visible on the product page the shopper opened, after they click Analyze, and open a ReviewIntel result.
   - Permission justification: `activeTab` is used because the toolbar click reads only the current tab. Host access is only the product pages listed in the manifest, so the button can appear there and the click can read that page. The extension does not read any other site.
   - Do not use a store's logo or say or imply that the store endorses ReviewIntel.
6. Privacy: this extension reads a page only after a click. Use the privacy policy below. The public policy URL can stay `https://getreviewintel.com/privacy` once that page includes this text, or the Owner can host the text below at a stable URL and paste that URL into the form.
7. Data-use questions: the extension collects the product page URL, product id, title, star rating, rating count, and the visible review text, stars, dates, and verified badges. It sends them to ReviewIntel for the shopper's own scan. It does not collect the shopper's store login, payment data, or browsing history. It does not use the data for advertising.
8. Screenshots: the button on a product page, and a ReviewIntel result. Replace the generated icons with final artwork before a public listing if the Owner wants a new mark.
9. Submit for review. Edge Add-ons can take the same Manifest V3 zip at `https://partner.microsoft.com/dashboard/microsoftedge/overview`. Publishing there is also the Owner's step, not part of this change.

## Privacy policy text for the store

ReviewIntel browser extension

The ReviewIntel extension adds an Analyze with ReviewIntel button on product pages at amazon.com, amazon.ca, amazon.co.uk, amazon.de, amazon.fr, amazon.es, amazon.it, amazon.com.au, amazon.in, amazon.com.mx, amazon.co.jp, walmart.com, walmart.ca, bestbuy.com, bestbuy.ca, target.com, homedepot.com, and homedepot.ca.

The extension does nothing until you click Analyze with ReviewIntel. That click reads only what is already visible on the product page: the product title, the product id in the page address, the star rating, the number of ratings, and the review cards on screen (review text, stars, date, and whether the store marked the review verified). It does not turn to the next page of reviews, does not run in the background, and does not read other sites.

The extension sends that text to ReviewIntel so ReviewIntel can score the product for you. You need to be signed in to ReviewIntel. The scan uses the same daily scan allowance as a scan you start on the ReviewIntel site. ReviewIntel does not receive your store password, payment information, or a history of other pages you visited.

ReviewIntel uses the submitted text only to build your result, enforce your plan limits, and keep the service secure. ReviewIntel does not sell this information. You can remove the extension from Chrome or Edge at any time.

## Tests

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
