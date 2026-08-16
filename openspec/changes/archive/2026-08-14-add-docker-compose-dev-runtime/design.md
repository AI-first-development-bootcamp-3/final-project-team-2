# Design: add-docker-compose-dev-runtime

## Context

pnpm 9 workspace monorepo (Node 22, Turbo) with three runnable services: `server/api` (NestJS, currently hardcodes `app.listen(3000)`), `apps/mobile` and `apps/admin` (Vite + React, both defaulting to port 5173). Shared workspace packages (`packages/config`, `packages/contracts`) mean any service image needs the root lockfile and those packages present at install time. ADR-18 fixes production on Vercel — containers are local-dev only. A parallel branch is adding Prisma (schema + migration + seed); it will introduce the API's real `DATABASE_URL` consumer. Team machines are mostly Windows with the repo often inside OneDrive-synced folders.

## Goals / Non-Goals

**Goals:**

- Reproducible one-command runtime a grader or new teammate can trust.
- Keep images buildable from a plain `git pull` (no registry, no pre-built artifacts).
- Leave a clean seam for the Prisma branch to add migrate + seed on API startup.

**Non-Goals:**

- Hot-reload/watch mode inside containers (bind mounts). Day-to-day development stays `pnpm dev` on the host; developers may point their local API at the compose Postgres.
- Production images, image publishing, or CI usage of these images (CI uses its own service containers per Epic 1).
- Nginx/reverse-proxy, TLS, or any prod-shaped topology.

## Decisions

### D1: Build-from-source images, no bind mounts

`docker compose up --build` builds images from the checked-out code. Alternative considered: bind-mounting the repo for hot reload. Rejected because Windows + OneDrive bind mounts are slow and drop file-change events (watchers need polling), and the graded artifact is "one command brings the system up," not "develop inside Docker." This also keeps Linux `node_modules` fully inside the image, avoiding the host/container binary mismatch entirely.

### D2: Single root Dockerfile, one build target per service

One `Dockerfile` at the repo root with named stages: a shared `base` stage (Node 22 alpine, corepack-enabled pnpm 9, workspace manifests + lockfile, `pnpm install --frozen-lockfile`), then thin `api`, `admin`, `mobile` stages that copy source and set the service CMD. Compose services select via `build.target`. Alternative: three per-service Dockerfiles — rejected because each would duplicate the same workspace-install preamble (root lockfile + `packages/*`), and `pnpm deploy --filter` pruning is overkill for dev-only images. Layer caching of the install stage is shared across all three services.

### D3: Frontends run Vite dev servers in containers

Per the acceptance criteria ("both frontend dev servers"). Vite must bind `0.0.0.0` (container ports are unreachable otherwise) — passed as `--host 0.0.0.0` flags in the container CMD rather than edited into `vite.config.ts`, so host-side `pnpm dev` behavior is untouched. Ports: mobile 5173, admin 5174 (admin overrides via `--port`).

### D4: CORS on the API, no Vite proxy

The API enables CORS for `http://localhost:5173` and `http://localhost:5174` (origins env-configurable). Alternative: Vite `server.proxy` so browsers talk same-origin — rejected because the deployed topology (Vercel static frontends + serverless API) is cross-origin anyway; enabling CORS now matches production behavior and keeps one mental model. Frontends get `VITE_API_URL` so the base URL is explicit and swappable per environment.

### D5: API reads configuration from environment

`server/api/src/main.ts` reads `PORT` (default 3000) and CORS origins from env. `DATABASE_URL` is defined in compose and `.env.example` now — shaped exactly as Prisma expects (`postgresql://user:password@postgres:5432/db`) — even though nothing consumes it until the Prisma branch lands. Hostname is the compose service name `postgres`. This is the coordination contract with that branch; full zod env validation arrives with the Prisma/auth work per Epic 1.

### D6: Compose-level env in a root `.env`

Compose interpolates Postgres credentials and host port mappings from a root `.env` (committed as `.env.example`). Per-service `.env.example` files document what each service itself reads (`server/api/.env.example`: `PORT`, `DATABASE_URL`, CORS origins; frontends: `VITE_API_URL`). Defaults work out of the box so `copy → up` is sufficient.

### D7: Startup ordering via healthcheck

Postgres gets `pg_isready`-based healthcheck; the API uses `depends_on: condition: service_healthy`. The API container runs through a small entrypoint script that today just starts Nest, giving the Prisma branch a single obvious place to prepend `prisma migrate deploy` + seed. Frontends depend only on the API being started (not healthy) — they're static dev servers and tolerate a briefly absent API.

## Risks / Trade-offs

- [No hot reload in containers] → Documented split: containers for the graded run/demo, `pnpm dev` for development. Compose Postgres is usable from host dev via `localhost:5432`.
- [`--build` forgotten after pull, stale images] → README specifies `docker compose up --build` as *the* command, not plain `up`.
- [First build is slow (full workspace install)] → Shared base stage caches the install layer; rebuilds after code-only changes skip reinstall. `.dockerignore` excludes `node_modules`, `dist`, `.git`.
- [Port collisions on dev machines (3000/5173/5174/5432 taken)] → Host-side mappings interpolated from root `.env`, overridable without touching compose.
- [Vite 6 dev server blocks unknown hosts in some setups] → Only `localhost` access is in scope; revisit `server.allowedHosts` only if someone needs LAN access.
- [Prisma branch merges first / diverges on env naming] → `DATABASE_URL` shape agreed in this design and present in `.env.example` from day one; entrypoint seam documented in tasks.

## Migration Plan

Purely additive — no deploy, no data migration. Rollback is deleting the added files and reverting the two small code edits. `docker compose down -v` documented as the database reset.

## Open Questions

- Does `docker compose up` eventually also seed demo data automatically (Epic 1 DoD says "with seeded data")? Owned by the Prisma branch; the entrypoint seam here accepts either answer.
