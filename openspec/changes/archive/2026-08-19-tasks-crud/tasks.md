# Task Checklist: Tasks CRUD (incl. add-from-project)

## 1. Shared Contracts & Validation (`packages/contracts`)

- [x] 1.1 Add/verify `CreateTaskSchema` with VAL-24 (name required) and VAL-25 (projectId required).
- [x] 1.2 Add/verify `UpdateTaskSchema` for updating task name, description, and status.
- [x] 1.3 Add/verify `TaskResponseSchema` and `QueryTasksSchema` supporting `projectId` and `includeDeleted` filters.
- [x] 1.4 Export contract schemas from `packages/contracts/src/index.ts` and verify unit tests (`pnpm --filter @abra/contracts test`).

## 2. API Endpoints & Service Logic (`server/api`)

- [x] 2.1 Implement/verify `TasksService.findAll({ projectId, includeDeleted })` joining Project & Client details.
- [x] 2.2 Implement/verify `TasksService.create(dto)` with VAL-25 check (verify project exists, is ACTIVE, and not deleted).
- [x] 2.3 Implement/verify `TasksService.update(id, dto)` updating task properties.
- [x] 2.4 Implement/verify `TasksService.remove(id)` executing soft delete (`status = CLOSED`, `deleted_at = now()`), preserving existing `TaskAssignment` records.
- [x] 2.5 Ensure `TasksController` endpoints (`GET/POST/PATCH/DELETE /api/v1/tasks`) are protected by Admin roles guard.
- [x] 2.6 Add unit tests for `TasksController` and `TasksService` reaching >70% coverage requirement (`pnpm --filter @abra/api test:coverage`).

## 3. Admin UI Features & Page (`apps/admin`)

- [x] 3.1 Verify `/admin/tasks` page layout matching Figma design node `0-1` (`tasks-page.tsx`).
- [x] 3.2 Implement task creation modal (`task-create-modal.tsx` / `users-create-form.tsx` style pattern).
- [x] 3.3 Implement task edit modal (`task-edit-modal.tsx`).
- [x] 3.4 Implement task close/delete confirmation modal (`task-delete-modal.tsx`).
- [x] 3.5 Implement URL pre-filtering (`/admin/tasks?projectId=xyz`) to auto-select project dropdown and filter task table rows.
- [x] 3.6 Add comprehensive unit tests in `apps/admin/src/features/tasks/*.spec.tsx` reaching >70% coverage.

## 4. Add Task from Project Screen Flow (`apps/admin/src/features/projects`)

- [x] 4.1 Add "+ הוספת משימה" action button to `projects-page.tsx` table rows.
- [x] 4.2 Trigger `TaskCreateModal` with pre-filled `projectId` directly from the project row action.
- [x] 4.3 Add unit test assertions in `projects-page.spec.tsx` for opening task creation modal from project row.

## 5. Employee App Integration (`apps/mobile`)

- [x] 5.1 Update employee time-entry task picker (`apps/mobile/src/`) to fetch assignments from `GET /api/v1/me/assignments` ensuring `includeDeleted=true` is never passed.
- [x] 5.2 Verify task picker strictly excludes any tasks with `status = 'CLOSED'` or `deleted_at IS NOT NULL`.
- [x] 5.3 Ensure historical time entry components (`apps/mobile/src/features/time-entries/`) display task, project, and client names for historical entries logged under soft-deleted/closed tasks.
- [x] 5.4 Add unit tests in `apps/mobile` asserting that task picker excludes closed tasks while historical entries display closed task names correctly.

## 6. Verification & E2E

- [x] 6.1 Run full workspace typechecks and linters (`pnpm lint && pnpm typecheck`).
- [x] 6.2 Run workspace coverage tests (`pnpm test:coverage`) ensuring all projects exceed 70% threshold.
- [x] 6.3 Run Playwright E2E verification specs testing soft-delete task picker exclusion and historical rendering.
