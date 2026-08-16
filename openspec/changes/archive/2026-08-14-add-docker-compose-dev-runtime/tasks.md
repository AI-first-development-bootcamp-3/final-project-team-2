# Tasks: add-docker-compose-dev-runtime

## 1. Code prerequisites

- [x] 1.1 Make `server/api/src/main.ts` read `PORT` from env (default 3000) and enable CORS with origins from env (default `http://localhost:5173,http://localhost:5174`)
- [x] 1.2 Verify `.gitignore` covers `.env` and `.env.*` variants in root and all service directories (keep `!.env.example`)

## 2. Docker build

- [x] 2.1 Add root `.dockerignore` (node_modules, dist, .git, .env, openspec, docs)
- [x] 2.2 Add root `Dockerfile`: `base` stage (node:22-alpine, corepack pnpm 9, copy root manifests + lockfile + all workspace package.json files + `packages/*`, `pnpm install --frozen-lockfile`, copy source), then `api`, `mobile`, `admin` target stages with their CMDs (`pnpm --filter @abra/api dev`, `pnpm --filter @abra/mobile dev --host 0.0.0.0 --port 5173`, `pnpm --filter @abra/admin dev --host 0.0.0.0 --port 5174` — no `--` separator: pnpm forwards flags itself, and an extra `--` makes Vite ignore them)
- [x] 2.3 Add `server/api/docker-entrypoint.sh` that (for now) just execs the Nest dev command, with a marked seam comment for the future `prisma migrate deploy` + seed step

## 3. Compose stack

- [x] 3.1 Add root `docker-compose.yml`: `postgres` service (postgres:16, named volume `pgdata`, `pg_isready` healthcheck, port `${POSTGRES_PORT:-5432}:5432`, credentials from env)
- [x] 3.2 Add `api` service (build target `api`, entrypoint script, `depends_on: postgres: condition: service_healthy`, port `${API_PORT:-3000}:3000`, env: `PORT`, `DATABASE_URL=postgresql://...@postgres:5432/...`, CORS origins)
- [x] 3.3 Add `mobile` and `admin` services (build targets, ports `${MOBILE_PORT:-5173}:5173` / `${ADMIN_PORT:-5174}:5174`, `VITE_API_URL`, `depends_on: api`)

## 4. Environment examples

- [x] 4.1 Add root `.env.example` (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, host port overrides)
- [x] 4.2 Add `server/api/.env.example` (PORT, DATABASE_URL pointing at `localhost:5432` for host-run dev, CORS_ORIGINS)
- [x] 4.3 Add `apps/mobile/.env.example` and `apps/admin/.env.example` (VITE_API_URL=http://localhost:3000)

## 5. Verify and document

- [x] 5.1 Run `docker compose up --build` from a clean state; confirm all four containers healthy, API answers on 3000, mobile on 5173, admin on 5174, Postgres accepts connections on 5432
- [x] 5.2 Confirm data durability (`docker compose down` + `up` keeps DB data) and reset path (`down -v` clears it)
- [x] 5.3 Update `README.md`: prerequisites (Docker Desktop), copy-env step, `docker compose up --build` as the one-command run, service URL table, DB reset note, and the containers-vs-`pnpm dev` split
