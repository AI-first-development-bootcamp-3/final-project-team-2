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
| API | http://localhost:3000 |
| PostgreSQL 16 | localhost:5432 (`abra` / `abra_dev_password` / db `timesheet`) |

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

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run all workspaces in dev/watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm test` | Run tests across all workspaces |
| `pnpm format` / `format:check` | Prettier write / check |
