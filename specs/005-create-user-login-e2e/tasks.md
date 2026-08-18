---
description: 'Task list for Create User Then Login E2E (KAN-49)'
---

# Tasks: Create User Then Login E2E

**Input**: Design documents from `/specs/005-create-user-login-e2e/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature _is_ the required Playwright journeys. Spec files are the implementation (not a separate TDD layer on product code). Do **not** implement sign-in, create, or deactivate in `apps/` or `server/` (FR-011). If KAN-39 is still a stub/mock, the journeys must fail — do not bypass UIs.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- E2E: `e2e/`
- CI: `.github/workflows/ci.yml`
- Docs: `README.md`, `specs/005-create-user-login-e2e/quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold e2e helpers; confirm no new packages and no product-code changes

- [x] T001 Confirm `@playwright/test` is already in `e2e/package.json` and do **not** add npm packages; do **not** change `server/api/prisma/schema.prisma`, `apps/admin/src/`, or `apps/mobile/src/` product behavior
- [x] T002 [P] Create `e2e/helpers/credentials.ts` with seed admin defaults (`admin@abra.co` / `Admin123!`) overridable via `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`, plus created-employee password `E2ePass12!`
- [x] T003 [P] Create `e2e/helpers/unique-email.ts` exporting `uniqueEmail()` that returns `e2e.{timestamp}.{random}@abra.co`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Harness so both journeys can reach admin + employee apps against a seeded org — MUST complete before user story specs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Export `ADMIN_BASE_URL` (default `http://localhost:5174`) from `e2e/playwright.config.ts`; keep `baseURL` as the employee app; add a third `webServer` for `pnpm --filter @abra/admin dev` on `ADMIN_PORT` with `VITE_API_URL=http://localhost:${API_PORT}/api/v1`
- [x] T005 Add `pnpm --filter @abra/api exec prisma db seed` after `prisma migrate deploy` in `.github/workflows/ci.yml` so the demo admin exists before `pnpm --filter @abra/e2e test`
- [x] T006 Confirm KAN-39 real admin sign-in/logout and employee API login exist in `apps/admin/src/features/auth/sign-in-page.tsx` and `apps/mobile/src/features/auth/LoginForm.tsx`; if they are still stub/mock, do **not** implement them here — journeys in later phases must fail on those screens instead of injecting tokens

**Checkpoint**: Foundation ready — Playwright starts API + mobile + admin; CI seeds; helpers exist; no product auth implemented in this feature

---

## Phase 3: User Story 1 - Prove create-then-login (Priority: P1) 🎯 MVP

**Goal**: Automated journey: admin signs into the console → creates an employee with a unique email and initial password from Users → signs out → that employee signs into the employee app and reaches the authenticated home (no forced password change; password never shown in Users)

**Independent Test**: `pnpm --filter @abra/e2e test e2e/specs/create-then-login.spec.ts` (or equivalent Playwright file filter). Against a seeded org with working KAN-39/46, the new employee leaves `/login` and sees `עמוד ראשי - דיווח יומי` in under 3 minutes.

### Implementation for User Story 1

- [x] T007 [US1] Implement the create-then-login journey in `e2e/specs/create-then-login.spec.ts` per `specs/005-create-user-login-e2e/contracts/user-lifecycle-e2e.md`: `test.setTimeout(180_000)`; one browser context; `goto(ADMIN_BASE_URL)` → admin sign-in with `e2e/helpers/credentials.ts` → Users heading `משתמשים` → `יצירת משתמש` with `uniqueEmail()` + `E2ePass12!` + role `רגיל` → `שמירה` → assert active employee row and password **absent** from the table
- [x] T008 [US1] Extend `e2e/specs/create-then-login.spec.ts`: admin signs out to `/admin/login`; open employee app `/login` (heading `ברוכים הבאים!`); submit the same email + initial password via `התחבר`; expect URL not `/login`, heading `עמוד ראשי - דיווח יומי`, and no password-change screen. Drive real UIs only (no `request.post` login/create)

**Checkpoint**: User Story 1 is independently testable (MVP Epic 3 create-then-login proof)

---

## Phase 4: User Story 2 - Prove a deactivated employee cannot sign in (Priority: P1)

**Goal**: Second independent journey: admin creates a **different** employee, deactivates them from Users, then employee-app sign-in with that password is refused (stay on `/login`, Hebrew error, authenticated heading absent)

**Independent Test**: `pnpm --filter @abra/e2e test e2e/specs/deactivated-cannot-login.spec.ts`. Must pass or fail without requiring US1 to have run. Failure must not skip US1.

### Implementation for User Story 2

