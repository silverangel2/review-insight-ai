# ReviewIntel browser extension (Chrome, Manifest V3)

Adds a small **Check reviews** button on Amazon product pages. Clicking it opens
`https://getreviewintel.com/analyze?url=<product URL>` in a new tab, where ReviewIntel runs its
normal scan. **Not published.** Do not submit without the Owner's go-ahead.

## What it does / doesn't do
- Reads only `location.pathname` to find the 10-character product id (ASIN). It builds a clean `/dp/<ASIN>` URL.
- Does **not** read page content, scrape reviews, make network requests, store data, or track users.
- No `permissions`, no `host_permissions`, no background service worker. Its content script runs only on Amazon storefront domains.
- The button can be dismissed per page (×). It respects reduced-motion and has a visible focus ring.

## Load it locally
1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → choose this `extension/` folder.
3. Open any Amazon product page (`/dp/…`): the button appears bottom-right.

## Chrome Web Store submission checklist
- Zip the folder contents (`manifest.json`, `content.js`, `content.css`, `icons/`).
- **Single purpose:** "Open the current Amazon product in ReviewIntel to see a review-based verdict."
- **Permission justification:** none requested. The content script match patterns are needed to show the button on Amazon product pages only.
- **Data usage:** collects no user data. Certify "does not collect or use user data".
- **Privacy policy URL:** https://getreviewintel.com/privacy
- Store listing: 1280×800 screenshots of the button on a product page and of a ReviewIntel result. Replace the generated icons with final brand artwork (128×128 PNG).
- Trademark note: describe it as working "on Amazon product pages". Don't use Amazon's logo or imply endorsement. Include: "ReviewIntel is independent and not affiliated with or endorsed by Amazon or any brand."
