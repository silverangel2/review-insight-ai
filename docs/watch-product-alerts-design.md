# "Watch this product" alerts: design note (not built yet)

A free path exists: `lib/emailDelivery.ts` already sends mail, Vercel cron is already
configured (`vercel.json`), and retrieval uses OpenAI 0. It is NOT built in this PR because
it needs a new database table (a production schema change the Owner should approve) and
recurring live scraping, which needs agreed request budgets.

## Shopper flow
1. On a result, "Watch this product": signed-in users only (email already verified).
2. We email once when the verdict changes (e.g. Wait to Buy), or when at least 10 new real
   reviews are accepted. Never on price, never marketing.
3. Every email has a one-click unwatch link (signed token) and shows the real reasons and quotes.

## Data (new table `product_watches`, needs approval)
`id, profile_email, listing_url, product_key (normalized ASIN/GTIN/model), last_verdict,
last_accepted_count, last_result_hash, last_checked_at, created_at, unsubscribed_at`.
Unique on (profile_email, product_key). Max 10 active watches per user.

## Recheck job
- Cron `/api/cron/product-watches` (CRON_SECRET), daily, at most N products per run (start with 25).
- Group watches by product_key: one rescan per product, not per watcher.
- Rescan through the same native retrieval: robots on, OpenAI 0, Firecrawl 0, headless off on Vercel.
- Compare deterministic result hashes; email only on a real verdict change or a new-evidence threshold.
- Stop after 3 consecutive access blocks for a host and tell watchers honestly ("we can't recheck right now").

## Effort
About 1.5 to 2 days: migration, API, cron, email template, unsubscribe, tests (mocked retrieval + email).
