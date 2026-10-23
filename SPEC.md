# Opentip app spec

Status: 23 Oct 2026. This file is the source of truth for OpentipHQ/opentip-app. Update it when a decision changes.

Opentip is a hosted docs and Worklog platform. Opentip Copilot writes docs for a GitHub repo and updates them on every push through one GitHub App. The GitHub App is named Opentip Copilot because the name Opentip is reserved by another account. Its slug is `opentip-copilot`. The install URL is https://github.com/apps/opentip-copilot/installations/new. The beta app is served at beta.opentip.tech. The marketing site stays at opentip.tech in the other repository.

The word for money a person sends a project is tip. The only assets are ETH and USDC. Tipping itself is out of scope until a later phase. Do not invent brand facts that are not in this file or in the product decisions below.

## Product decisions

Recorded from the roadmap on 23 Oct 2026.

### Phase 0, in optimusexe/Opentip (done, not this repo)

- Docs product landing at opentip.tech. Tipping moved to /tip as Opentip Tip, with redirects.
- Landing redesign and the CTA paragraph centering fix are merged.
- Terms, Privacy, Subprocessors, and 404 pages are merged. Nigerian law. The liability cap is the greater of 12 months paid or US$100.
- /beta application form writes to Neon via `BETA_DATABASE_URL`. One question per screen, optional X handle, free input price question.
- Still needs Elijah: run the beta SQL on Neon and redeploy so applications save.
- Private repo OpentipHQ/opentip-app exists and Cursor has access.

### Phase 1, this repository

Foundation: app skeleton, database schema, GitHub App sign-in, webhook intake, Copilot job interface, dashboard shell, admin shell, and a public docs renderer. Outside services are faked until keys exist.

Elijah still has to:

- Register the GitHub App on the OpentipHQ org as Opentip Copilot, slug `opentip-copilot`. The name Opentip is reserved. Sign-in and push updates use the same app. Install URL: https://github.com/apps/opentip-copilot/installations/new. See GITHUB_APP_SETUP.md. Override the slug with `GITHUB_APP_SLUG` only if GitHub assigns a different one.
- Create a separate Neon database for this app (Free plan). It becomes the production database at launch. Do not reuse the marketing site database.
- Add xAI, Groq, and Resend keys.

Beta access is sent by email. The beta app is beta.opentip.tech.

### Phase 2, docs engine and Copilot

- One worker, fed by the queue this app writes when a webhook arrives. It scales from zero. The host is an Azure Container App.
- Job kinds: first build, push update, chat edit.
- Approvals for pages waiting on review.
- Never silently overwrite a page a customer edited by hand. `Page.handEdited` records that, and `pageWriteMode` returns skip.
- A failed build keeps the live site running.
- Uninstall or a removed repo pauses the site and, in that phase, emails the owner. This foundation already pauses the site. The email is not sent yet.
- Repo renamed, moved, or archived. The webhook handler records the rename and pauses on archive, delete, or transfer.
- Webhooks that fail or arrive twice. Signature checks, a delivery id claim, and a job idempotency key are in this foundation. A failed claim is released so GitHub can retry.
- Private repos are supported. Code is sent to xAI and Groq. That is covered in the Privacy policy. Private docs behind sign-in are a later paid feature, still undecided for the first paid plans.

### Phase 3, docs sites, branding, and SEO

- Themes on Free: Ledger and Minimal.
- Fonts: Geist and Geist Mono. Headings at weight 500. Body at weight 400.
- Branding, the way Mintlify does it: logo light and dark, favicon, primary color, theme.
- Dynamic signed OG image per page, 1200 by 630, cached. Reference checked 23 Oct 2026: docs.shieldhq.xyz. The image shows the logo, section, title, and description on a light field with a hairline grid and a soft tint of the site color.
- OG overrides, in increasing control: own background (logo, title, and description stay), one image for the whole site, one image for a page.
- Floating "Built with Opentip" pill in a bottom corner. It opens https://opentip.tech.
- Free subdomains. Custom domains with automatic HTTPS and status messages are not on Free.
- Sitemap and robots.txt per site.
- Canonical link from the subdomain to the custom domain once the custom domain is active.
- Noindex on preview builds (`Page.noindex`) and on paused sites.

### Phase 4, Worklog, money, and admin

