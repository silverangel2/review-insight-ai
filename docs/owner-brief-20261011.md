# Owner brief — October 11, 2026

Email polish and a careful pass over the app are on the open pull request. Nothing was merged, deployed, charged, or emailed to a real person.

## Done

**Email**

- There is one branded ReviewIntel email layout. Welcome, the note after a first scan, product updates, support replies, advertising replies, and beta access all use it.
- A welcome email is prepared when someone creates an account, including Google sign-up.
- A free account gets one note after the first completed scan. It uses the real plan price and the benefits the product actually includes. No countdown, no fake brand names, and no invented reviews.
- Every customer email has an unsubscribe link and an email preferences link. The preferences page lets someone turn off product updates and that one scan note. Account and billing messages can still be sent when they are needed.
- Opening an unsubscribe link no longer changes anything by itself. The person confirms on the page. New links are signed so a guessed address is not enough.
- If sending fails because of a timeout or a temporary provider problem, ReviewIntel tries again, up to 3 times. A bad address is not retried.
- Tests cover this without sending real email.
- Domain notes are in `docs/email-deliverability.md`.

**Safe fixes from the app pass**

- Google’s ad script no longer loads before someone accepts optional cookies. Ads can still load after that choice.
- The public search files now point at getreviewintel.com, and private pages (account, dashboard, unsubscribe, email preferences, admin) are left out of Google’s list.
- The site description for search names the free plan, instead of sounding like the whole product is free.
- After someone finishes their profile, ReviewIntel only sends them to a page on this site.
- Admin alert emails can no longer treat a message as web code.

## Still open

- The new database file `supabase/migrations/20261011_email_preferences.sql` is in the project only. It has not been applied. Until it is, welcome and first-scan emails are skipped on purpose so nobody gets the same email twice.
- This machine has no email database connected. The unsubscribe button correctly says nothing was changed. After the database update is live, that same button turns the emails off.
- DNS is partly ready (Resend signing and the sending host are published, and incoming mail still uses ImprovMX). There is still no DMARC record. The exact line to add is in the email notes. Do not replace the ImprovMX mail records.
- Set `EMAIL_LINK_SECRET` before launch so unsubscribe links survive a database-key change.
- Set `REVIEWINTEL_POSTAL_ADDRESS` only if you have a real mailing address to print. Do not invent one.
- After you deploy, send one test to yourself from the admin email check and confirm it does not land in spam. This work did not send that test.

## Needs your decision

- The one note after a first scan is on unless the person turns it off. They do not have to tick the marketing box to receive that single note. If you want it only for people who ticked marketing, say so. A lawyer should confirm this if you have customers in Canada.
- The pages that decide shopper vs seller still trust a browser cookie for plan and role. The signed login cookie is the real check on the server. Switching the page gates is the right cleanup, but it can lock people out of a page if the check is wrong, so it was left for a careful pass with you watching both a shopper and a seller login.
- Some seller spreadsheet analysis can still call OpenAI. Shopper scans stay on the real-review path. Removing that seller path is a product change, not a small fix.
- The analyzer page is listed for Google, but a visitor has to log in. Say if you want that page kept out of search.
- Every page asks the server whether maintenance mode is on. That adds a delay. Changing it can also change how maintenance mode behaves, so it was left alone.

## What to look at

Desktop and phone:

- Unsubscribe page, then the button (it should not email anyone).
- Email preferences, logged out, then again after you log in once the database update is applied.
- Account page and the footer link named Email preferences.
- Homepage, to confirm it still loads and ads do not start before the cookie choice.

On your own computer, open `/dev-preview/email` while developing. That page is hidden on the live site. It shows the welcome email and the first-scan email. Nothing is sent from it.
