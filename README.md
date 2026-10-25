# Opentip app

Hosted docs and a Changelog. Opentip writes docs for a GitHub repo and updates them on every push. The same GitHub App, named Opentip Copilot, signs people in and receives webhooks. Install it at https://github.com/apps/opentip-copilot/installations/new.

The beta app is https://beta.opentip.tech. Product decisions live in [SPEC.md](SPEC.md). GitHub App registration steps for the OpentipHQ org live in [GITHUB_APP_SETUP.md](GITHUB_APP_SETUP.md).

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`. Never commit it. Then apply the migration to the Neon database for this app:

```bash
npx prisma migrate deploy
```

Use `migrate deploy` (or `migrate dev` on your own machine). Do not use `db push`.

```bash
npm run dev
```

Open http://localhost:3000.

Without `DATABASE_URL`, the dashboard and a preview docs site still render. Set `AUTH_DEV_BYPASS=1` to open the dashboard without GitHub. That flag is ignored when `NODE_ENV` is production.

Sign-up and log in are closed to the beta list. In production, set `ADMIN_EMAILS` to a comma-separated list of operator emails. Those addresses are approved for the beta. The next time one of them signs in with GitHub or an email code, the app creates or updates their account with the admin role. That is how the first admin gets in. They can then approve other people on the admin applications page. An address removed from `ADMIN_EMAILS` keeps the admin role it already has, and can sign in again while a `BetaAccess` row exists for it.

The admin applications page reads and writes the marketing site's `beta_application` table through `MARKETING_DATABASE_URL`. Add the read/write connection string to this app's host environment, and apply `docs/marketing-db/002_beta_application_review.sql` to the marketing database once. Approving an application grants local `BetaAccess` and sends one branded access email. A failed email does not undo access. Use Resend invite on the application to send it again. Rejecting an application revokes local access and invalidates existing sessions for that email.

On a localhost database, the same approval can be done by hand:

```bash
npx tsx scripts/approve-beta-email.ts you@example.com
npx tsx scripts/approve-beta-email.ts you@example.com --admin
```

The script exits if `DATABASE_URL` is not `localhost` or `127.0.0.1`. `--admin` sets the role when that email already has a user row. Run it again after the first local sign-in if the row was missing.

Email uses Resend (`RESEND_API_KEY`, `RESEND_FROM`) and is sent as branded HTML with a plain-text version. That covers sign-in codes, email-change codes, beta invites, beta approvals, announcements, and internal spend alerts. Sign-in codes are HMAC-SHA256 hashed with `SESSION_SECRET` and are not stored in plaintext. Locally, set `LOGIN_CODE_SINK=.local/login-codes.log` when Resend is unset. Leave that unset in production.

Announcements respect email preferences. Every announcement includes a signed preferences link and a one-click List-Unsubscribe header. The public page is `/email/preferences`. Transactional email such as sign-in and beta access does not use this setting.

Without `XAI_API_KEY` or `GROQ_API_KEY`, Copilot uses a fake provider in development and tests. Production refuses to run a job when the key for that job is missing.

Profile pictures use Vercel Blob. Set `BLOB_READ_WRITE_TOKEN` before trying an upload. Only the public blob URL is stored in Postgres. Replacing or removing a picture deletes the old blob. Without the token the profile page shows an honest configuration error.

Spend alerts use `SPEND_ALERT_DAILY_USD`, `SPEND_ALERT_USER_USD`, `SPEND_ALERT_USER_MULTIPLE`, and `SPEND_ALERT_EMAILS`. The protected cron route is `GET /api/cron/spend-alerts` with `Authorization: Bearer $CRON_SECRET`. `vercel.json` runs it daily at 01:00 UTC, and Vercel adds the bearer header when `CRON_SECRET` is set. Admins can also run a check from the Spend alerts page.

## Scripts

- `npm run dev` starts the app.
- `npm run lint` runs eslint.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm test` runs the unit tests.
- `npm run email:preview` renders sample emails to `.local/email-preview`.
- `npm run build` generates the Prisma client and builds Next.js.

## Where things live

- `prisma/schema.prisma` and `prisma/migrations` are the database.
- `src/app/api/webhooks/github` verifies the webhook and enqueues a job once.
- `src/app/api/auth/github` is GitHub sign-in. `src/app/api/auth/email` sends and checks the 6-digit code.
- `public/brand` and `public/icons` are the Opentip marks. Customer docs sites keep their own logos.
- `src/lib/copilot` chooses xAI `grok-build-0.1` or Groq `gpt-oss-120b`, checks daily caps, and caches repo summaries.
- `src/app/api/og` renders the signed social image.
- `src/proxy.ts` sends `{subdomain}.opentip.tech` at the docs renderer and keeps `/dashboard`, `/profile`, and `/admin` signed in. It does not decide the admin role. Admin pages return 404 for non-admins.
- `src/app/dashboard` is Import, Sites, Changelog, Usage, and Billing. Clicking Import opens a site dialog. Clicking Build site creates one pending site and one queued first-build job. Installing the GitHub App creates no sites.
- `src/app/profile` is the profile picture, display name, email change, sign-in methods, connected GitHub accounts, sign-out-all, and account deletion.
- `src/app/email/preferences` manages product email opt-outs with a signed link from an announcement. The one-click unsubscribe route is `/api/email/unsubscribe`.
- `src/lib/email` renders branded templates, sends through Resend, signs preference links, and filters announcements by opt-out.
- `src/app/admin` covers applications, users, usage, jobs, plans, feedback, invites, installs, tips, announcements, spend alerts, act-as, and the activity log. Act-as is read-only and admin Reset is not built.

## Tests

Unit tests cover webhook signatures and duplicate deliveries, daily spend caps, cached summaries, OG signatures, admin role enforcement, act-as write blocking, repo import idempotency, profile image validation and unlink rules, spend alert thresholds, marketing application mapping, beta application review flows, branded email rendering and transport, preference tokens, and announcement opt-out filtering. They do not need a database.
