# Post Cards

A pnpm and Turborepo monorepo containing:

- `apps/server`: a Node.js HTTP server built with Effect v4
- `apps/mobile`: an Expo React Native app

## Requirements

- Node.js 22 or newer
- pnpm 10.24.0

## Get started

```sh
pnpm install
pnpm dev
```

Run one app at a time:

```sh
pnpm dev:server
pnpm dev:mobile
```

The server listens on `http://localhost:3000`. Its health check is available at
`http://localhost:3000/health`.

The server stores data in `apps/server/data/post-cards.sqlite` by default. Set
`DATABASE_PATH` to use a different SQLite file.

Create the development sample data explicitly:

```sh
pnpm db:seed
```

Seeding never runs during server startup and refuses to run when
`NODE_ENV=production`. The postcards are available from
`GET http://localhost:3000/postcards`.

The mobile app uses that address by default on the iOS simulator, and
`http://10.0.2.2:3000` on the Android emulator. For a physical device, copy
`apps/mobile/.env.example` to `apps/mobile/.env` and set
`EXPO_PUBLIC_API_URL` to your computer's LAN address.

## Commands

```sh
pnpm build
pnpm check
pnpm lint
```
