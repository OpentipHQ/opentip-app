# Opentip app

Hosted docs and a Worklog. Opentip writes docs for a GitHub repo and updates them on every push. The same GitHub App, named Opentip, signs people in and receives webhooks.

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
- `src/app/api/auth/github` is GitHub App sign-in.
- `src/lib/copilot` chooses xAI `grok-build-0.1` or Groq `gpt-oss-120b`, checks daily caps, and caches repo summaries.
- `src/app/api/og` renders the signed social image.
- `src/proxy.ts` sends `{subdomain}.opentip.tech` at the docs renderer and keeps `/dashboard` and `/admin` signed in.
- `src/app/dashboard` is Sites, Worklog, Usage, and Billing.
- `src/app/admin` is the admin shell.

## Tests

Unit tests cover webhook signatures and duplicate deliveries, daily spend caps, cached summaries, and OG signatures. They do not need a database.

To promote a person to admin after they sign in, set `User.role` to `ADMIN` in the database. There is no self-serve promotion.
