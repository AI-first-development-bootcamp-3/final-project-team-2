---
description: 'Task list for Admin Create User (KAN-46)'
---

# Tasks: Admin Create User

**Input**: Design documents from `/specs/003-admin-create-user/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan/research/quickstart require contract, API integration, and admin RTL tests for same-phase delivery (FR-013 / SC-009). Write tests FIRST and ensure they FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Contracts: `packages/contracts/src/`
- API: `server/api/src/`
- Admin: `apps/admin/src/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold create-contract and admin modal files; confirm existing bcrypt (no new packages, no Prisma migration)

- [ ] T001 Confirm `bcrypt` is already a dependency in `server/api/package.json` and do **not** add `react-hook-form` or a dialog library to `apps/admin/package.json`; no Prisma schema change in `server/api/prisma/schema.prisma`
- [ ] T002 [P] Create `packages/contracts/src/users/create.ts` and `packages/contracts/src/users/create.spec.ts`
- [ ] T003 [P] Create `apps/admin/src/components/ui/crud-modal.tsx` and `apps/admin/src/features/users/users-create-form.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared create contract, VAL ids, CrudModal shell, auth confirmation — MUST complete before user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement `CreateUserBodySchema` (`fullName`, `email`, `password`, `role`) and `UserCreateSuccessSchema` (`{ data: UserListItem }`) in `packages/contracts/src/users/create.ts` per `specs/003-admin-create-user/contracts/users-create.md` (trim+lowercase email; **do not** trim password; reuse `UserListItemSchema`; no secrets)
- [ ] T005 Extend `ValCode` and Hebrew `VAL_MESSAGES` with VAL-10, VAL-11, VAL-12, VAL-13 in `packages/contracts/src/index.ts`
- [ ] T006 [P] Update `zodIssuesToDetails` in `packages/contracts/src/common/api-error.ts` so a Zod issue `message` matching `VAL-*` becomes `details[].rule` (create fields must not fall back to `VAL-QUERY`)
- [ ] T007 Export create schemas/types from `packages/contracts/src/index.ts` and ensure `pnpm --filter @abra/contracts build` succeeds
- [ ] T008 [P] Confirm KAN-39 `JwtGuard` / `RolesGuard` remain on `server/api/src/modules/users/users.controller.ts` and `server/api/src/modules/users/users.module.ts`; if missing, document blocker and stop before story endpoints
- [ ] T009 Implement create-mode shared `CrudModal` (open/close, Hebrew RTL, children slot, submit/cancel, saving disables submit) in `apps/admin/src/components/ui/crud-modal.tsx` per GENERAL_SPEC §10.2 — create only, no edit mode

**Checkpoint**: Foundation ready — create contract builds, VAL ids exist, CrudModal shell renders, users module still admin-guarded

---

## Phase 3: User Story 1 - Create a person from the Users screen (Priority: P1) 🎯 MVP

**Goal**: Admin opens create from Users, submits full name / email / initial password / role (רגיל/אדמין, default רגיל), gets an active person; form closes; current directory page refreshes in place; password never shown; employees and unsigned-in callers denied

**Independent Test**: Sign in as admin, open Users on page 1 with no hiding filters, create one employee and one admin with unique emails, confirm both appear on the refreshed page with names, lowercase emails, roles, and active status — never the password. Employee/anonymous cannot create.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Add contract tests for valid `CreateUserBodySchema`, email trim+lowercase, password **not** trimmed, and `UserCreateSuccessSchema` rejecting password/hash fields in `packages/contracts/src/users/create.spec.ts`
- [ ] T011 [P] [US1] Add API tests for `POST /api/v1/users`: 201 employee, 201 admin, stored email lowercase, `isActive: true`, 401, 403, body never contains `password` / `password_hash` / `token_version` in `server/api/src/modules/users/users.controller.spec.ts` (extend `createApp` Prisma mock with `user.create` / `user.findFirst`)
- [ ] T012 [P] [US1] Add admin RTL tests: open create from Users, four required fields, default role employee (רגיל), success closes modal and refetches the **current** page (page/query unchanged), password absent from table in `apps/admin/src/features/users/users-page.spec.tsx`

### Implementation for User Story 1

- [ ] T013 [US1] Implement `UsersService.create` in `server/api/src/modules/users/users.service.ts`: trim `fullName`, normalize email, `bcrypt.hash(password, 10)`, Prisma create with `is_active` default true / `deleted_at` null / `token_version` 0, select same fields as `USER_LIST_SELECT`, map to `UserListItem`
- [ ] T014 [US1] Add `POST /` in `server/api/src/modules/users/users.controller.ts`: admin guards, `CreateUserBodySchema.safeParse`, HTTP 201 `{ data }`, Swagger operation
- [ ] T015 [US1] Implement Hebrew RTL four-field form (שם מלא, אימייל, סיסמה ראשונית, תפקיד רגיל/אדמין, default `employee`) in `apps/admin/src/features/users/users-create-form.tsx` using `CreateUserBodySchema` on submit
- [ ] T016 [US1] Wire create trigger + `CrudModal` on `apps/admin/src/features/users/users-page.tsx`: `apiFetch` `POST` `/users` with JSON; on 201 close modal and refetch the existing list `path` — **do not** `setPage(1)` or clear search/filters/sort
- [ ] T017 [US1] Keep create behind admin Users only: no create control for employees; unauthenticated `POST` remains 401 via existing guards in `server/api/src/modules/users/users.controller.ts` and `apps/admin/src/features/auth/require-admin-session.tsx`

**Checkpoint**: User Story 1 fully functional and independently testable (MVP create)

---

## Phase 4: User Story 2 - Catch invalid create input and duplicate email (Priority: P1)

**Goal**: Missing name, missing/invalid email, missing password, password shorter than 8 characters, and invalid role return 400 with VAL-10 / VAL-02 / VAL-13 / VAL-04 / VAL-12; live duplicate email (case-insensitive) returns 409 VAL-11; email used only by a soft-deleted person succeeds; Hebrew errors keep the form open

**Independent Test**: Submit empty fields, 7-character password, malformed email, and a live duplicate email; each shows the matching Hebrew field/conflict error and creates no person. Reuse of a deactivated person’s email succeeds.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add contract tests for VAL-10 (whitespace name), VAL-02 (malformed/blank email), VAL-13 (empty password), VAL-04 (7 chars), VAL-12 (bad role) in `packages/contracts/src/users/create.spec.ts`
- [ ] T019 [P] [US2] Add API tests: 400 per VAL above with `details[].rule`; 409 VAL-11 for live duplicate including mixed-case email; 201 when the same email belongs only to a soft-deleted row in `server/api/src/modules/users/users.controller.spec.ts`
- [ ] T020 [P] [US2] Add admin RTL tests for Hebrew field errors and uniqueness conflict (form stays open, names VAL-11) in `apps/admin/src/features/users/users-create-form.spec.tsx` (or `users-page.spec.tsx` if the form is tested through the page)

### Implementation for User Story 2

- [ ] T021 [US2] Map Zod failures to `BadRequestException` with `zodIssuesToDetails` and Hebrew `VAL_MESSAGES` in `server/api/src/modules/users/users.controller.ts`
- [ ] T022 [US2] In `server/api/src/modules/users/users.service.ts`: case-insensitive live-email lookup → `ConflictException` 409 with `details[{ field: 'email', rule: 'VAL-11', message }]` that includes the rule id; catch Prisma `P2002` on email the same way; allow create when the only match is soft-deleted
- [ ] T023 [US2] Render Hebrew field/conflict errors from `details[].rule` + `VAL_MESSAGES` on `apps/admin/src/features/users/users-create-form.tsx`; keep modal open; do not create a second person

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - New person can sign in immediately (Priority: P1)

**Goal**: Initial password is stored only as bcrypt (10 rounds), not trimmed; mixed-case sign-in email matches stored lowercase; no forced password change; employee vs admin product routing stays KAN-39

**Independent Test**: After create, `bcrypt.compare` succeeds with the initial password (including leading/trailing spaces). `LoginSchema` accepts `Nadav@Org.com` as `nadav@org.com`. When KAN-39 login is present, first sign-in on the matching product succeeds with no password-change step.

### Tests for User Story 3

- [ ] T024 [P] [US3] Extend `packages/contracts/src/index.test.ts` so `LoginSchema` trims and lowercases email while still emitting VAL-01 / VAL-02 for empty/malformed input
- [ ] T025 [P] [US3] Add API test that `bcrypt.compare(initialPassword, storedHash)` succeeds (password with leading/trailing spaces round-trips) and the 201 body has no hash / no must-change field in `server/api/src/modules/users/users.controller.spec.ts`

### Implementation for User Story 3

- [ ] T026 [US3] Confirm `UsersService.create` in `server/api/src/modules/users/users.service.ts` does not trim `password`, uses salt rounds 10, never writes a must-change flag, and leaves `token_version` at 0
- [ ] T027 [US3] Transform `LoginSchema.email` to trim + lowercase in `packages/contracts/src/index.ts` so mixed-case sign-in matches stored email (KAN-39 login must use this normalized value; do **not** add a new login screen)
- [ ] T028 [US3] If an auth login service exists under `server/api/src/modules/`, look up users by the normalized email; if it does not exist yet, leave a comment on `LoginSchema` that consumers must query with the schema output — Playwright create-then-login remains KAN-49

**Checkpoint**: Created people have a usable hash; sign-in contract is case-insensitive; no first-login password change

---

## Phase 6: User Story 4 - Loading, field errors, and expired session (Priority: P1)

**Goal**: Saving state blocks double-submit; validation/uniqueness keep the form open with Hebrew errors; expired session goes to admin sign-in; any other failure (5xx/network) keeps the form open with a Hebrew retry error and typed values intact

**Independent Test**: Slow submit shows saving and cannot double-submit; validation and uniqueness stay on the form; 401 → `/admin/login`; 5xx → Hebrew error, values remain, retry possible

### Tests for User Story 4

- [ ] T029 [P] [US4] Add admin RTL tests for in-flight saving (submit disabled), 400 stays open, 409 stays open, 401 → sign-in, 500/network Hebrew retry with values preserved in `apps/admin/src/features/users/users-page.spec.tsx` and/or `apps/admin/src/features/users/users-create-form.spec.tsx`

### Implementation for User Story 4

- [ ] T030 [US4] Drive CrudModal saving state from in-flight `POST` in `apps/admin/src/features/users/users-create-form.tsx` and `apps/admin/src/components/ui/crud-modal.tsx` so the admin cannot send a second create for the same submit
- [ ] T031 [US4] Submit create only through `apiFetch` in `apps/admin/src/lib/api/client.ts` so 401 clears the token and assigns `/admin/login` (not a generic “failed to create” as the final state)
- [ ] T032 [US4] On non-401/400/409 failures, keep the modal open with a Hebrew retry message, preserve typed values, and do not redirect to sign-in in `apps/admin/src/features/users/users-create-form.tsx`

**Checkpoint**: All four user stories independently functional; create UX matches FR-012 / FR-017 / SC-010 / SC-011

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Same-phase verification and cleanup across stories

- [ ] T033 [P] Run and fix failures for `pnpm --filter @abra/contracts test`, `pnpm --filter @abra/api test`, and `pnpm --filter @abra/admin test`
- [ ] T034 Verify create and list responses never include `password` / `password_hash` / `token_version` across tests in `server/api/src/modules/users/` and `packages/contracts/src/users/create.spec.ts`
- [ ] T035 Confirm out-of-scope UI absent (no edit, reset-password, or deactivate actions; no extra HR fields) on `apps/admin/src/features/users/users-page.tsx` and `apps/admin/src/features/users/users-create-form.tsx`
- [ ] T036 Execute manual scenarios in `specs/003-admin-create-user/quickstart.md` against seeded DB
- [ ] T037 [P] Add `CrudModal` unit tests in `apps/admin/src/components/ui/crud-modal.spec.tsx` (open/close, saving disables submit)
- [ ] T038 Run `pnpm test:coverage` and address coverage gaps to meet ≥70% gate for touched packages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational completion
  - Prefer priority order: US1 → US2 → US4 → US3 (US2/US4 need the US1 form; US3 needs the US1 hash)
  - US2/US3/US4 remain independently testable with fixtures/mocks
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on other stories — **MVP**
- **User Story 2 (P1)**: After Foundational; extends US1 create validation/uniqueness — independently testable with invalid bodies and duplicate fixtures
- **User Story 3 (P1)**: After Foundational; extends US1 hashing + `LoginSchema` — independently testable with `bcrypt.compare` (full product login is KAN-39; e2e chain is KAN-49)
- **User Story 4 (P1)**: After Foundational; extends US1 modal states — independently testable by mocking `apiFetch` outcomes

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Service before controller (API)
- Form before Users-page wiring (admin)
- Story complete before next priority when staffing is serial

### Parallel Opportunities

- T002–T003 (scaffold files) in parallel
- T006 and T008 in parallel with T004/T005 (different files)
- T010–T012 (US1 tests) in parallel
- T018–T020 (US2 tests) in parallel
- T024–T025 (US3 tests) in parallel
- After Foundational, API vs admin can split within a story at the contract boundary

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (fail before impl):
Task: "Contract tests in packages/contracts/src/users/create.spec.ts"
Task: "API POST tests in server/api/src/modules/users/users.controller.spec.ts"
Task: "Admin RTL create tests in apps/admin/src/features/users/users-page.spec.tsx"

# After tests fail, implement service → controller → form → page wiring
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 tests together:
Task: "Contract VAL tests in packages/contracts/src/users/create.spec.ts"
Task: "API 400/409 tests in server/api/src/modules/users/users.controller.spec.ts"
Task: "Admin Hebrew error RTL in apps/admin/src/features/users/users-create-form.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Admin can create an employee and an admin; current page refreshes; secrets never shown
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP create (same-phase API + form)
3. US2 → validation + unique email
4. US4 → saving / session / retry
5. US3 → immediate sign-in contract (hash + case-insensitive login schema)
6. Polish → quickstart + coverage

FR-013 still requires contract + API + admin in **one delivery** of this feature (not a FE-only or BE-only ship). Incremental story order is for implementation checkpoints, not separate releases.

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1 API (`users.service.ts` / `users.controller.ts`)
   - Developer B: US1 admin (`crud-modal.tsx` / `users-create-form.tsx` / `users-page.tsx`)
3. Then proceed US2 → US4 → US3

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US4 for traceability
- Auth (KAN-39) and directory (KAN-45) are hard prerequisites — T008 gates story endpoints
- Do not implement edit, reset-password, or deactivate (FR-014); no extra HR fields (FR-015)
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
