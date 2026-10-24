# Screenshot scan retest (private preview)

This is the native ReviewIntel harness for screenshot identity and saved
scan results. It runs in this repo. It does not call OpenAI, paid proxies,
or production.

Owner deploys. This branch does not.

## 1. Offline harness (no server)

From the repo root:

```bash
npm run harness:screenshots
```

The command grades `fixtures/screenshot-scans/identity.json` through the same
title reader the analyze path uses (`productFactsFromOcr`) and the Amazon
enrichment plan for Walmart, Best Buy, and Amazon screenshots.

Artifacts:

- `artifacts/screenshot-harness/latest/report.md`
- `artifacts/screenshot-harness/latest/report.json`

Each fixture is `PASS` or `FAIL`. A failing title, a missing model token
(`NC301C`, `8qt`, `V8`, `9a`), store chrome (`Official Outlet`, `Available at
a lower`), or a retailer screenshot that does not plan the matching Amazon
store fails the run. Walmart.ca and Best Buy screenshots enrich from
Amazon.ca. Walmart.com and BestBuy.com screenshots enrich from Amazon.com.
BISSELL `(4.3) | 448` and Instant Pot `(4.8) | 2,553` must keep those stars
and produce a provisional Buy, Wait, or Skip with no Amazon review scrape.
Live Tesseract noise on that same BISSELL row — `(43) | 448` and
`4.3) | 448` — is still 4.3 from 448. A bare `(43)` and a price such as
`$98.88` are not ratings.
Exit code is non-zero when anything fails.

`npm test` includes the same checks.

## 2. Private preview (Owner)

Deploy this branch's preview yourself. Do not point the check at production.

On the preview, signed in as a Premium shopper:

1. Open the scan page on a phone-sized window. The first action is the
   screenshot. The link field is labeled optional.
2. Upload a product-page screenshot only (no link) for each product. Use the
   same ten screenshots, then a second set of ten different products.
3. A passing result has:
   - the real product name, including the model, and not a store-page title
   - Buy, Wait, or Skip with a score
   - at least one strength and one complaint taken from the reviews
   - an Amazon "Check price" link whose address contains `tag=`
4. The result must not show a ratings count, "Not scored", "Not enough
   evidence", or "Vercel".

To grade a saved analyze JSON from that preview:

```bash
node scripts/screenshot-scan-harness.mjs --grade-result ./path/to-result.json --prominent
```

`--prominent` requires a scored verdict plus a real strength and a real
complaint. The file can be the analyze response or `{ "result": ... }`.
Do not put passwords, cookies, or session tokens in the file, the command,
or the docs.

## What the code changes

- Screenshot titles drop store chrome and keep model tokens. App-install
  banners, out-of-stock apologies, and slogan lines from another product
  cannot become the name. The title next to the star rating wins over a
  longer line elsewhere on the page. A fetched listing title cannot replace
  a screenshot name that names a different brand or model. HTML entities
  such as `&#34;` are decoded. A size unit on the next line (`8` / `Quart`)
  stays on the title.
- A star line with a parenthetical total (`(12,431)`) or a `2.3K reviews`
  line is kept as the marketplace count the score needs. Walmart and Best
  Buy lines that omit "out of 5" are read too: `(4.3) | 448`, `4.3 (448)`,
  and `4.8 | 2,553`. Live OCR that drops the decimal (`(43) | 448`) or the
  opening parenthesis (`4.3) | 448`) is the same pair. A price and a bare
  `(43)` with no count are not. The screenshot pair is enough for a
  provisional Buy, Wait, or Skip when Amazon returns nothing or returns a
  rating without a count. A complete named Amazon page still wins when that
  page was actually read. An unnamed result ("Amazon product") keeps the
  screenshot stars instead, and does not reuse another product's library.
  Shoppers do not get a ratings-count fact row.
- When the screenshot listing is thin or blocked, the existing review hunt
  continues to other free stores. A fingerprint-matched library corpus of
  at least three accepted reviews is reused instead of scraping again.
  Screenshot stars still make a provisional Buy, Wait, or Skip when every
  layer is empty. Strengths, complaints, and the verdict reason are short
  sentences a person could say about this product, using words that appear
  in the reviews that were gathered. A vague label ("easy to use", "does
  what it promises") is left out rather than padded. Sophie
  (`validateReviewProposal` in `lib/sophieContributions.ts`) grades whether
  those findings cite reviews this scan already gathered. The analyze route
  runs that check on the server and stores the grade. The shopper client
  does not import it. It does not fetch reviews, call a model, or replace
  the buying-score verdict. A finding it cannot cite is dropped, not
  replaced with a generic sentence. Its contract keeps the assessment at
  "Insufficient evidence" and rejects score overrides. If grading fails,
  the deterministic sentences still show. Scans do not wait on Sophie,
  Ollama, or getreviewintel.com.
- Affiliate "Check price" links may still point at Amazon. The bot does not
  need an Amazon review scrape to score a screenshot that already shows stars.
- A screenshot-only Walmart or Best Buy scan can still search the matching
  Amazon store for that product. A pasted store link stays on that store.
  That search is not required for the provisional score.
- Unmatched negative review excerpts show as complaints instead of the
  generic "isolated concerns" line.
- Shoppers do not see a ratings-count row.
- Amazon links keep an existing associate tag, and gain the store default
  when a tag is missing.
