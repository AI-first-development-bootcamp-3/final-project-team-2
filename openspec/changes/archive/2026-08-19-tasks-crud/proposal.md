# Proposal: Tasks CRUD (incl. add-from-project & Employee App integration)

## Why

Tasks are the fundamental building blocks of work reporting in Abra Timesheet. Every time entry logged by an employee belongs to a specific task within a project. To enable time tracking and task assignment management (KAN-44 / Epic 4: Entity Management), administrators must be able to create, view, edit, filter, and close/delete tasks, both from a dedicated `/admin/tasks` screen and directly from a project's view (`/admin/projects` with `add-task-from-project` flow per PRD p.8 and Jira KAN-52). Furthermore, the Employee App (`apps/mobile`) must filter task pickers strictly to open tasks while continuing to render task names on historical entries.

## What Changes

- **Contracts (`packages/contracts/`)**: Define type-safe Zod validation contracts for Task CRUD operations (`CreateTaskSchema`, `UpdateTaskSchema`, `TaskResponseSchema`, `QueryTasksSchema`) enforcing VAL-24 (task name required) and VAL-25 (project references an active, non-deleted project).
- **Backend API (`server/api/src/modules/tasks/`)**: Implement §12.5 endpoints:
  - `GET /api/v1/tasks` (with optional `projectId` and `includeDeleted` query params)
  - `POST /api/v1/tasks` (creates task under active project)
  - `GET /api/v1/tasks/:id`
  - `PATCH /api/v1/tasks/:id` (updates name, description, status)
  - `DELETE /api/v1/tasks/:id` (soft-delete: sets `status = CLOSED` and `deleted_at = now()`, keeping existing assignments intact while removing task from employee pickers)
- **Admin UI (`apps/admin/src/features/tasks/`)**: Build `/admin/tasks` page matching Figma designs, featuring:
  - Tasks data table with project filter, status badge (OPEN / CLOSED), search, and pagination.
  - Create Task modal and Edit Task modal.
  - Delete/Close confirmation dialog adhering to §8.3 soft delete rules.
  - URL parameter pre-filtering (`/admin/tasks?projectId=xyz`).
- **Project Screen Integration (`apps/admin/src/features/projects/`)**: Add "Add Task" action and inline task creation modal from the Projects screen (PRD p.8 / KAN-52).
- **Employee App (`apps/mobile/src/`)**:
  - Task Picker Filtering: Ensures the task picker fetches/filters ONLY open tasks (`status = 'OPEN'` and `deleted_at IS NULL`), explicitly excluding closed or soft-deleted tasks without sending `includeDeleted=true`.
  - Historical Data Rendering: Ensures historical time entries logged under tasks that were subsequently closed/soft-deleted continue to correctly display the original task name.

## Capabilities

### New Capabilities

- `tasks-crud`: Full admin management of Task entities via API endpoints (`GET/POST/PATCH/DELETE /api/v1/tasks`) and `/admin/tasks` frontend screen. Enforces VAL-24 and VAL-25, soft delete semantics (§8.3), and URL pre-filtering.
- `add-task-from-project`: Ability to trigger task creation modal pre-populated with a project's ID directly from the Projects table / row actions (`/admin/projects`).
- `employee-task-picker`: Employee task picker filtering (active/open tasks only) and historical rendering preservation for closed tasks.

### Modified Capabilities

- `projects-crud`: Added "Add Task" button and "View Tasks" drill-down navigation link to Project rows.

## Impact

- **API (`server/api/`)**: `TasksModule`, `TasksController`, `TasksService` updated/verified for §12.5 REST standards and soft-delete behavior.
- **Admin UI (`apps/admin/`)**: New `tasks-page.tsx`, `task-create-modal.tsx`, `task-edit-modal.tsx`, `task-delete-modal.tsx`, updated `projects-page.tsx`.
- **Employee UI (`apps/mobile/`)**: Updated task picker and time entry history rendering logic.
- **Contracts (`packages/contracts/`)**: Schema definitions in `src/tasks/` and exports in `src/index.ts`.
- **Figma Design Compliance**: Directly models node `0-1` in Figma design (`https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/...`).
