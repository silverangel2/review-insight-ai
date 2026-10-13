# Email setup notes for getreviewintel.com

Checked on October 11, 2026 from public DNS. No email was sent while checking.

ReviewIntel sends mail with Resend from `ReviewIntel <support@getreviewintel.com>`. Incoming mail for that address still arrives through ImprovMX. Leave the incoming mail records alone.

## Already in place

- Incoming mail points at ImprovMX (`mx1.improvmx.com` and `mx2.improvmx.com`).
- The main SPF record allows ImprovMX only: `v=spf1 include:spf.improvmx.com ~all`. That is correct for mail ImprovMX forwards. Do not replace this line with a Resend-only record, or forwarded mail can break.
- Resend’s sending host is separate and already published:
  - `send.getreviewintel.com` TXT: `v=spf1 include:amazonses.com ~all`
  - `send.getreviewintel.com` MX: `feedback-smtp.us-east-1.amazonses.com`
  - `resend._domainkey.getreviewintel.com` has a DKIM public key
- Customer emails include a plain-text copy, a preferences link, an unsubscribe link, and a one-click unsubscribe header.

## Still needed before mail is less likely to land in spam

1. In the Resend dashboard, open the domain `getreviewintel.com` and confirm it says verified. If Resend shows a record that is not listed above, add that record in Vercel DNS. Do not delete the ImprovMX records.
2. Add a DMARC record. There is no `_dmarc.getreviewintel.com` record today. Start with monitor-only, after you confirm `support@getreviewintel.com` receives mail:

   `v=DMARC1; p=none; rua=mailto:support@getreviewintel.com; adkim=s; aspf=r`

   `p=none` only watches. Do not switch it to reject until you have read a few reports and real mail is still arriving.
3. Set `EMAIL_LINK_SECRET` in the host environment to a long random value. Unsubscribe and preference links are signed with it. If it is missing, the app can derive a key from the database secret, but those links break when that database secret changes.
4. Set `REVIEWINTEL_POSTAL_ADDRESS` to your real mailing address if you send product updates to people in the United States. The email footer prints it when it is set. Do not invent an address.
5. Apply `supabase/migrations/20261011_email_preferences.sql` with the rest of the database updates. Until that runs, welcome and first-scan emails are skipped instead of being sent twice, and the newer preference checkboxes cannot be stored.
6. Keep `RESEND_API_KEY` only on the server. Do not put it in a public env var.
7. Send a test only from the admin email check, to your own inbox, after deploy. Look at the message source and confirm SPF, DKIM, and DMARC pass. This work did not send that test.

## What the app sends

- Welcome: once, when an account is created (email signup or Google signup).
- First scan: once, after a free account’s first completed scan, unless they turned that note off.
- Product updates: only to people who opted in, from the existing admin campaign sender.
- Support and advertising replies use the same layout.
- Failed sends are tried up to 3 times when the failure looks temporary (network, timeout, or a provider 429/5xx). A bad address is not retried.
