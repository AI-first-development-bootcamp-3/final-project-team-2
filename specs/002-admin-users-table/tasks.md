---
description: 'Task list for Admin Users Table (KAN-45)'
---

# Tasks: Admin Users Table

**Input**: Design documents from `/specs/002-admin-users-table/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan/research/quickstart require contract, API integration, and admin RTL tests for same-phase delivery (FR-014 / SC-009).

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

**Purpose**: Wire workspace dependencies and scaffold directories for the users list feature

- [x] T001 Add `@abra/contracts` workspace dependency to `server/api/package.json` and `apps/admin/package.json`
- [x] T002 [P] Create contracts source folders `packages/contracts/src/common/` and `packages/contracts/src/users/`
- [x] T003 [P] Create Nest users module folder `server/api/src/modules/users/`
- [x] T004 [P] Create admin folders `apps/admin/src/components/ui/`, `apps/admin/src/features/users/`, and `apps/admin/src/lib/api/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared list contract, auth wiring (KAN-39), Nest users module skeleton, admin shell routing/API client/DataTable — MUST complete before user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement shared list `meta` and API error envelope Zod schemas in `packages/contracts/src/common/list-envelope.ts` and `packages/contracts/src/common/api-error.ts` per `specs/002-admin-users-table/contracts/users-list.md`
- [x] T006 [P] Implement `UsersListQuerySchema` and `UserListItemSchema` in `packages/contracts/src/users/list.ts` (page/limit/q/role/isActive/includeDeleted/sort/order; camelCase; no secrets)
- [x] T007 Export new contracts from `packages/contracts/src/index.ts` and ensure `pnpm --filter @abra/contracts build` succeeds
- [x] T008 [P] Confirm KAN-39 JwtGuard/RolesGuard (or equivalent) exist under `server/api/src/common/`; if missing, document blocker and stop until auth is available before story endpoints
- [x] T009 Register empty `UsersModule` in `server/api/src/modules/users/users.module.ts` and import it from `server/api/src/app.module.ts`
- [x] T010 Add admin routing (react-router) with `/admin/users` placeholder and Hebrew RTL shell wiring in `apps/admin/src/App.tsx` (and route module under `apps/admin/src/` as needed)
- [x] T011 [P] Implement authenticated API client with 401 → admin sign-in redirect in `apps/admin/src/lib/api/client.ts`
- [x] T012 Implement shared config-driven `DataTable` (columns, pagination controls, sort headers) in `apps/admin/src/components/ui/data-table.tsx` per GENERAL_SPEC §10.2

**Checkpoint**: Foundation ready — contracts build, users module registered, admin can route to `/admin/users` and call API with auth redirect

---

## Phase 3: User Story 1 - Browse the organization directory (Priority: P1) 🎯 MVP

**Goal**: Admin opens Users and sees a paginated table (20/page) of full name, email, role, status; soft-deleted hidden by default; employees/unauthenticated denied; past-last page returns empty data with real total; column sort supported

**Independent Test**: Sign in as admin, open Users, confirm four columns, ≤20 rows, no soft-deleted users, page navigation works, sort by column works, employee/anonymous denied

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Add contract tests for `UsersListQuerySchema` / `UserListItemSchema` / list success envelope in `packages/contracts/src/users/list.spec.ts`
- [x] T014 [P] [US1] Add API integration tests for `GET /api/v1/users` happy path, 401, 403, default page size 20, past-last page empty+total, limit>100 → 400, secrets absent in `server/api/src/modules/users/users.controller.spec.ts` (or co-located integration spec)
- [x] T015 [P] [US1] Add admin RTL test for Users table columns and default browse rendering in `apps/admin/src/features/users/users-page.spec.tsx`

### Implementation for User Story 1

