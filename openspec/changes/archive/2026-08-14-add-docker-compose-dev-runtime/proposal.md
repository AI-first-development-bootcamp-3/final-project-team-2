# add-docker-compose-dev-runtime

## Why

The spec makes containerization a hard requirement (GENERAL_SPEC §3.3, ADR-18): `docker compose up` is the graded development runtime, and Epic 1's definition of done is "a fresh clone plus one command gives a working local system." Today the repo has the pnpm monorepo scaffold but no way to run Postgres or bring the whole system up with one command — this blocks the Prisma/seed work (needs a database) and every feature epic after it. This change implements Jira KAN-31.

## What Changes

- Add a root `docker-compose.yml` that brings up four services: Postgres 16 (named volume, healthcheck), the NestJS API, and both Vite frontend dev servers (mobile + admin).
- Add a single root `Dockerfile` with per-service build targets (`api`, `admin`, `mobile`) built from the pnpm workspace — images are built locally from pulled source (`docker compose up --build`); no image registry, no bind-mount hot-reload (day-to-day dev stays `pnpm dev` on the host).
- API reads `PORT` from environment instead of the hardcoded `3000` in `server/api/src/main.ts`, and enables CORS for the two frontend origins.
- Both Vite dev servers bind `0.0.0.0` inside containers and get distinct host ports (mobile 5173, admin 5174).
- Committed `.env.example` per service plus a root `.env.example` for compose-level settings (Postgres credentials, port mappings); real `.env` files stay git-ignored.
- README documents `docker compose up --build` as the one-command run.
- API container entrypoint is structured so the Prisma branch (migrate + seed on startup) can slot in later without reshaping the compose setup — `DATABASE_URL` naming agreed now.

## Capabilities

### New Capabilities
- `dev-runtime`: One-command containerized development runtime — what `docker compose up --build` must bring up, how services are wired (ports, env, database), and the env-file contract (`.env.example` committed, `.env` ignored).

### Modified Capabilities

<!-- none — no existing specs in openspec/specs/ yet -->

## Impact

- **New files**: `docker-compose.yml`, `Dockerfile`, `.dockerignore`, root and per-service `.env.example` files.
- **Modified code**: `server/api/src/main.ts` (env-driven port + CORS), `apps/admin/vite.config.ts` and `apps/mobile/vite.config.ts` (host/port for container use), root `README.md`.
- **Dependencies**: teammates need Docker Desktop (or engine + compose v2). No new npm dependencies expected.
- **Coordination**: the in-flight Prisma branch (`Prisma-schema,-first-migration,-and-seed-script`) will consume the Postgres service and `DATABASE_URL` this change defines; the API entrypoint anticipates a later migrate+seed step.
