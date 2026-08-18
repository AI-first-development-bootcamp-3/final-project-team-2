---
description: 'Task list for Admin Projects CRUD (KAN-51)'
---

# Tasks: Admin Projects CRUD

**Input**: Design documents from `/specs/006-admin-projects-crud/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan/research/quickstart require contract, API integration, and admin RTL tests for same-phase delivery (FR-017 / SC-012). Write tests FIRST and ensure they FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Reuse the existing entity-management projects slice (`packages/contracts/src/projects/`, `server/api/src/modules/projects/`, `apps/admin/src/features/projects/`); close KAN-51 gaps rather than adding a second module.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Contracts: `packages/contracts/src/`
- API: `server/api/src/`
- Admin: `apps/admin/src/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm reuse of existing Project/Client models, contracts, Nest module, and admin feature files; no new packages or Prisma migration

- [ ] T001 Confirm Prisma `Project` in `server/api/prisma/schema.prisma` already has `name`, `client_id`, `is_active`, `deleted_at` (GENERAL_SPEC §4.3) and do **not** add a migration; do **not** add `react-hook-form` or a new dialog library to `apps/admin/package.json`
- [ ] T002 [P] Ensure contract files exist: `packages/contracts/src/projects/list.ts`, `packages/contracts/src/projects/create.ts`, `packages/contracts/src/projects/update.ts`, plus `packages/contracts/src/projects/list.spec.ts`, `packages/contracts/src/projects/create.spec.ts`, and `packages/contracts/src/projects/update.spec.ts` (create empty spec files if missing)
- [ ] T003 [P] Confirm admin feature files exist: `apps/admin/src/features/projects/projects-page.tsx`, `apps/admin/src/features/projects/projects-columns.tsx`, `apps/admin/src/features/projects/project-create-form.tsx`, `apps/admin/src/features/projects/project-edit-modal.tsx`, `apps/admin/src/features/projects/projects-page.spec.tsx`; confirm API module files exist: `server/api/src/modules/projects/projects.controller.ts`, `server/api/src/modules/projects/projects.service.ts`, `server/api/src/modules/projects/projects.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared list/item contract (`isDeleted`, `clientName` sort), VAL ids, auth guards, shared UI — MUST complete before user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Extend `ProjectsListSortSchema` with `clientName` and add `isDeleted: z.boolean()` to `ProjectListItemSchema` in `packages/contracts/src/projects/list.ts` per `specs/006-admin-projects-crud/contracts/projects.md` (defaults remain `page=1`, `limit=20`, `sort=name`, `order=asc`, `includeDeleted=false`; `q` trim; `clientId` uuid)
- [ ] T005 [P] Add `ProjectGetSuccessSchema` and `ProjectUpdateSuccessSchema` (`{ data: ProjectListItem }`) in `packages/contracts/src/projects/update.ts` (keep `UpdateProjectBodySchema` optional `name` VAL-22 / `clientId` VAL-23 uuid / `isActive`); confirm `CreateProjectBodySchema` + `ProjectCreateSuccessSchema` in `packages/contracts/src/projects/create.ts`
- [ ] T006 Confirm `ValCode` and Hebrew `VAL_MESSAGES` already include VAL-22 (`שם הפרויקט הוא שדה חובה`) and VAL-23 (`יש לבחור לקוח תקין ופעיל`) in `packages/contracts/src/index.ts`; add them only if missing
- [ ] T007 Export list/create/update schemas and success types from `packages/contracts/src/index.ts` and ensure `pnpm --filter @abra/contracts build` succeeds
- [ ] T008 [P] Confirm `JwtGuard` + `RolesGuard` + `@Roles('admin')` on `server/api/src/modules/projects/projects.controller.ts` and that `ProjectsModule` is imported from `server/api/src/app.module.ts`; if missing, document blocker and stop before story endpoints
- [ ] T009 [P] Confirm shared `DataTable` in `apps/admin/src/components/ui/data-table.tsx` and `CrudModal` in `apps/admin/src/components/ui/crud-modal.tsx`; confirm KAN-50 `GET /clients?limit=100&isActive=true` is available for the picker (Clients list in `server/api/src/modules/clients/`)

**Checkpoint**: Foundation ready — project contract builds with `isDeleted` + `clientName` sort, VAL-22/23 exist, projects module is admin-guarded, DataTable/CrudModal reusable

---

## Phase 3: User Story 1 - Browse the projects catalog (Priority: P1) 🎯 MVP

**Goal**: Admin opens `/admin/projects` and sees a Hebrew RTL table of name, client name, and status; page size 20; default sort name A–Z; search by name; filter by client; include-removed; loading and empty states; employees and unsigned-in callers denied

**Independent Test**: Sign in as admin, open Projects, confirm columns name / client name / status, default page size, search and client filter, removed rows absent until included and then distinguishable.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Add contract tests for list defaults, `q` trim, `clientId`, `includeDeleted`, `sort=clientName`, and `ProjectListItemSchema` requiring `isDeleted` in `packages/contracts/src/projects/list.spec.ts`
- [ ] T011 [P] [US1] Add API tests for `GET /api/v1/projects`: 200 with `clientName` join, default limit 20 / `sort=name` asc, search `q`, filter `clientId`, default excludes removed, `includeDeleted=true` returns `isDeleted: true` rows, past-last page 200 empty `data` + real `meta.total`, 401, 403 in `server/api/src/modules/projects/projects.controller.spec.ts`
- [ ] T012 [P] [US1] Add admin RTL tests: columns שם / לקוח / סטטוס (פעיל / לא פעיל), loading state, empty copy **אין מידע קיים עד כה**, no page-size control, search and client filter reset to page 1, include-removed shows distinguishable removed rows, sort by client name resets to page 1 in `apps/admin/src/features/projects/projects-page.spec.tsx`

### Implementation for User Story 1

- [ ] T013 [US1] Implement `ProjectsService.list` in `server/api/src/modules/projects/projects.service.ts`: join `client.name` as `clientName`, map `isDeleted` from `deleted_at`, `includeDeleted` middleware bypass, search name insensitive, filter `clientId` / `isActive`, sort `name` | `clientName` (`orderBy: { client: { name } }`) | `isActive`, offset pagination
- [ ] T014 [US1] Implement `GET /` and `GET /:id` in `server/api/src/modules/projects/projects.controller.ts`: parse `ProjectsListQuerySchema`, 200 list envelope, 200 `{ data }` for get-one, 404 Hebrew for missing/removed on get-one, Swagger operations
- [ ] T015 [P] [US1] Implement columns in `apps/admin/src/features/projects/projects-columns.tsx`: sortable `name`, sortable `clientName`, sortable `isActive` (פעיל / לא פעיל); when `isDeleted` show a distinct removed marker (e.g. הוסר) — **do not** add a task-count column or require משימות as KAN-51 AC
- [ ] T016 [US1] Implement catalog UI in `apps/admin/src/features/projects/projects-page.tsx`: `apiFetch` list with `limit=20`, search `q`, client filter from `GET /clients?limit=100` (non-deleted), include-removed labeled as including **removed** (not “כולל מושבתים”), loading, empty **אין מידע קיים עד כה**, Hebrew RTL; changing search/filter/sort sets page 1
- [ ] T017 [US1] Keep `/admin/projects` behind admin session in `apps/admin/src/App.tsx` and `apps/admin/src/components/layout/admin-sidebar.tsx` (label פרויקטים); employees cannot open the console; unauthenticated `GET /projects` remains 401 via existing guards

**Checkpoint**: User Story 1 fully functional and independently testable (MVP catalog)

---

## Phase 4: User Story 2 - Create a project under an active client (Priority: P1)

**Goal**: Admin opens create from Projects, submits name + active client, gets an active project (201); form closes; current catalog page refreshes in place; picker lists active non-removed clients only; employees and unsigned-in callers denied

**Independent Test**: With at least one active client, create a uniquely named project, confirm it is active under that client and appears on the refreshed page when it belongs there.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add contract tests for valid `CreateProjectBodySchema` (trim name) and `ProjectCreateSuccessSchema` requiring `isActive: true` / `isDeleted: false` in `packages/contracts/src/projects/create.spec.ts`
- [ ] T019 [P] [US2] Add API tests for `POST /api/v1/projects`: 201 with `isActive: true`, `clientName` joined, 401, 403 in `server/api/src/modules/projects/projects.controller.spec.ts`
- [ ] T020 [P] [US2] Add admin RTL tests: create title **יצירת פרויקט**, fields **שם הפרויקט** / **שם הלקוח**, primary **צור פרויקט**, picker only active clients, success closes modal and refetches the **current** page (page/query unchanged) in `apps/admin/src/features/projects/project-create-form.spec.tsx` and/or `apps/admin/src/features/projects/projects-page.spec.tsx`

### Implementation for User Story 2

- [ ] T021 [US2] Implement `ProjectsService.create` in `server/api/src/modules/projects/projects.service.ts`: trim name, `validateClientId` (active, not removed), Prisma create with `is_active` default true / `deleted_at` null, return `ProjectListItem` (do **not** enforce unique names)
- [ ] T022 [US2] Add `POST /` in `server/api/src/modules/projects/projects.controller.ts`: admin guards, `CreateProjectBodySchema.safeParse`, HTTP 201 `{ data }`, Swagger operation
- [ ] T023 [US2] Implement Hebrew RTL create form in `apps/admin/src/features/projects/project-create-form.tsx` using `CrudModal` and `CreateProjectBodySchema`: copy **יצירת פרויקט** / **שם הפרויקט** / **שם הלקוח** / **צור פרויקט**; load picker via `GET /clients?limit=100&isActive=true`; no lead-manager/dates/description fields
- [ ] T024 [US2] Wire create trigger on `apps/admin/src/features/projects/projects-page.tsx`: on 201 close modal and refetch the existing list `path` — **do not** `setPage(1)` or clear search/filters/sort

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Catch invalid create and an unusable client (Priority: P1)

**Goal**: Missing/whitespace name → 400 VAL-22; missing/malformed clientId → 400 VAL-23; inactive/removed/unknown client → 422 VAL-23; duplicate names allowed; Hebrew errors keep the form open; empty picker when no active clients

**Independent Test**: Submit empty name, whitespace-only name, no client, and an inactive/removed client; each shows the matching Hebrew VAL error and creates no project. A second project with a reused name succeeds.

### Tests for User Story 3

- [ ] T025 [P] [US3] Add contract tests for VAL-22 (missing / whitespace name) and VAL-23 (missing / non-uuid `clientId`) in `packages/contracts/src/projects/create.spec.ts`
- [ ] T026 [P] [US3] Add API tests: 400 VAL-22; 400 VAL-23 malformed/missing client; 422 VAL-23 for inactive, removed, or unknown client; 201 when a second project reuses an existing name in `server/api/src/modules/projects/projects.controller.spec.ts`
- [ ] T027 [P] [US3] Add admin RTL tests for Hebrew VAL-22 / VAL-23 field errors (form stays open, no row added) and empty picker when `GET /clients?isActive=true` returns no clients in `apps/admin/src/features/projects/project-create-form.spec.tsx`

### Implementation for User Story 3

- [ ] T028 [US3] Map Zod failures to `BadRequestException` with `zodIssuesToDetails` and Hebrew `VAL_MESSAGES` in `server/api/src/modules/projects/projects.controller.ts`
- [ ] T029 [US3] In `server/api/src/modules/projects/projects.service.ts` `validateClientId`: missing row, `deleted_at` set, or `is_active=false` → `UnprocessableEntityException` 422 with `details[{ field: 'clientId', rule: 'VAL-23', message: VAL_MESSAGES['VAL-23'] }]`
- [ ] T030 [US3] Render Hebrew field errors from `details[].rule` + `VAL_MESSAGES` on `apps/admin/src/features/projects/project-create-form.tsx`; keep modal open; do not POST when picker is empty (submit still yields VAL-23)

**Checkpoint**: User Stories 1–3 independently functional

---

## Phase 6: User Story 4 - Edit name, client, and active/inactive (Priority: P1)

**Goal**: Admin edits a live project’s name, client, and `isActive`. Client change re-applies VAL-23. Saving without changing client succeeds even if the current client was later deactivated. Deactivate uses PATCH (not DELETE); tasks unchanged; inactive projects stay in the default catalog and disappear from `GET /me/assignments`

**Independent Test**: Edit name, move to another active client, set inactive; tasks unchanged; employee picker omits the project; default catalog still shows the inactive row.

### Tests for User Story 4

- [ ] T031 [P] [US4] Add contract tests for optional `UpdateProjectBodySchema` (whitespace name → VAL-22; bad `clientId` → VAL-23) and `ProjectUpdateSuccessSchema` in `packages/contracts/src/projects/update.spec.ts`
- [ ] T032 [P] [US4] Add API tests in `server/api/src/modules/projects/projects.controller.spec.ts`: PATCH name 200; PATCH new active client 200; PATCH inactive/removed client 422 VAL-23; PATCH name/`isActive` with **same** `clientId` when parent client is inactive → 200; PATCH `{ isActive: false }` leaves child tasks open and not soft-deleted; 404 for unknown/removed id
- [ ] T033 [P] [US4] Add picker-hide test: after PATCH `isActive=false`, `GET /api/v1/me/assignments` as the assigned employee omits that `projectId` in `server/api/src/modules/me/me.controller.spec.ts`
- [ ] T034 [P] [US4] Add admin RTL tests: edit pre-fill, save name, `isActive` toggle calls **PATCH** not DELETE, keep current inactive client as selected option, VAL-22/VAL-23 keep modal open in `apps/admin/src/features/projects/project-edit-modal.spec.tsx` and/or `apps/admin/src/features/projects/projects-page.spec.tsx`

### Implementation for User Story 4

- [ ] T035 [US4] Implement `ProjectsService.update` in `server/api/src/modules/projects/projects.service.ts`: 404 if missing/removed; call `validateClientId` **only when** `payload.clientId` is present **and different** from stored `client_id`; `isActive` updates `is_active` only (no task writes)
- [ ] T036 [US4] Add `PATCH /:id` in `server/api/src/modules/projects/projects.controller.ts`: `UpdateProjectBodySchema.safeParse`, Hebrew 400 on VAL-22, 200 `{ data }`
- [ ] T037 [US4] Implement edit form in `apps/admin/src/features/projects/project-edit-modal.tsx`: pre-fill name/client/`isActive`; picker `GET /clients?limit=100&isActive=true` **plus** current client option if it is missing from that list; submit PATCH `{ name, clientId, isActive }`; **do not** call DELETE for השבת
- [ ] T038 [US4] Confirm `GET /api/v1/me/assignments` in `server/api/src/modules/me/me.controller.ts` already filters `project.is_active=true` and `deleted_at=null`; if not, add those predicates (do not build a new picker API)

**Checkpoint**: User Stories 1–4 independently functional; inactive ≠ removed

---

## Phase 7: User Story 5 - Soft-remove a project and keep historical names (Priority: P1)

**Goal**: Admin confirms remove (ביטול / מחיקה); `DELETE` sets `deleted_at` and returns 204; default list hides the row; include-removed shows name + client as removed; tasks not closed/removed; `GET /me/assignments` omits it; TimeEntry still resolves `Project.name` when the read includes deleted relations

**Independent Test**: Remove a project that a seeded time entry names; default list hides it; include-removed shows it; picker omits it; history still has the name; tasks unchanged.

### Tests for User Story 5

- [ ] T039 [P] [US5] Add API tests in `server/api/src/modules/projects/projects.controller.spec.ts` (and service tests in `server/api/src/modules/projects/projects.service.spec.ts` if needed): DELETE 204; row still in DB with `deleted_at` set; default list excludes it; `includeDeleted=true` returns `isDeleted: true`; child tasks unchanged (`status` / `deleted_at`); 404 for unknown id
- [ ] T040 [US5] Add tests that after DELETE (and after deactivate from US4) a TimeEntry fixture still resolves `project.name` when the Prisma read **explicitly includes** deleted related Project/Task rows in `server/api/src/modules/projects/projects.service.spec.ts`; add `GET /me/assignments` omits removed `projectId` in `server/api/src/modules/me/me.controller.spec.ts`
- [ ] T041 [P] [US5] Add admin RTL tests: remove confirmation **ביטול** / **מחיקה** (cancel leaves the row); confirm hides from default list; include-removed still shows name and client as removed — distinct from inactive — in `apps/admin/src/features/projects/projects-page.spec.tsx`

### Implementation for User Story 5

- [ ] T042 [US5] Implement `ProjectsService.softDelete` in `server/api/src/modules/projects/projects.service.ts`: 404 if missing; set `deleted_at` only; **do not** write tasks
- [ ] T043 [US5] Implement `DELETE /:id` in `server/api/src/modules/projects/projects.controller.ts` with HTTP 204 empty body
- [ ] T044 [US5] Replace conflated השבת→DELETE on `apps/admin/src/features/projects/projects-page.tsx` / `apps/admin/src/features/projects/projects-columns.tsx` with a dedicated remove action that opens Hebrew confirmation (ביטול / מחיקה) then `DELETE /projects/:id`; keep deactivate on the edit `isActive` control from US4
- [ ] T045 [US5] When include-removed is on, show name + client for removed rows using `isDeleted` in `apps/admin/src/features/projects/projects-columns.tsx` so the admin can tell what was removed

**Checkpoint**: User Stories 1–5 independently functional; historical name + picker hide proven

---

## Phase 8: User Story 6 - Loading, field errors, and expired session (Priority: P1)

**Goal**: Create/edit/remove show a saving state and cannot double-submit; validation stays on the open form with Hebrew errors; expired session goes to sign-in; other failures (5xx/network) keep the form open with a Hebrew retry error and typed values intact

**Independent Test**: Slow create shows saving and cannot double-submit; VAL-22/VAL-23 stay on the form; 401 → `/login`; 5xx → Hebrew error, values remain, retry possible.

### Tests for User Story 6

- [ ] T046 [P] [US6] Add admin RTL tests for in-flight saving (submit disabled) on create and edit, 400/422 stay open, 401 → `/login`, 500/network Hebrew retry with values preserved in `apps/admin/src/features/projects/project-create-form.spec.tsx`, `apps/admin/src/features/projects/project-edit-modal.spec.tsx`, and/or `apps/admin/src/features/projects/projects-page.spec.tsx`

### Implementation for User Story 6

- [ ] T047 [US6] Drive `CrudModal` saving state from in-flight POST/PATCH/DELETE in `apps/admin/src/features/projects/project-create-form.tsx`, `apps/admin/src/features/projects/project-edit-modal.tsx`, and the remove confirmation on `apps/admin/src/features/projects/projects-page.tsx` so the admin cannot send a second submit for the same action
- [ ] T048 [US6] Submit create/edit/remove only through `apiFetch` in `apps/admin/src/lib/api/client.ts` so 401 clears the token and assigns `/login` (not a generic failure as the final state)
- [ ] T049 [US6] On non-401/400/422 failures, keep the modal/confirmation open with a Hebrew retry message, preserve typed values, and do not redirect to sign-in in `apps/admin/src/features/projects/project-create-form.tsx` and `apps/admin/src/features/projects/project-edit-modal.tsx`

**Checkpoint**: All six user stories independently functional; UX matches FR-015 / FR-016 / SC-010 / SC-011

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Same-phase verification and cleanup across stories

- [ ] T050 [P] Run and fix failures for `pnpm --filter @abra/contracts test`, `pnpm --filter @abra/api test`, and `pnpm --filter @abra/admin test` (touched files under `packages/contracts/src/projects/`, `server/api/src/modules/projects/`, `server/api/src/modules/me/`, `apps/admin/src/features/projects/`)
- [ ] T051 Confirm out-of-scope UI absent (no lead manager, start/end dates, or project description on create/edit; no combined ניהול לקוחות/פרויקטים table; do not treat task CRUD or hour-report type as this feature) on `apps/admin/src/features/projects/project-create-form.tsx` and `apps/admin/src/features/projects/project-edit-modal.tsx`
- [ ] T052 Execute manual scenarios in `specs/006-admin-projects-crud/quickstart.md` against seeded DB
- [ ] T053 Run `pnpm test:coverage` and address coverage gaps to meet ≥70% gate for touched packages (`@abra/contracts`, `@abra/api`, `@abra/admin`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Stories (Phases 3–8)**: All depend on Foundational completion
  - Prefer priority order: US1 → US2 → US3 → US4 → US5 → US6 (later stories extend the catalog and forms)
  - Each story remains independently testable with fixtures/mocks
- **Polish (Phase 9)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on other stories — **MVP catalog**
- **User Story 2 (P1)**: After Foundational; opens create from the US1 screen — independently testable with an active client fixture
- **User Story 3 (P1)**: After Foundational; extends US2 validation — independently testable with invalid bodies
- **User Story 4 (P1)**: After Foundational; edit on US1 rows — independently testable with PATCH fixtures; picker hide uses `/me/assignments`
- **User Story 5 (P1)**: After Foundational; remove must stay distinct from US4 deactivate — independently testable with DELETE + TimeEntry fixture
- **User Story 6 (P1)**: After Foundational; extends US2/US4/US5 modal states — independently testable by mocking `apiFetch` outcomes

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Service before controller (API)
- Columns/form before page wiring (admin)
- Story complete before next priority when staffing is serial

### Parallel Opportunities

- T002–T003 (confirm/scaffold files) in parallel
- T005, T008, T009 in parallel with T004/T006 (different files)
- T010–T012 (US1 tests) in parallel
- T018–T020 (US2 tests) in parallel
- T025–T027 (US3 tests) in parallel
- T031–T034 (US4 tests) in parallel
- T039 and T041 (US5 tests) in parallel; T040 after T039 (shared `projects.service.spec.ts`)
- After Foundational, API vs admin can split within a story at the contract boundary

---

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (fail before impl):
Task: "Contract tests in packages/contracts/src/projects/list.spec.ts"
Task: "API GET /projects tests in server/api/src/modules/projects/projects.controller.spec.ts"
Task: "Admin RTL catalog tests in apps/admin/src/features/projects/projects-page.spec.tsx"

# After tests fail, implement service → controller → columns → page
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 tests together:
Task: "Contract create tests in packages/contracts/src/projects/create.spec.ts"
Task: "API POST tests in server/api/src/modules/projects/projects.controller.spec.ts"
Task: "Admin create RTL in apps/admin/src/features/projects/project-create-form.spec.tsx"
```

