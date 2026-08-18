# Abra Timesheet — Team 2

Monorepo for the Abra timesheet system: employee app (`apps/mobile`), admin console (`apps/admin`), NestJS API (`server/api`), shared zod contracts (`packages/contracts`) and shared tooling config (`packages/config`).

## Run everything with one command

Prerequisites: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose v2). Nothing else — no local Node needed for this path.

```bash
cp .env.example .env
docker compose up --build
```

The defaults in `.env.example` work as-is. `--build` matters: it rebuilds the images from your checked-out code, so freshly pulled changes are picked up.

| Service               | URL                                                            |
| --------------------- | -------------------------------------------------------------- |
| Employee app (mobile) | http://localhost:5173                                          |
| Admin console         | http://localhost:5174                                          |
| API health            | http://localhost:3000/api/v1/health                            |
| API docs (Swagger)    | http://localhost:3000/docs                                     |
| PostgreSQL 16         | localhost:5432 (`abra` / `abra_dev_password` / db `timesheet`) |

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

**Important:** The API requires a `DATABASE_URL` environment variable pointing to a running PostgreSQL instance. Without it, the server will refuse to start.

## Running tests

| Kind                       | Command                                | Status                                                                                                  |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Unit tests                 | `pnpm test` (all workspaces via turbo) | active — vitest suites in every workspace                                                               |
| Unit tests + coverage gate | `pnpm test:coverage` (what CI runs)    | active — fails below 70% lines/branches/functions/statements                                            |
| E2E (Playwright)           | `pnpm test:e2e`                        | active — app shell, health, create-then-login, deactivated-cannot-login, catalog-chain (`entity-chain`) |

### Running E2E tests locally

Prerequisites: a running PostgreSQL instance (e.g. `docker compose up postgres`) with **migrations and seed** applied so the demo admin exists:

```bash
pnpm --filter @abra/api exec prisma migrate deploy
pnpm --filter @abra/api exec prisma db seed
```

Playwright starts the API (3000), employee app (5173), and admin console (5174). Seed admin: `admin@abra.co` / `Admin123!`.

```bash
pnpm install                 # installs all workspaces including e2e
pnpm test:e2e                # starts API + mobile + admin, runs Playwright specs
```

The required check discovers these specs:

1. `app-shell` — unsigned-in employee app shell
2. `health` — API `GET /health` returns 200
3. `create-then-login` — admin creates an employee → signs out → that employee signs into the employee app
4. `deactivated-cannot-login` — admin deactivates a (new) employee → employee-app sign-in is refused
5. `entity-chain` (catalog-chain) — admin creates client → project → task → assignment on the console, then picker data is exactly that chain (`GET /me/assignments`); the seeded unassigned employee does not see the new task

Playwright browsers are installed automatically on first run. To install them manually:

```bash
pnpm --filter @abra/e2e exec playwright install --with-deps chromium
```

CI (GitHub Actions) runs Prettier, ESLint, typecheck, the coverage-gated tests, a full build, and E2E Playwright specs on every PR to `dev`/`staging`/`main` and on pushes to those branches.

## Deployments

Production deploys to Vercel on push to `dev` (three projects: mobile, admin, API as a serverless function). PR previews are deployed automatically. URLs will be filled in when the Vercel CD story ships:

| Target        | URL                       |
| ------------- | ------------------------- |
| Employee app  | _pending Vercel CD story_ |
| Admin console | _pending Vercel CD story_ |
| API health    | _pending Vercel CD story_ |
| API docs      | _pending Vercel CD story_ |

## Scripts

| Command                        | What it does                                |
| ------------------------------ | ------------------------------------------- |
| `pnpm dev`                     | Run all workspaces in dev/watch mode        |
| `pnpm build`                   | Build all workspaces                        |
| `pnpm lint`                    | ESLint across all workspaces                |
| `pnpm typecheck`               | `tsc --noEmit` across all workspaces        |
| `pnpm test`                    | Run tests across all workspaces             |
| `pnpm test:coverage`           | Run tests with the 70% coverage gate (CI)   |
| `pnpm test:e2e`                | Run Playwright E2E specs (needs running DB) |
| `pnpm format` / `format:check` | Prettier write / check                      |
