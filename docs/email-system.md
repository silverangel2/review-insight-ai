# ReviewIntel email system

## How sending works (`lib/emailDelivery.ts`)
- One sender: `ReviewIntel <support@getreviewintel.com>`, reply-to `support@getreviewintel.com` unless a route sets one (e.g. advertiser inquiries reply to the advertiser).
- Every template goes through `lib/emailTemplate.ts` (branded responsive HTML + plain text) via `lib/emailTemplates.ts`.
- Categories: `transactional` (always sent) and optional `tips`, `upgrade`, `watch_alerts`, `marketing`. Optional mail checks
  `email_preferences` and carries `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- Retries: up to 3 attempts with backoff on retryable provider errors (rate limit / provider 5xx). Resend errors returned in
  the response body are now treated as failures. Previously they were logged as "sent".
- Logging: every attempt (sent / failed / skipped + reason) goes to `admin_email_logs`.
- Rate limit: max 6 emails per recipient per email type per hour (per server instance).
- **Dev sink:** outside production, mail goes ONLY to `REVIEWINTEL_EMAIL_DEV_SINK`; if it's unset, nothing is sent (logged as skipped).

## Templates and previews
Dev gallery: `/dev-preview/email` (HTML + text side by side). Raw: `/api/dev/email-preview?template=<name>[&format=text]`. Both 404 in production.
Templates: welcome, upgrade_after_first_scan, watch_alert, advertiser_inquiry_owner, advertiser_autoreply, advertiser_payment_link, owner_notification.

## Not covered by this code
- **Verification and password-reset** emails are sent by **Supabase Auth**. Restyle them in Supabase → Authentication → Email Templates (paste the layout from `/api/dev/email-preview?template=welcome` and swap in `{{ .ConfirmationURL }}`). Set the custom SMTP sender in Supabase to Resend so they come from the same domain.
- **Receipts** are sent by **Stripe**. Enable "Successful payments" emails and brand them in the Stripe dashboard.
- Contact auto-reply, admin replies, beta emails and marketing still build their own HTML (they work, all now get retries, logging, rate limits and the dev sink). Marketing is categorised `marketing` and respects opt-out. Moving them onto the template is a follow-up.

## Owner setup
1. Apply `supabase/migrations/20261011_email_preferences.sql` (not applied by the app). Without it, preferences use defaults and the once-only welcome/upgrade emails are skipped.
2. Set `REVIEWINTEL_EMAIL_SECRET` (signs preference/unsubscribe links) and, locally, `REVIEWINTEL_EMAIL_DEV_SINK`.
3. DNS for getreviewintel.com (Vercel DNS) — see the readiness report below.

## DNS readiness (read-only check, 2026-10-11)
`dig @1.1.1.1` found **no** TXT (SPF), **no** `_dmarc`, **no** `resend._domainkey` DKIM, **no** `send.` subdomain records and **no MX**.
- Add the domain in Resend → Domains and copy the exact records it gives (typically: `resend._domainkey` TXT for DKIM, `send` MX
  `feedback-smtp.<region>.amazonses.com` and `send` TXT `v=spf1 include:amazonses.com ~all`).
- Add DMARC: `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:support@getreviewintel.com` (move to `p=quarantine` after a few clean weeks).
- **No MX means support@getreviewintel.com cannot receive mail.** Replies to every email bounce. Add MX for your mailbox provider.
