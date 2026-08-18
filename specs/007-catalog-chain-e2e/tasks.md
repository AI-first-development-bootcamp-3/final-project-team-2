---
description: 'Task list for Full Catalog Chain E2E (KAN-54)'
---

# Tasks: Full Catalog Chain E2E

**Input**: Design documents from `/specs/007-catalog-chain-e2e/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature _is_ the required Playwright journey. `e2e/specs/entity-chain.spec.ts` is the implementation (not a separate TDD layer on product code). Do **not** implement Clients, Projects, Tasks, Assignments, or picker behavior in `apps/` or `server/` (FR-011). If KAN-50–53 are missing, the journey must fail — do not bypass console creates with `request.post`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- E2E: `e2e/`
- CI: `.github/workflows/ci.yml` (confirm only — no job change)
- Docs: `README.md`, `specs/007-catalog-chain-e2e/quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold e2e helpers; confirm no new packages and no product-code changes

- [ ] T001 Confirm `@playwright/test` is already in `e2e/package.json` and do **not** add npm packages; do **not** change `server/api/prisma/schema.prisma`, `apps/admin/src/`, `apps/mobile/src/`, `server/api/src/`, or `packages/contracts/` product behavior
- [ ] T002 [P] Create `e2e/helpers/unique-name.ts` exporting `uniqueName(kind: string)` that returns `e2e.{kind}.{timestamp}.{random}` for client/project/task names (FR-010 / VAL-21)
- [ ] T003 [P] Create `e2e/helpers/catalog-chain.ts` with console helpers (no API creates): `createClientViaConsole`, `createProjectViaConsole`, `createTaskViaConsole`, `assignEmployeeViaConsole` using Hebrew UI from `specs/007-catalog-chain-e2e/research.md` §4, plus `fetchMyAssignments(request, email, password)` against `API_BASE_URL` from `e2e/playwright.config.ts` (`POST /auth/login` then `GET /me/assignments`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the existing harness can reach admin + API against a seeded org — MUST complete before user story specs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Confirm `e2e/playwright.config.ts` already exports `ADMIN_BASE_URL` (default `http://localhost:5174`) and `API_BASE_URL`, keeps `baseURL` as the employee app, and starts the admin `webServer` on `ADMIN_PORT`; do **not** add a fourth server or change smoke `baseURL`
- [ ] T005 [P] Confirm `.github/workflows/ci.yml` already runs `prisma migrate deploy`, `prisma db seed`, then `pnpm --filter @abra/e2e test`; do **not** add a new CI job or extra seed step
- [ ] T006 [P] Confirm KAN-50–53 screens exist at `apps/admin/src/features/clients/clients-page.tsx`, `apps/admin/src/features/projects/projects-page.tsx`, `apps/admin/src/features/tasks/tasks-page.tsx`, `apps/admin/src/features/assignments/assignments-page.tsx` and picker at `server/api/src/modules/me/me.controller.ts`; if a screen is missing, do **not** implement it here — the journey in later phases must fail on that screen instead of using hidden API creates

**Checkpoint**: Foundation ready — Playwright starts API + mobile + admin; CI seeds; helpers exist; no catalog/picker product implemented in this feature

---

## Phase 3: User Story 1 - Prove the catalog chain in the admin console (Priority: P1) 🎯 MVP

**Goal**: Automated journey: admin signs into the console, creates a uniquely named client, a project under that client, a task under that project, and assigns a dedicated employee — each of the four catalog steps on Clients / Projects / Tasks / Assignments — and each new row is visible with the expected parent and status

**Independent Test**: `pnpm --filter @abra/e2e exec playwright test specs/entity-chain.spec.ts`. Against a seeded org with working KAN-50–53, the four console creates succeed and catalog rows match in under 4 minutes. Fail the check if any create is done via `request.post` to catalog APIs.

### Implementation for User Story 1

- [ ] T007 [US1] Rewrite `e2e/specs/entity-chain.spec.ts`: remove `test.describe.skip`; `test.setTimeout(240_000)`; one browser context; `signInAsAdmin` from `e2e/helpers/users-directory.ts` (fail fast if still on `/login`, FR-012); `createEmployeeViaUsers` with `uniqueEmail()` from `e2e/helpers/unique-email.ts` + `CREATED_EMPLOYEE_PASSWORD` from `e2e/helpers/credentials.ts` (setup, not a KAN-54 catalog step); navigate sidebar `לקוחות`; `createClientViaConsole` with `uniqueName('client')`; assert the Clients row is `פעיל` via search `חיפוש` per `specs/007-catalog-chain-e2e/contracts/catalog-chain-e2e.md`
- [ ] T008 [US1] Extend `e2e/specs/entity-chain.spec.ts`: sidebar `פרויקטים` → create project with `uniqueName('project')` parented to that client (`צור פרויקט`); assert Projects row shows that client and `פעיל`; sidebar `משימות` → create task with `uniqueName('task')` parented to that project; assert Tasks row shows that project and `פתוחה`
- [ ] T009 [US1] Extend `e2e/specs/entity-chain.spec.ts`: sidebar `שיוכים` → assign the dedicated employee to that task via `assignEmployeeViaConsole`; assert the Assignments row shows that employee (name/email) and that task. Delete the old `request.post` catalog creates (`/clients`, `/projects`, `/tasks`, `/assignments`) from this file

**Checkpoint**: User Story 1 is independently testable (MVP Epic 4 console-chain proof). Picker assertions are not required yet.

---

## Phase 4: User Story 2 - Prove the assigned employee’s picker shows exactly that chain (Priority: P1)

**Goal**: After the US1 chain and assignment, the dedicated employee’s `GET /me/assignments` contains exactly one live assignment whose three names match; seeded `employee1@abra.co` does not see that task

**Independent Test**: Same `specs/entity-chain.spec.ts` after T007–T009. Dedicated picker `data.length === 1` with matching `clientName` / `projectName` / `taskName`. `employee1@abra.co` picker has no item with that `taskName`. Do not open employee-app cascading pickers (FR-014).

### Implementation for User Story 2

- [ ] T010 [US2] Extend `e2e/specs/entity-chain.spec.ts`: after the Assignments row is visible, call `fetchMyAssignments` from `e2e/helpers/catalog-chain.ts` as the dedicated employee; if login fails, fail with a setup message (not an empty-picker assertion); assert HTTP 200, `data.length === 1`, and `clientName` / `projectName` / `taskName` equal this run’s unique names
- [ ] T011 [US2] Extend `e2e/specs/entity-chain.spec.ts`: call `fetchMyAssignments` as `SEEDED_EMPLOYEE` from `e2e/fixtures/users.ts` (`employee1@abra.co`); assert no item has this run’s `taskName`. Use absolute `API_BASE_URL` (do not `request.get('/api/v1/...')` against the employee-app `baseURL`)

**Checkpoint**: User Stories 1 and 2 both pass in `entity-chain.spec.ts` (console chain + picker data)

---

## Phase 5: User Story 3 - Required quality gate and safe reruns (Priority: P1)

**Goal**: The catalog-chain journey runs in the existing required e2e check with the smokes and Epic 3 files; a failure fails the job; unique names/emails allow consecutive reruns; the chain spec is not skipped in CI

**Independent Test**: `pnpm test:e2e` discovers app-shell, health, create-then-login, deactivated-cannot-login, and entity-chain. Run entity-chain twice locally: both succeed (SC-006) when product prerequisites are met. `entity-chain.spec.ts` has no `test.skip` / `test.fixme`.

### Implementation for User Story 3

- [ ] T012 [US3] Keep `e2e/specs/app-shell.spec.ts`, `e2e/specs/health.spec.ts`, `e2e/specs/create-then-login.spec.ts`, `e2e/specs/deactivated-cannot-login.spec.ts`, and `e2e/specs/login.spec.ts` still discovered by `testDir: './specs'` in `e2e/playwright.config.ts` (no `testIgnore` that drops smokes, Epic 3 files, or `entity-chain.spec.ts`). Do **not** unskip KAN-49 files as part of this feature if they are still skipped
- [ ] T013 [US3] Confirm `e2e/specs/entity-chain.spec.ts` has no `test.skip` / `test.fixme` / `test.fail` / `describe.skip` so a failure fails `pnpm --filter @abra/e2e test` (SC-005); confirm `e2e/helpers/unique-name.ts` and `e2e/helpers/unique-email.ts` are used so two consecutive runs cannot collide on VAL-21 or email uniqueness (SC-006)
- [ ] T014 [P] [US3] Update the E2E section in `README.md` so the required-check list includes catalog-chain (`entity-chain`: admin creates client → project → task → assignment on the console, then picker data is exactly that chain), still listing app shell, health, create-then-login, and deactivated-cannot-login

**Checkpoint**: Required check documents and discovers the catalog-chain spec plus existing checks; reruns are unique-name safe

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, docs, and quickstart validation across the journey

- [ ] T015 [P] Ensure `e2e/tsconfig.json` still includes `helpers/**/*.ts` and `specs/**/*.ts` so `pnpm --filter @abra/e2e typecheck` passes after adding `e2e/helpers/unique-name.ts` and `e2e/helpers/catalog-chain.ts`
- [ ] T016 Run the validation in `specs/007-catalog-chain-e2e/quickstart.md` (`pnpm test:e2e` or `pnpm --filter @abra/e2e exec playwright test specs/entity-chain.spec.ts`); if KAN-50–53 are incomplete, record the failing assertions rather than weakening the spec or restoring API creates
- [ ] T017 Confirm `git diff -- apps/admin apps/mobile server/api/src packages/contracts` is empty for this feature (FR-011) aside from any pre-existing unrelated work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational
  - US1 then US2 are sequential in the **same** spec file (`entity-chain.spec.ts`) — US2 needs US1’s unique names and assignment
  - US3 depends on the rewritten spec existing (T007–T011) so discovery/README are accurate
- **Polish (Phase 6)**: Depends on US1–US3

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2
- **User Story 2 (P1)**: After US1 in `e2e/specs/entity-chain.spec.ts` (same ordered walk; cannot be a separate parallel spec)
- **User Story 3 (P1)**: After US1+US2 spec exists — harness (CI seed, admin `webServer`) already confirmed in Phase 2

### Within Each User Story

- Helpers and harness confirm before spec rewrite
- US1: sign-in + employee setup + client (T007) before project/task (T008) before assignment (T009)
- US2: dedicated picker (T010) before unassigned control (T011)
- Drive catalog UIs only; never `request.post` client/project/task/assignment as a substitute
- Picker proof uses API `GET /me/assignments` only (not employee-app pickers)
- Story complete before treating it as the required-check MVP demo

### Parallel Opportunities

- T002 and T003 (different helper files)
- T004, T005, T006 (confirm-only, different files)
- T014 (README) can overlap with T012–T013 once the spec file exists
- T015 can overlap with T017 after helpers exist
- US1 and US2 **cannot** be staffed in parallel — same file, ordered chain

---

## Parallel Example: Setup helpers

```bash
# Different files — can be staffed in parallel:
Task: "Create e2e/helpers/unique-name.ts (T002)"
Task: "Create e2e/helpers/catalog-chain.ts (T003)"
```

---

## Parallel Example: Foundational confirms

```bash
Task: "Confirm e2e/playwright.config.ts admin webServer (T004)"
Task: "Confirm .github/workflows/ci.yml seed + e2e job (T005)"
Task: "Confirm catalog screens + picker exist (T006)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — harness already present; confirm only)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `pnpm --filter @abra/e2e exec playwright test specs/entity-chain.spec.ts`
5. Demo Epic 4 console chain if KAN-50–53 are present (picker proof is US2)

### Incremental Delivery

1. Setup + Foundational → helpers + harness confirmed
2. US1 → MVP console client → project → task → assignment proof
3. US2 → picker data is exactly that chain (+ unassigned negative)
4. US3 → required-check discovery + README
5. Polish → typecheck + quickstart + FR-011 diff

Do not ship a green check by restoring API-only creates or skipping the spec.

### Parallel Team Strategy

1. Team completes Setup + Foundational together (T002/T003 and T004–T006 in parallel)
2. After Foundational, **one** developer walks T007→T011 in `entity-chain.spec.ts` (do not split US1/US2 across people on the same file)
3. Then US3 + polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US3 for traceability
- KAN-50/51/52/53 (and picker) are hard product prerequisites — T006 gates honesty of the journey
- Dedicated employee is created on Users (KAN-49 helper); assigning them is still a console step
- Unassigned control is seed `employee1@abra.co`, not a second unique employee
- Admin sign-in path is `${ADMIN_BASE_URL}/login`, not `/admin/login`
- Do not implement soft-delete, close, unassign, hour-report type (KAN-63), or employee-app pickers
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
- Avoid: API-only shortcuts, `test.skip` in CI, reusing seed employees as the dedicated assignee, product catalog implemented in this branch
