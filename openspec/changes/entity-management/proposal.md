## Why

Entity Management is the critical bottleneck blocking all downstream features. Daily Time Reporting (KAN-64), Monthly View (KAN-65), Absences (KAN-66), and Punch Clock (KAN-67) all depend on the Client > Project > Task hierarchy and task assignments existing in the system. Until admins can create and manage these entities, employees have nothing to report time against (only seed data exists). This is the next epic on the Jira board (KAN-44) with 6 tasks assigned and ready.

## What Changes

- **Admin sidebar navigation**: New `AdminLayout` component with persistent sidebar, replacing the current single-route redirect. Required because Entity Management adds 4 new admin routes.
- **Clients CRUD**: Full admin CRUD (list/create/edit/deactivate/soft-delete) for the Client entity via API endpoints and admin console UI.
- **Projects CRUD**: Full admin CRUD for Project, with client foreign-key validation (must reference active client). Includes "View Tasks" action that navigates to the Tasks page pre-filtered by project.
- **Tasks CRUD**: Full admin CRUD for Task, with project foreign-key validation. Delete sets both `status: closed` and `deleted_at` per spec section 8.3.
- **Task Assignments**: Admin creates/removes user-to-task assignments. Hard delete (no soft delete on TaskAssignment). Removing an assignment blocks new reporting but preserves existing TimeEntries.
- **Employee picker endpoint**: `GET /api/v1/me/assignments` returns the employee's assigned tasks with parent project and client names, filtered to only active/open entities. This is the data source for the cascading Client > Project > Task picker in the employee app.
- **Shared Zod contracts**: New schemas in `packages/contracts/` for all entity CRUD operations and the employee picker response, with validation rules VAL-20 through VAL-27 and Hebrew error messages.

## Capabilities

### New Capabilities
- `clients-crud`: Admin CRUD for Client entity -- API endpoints (GET/POST/PATCH/DELETE /api/v1/clients), admin console page with DataTable + CrudModal, Zod contracts, and unit tests.
- `projects-crud`: Admin CRUD for Project entity -- API endpoints, admin console page, client foreign-key validation (VAL-23), "View Tasks" drill-down navigation, Zod contracts, and unit tests.
- `tasks-crud`: Admin CRUD for Task entity -- API endpoints, admin console page, project foreign-key validation (VAL-25), close-on-delete behavior (status + deleted_at), URL-aware project pre-filter, Zod contracts, and unit tests.
- `assignments-management`: Admin create/remove for TaskAssignment -- API endpoints, admin console page, uniqueness enforcement (VAL-27), hard delete semantics, Zod contracts, and unit tests.
- `employee-picker-api`: Employee-facing endpoint `GET /api/v1/me/assignments` returning assigned task chains (task + project + client) filtered to active/open entities only. Powers the cascading picker in the employee app.
- `admin-shell`: Sidebar navigation component and AdminLayout wrapper for the admin console. Prerequisite for all entity management pages.
- `entity-e2e`: Playwright end-to-end spec covering the full catalog chain: admin creates client > project > task > assigns employee > employee picker returns the chain.

### Modified Capabilities
_(none -- no existing specs are changing)_

## Impact

- **API (`server/api/`)**: 4 new NestJS modules (clients, projects, tasks, assignments) + 1 new endpoint on a new me/assignments controller. Registers in `app.module.ts`.
- **Admin UI (`apps/admin/`)**: 4 new feature folders, 1 new shared component (AdminLayout + Sidebar), updated `App.tsx` routing.
- **Contracts (`packages/contracts/`)**: ~10 new files under `clients/`, `projects/`, `tasks/`, `assignments/`, `me/` directories. New VAL-20 through VAL-27 messages added to `VAL_MESSAGES`.
- **E2E (`e2e/`)**: 1 new Playwright spec for the full entity chain.
- **Prisma**: No schema changes needed -- all models (Client, Project, Task, TaskAssignment) already exist in the schema. No new migration.
- **Dependencies**: No new npm packages required. Uses existing DataTable, CrudModal, apiFetch, Prisma, NestJS patterns.