- [x] T016 [US1] Implement `UsersService.list` in `server/api/src/modules/users/users.service.ts` (Prisma select without `password_hash`/`token_version`; default exclude soft-deleted; offset pagination; map `full_name` → `fullName`; default sort `fullName` asc; past-last page returns `[]` + real total)
- [x] T017 [US1] Implement `GET /api/v1/users` in `server/api/src/modules/users/users.controller.ts` with admin-only guards, Zod query validation, and `{ data, meta }` response
- [x] T018 [US1] Implement Users page table wired to list API (fixed `limit=20`, no page-size control, Hebrew labels for role/status) in `apps/admin/src/features/users/users-page.tsx`
- [x] T019 [US1] Define DataTable column config (fullName, email, role, isActive→status) and page navigation in `apps/admin/src/features/users/users-columns.tsx`
- [x] T020 [US1] Wire column-header sort (`sort`/`order` query; reset to page 1 on sort change) in `apps/admin/src/features/users/users-page.tsx` and ensure API accepts `fullName|email|role|isActive`
- [x] T021 [US1] Ensure employee and unauthenticated access are rejected in API guards and admin route protection for `/admin/users`

**Checkpoint**: User Story 1 fully functional and independently testable (MVP directory)

---

## Phase 4: User Story 2 - Search and filter the directory (Priority: P1)

**Goal**: Admin can search by name/email (case-insensitive partial), filter by role and active/inactive, combine filters with AND semantics; whitespace-only search treated as no search; changing search/filters resets to page 1

**Independent Test**: With mixed roles/statuses, search unique email, filter by role, filter inactive, combine criteria, confirm page resets; spaces-only search shows unfiltered list

### Tests for User Story 2

- [x] T022 [P] [US2] Extend API integration tests for `q`, `role`, `isActive`, AND combination, whitespace-only `q`, and page reset behavior in `server/api/src/modules/users/users.controller.spec.ts`
- [x] T023 [P] [US2] Add admin RTL tests for search/filter controls and page reset in `apps/admin/src/features/users/users-page.spec.tsx`

### Implementation for User Story 2

- [x] T024 [US2] Extend `UsersService.list` in `server/api/src/modules/users/users.service.ts` to apply trimmed `q` (OR on full_name/email), `role`, and `isActive` filters
- [x] T025 [US2] Add search input and role/status filter controls on `apps/admin/src/features/users/users-page.tsx` (or `apps/admin/src/features/users/users-filters.tsx`) that pass query params and reset `page` to 1 on change
- [x] T026 [US2] Ensure whitespace-only search is trimmed client-side and accepted as empty `q` server-side per FR-006

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 4 - Loading, empty, and error feedback (Priority: P1)

**Goal**: Distinct loading, empty, and Hebrew error states; expired session redirects to sign-in (not a directory error as final state)

**Independent Test**: Observe loading during slow fetch, empty when no matches, Hebrew error on failed load, session expiry → sign-in redirect

### Tests for User Story 4

- [x] T027 [P] [US4] Add admin RTL tests for loading, empty, Hebrew error, and 401→sign-in redirect in `apps/admin/src/features/users/users-page.spec.tsx`

### Implementation for User Story 4

- [x] T028 [US4] Add loading state UI while directory request is in flight in `apps/admin/src/features/users/users-page.tsx` (do not show stale table as final)
- [x] T029 [US4] Add empty state when `data` is empty and request succeeded in `apps/admin/src/features/users/users-page.tsx`
- [x] T030 [US4] Surface non-auth failures as Hebrew error messages in `apps/admin/src/features/users/users-page.tsx`; keep 401 handling via `apps/admin/src/lib/api/client.ts` redirect to sign-in

**Checkpoint**: Browse/search flows show correct feedback states; expired session goes to sign-in

---

## Phase 6: User Story 3 - Include deactivated people (Priority: P2)

**Goal**: Explicit include-deactivated control shows soft-deleted users as inactive; off hides them from list and total; include + active filter still excludes inactive removed people

