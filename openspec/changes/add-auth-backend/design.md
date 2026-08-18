# Design: add-auth-backend

## Context

The NestJS API lives in `server/api` with a global `/api/v1` prefix, zod env validation in `src/env.ts`, and Prisma with a `User` model that already carries `password_hash`, `token_version`, and `is_active` (bcrypt is already a dependency, seeded users exist). Shared zod schemas live in `packages/contracts`. Playwright e2e infrastructure (KAN-34) is merged: `e2e/specs/*` run in CI against the dev stack. The login UI (KAN-38) is in review on its own branch; this change builds the backend it will call. See `proposal.md` for motivation.

Working agreements for this change: strict TDD (red → green per slice), one commit per subtask, one PR per Jira task, branched off `dev`.

## Goals / Non-Goals

**Goals:**

- Auth endpoints, token lifecycle, and guards exactly as specified in `specs/auth/spec.md`, implemented so later epics only add `@Roles`/`@Auth` decorators to new controllers.
- Admin portal login screen (KAN-70): the designed visuals of Figma node 1-32908 stay untouched; only the card content changes to email + password + זכור אותי, reusing `LoginSchema` and `VAL_MESSAGES` from `packages/contracts` — one schema, two apps.
- Guard logic unit-tested to near-100% (GENERAL_SPEC §14.2 priority 1); overall coverage stays ≥70%.
- Each Jira task independently reviewable and mergeable: KAN-39 → KAN-40 → KAN-70 → KAN-41 → KAN-42 stack in that order (KAN-70 needs the login endpoint from KAN-39; KAN-41's global guards land after both frontends can authenticate; KAN-42 verifies last).

**Non-Goals:**

- Mobile login UI (KAN-38, in review separately); the Figma design revision itself for the admin card (designer's task — KAN-70 builds to the agreed field list without waiting for updated frames); password reset / user CRUD (Epic 3); forgot-password, SSO, rate limiting, account lockout (out of epic scope).
- Fixing the stale Confluence §3 route-matrix wording (docs task, tracked outside this change).

## Decisions

- **`@nestjs/jwt` over raw `jsonwebtoken`**: first-class Nest DI/testing integration, same underlying library. Two secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) so access and refresh tokens can never be confused for each other.
- **Refresh token is itself a JWT** carrying `{ userId, tokenVersion }` with its own expiry — revocation is a single integer compare against the User row, no token table. Alternative (DB-stored opaque tokens) rejected: more state, no requirement needs it.
- **Remember-me lives in the refresh token's own expiry claim** and the cookie `Max-Age`, both set at login from the validated request body. Refresh does not extend the session beyond the original horizon (no sliding window) — matches KAN-40's "enforced server-side" wording with the simplest model.
- **Guards are global providers** (`APP_GUARD`: JwtGuard then RolesGuard) with `@Public()` as the opt-out, rather than per-controller decoration. Secure by default: a new controller added later is protected even if its author forgets the decorators. This flips existing routes (health, hello) to protected — health stays `@Public()` so CI/deploy checks keep working.
- **`is_active` check queries the user inside JwtGuard** on every request. Costs one indexed PK lookup per request; required by the spec ("deactivated user rejected on next request"), so statelessness is deliberately traded away here and only here.
- **Contracts own the wire shapes**: `LoginRequest` (email VAL-01/02, password VAL-03/04, `rememberMe` boolean default false), `LoginResponse`/`RefreshResponse` (`accessToken`, user summary) in `packages/contracts`, reused by KAN-38's form and validated in the controller via a zod validation pipe.
- **e2e spec drives the deployed login page** (KAN-38's `/login` in the employee app) with seeded credentials from `prisma/seed.ts`; it asserts landing on daily-report home and the Hebrew error text. If KAN-38 has not merged when KAN-42 starts, the spec is written against the agreed route/test-ids and marked `fixme` until the UI lands — the API-level login behaviors are already covered by Vitest integration tests in KAN-39.

**TDD seams** (tests live only at these public boundaries):

1. HTTP surface of the auth module — supertest against the Nest app: login/refresh/logout status codes, bodies, `Set-Cookie` attributes.
2. Guard behavior via minimal test controllers (`@Public`/`@Auth`/`@Roles`) — not guard internals.
3. Token service time behavior — fake timers around expiry claims.
4. Env schema — parse failures name the missing secret.
5. Browser login flow — Playwright.

## Risks / Trade-offs

- [Global guards break existing unauthenticated consumers (frontends, smoke checks)] → land KAN-41 last of the API PRs, keep health `@Public()`, coordinate with the KAN-38 branch so the UI ships with token handling before guards go global.
- [KAN-42 depends on KAN-38's merged UI] → resolved by sequencing (decided 17 Aug 2026): KAN-38 merges before this change starts, so the e2e spec targets the real UI; the `fixme` fallback remains only as contingency if KAN-38 is reverted.
- [Per-request `is_active` DB lookup adds latency] → single PK lookup, acceptable at this scale; revisit with a short-TTL cache only if measured.
- [Cookie `SameSite=Strict` can break cross-site local setups (Vite dev server on another port)] → dev runs same-site via the compose stack / Vite proxy; document in the PR if a dev-only `Lax` override is needed.
- [Secrets misconfigured in Vercel/CI] → env schema fails startup naming the variable (spec'd); `.env.example` documents both.

## Migration Plan

1. PRs merge to `dev` in order: KAN-39 (endpoints, contracts, env secrets) → KAN-40 (durations) → KAN-70 (admin portal login screen) → KAN-41 (global guards — the only behaviorally breaking step) → KAN-42 (e2e in required CI check).
2. Before KAN-41 merges: `JWT_SECRET`/`JWT_REFRESH_SECRET` set in GitHub Actions secrets and Vercel; KAN-38 UI merged or feature-flagged.
3. Rollback: revert the offending PR; tokens are stateless so no data migration in either direction (`token_version` column already exists).

## Open Questions

- Exact Hebrew copy for the login error and session-expired messages — final wording can land with KAN-38 review without changing specs or tasks.
