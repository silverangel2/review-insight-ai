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

- Screenshot titles drop store chrome and keep model tokens.
- A star line with a parenthetical total (`(12,431)`) or a `2.3K reviews`
  line is kept as the marketplace count the score needs. Shoppers do not
  get a ratings-count fact row.
- A screenshot-only Walmart or Best Buy scan searches the matching Amazon
  store for that product. A pasted store link stays on that store.
- Unmatched negative review excerpts show as complaints instead of the
  generic "isolated concerns" line.
- Shoppers do not see a ratings-count row.
- Amazon links keep an existing associate tag, and gain the store default
  when a tag is missing.
