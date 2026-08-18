# Task Checklist: Assign users to tasks (Assignments CRUD)

## 1. Shared Contracts & Validation (`packages/contracts`)

- [x] 1.1 Add/verify `CreateAssignmentBodySchema` enforcing VAL-26 (userId & taskId required UUIDs) and VAL-27.
- [x] 1.2 Add/verify `AssignmentListItemSchema` and `QueryAssignmentsSchema` supporting `userId` and `taskId` filters.
- [x] 1.3 Export contract schemas from `packages/contracts/src/index.ts` and verify unit tests (`pnpm --filter @abra/contracts test`).

## 2. API Endpoints & Service Logic (`server/api`)

- [x] 2.1 Implement/verify `AssignmentsService.findAll({ userId, taskId })` joining User, Task, Project, and Client details.
- [x] 2.2 Implement/verify `AssignmentsService.create(dto)` with VAL-26 check (verify user & task exist) and VAL-27 check (throw 409 Conflict if duplicate assignment).
- [x] 2.3 Implement/verify `AssignmentsService.remove(id)` executing hard delete of join record while preserving existing `TimeEntry` records.
- [x] 2.4 Ensure `AssignmentsController` endpoints (`GET/POST/DELETE /api/v1/assignments`) are protected by Admin roles guard.
- [x] 2.5 Add unit tests for `AssignmentsController` and `AssignmentsService` verifying 409 Conflict duplicate handling and coverage >70% (`pnpm --filter @abra/api test:coverage`).

## 3. Admin UI Features & Page (`apps/admin`)

- [x] 3.1 Verify `/admin/assignments` page layout matching Figma design (`assignments-page.tsx`).
- [x] 3.2 Implement assign employee modal (`assignment-create-form.tsx`).
- [x] 3.3 Implement remove assignment confirmation modal (`assignment-delete-modal.tsx`).
- [x] 3.4 Implement user & task filter dropdowns on the assignments data table.
- [x] 3.5 Add comprehensive unit tests in `apps/admin/src/features/assignments/*.spec.tsx` reaching >70% coverage.

## 4. Employee App Scoping & Access Control (§8.2)

- [x] 4.1 Verify `GET /api/v1/me/assignments` returns active task assignments for logged-in employee.
- [x] 4.2 Verify API enforcement that unassigned users receive HTTP 403 Forbidden when attempting to record a time entry for an unassigned task.
- [x] 4.3 Add unit tests verifying assignment removal blocks new time entry creation while keeping historical entries intact.

## 5. Verification & E2E

- [x] 5.1 Run full workspace typechecks and linters (`pnpm lint && pnpm typecheck`).
- [x] 5.2 Run workspace coverage tests (`pnpm test:coverage`) ensuring all projects exceed 70% threshold.
- [x] 5.3 Run Playwright E2E verification specs for full entity catalog chain (create client → project → task → assign employee → employee picker).
