# Opentip app

Hosted docs and a Worklog. Opentip writes docs for a GitHub repo and updates them on every push. The same GitHub App, named Opentip Copilot, signs people in and receives webhooks. Install it at https://github.com/apps/opentip-copilot/installations/new.

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

On a localhost database, the same approval can be done by hand:

```bash
npx tsx scripts/approve-beta-email.ts you@example.com
npx tsx scripts/approve-beta-email.ts you@example.com --admin
```

The script exits if `DATABASE_URL` is not `localhost` or `127.0.0.1`. `--admin` sets the role when that email already has a user row. Run it again after the first local sign-in if the row was missing.

Sign-in codes are emailed with Resend (`RESEND_API_KEY`, `RESEND_FROM`). They are HMAC-SHA256 hashed with `SESSION_SECRET` and are not stored in plaintext. Locally, set `LOGIN_CODE_SINK=.local/login-codes.log` when Resend is unset. Leave that unset in production.

Without `XAI_API_KEY` or `GROQ_API_KEY`, Copilot uses a fake provider in development and tests. Production refuses to run a job when the key for that job is missing.

## Scripts

- `npm run dev` starts the app.
- `npm run lint` runs eslint.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm test` runs the unit tests.
- `npm run build` generates the Prisma client and builds Next.js.

## Where things live

- `prisma/schema.prisma` and `prisma/migrations` are the database.
- `src/app/api/webhooks/github` verifies the webhook and enqueues a job once.
- `src/app/api/auth/github` is GitHub sign-in. `src/app/api/auth/email` sends and checks the 6-digit code.
- `public/brand` and `public/icons` are the Opentip marks. Customer docs sites keep their own logos.
- `src/lib/copilot` chooses xAI `grok-build-0.1` or Groq `gpt-oss-120b`, checks daily caps, and caches repo summaries.
- `src/app/api/og` renders the signed social image.
- `src/proxy.ts` sends `{subdomain}.opentip.tech` at the docs renderer and keeps `/dashboard` and `/admin` signed in.
- `src/app/dashboard` is Sites, Worklog, Usage, and Billing.
- `src/app/admin` is the admin shell.

## Tests

Unit tests cover webhook signatures and duplicate deliveries, daily spend caps, cached summaries, and OG signatures. They do not need a database.
