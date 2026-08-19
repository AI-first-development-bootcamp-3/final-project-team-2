# Implementation Plan: Fix Admin Logout Relogin

**Branch**: `008-fix-admin-logout` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-fix-admin-logout/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Fix Jira [KAN-116](https://nadav40450.atlassian.net/browse/KAN-116): logging out of the admin console immediately signs the admin back in. Root cause: sidebar **התנתקות** only clears the in-memory session and full-page navigates to `/login`, so `bootstrapSession()` rebuilds the session from the still-valid httpOnly refresh cookie and `RedirectIfAdmin` bounces them into the console. Approach: both Logout controls call existing `POST /api/v1/auth/logout` and ignore in-flight refresh; make logout idempotent when the access token is dead (identify via refresh cookie, always clear the cookie); prove with Vitest plus Playwright `e2e/specs/admin-logout.spec.ts`. Employee-app sign-out is out of scope.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: NestJS API (`@abra/api`), Vite React admin (`@abra/admin`), Playwright (`@abra/e2e`), Vitest + Testing Library

**Storage**: PostgreSQL 16 via Prisma — **no schema change**. Reuse `User.token_version` and cookie `refresh_token`. Demo seed admin `admin@abra.co` / `Admin123!` required for e2e.

**Testing**: Vitest in `@abra/admin` and `@abra/api`; Playwright Chromium in `@abra/e2e`. New spec `admin-logout.spec.ts` joins the existing CI `e2e` job. No new coverage-gate package.

**Target Platform**: Local + GitHub Actions Ubuntu — admin console (5174) + API (3000) + Postgres; employee app unused for this journey

**Project Type**: Monorepo bugfix (admin UI + auth API + e2e). No new service or package.

**Performance Goals**: Logout lands on sign-in without automatic re-admission within the existing UI; SC-002 wait ≥ 10s; SC-004 re-login within 30s. Playwright timeout for this spec: 60s (not the 240s catalog-chain budget).

**Constraints**: Admin console only (spec); do not add a new Logout control; Hebrew RTL labels stay `התנתקות` / `התנתק`; session remains in-memory (no web storage); cookie stays httpOnly; remember-me must not restore after Logout (FR-006)

**Scale/Scope**: Sidebar + shared `logout()` helper, `POST /auth/logout` hardening, a handful of unit tests, one Playwright file. Demo org. No CI workflow change.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **existing auth / admin-shell specs** and this feature’s FRs until a real constitution is adopted.

| Gate | Status | Notes |
| ---- | ------ | ----- |
| Logout clears session and shows sign-in (admin-shell) | PASS | Plan wires sidebar to API logout + redirect |
| Refresh after logout is 401 (auth spec) | PASS | Client calls logout; server still bumps `token_version` and clears cookie |
| In-memory session only (KAN-70) | PASS | No web-storage session; durable credential remains httpOnly cookie |
| Admin console only | PASS | Employee app unchanged |
| No unjustified new packages/services | PASS | Reuse `@abra/admin`, `@abra/api`, `@abra/e2e` |
| Test-first / required e2e check | PASS | Vitest regressions + Playwright in existing `e2e` job |
| No schema / no new product APIs | PASS | Same `POST /auth/logout` path; semantics widened to stay 204 when access JWT is dead |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate | Status | Notes |
| ---- | ------ | ----- |
| Root cause addressed in design | PASS | `research.md` §1–2: sidebar skipped API logout |
| Refresh race and dead access token covered | PASS | `research.md` §3–4; contract tables |
| Proof is cookie-aware e2e + unit | PASS | `contracts/admin-logout.md` + `quickstart.md` |
| No unjustified complexity | PASS | Complexity Tracking empty; no new app; one helper; one e2e file |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-fix-admin-logout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/admin/src/
├── components/layout/admin-sidebar.tsx      # Sidebar התנתקות → logout then /login
├── components/layout/admin-sidebar.spec.tsx
├── features/users/users-page.tsx            # התנתק uses the same helper
├── lib/api.ts                               # logout(); ignore in-flight refresh
├── lib/api/client.ts                        # redirectToSignIn; 401 interceptor
├── lib/auth.ts                              # in-memory session
├── lib/session.spec.ts                      # bootstrap / refresh / logout races
└── App.tsx                                  # bootstrapSession; RedirectIfAdmin

server/api/src/auth/
├── auth.controller.ts                       # POST /auth/logout idempotent 204
├── auth.service.ts                          # token_version increment
├── auth.constants.ts                        # cookie clear options (existing)
└── auth.spec.ts                             # logout with cookie only / no tokens

e2e/
├── specs/admin-logout.spec.ts               # NEW — sidebar logout journey
└── helpers/users-directory.ts               # signOutAdmin unchanged (Users התנתק)
```

**Structure Decision**: Existing admin + API + e2e layout. No new packages. Primary UI change is `admin-sidebar.tsx`; primary API change is `auth.controller.ts` logout identity (Bearer **or** refresh cookie). Playwright adds one spec file under `e2e/specs/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None. Logout already exists; this change uses it from the sidebar and closes the dead-access-token hole so remount cannot restore a revoked session.
