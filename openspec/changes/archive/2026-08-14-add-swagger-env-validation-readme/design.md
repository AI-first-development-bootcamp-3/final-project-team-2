# Design: add-swagger-env-validation-readme

## Context

The API (NestJS 10) has one endpoint, `GET /health` in `app.controller.ts`, no route prefix, and env handling recently moved to env-driven `PORT`/`CORS_ORIGINS` reads in `main.ts` (KAN-31, PR #6 — unmerged). GENERAL_SPEC §6.1 mandates `/api/v1/{resource}`; §6.11 puts Swagger at `/api/v1/docs`; the Jira AC and Epic 1 page say `/docs`. The CI story (Vitest/Playwright) and Vercel CD story haven't produced code yet, but the README must carry their sections as graded deliverables. `packages/contracts` holds zod ^3 for shared domain schemas.

## Goals / Non-Goals

**Goals:**

- Adopt the `/api/v1` prefix while it's a one-endpoint change.
- Swagger that grows automatically with future modules — zero per-epic doc debt.
- Env misconfiguration fails at boot, in one obvious place, with actionable output.

**Non-Goals:**

- No `@nestjs/config`/ConfigModule yet — one env consumer doesn't justify the pattern; revisit when auth/Prisma multiply consumers.
- No auth on `/docs` (dev-graded artifact; production exposure is decided in the Vercel story).
- No JWT/Blob/Neon variables — they enter the schema with the stories that consume them.
- Not filling deployment URLs or e2e instructions with invented values.

## Decisions

### D1: Global prefix now, health moves

`app.setGlobalPrefix('api/v1')` in `main.ts`; health becomes `/api/v1/health`. Alternative — exclude health from the prefix as a bare infrastructure endpoint — rejected: one convention with no exceptions is easier to hold, nothing merged consumes `/health`, and the e2e smoke story (unstarted) can target the final path from day one. PR #6's compose stack needs no change (it maps ports, not paths).

### D2: Swagger UI at `/docs`, spec path redirects

`SwaggerModule.setup('docs', ...)` plus a redirect from `/api/v1/docs` to `/docs`. Satisfies the ticket AC and Epic 1 page literally and GENERAL_SPEC §6.11 functionally, instead of picking a winner between contradicting documents. `@nestjs/swagger` ^8 (Nest 10 line). The document builds from decorators at boot, so new modules appear without doc work; the health endpoint gets explicit `@ApiOkResponse` decoration as the exemplar.

### D3: Env schema is server-private, parsed pre-bootstrap

New `server/api/src/env.ts`: zod schema + `parseEnv()` called at the top of `bootstrap()` before `NestFactory.create`. zod goes into `server/api` dependencies directly — not imported from `packages/contracts`, whose charter (folder structure §3.2) is shared domain schemas consumed by frontends; server config shape must not leak there. On failure: print zod's flattened issues (variable name + expected format) and `process.exit(1)`. Typed result is passed to the rest of `main.ts` — no raw `process.env` reads survive outside `env.ts`.

### D4: Required-vs-optional split follows consumption

`PORT` (coerced number, default 3000) and `CORS_ORIGINS` (comma-list, default both localhost frontends) stay optional-with-defaults. `DATABASE_URL` is `optional()` but shape-checked when present (`postgresql://` URL) — the API doesn't consume it yet; the Prisma PR flips it to required when it does. This keeps "boot with no env" working (CI, fresh clones) while still catching typos in compose/`.env` immediately.

### D5: README pending markers name their tickets

Deployment URLs and e2e sections are written as structured placeholders naming the blocking story (Vercel CD / CI-Playwright), so graders read intent rather than omission. Unit tests documented as `pnpm test` (turbo) — currently a no-op per workspace, which the CI story changes.

## Risks / Trade-offs

- [Health path change breaks references to bare `/health`] → Grep repo + PR #6 description; only docs/test-plan text references exist today. Team ping so the e2e story targets `/api/v1/health`.
- [Stacked branch: PR #6 rejected or heavily amended] → This branch rebases onto whatever #6 becomes; conflicts are confined to `main.ts`/README, both small.
- [`@nestjs/swagger` major drift vs Nest 11 upgrade later] → Pinned caret range; upgrade rides the framework upgrade.
- [Redirect for `/api/v1/docs` bypassed by global prefix ordering] → Register the redirect as an explicit route/middleware after prefix setup; verify both paths in the task list.
- [Contradiction resolution (D2) surprises a teammate reading GENERAL_SPEC] → Called out in PR description; both paths work, so no one is wrong.

## Migration Plan

Additive except the health path. Sequence: branch off `feat/kan-31-docker-compose` → implement → verify in compose (`/api/v1/health`, `/docs`, boot-failure cases) → PR into `dev` after #6 merges. Rollback = revert the single PR; no data or deploy surface.

## Open Questions

- Should `/docs` be disabled or protected in the eventual Vercel production deployment? Owned by the Vercel CD story (GENERAL_SPEC says "available in development"; production posture is that story's call).
