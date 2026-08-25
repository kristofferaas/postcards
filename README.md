# Post Cards

A pnpm and Turborepo monorepo containing:

- `apps/mobile`: an Expo React Native app
- `apps/server`: the Effect API and its Alchemy v2 Cloudflare Stack

## Requirements

- Node.js 22 or newer
- pnpm 10.24.0
- an Alchemy Cloudflare profile created by `alchemy login` or the first deploy

## Install

```sh
pnpm install
```

## Local development

Start the API Worker in Alchemy's local development runtime:

```sh
pnpm dev:server
```

`alchemy dev` runs the Worker locally at `http://localhost:3000`, and the D1
database and R2 bucket use Alchemy's local providers. Stack metadata uses the
shared Cloudflare state store, while emulated resource data remains under the
ignored `apps/server/.alchemy` directory.

In another terminal, start the mobile app:

```sh
pnpm dev:mobile
```

The mobile app uses `http://localhost:3000` on the iOS simulator and
`http://10.0.2.2:3000` on the Android emulator by default. Set
`EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to use a deployed Worker or a
physical device.

Passkeys use the API hostname as their relying-party ID. Set
`EXPO_PUBLIC_PASSKEY_RP_ID` only when the relying-party ID differs from that
hostname. Local iOS builds use Apple's `localhost` associated-domain developer
mode.

## Cloudflare resources

The Alchemy Stack owns:

- one R2 bucket for postcard images
- one D1 database for postcard designs and sent postcards
- one Worker that preserves `/health`, `/blobs/*`, and `/rpc`

D1 migrations live in `apps/server/migrations` and are applied by Alchemy during
deployment.

Review and deploy the Stack from `apps/server`:

```sh
pnpm alchemy plan
pnpm alchemy deploy
```

After deployment, point the mobile app at the returned `workerUrl`. To seed the
deployed API with the bundled development postcard fixture, pass that URL and
an authenticated Better Auth cookie explicitly:

```sh
POSTCARDS_SESSION_COOKIE='better-auth.session_token=...' \
  pnpm data:seed -- https://your-worker.workers.dev
```

The seed is idempotent. It uploads the fixture images through `POST /blobs` and
creates the design and sent-postcard records through the existing RPC API.

## API

- `GET /health` returns service status.
- `GET /.well-known/apple-app-site-association` associates the iOS app with
  the passkey relying-party domain.
- `GET /.well-known/assetlinks.json` associates signed Android builds with the
  same domain.
- `/api/auth/*` serves passkey registration, authentication, and sessions.
- `POST /blobs` stores image bytes with a supported image `Content-Type`.
- `GET /blobs/:key` returns immutable image content.
- `/rpc` serves the postcard Effect RPC group used by the mobile app.

`POST /blobs` and `/rpc` require a Better Auth session. Sent postcards are
scoped to the authenticated user.

## Passkey deployment configuration

Production deploys require these GitHub Actions repository or environment
variables:

- `APPLE_TEAM_ID`: the ten-character Apple Developer Team ID. The Worker uses
  it to return `<TeamID>.com.kristofferaas.postcards` from the AASA endpoint.
- `ANDROID_CERT_FINGERPRINTS`: one or more SHA-256 signing-certificate
  fingerprints separated by commas. Include every certificate that may sign
  an installed build, such as EAS and Google Play App Signing certificates.

The EAS `production` environment also needs:

- `EXPO_PUBLIC_API_URL`: the production Worker URL.
- `APPLE_TEAM_ID`: the same Apple Developer Team ID.
- `EXPO_PUBLIC_PASSKEY_RP_ID`: optional when it is the same as the API
  hostname.

The Worker refuses a production deploy when either platform association value
is missing. Non-production builds use `FAKETEAMID` when no Apple Team ID is
provided, which keeps simulator-only native projects configurable. Verify the
deployed responses with:

```sh
curl https://your-worker.workers.dev/.well-known/apple-app-site-association
curl https://your-worker.workers.dev/.well-known/assetlinks.json
```

## Checks

```sh
pnpm check
pnpm --filter @post-cards/server test
pnpm lint
```

Run the full Stack against Alchemy's local Worker, R2, and D1 emulators with:

```sh
pnpm --dir=apps/server test:integration
```

The tracked iOS passkey UI test can be added to a generated native project
after `expo prebuild`:

```sh
pnpm --filter @post-cards/mobile test:ios:passkey:configure
```

Start Expo with an HTTPS Worker whose hostname matches the generated app's
web-credentials entitlement, then run:

```sh
EXPO_PUBLIC_API_URL=https://your-worker.workers.dev \
  pnpm --filter @post-cards/mobile test:ios:passkey
```

Set `IOS_SIMULATOR_ID` to choose a simulator; otherwise the command uses the
booted device. It supplies matching Face ID events and covers registration,
sign-out, and passkey sign-in.

## GitHub Flow and deployments

Development follows GitHub Flow: create a short-lived branch, open a pull
request, and merge it into `main` after checks pass.

The `Deploy` GitHub Actions workflow:

- checks types, lint, and unit tests on pull requests and `main`
- deploys same-repository pull requests to an isolated `pr-N` Cloudflare stage
- posts or updates the preview Worker URL on the pull request
- runs live Worker, R2, and D1 integration tests against each preview
- destroys the preview when the pull request closes or becomes a draft
- deploys `main` automatically to the `prod` stage and verifies production
  health plus D1 reads

Production R2 and D1 resources use Alchemy's retain removal policy. Preview
data remains disposable and is removed with its preview Stack.

CI credentials are managed by `apps/server/stacks/github.ts`. That Stack mints
a scoped Cloudflare token, writes the token and account ID directly to GitHub
Actions secrets, and creates a `production` GitHub environment restricted to
`main`. It is deployed manually from a dedicated admin profile:

```sh
pnpm --dir=apps/server exec alchemy login --profile admin
pnpm --dir=apps/server exec alchemy deploy stacks/github.ts --profile admin
```

Alchemy stores this login in its profile store. The application and workflow
do not require Cloudflare credentials in local environment files.
