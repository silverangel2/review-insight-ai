# ReviewIntel browser extension (Chrome and Edge, Manifest V3)

Reads the reviews already visible on the product page the shopper has open, then opens the normal ReviewIntel result. **Not published.** Do not submit to a store without the Owner's go-ahead. See `docs/HANDOFF-extension.md`.

## What it does

- The button and the toolbar action both say **Analyze with ReviewIntel**.
- Nothing is read until that click. The click reads the title, product id, star rating, rating count, and the review cards already on the screen (text, stars, date, verified badge).
- It does not turn pages, scroll for more reviews, or run in the background.
- It opens ReviewIntel in a new tab. ReviewIntel scores those reviews with the same daily scan allowance and Buying Score the site already uses.

## Permissions

- `activeTab` — the toolbar click applies to the tab the shopper is looking at.
- Host access only for the product pages ReviewIntel already supports. No other sites, and not ReviewIntel's own site.

## Load it locally

1. In `extension/config.js`, set `REVIEWINTEL_ORIGIN` to the site you are signed in on. Use `http://localhost:3000` for a local server, or leave `https://getreviewintel.com`.
2. Chrome or Edge → extensions → turn on **Developer mode**.
3. **Load unpacked** → choose this `extension/` folder.
4. Sign in to ReviewIntel in that same browser.
5. Reload a product page. Click **Analyze with ReviewIntel** on the page or in the toolbar.
6. A ReviewIntel tab opens on your result.

The bookmark on `/tools/analyze-page` does the same job on a phone or a computer without the extension.