**Independent Test**: Soft-deleted fixture hidden by default; visible as inactive when include-deactivated on; still absent when filtering active

### Tests for User Story 3

- [x] T031 [P] [US3] Add API integration tests for `includeDeleted` on/off, status inactive when included, and includeDeleted+isActive=true in `server/api/src/modules/users/users.controller.spec.ts`
- [x] T032 [P] [US3] Add admin RTL test for include-deactivated toggle in `apps/admin/src/features/users/users-page.spec.tsx`

### Implementation for User Story 3

- [x] T033 [US3] Extend `UsersService.list` in `server/api/src/modules/users/users.service.ts` to honor `includeDeleted` via explicit `deleted_at` predicate (bypass soft-delete middleware default) per research.md
- [x] T034 [US3] Add include-deactivated control on `apps/admin/src/features/users/users-page.tsx` (or filters component) passing `includeDeleted=true` and resetting to page 1
- [x] T035 [US3] Confirm soft-deleted rows display status inactive in column mapping in `apps/admin/src/features/users/users-columns.tsx`

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Same-phase verification and cleanup across stories

- [x] T036 [P] Run and fix failures for `pnpm --filter @abra/contracts test`, `pnpm --filter @abra/api test`, and `pnpm --filter @abra/admin test`
- [x] T037 Verify list responses never include `password_hash`/`token_version` across API tests in `server/api/src/modules/users/`
- [x] T038 Confirm out-of-scope UI absent (no create/edit/reset/deactivate actions) on `apps/admin/src/features/users/users-page.tsx`
- [x] T039 Execute manual scenarios in `specs/002-admin-users-table/quickstart.md` against seeded DB
- [x] T040 [P] Run `pnpm test:coverage` and address coverage gaps to meet ≥70% gate for touched packages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational completion
  - Prefer priority order: US1 → US2 → US4 → US3
  - US2/US4/US3 build on US1 list endpoint + Users page but remain independently testable
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on other stories — **MVP**
- **User Story 2 (P1)**: After Foundational; extends US1 list/query UI — independently testable with filter fixtures
- **User Story 4 (P1)**: After Foundational; extends US1 page states — independently testable by mocking API outcomes
- **User Story 3 (P2)**: After Foundational; extends US1 service/UI with `includeDeleted` — independently testable with soft-deleted fixture

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Service before controller (API)
- Page/columns before polish filters (admin)
- Story complete before next priority when staffing is serial

### Parallel Opportunities

- T002–T004 (setup folders) in parallel
- T006 and T008 in parallel after T005 started/done as needed
- T011 parallel with T010 after routing approach chosen
- T013–T015 (US1 tests) in parallel
- T022–T023 (US2 tests) in parallel
- T031–T032 (US3 tests) in parallel
- After Foundational, different developers can split API vs admin within a story if careful about contract boundary

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (fail before impl):
Task: "Contract tests in packages/contracts/src/users/list.spec.ts"
Task: "API integration tests in server/api/src/modules/users/users.controller.spec.ts"
Task: "Admin RTL browse test in apps/admin/src/features/users/users-page.spec.tsx"

# After tests fail, implement service → controller → UI serially for US1
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 tests together:
Task: "API filter/search tests in server/api/src/modules/users/users.controller.spec.ts"
Task: "Admin filter RTL tests in apps/admin/src/features/users/users-page.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Admin can browse paginated directory with auth
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP directory
3. US2 → search/filter
4. US4 → loading/empty/error + session redirect
5. US3 → include deactivated
6. Polish → quickstart + coverage

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1 API (`users.service.ts` / `users.controller.ts`)
   - Developer B: US1 admin (`users-page.tsx` / `users-columns.tsx` / DataTable)
3. Then proceed US2 → US4 → US3

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US4 for traceability
- Auth (KAN-39) is a hard prerequisite — T008 gates story endpoints
- Do not implement create/edit/reset/deactivate (FR-015)
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
