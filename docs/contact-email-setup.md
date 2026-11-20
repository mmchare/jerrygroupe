# Contact form email delivery

The contact form stores submissions in Supabase and then sends a notification to `contact@jerrytradinggroup.com` through the Resend HTTPS API. This uses HTTPS rather than Proton SMTP because the site is deployed on Vercel, where direct SMTP connections are not suitable.

## Required deployment secrets

Configure these as server-side environment variables in the deployment platform (Vercel/Lovable Secrets). Do not commit their values:

- `RESEND_API_KEY`: API key created in Resend.
- `CONTACT_FROM_EMAIL`: sender address on a domain verified with Resend, for example `JERRY GROUP <contact@jerrytradinggroup.com>` after `jerrytradinggroup.com` has been verified there.

The recipient is fixed in the application as `contact@jerrytradinggroup.com`. Replies to the notification are directed to the visitor's submitted email address.

## Setup and verification

1. Add and verify `jerrytradinggroup.com` in Resend, including the DNS records Resend provides. This verifies sending through Resend; it does not change Proton's mailbox hosting or MX records.
2. Create a Resend API key and configure the two variables above in the production deployment and any preview environment where you want to test.
3. Redeploy after adding the secrets.
4. Submit a test message and verify delivery to the Proton inbox. If delivery fails, inspect the server logs for `[contact] email delivery failed` or `[contact] email delivery request failed`.

The form stores each valid message before attempting delivery. If delivery fails, the visitor sees the existing generic error and can retry; retries reuse the same client message ID for provider idempotency.
