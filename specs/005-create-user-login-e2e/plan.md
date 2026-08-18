# Implementation Plan: Create User Then Login E2E

**Branch**: `005-create-user-login-e2e` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-create-user-login-e2e/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver Jira KAN-49 (Epic KAN-43): two required Playwright journeys that prove Epic 3 done — (1) admin signs into the console, creates an employee with an initial password, signs out, and that employee signs into the employee app; (2) after an admin deactivates an employee on Users, that person cannot sign into the employee app. Approach: extend the existing `@abra/e2e` harness (start admin console + seed demo org in CI), add two independent specs that drive the real UIs, and keep product login/create/deactivate behavior as prerequisites (KAN-39 / 45 / 46 / 48). This feature does **not** add API endpoints or change user-management rules.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: Playwright 1.52 (`@abra/e2e`), existing Vite admin (5174) + mobile (5173) + NestJS API (3000)

**Storage**: PostgreSQL 16 via Prisma — **read/create/deactivate through the UIs only**. No schema change. Demo seed (`admin@abra.co` / `Admin123!`) must be applied before journeys run.

**Testing**: Playwright Chromium in `@abra/e2e`; existing smoke specs stay; CI job `e2e` remains the required check. No new Vitest coverage target (e2e package is not in the 70% unit-coverage gate).

**Target Platform**: Local + GitHub Actions Ubuntu — composed stack: API + admin console + employee app + Postgres

**Project Type**: Monorepo end-to-end check (cross-app; no new runtime service)

**Performance Goals**: Create-then-login journey finishes in under 3 minutes once apps are up (SC-001). Playwright per-test timeout for these specs: 180s. Existing smoke specs keep the default 30s.

**Constraints**: Drive real UIs (FR-009 / FR-010); do not implement sign-in, create, or deactivate (FR-011); unique email per run (FR-008); two journeys independently runnable (FR-005); Hebrew RTL; never assert password material in the Users table (FR-014)

**Scale/Scope**: Two new Playwright specs + harness changes (admin `webServer`, CI seed, dual origins). Demo org size. No new packages.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **GENERAL_SPEC** + this feature’s FR-011 until a real constitution is adopted.

| Gate                                                             | Status | Notes                                                                         |
| ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| No new product API / no change to user-management rules (FR-011) | PASS   | Plan only adds e2e specs + harness; login/create/deactivate stay KAN-39/46/48 |
| Secrets never in directory or person records (§13.2 / FR-014)    | PASS   | Journeys assert password is absent from Users rows                            |
| Admin-only Users; employee signs into employee app (§5.2 / §7.2) | PASS   | Journey 1 creates role=employee and signs in on mobile                        |
| Unique email among non-deleted (§4.1)                            | PASS   | Unique suffix per run; not a new uniqueness rule                              |
| Required automated check (KAN-34 e2e job)                        | PASS   | New specs run in existing CI `e2e` job; failure fails the job                 |
| No unjustified new packages/services                             | PASS   | Reuse `@abra/e2e`, Playwright Chromium, seed from KAN-32                      |
| Test-first / coverage discipline (§14)                           | PASS   | These _are_ the tests; unit 70% gate unchanged                                |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate                                         | Status | Notes                                                   |
| -------------------------------------------- | ------ | ------------------------------------------------------- |
| No product-behavior change in design         | PASS   | `research.md` treats KAN-39/46/48 as hard prerequisites |
| Journey contract is UI/CI, not a new Zod API | PASS   | `contracts/user-lifecycle-e2e.md`                       |
| Secrets / unique email / independence        | PASS   | Encoded in data-model + contract + quickstart           |
| No unjustified complexity                    | PASS   | Complexity Tracking empty; no new app or auth module    |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-create-user-login-e2e/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
e2e/
├── playwright.config.ts          # ADD admin webServer, ADMIN_BASE_URL, longer timeout for lifecycle specs
├── helpers/                      # NEW: unique email, seed credentials, origin URLs
│   ├── credentials.ts
│   └── unique-email.ts
└── specs/
    ├── app-shell.spec.ts         # unchanged smoke
    ├── health.spec.ts            # unchanged smoke
    ├── create-then-login.spec.ts # NEW: US1
    └── deactivated-cannot-login.spec.ts # NEW: US2

.github/workflows/ci.yml          # ADD prisma db seed after migrate

server/api/prisma/seed.ts         # unchanged; invoked from CI
apps/admin/                       # not modified by this feature (KAN-39 owns sign-in/logout)
apps/mobile/                      # not modified by this feature (KAN-39 owns real login)
```

**Structure Decision**: Keep all new automated checks in the existing `@abra/e2e` package. No new top-level app. Product code changes for login/logout are **out of scope** here and must already exist (KAN-39) for the journeys to pass.

## Complexity Tracking

> No constitution violations requiring justification.
