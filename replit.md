# Lock Screen Simulation

An Android-compatible, self-contained lock screen simulation with configurable demo unlock behavior and locally saved settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `pnpm --filter @workspace/lock-screen-simulation run typecheck` — check the mobile app

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lock-screen-simulation/app/index.tsx` — lock screen, hidden setup, and demo home flows
- `artifacts/lock-screen-simulation/constants/colors.ts` — app color tokens
- `artifacts/lock-screen-simulation/assets/images/icon.png` — generated app icon
- Settings are stored locally with AsyncStorage; the API server is not used by this app.

## Architecture decisions

- This app is intentionally frontend-only and stores simulation settings on-device.
- The lock screen never reads, submits, or changes actual Android credentials.
- Wallpaper access is best-effort through an optional native `WallpaperModule`; the app uses a neutral fallback when it is unavailable.
- The hidden setup entry point is three consecutive taps on `0`, with an 800ms inter-tap timeout.

## Product

The app presents a premium, portrait lock screen simulation with numeric PIN entry, configurable attempt-based opening, a hidden triple-tap settings screen, local persistence, optional wallpaper refresh, and a clearly labeled demo home screen.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
