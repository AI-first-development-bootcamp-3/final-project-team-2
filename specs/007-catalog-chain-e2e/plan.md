# Implementation Plan: Full Catalog Chain E2E

**Branch**: `007-catalog-chain-e2e` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-catalog-chain-e2e/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver Jira KAN-54 (Epic KAN-44): one required Playwright journey that proves Epic 4’s catalog done — an admin signs into the console, creates a client, a project under it, a task under that project, and assigns a dedicated employee — all on the console screens — then that employee’s picker data contains **exactly** that chain, and an unassigned employee does not see the new task. Approach: rewrite the skipped API-only `e2e/specs/entity-chain.spec.ts` to drive the real admin UI, reuse the existing `@abra/e2e` harness (admin 5174 + CI seed already present), and load picker data via `GET /api/v1/me/assignments`. This feature does **not** add API endpoints or change catalog/picker product rules.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: Playwright 1.52 (`@abra/e2e`), existing Vite admin (5174) + mobile (5173) + NestJS API (3000)

**Storage**: PostgreSQL 16 via Prisma — **create catalog rows through the console UI only**. No schema change. Demo seed (`admin@abra.co` / `Admin123!`, `employee1@abra.co`) must be applied before the journey runs.

**Testing**: Playwright Chromium in `@abra/e2e`; existing smoke and Epic 3 specs stay; CI job `e2e` remains the required check. No new Vitest coverage target (e2e package is not in the 70% unit-coverage gate).

**Target Platform**: Local + GitHub Actions Ubuntu — composed stack: API + admin console + employee app + Postgres

**Project Type**: Monorepo end-to-end check (cross-app; no new runtime service)

**Performance Goals**: Catalog-chain journey finishes in under 4 minutes from admin sign-in through the picker check (SC-001). Playwright per-test timeout for this spec: 240s. Existing smoke specs keep the default 30s.

**Constraints**: Drive real console UIs for the four catalog steps (FR-002); picker proof is data not employee-app pickers (FR-014); do not change catalog/picker product behavior (FR-011); unique client name and employee email per run (FR-010); Hebrew RTL; known demo admin required (FR-012)

**Scale/Scope**: One rewritten Playwright spec + small helpers. Demo org size. No new packages. No CI workflow change.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **GENERAL_SPEC** + this feature’s FR-011 until a real constitution is adopted.

| Gate | Status | Notes |
| --- | --- | --- |
| No new product API / no change to catalog or picker rules (FR-011) | PASS | Plan only rewrites e2e spec + helpers; KAN-50–53 stay owners |
| Four catalog steps on console screens (FR-002 / Epic 4 DoD) | PASS | Hidden `request.post` creates rejected in research |
| Employee pickers show only assigned live open work (§8.2) | PASS | Asserted via `GET /me/assignments`; unassigned control must not see the task |
| Unique client name among non-deleted (VAL-21) | PASS | Unique suffix per run; not a new uniqueness rule |
| Required automated check (KAN-34 e2e job) | PASS | Journey runs in existing CI `e2e` job; failure fails the job |
| Existing smokes / Epic 3 keep running (FR-009) | PASS | Plan forbids skip/delete of those specs |
| No unjustified new packages/services | PASS | Reuse `@abra/e2e`, Playwright Chromium, seed from KAN-32, Users helper from KAN-49 |
| Test-first / coverage discipline (§14) | PASS | These _are_ the tests; unit 70% gate unchanged |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate | Status | Notes |
| --- | --- | --- |
| No product-behavior change in design | PASS | `research.md` treats KAN-50–53 as hard prerequisites |
| Journey contract is UI/CI, not a new Zod API | PASS | `contracts/catalog-chain-e2e.md` |
| Unique names / dedicated employee / picker names | PASS | Encoded in data-model + contract + quickstart |
| No unjustified complexity | PASS | Complexity Tracking empty; no new app; replace skipped spec in place |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/007-catalog-chain-e2e/
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
├── playwright.config.ts                 # unchanged (admin webServer + ADMIN_BASE_URL already present)
├── helpers/
│   ├── credentials.ts                   # unchanged
│   ├── unique-email.ts                  # unchanged; add unique catalog-name helper alongside
│   ├── users-directory.ts               # reuse signInAsAdmin + createEmployeeViaUsers
│   └── catalog-chain.ts                 # NEW: unique names, console create/assign, fetchMyAssignments
└── specs/
    ├── app-shell.spec.ts                # unchanged smoke
    ├── health.spec.ts                   # unchanged smoke
    ├── login.spec.ts                    # unchanged (KAN-42)
    ├── create-then-login.spec.ts        # unchanged (do not skip/delete)
    ├── deactivated-cannot-login.spec.ts # unchanged (do not skip/delete)
    └── entity-chain.spec.ts             # REPLACE skip+API creates with console-driven journey

.github/workflows/ci.yml                 # unchanged; already seeds + runs pnpm --filter @abra/e2e test

apps/admin/                              # not modified (KAN-50–53 own the screens)
apps/mobile/                             # not modified (on-screen pickers out of scope)
server/api/                              # not modified (picker + catalog APIs already delivered)
packages/contracts/                      # not modified
```

**Structure Decision**: Keep the required check in the existing `@abra/e2e` package. Replace `entity-chain.spec.ts` in place rather than adding a second spec. No new top-level app. Product code for catalogs and picker is **out of scope** here and must already exist (KAN-50–53) for the journey to pass.

## Complexity Tracking

> No constitution violations requiring justification.