- Carry over the existing Worklog code, including the PR #34 fix. This foundation has the schema and a read-only list.
- Optional tip button under a Money section. ETH and USDC only. Tip fees unchanged. Not in this release.
- Admin, the nine items that were written down: applications, users, usage and costs, jobs, plans and limits, feedback, tips overview, invite waves, GitHub App installs. Thirteen features were approved and only these nine are recorded. Do not invent the other four.
- Takedown tools for abuse reports.

### Phase 5, trust, safety, and data

- Export docs as Markdown or as a pull request to the repo.
- Deleting a site: a grace period, then a full wipe including the CDN cache.
- Deleting an account, including the GDPR path.
- Emails for failed builds, pages waiting for approval, and domain status.
- Report abuse link on every site, and checks on new sites.
- DMCA and takedown policy in the Terms.
- Tip button rules: who receives the tip, and Terms covering crypto.

### Phase 6, launch and paid plans

- Paddle account and website review before launch. Needs live pricing, Terms, Privacy, and a refund policy.
- Plans: Free, Pro $20 a month, Team $200 a month. Prices stay hidden during beta. Prices may change from beta form answers.
- A discount on the first two months after launch. No lifetime deal.
- Feature scenes as short videos on the landing page. Uncertain whether that already landed in the marketing repo.

### Later

- Monorepos: pick one package or folder.
- Docs search. Still a decision. It is not in the beta scope until that decision changes.
- `llms.txt` per site.
- AI crawler opt-out (Content-Signal in robots.txt).
- Public API and webhooks for customers.
- Limit of 3 Worklog updates a day.
- Private docs behind sign-in as a paid feature.
- Code with comments that are not in English.

## Branding model

Each site stores:

- `logoLightUrl` and `logoDarkUrl`. One file is enough if the other is empty.
- `logoHref` for where the logo click goes.
- `faviconUrl`.
- `primaryColor`. Required in the product sense. Default `#2A2AD6` until the customer sets one.
- `theme`: `LEDGER` or `MINIMAL`.
- `appearance`: `SYSTEM`, `LIGHT`, or `DARK`.
- `ogBackgroundUrl`: the customer's background, with the automatic logo, section, title, and description still drawn on top.
- `ogImageUrl`: one fixed image for the whole site.
- `Page.ogImageUrl`: one fixed image for that page.

The automatic image wins only when neither the page nor the site has a fixed image. The route is `/api/og`. Query fields are `site`, `section`, `title`, `description`, `primary`, optional `logo`, optional `background`, and `sig`. The signature is HMAC-SHA256 over a versioned canonical string, encoded as base64url, using `OG_SIGNING_SECRET`. A bad or missing signature returns 403. Colors must be `#RRGGBB`. Logo and background URLs must be https. The response is a 1200 by 630 PNG from `next/og` `ImageResponse`, cached for a day at the edge.

App chrome, separate from customer sites:

- Background `#FAFAFA`.
- Opentip blue `#2A2AD6`.
- Hairline `#EBEBEB`, 1px, on cards.
- Pill buttons.
- Geist and Geist Mono, weights 400 and 500 only.

## Models and cost caps

Decided 23 Oct 2026.

- Heavy jobs (first full build, large chat edits over 2,000 characters): xAI `grok-build-0.1`. `grok-4.7` is a config option only, via `XAI_HEAVY_MODEL`. It is not the default.
- Small jobs (push updates, smaller edits): Groq `openai/gpt-oss-120b` on the paid Developer plan. Override with `GROQ_SMALL_MODEL`.
- One provider layer: `resolveProvider`. Missing keys use a fake provider in development and tests. Production fails closed.
- Fake completions cost 0, so local preview does not burn the cap. Real calls use internal USD estimates (`XAI_*_USD_PER_MTOK`, `GROQ_*_USD_PER_MTOK`). Those estimates are for caps, not an invoice. Unset xAI prices default to $1 per million input tokens and $2 per million output tokens, the grok-build-0.1 list prices.
- Before a job runs, reserve an estimate (heavy: 20k prompt and 8k completion tokens, small: 4k and 1.5k). Reject the job when the reserve would pass the per-repo daily cap or the global daily cap.
- Default caps: $2 per repo per day, $25 global per day. Both are UTC days and are env-configurable.
- The database path sums `UsageEntry` rows inside a serializable transaction (`reserveDailySpend`) so two jobs cannot both pass a cap they would share.
- Repo summaries are cached on the repo row (`summary`, `summarySha`, `summaryCachedAt`) and behind `getOrCreateRepoSummary`. Reuse the summary until the sha changes or the TTL passes. Refreshing a summary is its own job and must pass the cap on its own. Do not hide a second model call inside a job that was reserved once.
- Token totals and estimated spend are shown on the admin Usage page. They are not shown on the customer dashboard. The customer Usage page lists sites, published pages, and builds only.

