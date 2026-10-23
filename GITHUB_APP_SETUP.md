# Register the Opentip Copilot GitHub App

Create this app on the OpentipHQ organization. One app handles sign-in and repository webhooks.

The name Opentip is reserved by another GitHub account. Register the app as Opentip Copilot. The slug is `opentip-copilot`.

Open: https://github.com/organizations/OpentipHQ/settings/apps/new

Install URL, after the app exists: https://github.com/apps/opentip-copilot/installations/new

## App settings

| Field | Value |
| --- | --- |
| GitHub App name | Opentip Copilot |
| GitHub App slug | opentip-copilot |
| Description | Writes docs for a repository and updates them on every push. |
| Homepage URL | https://beta.opentip.tech |
| Callback URL | https://beta.opentip.tech/api/auth/github/callback |
| Setup URL | https://beta.opentip.tech/api/github/setup |
| Redirect on update | Checked |
| Expire user authorization tokens | Checked |
| Request user authorization (OAuth) during installation | Checked |
| Enable Device Flow | Unchecked |
| Webhook Active | Checked |
| Webhook URL | https://beta.opentip.tech/api/webhooks/github |
| Webhook secret | A long random string. Store it as `GITHUB_WEBHOOK_SECRET`. |
| Webhook content type | application/json |
| SSL verification | Enabled |
| Where can this GitHub App be installed? | Any account |

After you type the name, confirm GitHub saved the slug as `opentip-copilot`. The install URL uses that slug. The product name stays Opentip. The GitHub App name is Opentip Copilot.

## Permissions

Repository permissions:

- Contents: Read-only. Copilot reads the repo to write docs.
- Metadata: Read-only. GitHub requires this.
- Pull requests: Read and write. A later phase opens a pull request to export docs. Request it now so installed users are not prompted again.

Account permissions:

- Email addresses: Read-only. Sign-in uses the primary verified email when GitHub has one.

Organization permissions: none.

Leave every other permission at No access.

## Events

Subscribe to:

- Installation
- Installation repositories
- Push
- Repository

Those events cover install, uninstall, repo added or removed, push, rename, transfer, archive, and delete.

## After you create the app

1. Copy the App ID into `GITHUB_APP_ID`.
2. Generate a private key. Put the PEM in `GITHUB_APP_PRIVATE_KEY` with newlines written as `\n`. Do not commit the `.pem` file.
3. Copy the Client ID into `GITHUB_CLIENT_ID`.
4. Generate a client secret into `GITHUB_CLIENT_SECRET`.
5. Create a Neon database for this app on the Free plan. It is separate from the marketing site `BETA_DATABASE_URL`. Put the connection string in `DATABASE_URL`. Use a direct connection for migrations.
6. Create the other secrets in `.env.example`: `XAI_API_KEY`, `GROQ_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `OG_SIGNING_SECRET`, and `SESSION_SECRET`.
7. Set those variables on the host for beta.opentip.tech.
8. From this repo, run `npx prisma migrate deploy`.
9. Install the app on one test repository from https://github.com/apps/opentip-copilot/installations/new. GitHub sends the browser to the setup URL with `code`, `installation_id`, and `setup_action`, and no sign-in cookie. The app checks that this GitHub user can access that installation, holds the install, and sends them to log in. It does not show "The sign-in attempt expired." Sites are created only after an approved account signs in and the install matches that account. An email that is not on the beta list goes to the waitlist and no sites are created.
10. Push a commit. The webhook should return 200. A second delivery of the same event must not create a second job. Uninstalling the app pauses the site. It does not delete it.

Local webhook checks need a public tunnel to `http://localhost:3000/api/webhooks/github` and a real `DATABASE_URL`. Without a database the route still checks the signature, answers ping, and returns 503 for other events.

The marketing site at opentip.tech is a different app. Do not point this GitHub App at that project.