- [x] T009 [P] [US2] Implement `e2e/specs/deactivated-cannot-login.spec.ts` per `specs/005-create-user-login-e2e/contracts/user-lifecycle-e2e.md`: `test.setTimeout(180_000)`; own `uniqueEmail()` employee (do **not** reuse US1’s person or seed `employee1@abra.co`); create via Users UI; `השבת` → confirm `השבת משתמש`; then employee `/login` with that email+password stays on `/login`, shows a Hebrew error (`role=alert` or login error region), and does **not** show `עמוד ראשי - דיווח יומי`

**Checkpoint**: User Stories 1 and 2 both work independently in separate spec files

---

## Phase 5: User Story 3 - Required quality gate and safe reruns (Priority: P1)

**Goal**: Both journeys run in the existing required e2e check with the smokes; a failure fails the job; unique emails allow consecutive reruns; specs are not skipped in CI

**Independent Test**: `pnpm test:e2e` discovers four specs (app-shell, health, create-then-login, deactivated-cannot-login). Run twice locally: both lifecycle specs still pass (SC-004) when product prerequisites are met. Neither lifecycle file uses `test.skip` / `test.fixme`.

### Implementation for User Story 3

- [x] T010 [US3] Keep `e2e/specs/app-shell.spec.ts` and `e2e/specs/health.spec.ts` unchanged and still discovered by `testDir: './specs'` in `e2e/playwright.config.ts` (no `testIgnore` that drops smokes or the new journeys)
- [x] T011 [US3] Confirm `e2e/specs/create-then-login.spec.ts` and `e2e/specs/deactivated-cannot-login.spec.ts` have no `test.skip` / `test.fixme` / `test.fail` so a failure fails `pnpm --filter @abra/e2e test` (SC-003)
- [x] T012 [US3] Update the E2E section in `README.md` to list the four specs, the seed requirement (`prisma db seed`), and admin console on port 5174 alongside mobile 5173 / API 3000

**Checkpoint**: Required check documents and discovers all four specs; reruns are unique-email safe via `e2e/helpers/unique-email.ts`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, docs, and quickstart validation across both journeys

- [x] T013 [P] Ensure `e2e/tsconfig.json` includes `helpers/**/*.ts` and `specs/**/*.ts` so `pnpm --filter @abra/e2e typecheck` passes
- [x] T014 Run the validation in `specs/005-create-user-login-e2e/quickstart.md` (`pnpm test:e2e`); if KAN-39 is incomplete, record the failing assertions rather than weakening the specs
- [x] T015 Confirm `git diff -- apps/admin apps/mobile server/api/src packages/contracts` is empty for this feature (FR-011) aside from any pre-existing unrelated work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational
  - US1 and US2 can proceed in parallel after Phase 2 (different spec files)
  - US3 depends on both spec files existing (T007–T009) so discovery/README are accurate
- **Polish (Phase 6)**: Depends on US1–US3

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2
- **User Story 2 (P1)**: After Foundational — no dependency on US1 (creates its own employee)
- **User Story 3 (P1)**: After US1 and US2 spec files exist — harness (CI seed, admin `webServer`) already in Phase 2

### Within Each User Story

- Helpers and Playwright config before spec files
- US1: create+assert row (T007) before logout+employee login (T008) — same file, sequential
- Drive UIs only; never inject tokens or call create/deactivate via `request` as a substitute
- Story complete before treating it as the required-check MVP demo

### Parallel Opportunities

- T002 and T003 (different helper files)
- After Phase 2: T009 [US2] in parallel with T007–T008 [US1]
- T013 can overlap with README (T012) once specs exist

---

## Parallel Example: User Story 1 + 2 (after Phase 2)

```bash
# Different files — can be staffed in parallel:
Task: "Implement create-then-login.spec.ts (T007–T008)"
Task: "Implement deactivated-cannot-login.spec.ts (T009)"
```

---

## Parallel Example: Setup helpers

```bash
Task: "Create e2e/helpers/credentials.ts"
Task: "Create e2e/helpers/unique-email.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — admin server + CI seed)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `pnpm --filter @abra/e2e test e2e/specs/create-then-login.spec.ts`
5. Demo Epic 3 create-then-login if KAN-39/46 are present

### Incremental Delivery

1. Setup + Foundational → harness ready
2. US1 → MVP create-then-login proof
3. US2 → deactivated-cannot-sign-in proof
4. US3 → required-check discovery + README
5. Polish → typecheck + quickstart

Do not ship a green check by mocking login or skipping specs.

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1 (`create-then-login.spec.ts`)
   - Developer B: US2 (`deactivated-cannot-login.spec.ts`)
3. Then US3 + polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US3 for traceability
- KAN-39/45/46/48 are hard product prerequisites — T006 gates honesty of the journeys
- Do not implement edit, reset-password, restore, or create-admin-then-console-login
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
- Avoid: API-only shortcuts, `test.skip` in CI, shared seed employee for US2, product auth implemented in this branch