---

## Parallel Example: User Story 4

```bash
# Launch US4 tests together:
Task: "Contract update tests in packages/contracts/src/projects/update.spec.ts"
Task: "API PATCH tests in server/api/src/modules/projects/projects.controller.spec.ts"
Task: "Picker hide in server/api/src/modules/me/me.controller.spec.ts"
Task: "Admin edit RTL in apps/admin/src/features/projects/project-edit-modal.spec.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Admin can browse Projects (name, client, status, search, filter, include-removed, pagination)
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP catalog (same-phase list contract + API + screen)
3. US2 → create under an active client
4. US3 → VAL-22 / VAL-23
5. US4 → edit + deactivate (PATCH `isActive`)
6. US5 → soft-remove + history + picker hide
7. US6 → saving / session / retry
8. Polish → quickstart + coverage

FR-017 still requires contract + API + admin in **one delivery** of this feature (not a FE-only or BE-only ship). Incremental story order is for implementation checkpoints, not separate releases.

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Foundational:
   - Developer A: US1 API (`projects.service.ts` / `projects.controller.ts`)
   - Developer B: US1 admin (`projects-columns.tsx` / `projects-page.tsx`)
3. Then proceed US2 → US3 → US4 → US5 → US6

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US6 for traceability
- Auth (KAN-39) and Clients (KAN-50) are hard prerequisites — T008/T009 gate story work
- Inactive (`PATCH isActive`) and remove (`DELETE`) MUST stay distinct; do not map השבת to DELETE
- Do not collect lead manager / dates / description (FR-018); do not deliver combined assignment table, tasks CRUD, or hour-report type (FR-019)
- Entity CRUD is not audit-logged in MVP
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
