# add-swagger-env-validation-readme

## Why

Swagger and the README are graded deliverables that the spec wants growing with every epic, not written at the end (Epic 1 §6); env validation at boot is the guard that turns misconfiguration into a clear startup error instead of a runtime failure at first request. Doing this now — while the API has exactly one endpoint — also lets us adopt the spec's mandatory `/api/v1` route prefix (GENERAL_SPEC §6.1) as a one-line change instead of a breaking sweep later. This change implements Jira KAN-36.

## What Changes

- **BREAKING (path)**: API adopts the global `/api/v1` prefix; health moves from `/health` to `/api/v1/health`. The e2e smoke story and any teammate referencing bare `/health` must use the new path (coordinated — nothing merged consumes it yet).
- Swagger UI served at `/docs`, auto-generated from NestJS decorators via `@nestjs/swagger`, documenting the health endpoint; `/api/v1/docs` redirects to `/docs` so both the ticket AC and GENERAL_SPEC §6.11 hold.
- API validates environment variables at boot with zod, before Nest is created: `PORT` and `CORS_ORIGINS` with defaults, `DATABASE_URL` shape-checked when present (flips to required when the Prisma work consumes it). Invalid or missing required config exits immediately with an error naming the offending keys.
- README grows the remaining graded sections: deployment URLs and how-to-run-tests, structured now with explicit "pending" markers where the CI (KAN-33/34) and Vercel (KAN-35) stories haven't shipped, plus the `/docs` and new health URLs.

## Capabilities

### New Capabilities

- `api-docs`: Swagger/OpenAPI documentation — where it's served, what it documents, how it stays current.
- `env-validation`: fail-fast environment validation at API boot — what's validated, what happens on bad config.

### Modified Capabilities

- `dev-runtime`: the documented service URLs change — API routes now live under `/api/v1` (health at `/api/v1/health`), and the README's run documentation grows deployment/test sections.

## Impact

- **Modified code**: `server/api/src/main.ts` (prefix, Swagger setup, env parse), `server/api/src/app.controller.ts` (Swagger decorators), new `server/api/src/env.ts`, `server/api/package.json` (add `@nestjs/swagger`, `zod`), `README.md`.
- **Dependencies**: `@nestjs/swagger` (^8 for Nest 10) and `zod` (^3, matching `packages/contracts`) added to `server/api` only — env schema is server-private and deliberately not in `packages/contracts`.
- **Coordination**: e2e smoke spec (health path), PR #6 (base branch — this work branches off `feat/kan-31-docker-compose` since both touch `main.ts`/README; PR targets `dev` after #6 merges). Frontends unaffected: `VITE_API_URL` stays a base URL; calls use `${VITE_API_URL}/api/v1/...`.
