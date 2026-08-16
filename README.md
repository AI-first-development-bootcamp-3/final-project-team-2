# Abra Timesheet — Team 2

Monorepo for the Abra timesheet system: employee app (`apps/mobile`), admin console (`apps/admin`), NestJS API (`server/api`), shared zod contracts (`packages/contracts`) and shared tooling config (`packages/config`).

## Run everything with one command

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose v2). Nothing else — no local Node needed for this path.

```bash
cp .env.example .env
docker compose up --build
```

The defaults in `.env.example` work as-is. `--build` matters: it rebuilds the images from your checked-out code, so freshly pulled changes are picked up.

| Service | URL |
| --- | --- |
| Employee app (mobile) | http://localhost:5173 |
| Admin console | http://localhost:5174 |
| API health | http://localhost:3000/api/v1/health |
| API docs (Swagger) | http://localhost:3000/docs |
| PostgreSQL 16 | localhost:5432 (`abra` / `abra_dev_password` / db `timesheet`) |

All API routes live under the `/api/v1` prefix. The API validates its environment at boot — a missing or malformed variable stops startup with an error naming the key (see `server/api/.env.example`).

Database data lives in a named volume and survives `docker compose down`. To wipe it and start fresh:

```bash
docker compose down -v
```

If a default port is taken on your machine, override it in `.env` (`API_PORT`, `MOBILE_PORT`, `ADMIN_PORT`, `POSTGRES_PORT`).

## Day-to-day development (without containers)

The compose stack is the reproducible "run the whole system" path (and what gets graded). For iterating on code with hot reload, run the workspaces directly:

```bash
pnpm install
docker compose up postgres   # just the database
pnpm dev                     # all workspaces via turbo, or:
pnpm --filter @abra/api dev
pnpm --filter @abra/mobile dev
pnpm --filter @abra/admin dev
```

Requires Node 22+ and pnpm 9 (`corepack enable`). Each service documents its own variables in a committed `.env.example` next to its `package.json`; copy to `.env` and adjust. Real `.env` files are git-ignored — never commit one.

## Running tests

| Kind | Command | Status |
| --- | --- | --- |
| Unit tests | `pnpm test` (all workspaces via turbo) | active — vitest suites in every workspace |
| Unit tests + coverage gate | `pnpm test:coverage` (what CI runs) | active — fails below 70% lines/branches/functions/statements |
| E2E (Playwright) | — | pending the e2e story (smoke specs: app shell renders, health returns 200) |

CI (GitHub Actions) runs Prettier, ESLint, typecheck, the coverage-gated tests and a full build on every PR to `dev`/`staging`/`main` and on pushes to those branches.

## Deployments

Production deploys to Vercel on merge to `main` (three projects: mobile, admin, API as a serverless function). URLs will be filled in when the Vercel CD story ships:

| Target | URL |
| --- | --- |
| Employee app | _pending Vercel CD story_ |
| Admin console | _pending Vercel CD story_ |
| API health | _pending Vercel CD story_ |
| API docs | _pending Vercel CD story_ |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run all workspaces in dev/watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm test` | Run tests across all workspaces |
| `pnpm test:coverage` | Run tests with the 70% coverage gate (CI) |
| `pnpm format` / `format:check` | Prettier write / check |
