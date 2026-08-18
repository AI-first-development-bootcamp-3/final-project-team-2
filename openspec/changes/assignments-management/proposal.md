# Proposal: Assign users to tasks (Assignments CRUD & Employee Scoping)

## Why

Assigning users to tasks is a fundamental pillar of Epic 4 (Entity Management / KAN-44). Employee time-entry pickers (§8.2) are scoped exclusively to tasks assigned to that employee. Without task assignments, employees cannot select tasks or record time entries. Adding and removing assignments allows administrators to grant or revoke reporting permissions per task while preserving existing historical time entries intact.

## What Changes

- **Contracts (`packages/contracts/`)**: Define type-safe Zod validation contracts for Assignment operations (`CreateAssignmentBodySchema`, `AssignmentListItemSchema`, `QueryAssignmentsSchema`) enforcing VAL-26 (user and task must exist and be active) and VAL-27 (uniqueness per `(userId, taskId)` pair).
- **Backend API (`server/api/src/modules/assignments/`)**: Implement §12.6 REST endpoints:
  - `GET /api/v1/assignments` (filterable by `userId` and `taskId`, supporting pagination and sorting).
  - `POST /api/v1/assignments` (creates user ↔ task join record; throws HTTP 409 Conflict if `(userId, taskId)` pair already exists).
  - `DELETE /api/v1/assignments/:id` (removes assignment record, blocking NEW reporting on that task without deleting or altering existing `TimeEntry` records).
- **Admin UI (`apps/admin/src/features/assignments/`)**: Build `/admin/assignments` page matching Figma designs, featuring:
  - Data table displaying employee name, task name, project name, client name, and assignment actions.
  - User filter dropdown and Task filter dropdown.
  - "שיוך עובד למשימה" (Assign Employee to Task) modal dialog with employee and task pickers.
  - Delete/Remove assignment confirmation modal.
- **Employee App Scoping (§8.2)**: `GET /api/v1/me/assignments` returns active assignments for the authenticated employee. API tests assert that an unassigned user receives 403 Forbidden when attempting to record a time entry for an unassigned task.

## Capabilities

### New Capabilities

- `assignments-management`: Admin management of Task Assignments via §12.6 API endpoints (`GET/POST/DELETE /api/v1/assignments`) and `/admin/assignments` console page. Enforces VAL-26 and VAL-27 (duplicate → HTTP 409 Conflict) and hard delete semantics.
- `employee-assignment-scoping`: Scoping employee pickers (§8.2) to assigned tasks only, preventing unassigned time entry writes.

### Modified Capabilities

- `tasks-crud`: Integrated assignment counts and employee assignment actions.

## Impact

- **API (`server/api/`)**: `AssignmentsModule`, `AssignmentsController`, `AssignmentsService` updated/verified for §12.6 REST standards and 409 Conflict duplicate handling.
- **Admin UI (`apps/admin/`)**: New `assignments-page.tsx`, `assignment-create-form.tsx`, `assignment-delete-modal.tsx`.
- **Contracts (`packages/contracts/`)**: Schema definitions in `src/assignments/` and exports in `src/index.ts`.
- **Figma Design Compliance**: Directly models assignment table and modal screens in Figma design (`https://figma.com/design/3CK80SB84FluVRrWCDlmaw/...`).