## What this foundation includes

- Next.js App Router, TypeScript, Tailwind, shadcn.
- Prisma schema and a SQL migration. Apply it with `prisma migrate deploy`. Do not use `db push`.
- Models: users and admin role, GitHub App installations, repos, sites (subdomain, custom domain, branding), pages, jobs, webhook deliveries, chat edits, Worklog entries, plans, subscriptions, usage entries, beta invites, beta applications, feedback.
- Plan rows seeded by the migration: Free $0, Pro $20, Team $200. The billing page hides prices unless `SHOW_PLAN_PRICES=1`.
- Closed beta. `/sign-up` and `/login` offer GitHub or a 6-digit email code. Codes expire in 10 minutes, are stored hashed, and stop after 5 attempts. Resend waits 60 seconds. There are no passwords and no magic links.
- An email can sign in only after it is on `BetaAccess`, or listed in `ADMIN_EMAILS`. Approving a beta application in admin adds a `BetaAccess` row. Emails in `ADMIN_EMAILS` are approved and receive the admin role the next time they sign in, which bootstraps the first admin. An unapproved email sees `/waitlist` and gets no session.
- GitHub and email can share one account when the emails match. A different GitHub account on the same email is refused.
- The install button is on the signed-in Sites page. A GitHub install that arrives without the sign-in cookie does not show "sign-in attempt expired" and does not create sites. It is held, then linked after an approved sign-in if the GitHub account or email matches. An unapproved install never creates sites.
- GitHub App OAuth, setup URL, and `POST /api/webhooks/github`. The app slug defaults to `opentip-copilot` (`GITHUB_APP_SLUG`). The install URL is `https://github.com/apps/opentip-copilot/installations/new`.
- Webhook signature check, idempotent enqueue, uninstall and suspend pause, removed-repo pause, rename, archive, delete, and transfer handling.
- Copilot provider layer, caps, cached summary helper, and `runCopilotJob`.
- Dashboard: Sites, Worklog, Usage, Billing. No credit or token figures on those pages.
- Admin shell for the nine recorded areas. Tips is a placeholder. Takedown tools are not built.
- Public docs on `{subdomain}.opentip.tech` and on `{subdomain}.{APP_HOST}` (so `ledger.beta.opentip.tech` works during beta). Custom domains rewrite to the same renderer.
- Per-site branding, Ledger and Minimal, the corner pill, signed OG images, sitemap, robots.txt, canonical tags, noindex when paused or `Page.noindex`.
- Local preview site at `/sites/sample` when `DATABASE_URL` is unset.
- `AUTH_DEV_BYPASS=1` opens the dashboard in development only. Production ignores it.

## What is stubbed

- The Copilot worker process. Jobs are queued. Nothing runs them on a timer or a container yet. An approved install can create a pending site row, and the worker still has to build it. The webhook enqueues a push only after a repo row exists.
- Chat UI, approvals, and the "failed build keeps the live site" publish step. The skip rule for hand edits is a function the worker must call.
- Email on uninstall, build failure, approval, or domain status. Beta invite email is the only sender, and it no-ops without Resend.
- Paddle checkout. Billing explains that checkout is not connected.
- Tips. No tip button, no tip ledger.
- Custom domain HTTPS provisioning and status polling. The columns exist. The certificate flow does not.
- Worklog composer. The page lists entries.
- Copying /beta applications from the marketing database into `BetaApplication`.
- Docs search, monorepo picker, export, deletion grace period, abuse reports, and `llms.txt`.
- The four unrecorded admin features. They are not guessed.

## Language

User-facing copy does not use an em dash. ETH and USDC are the only assets named for tips.
