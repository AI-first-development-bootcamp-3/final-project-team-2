# Technical & UI Design: Tasks CRUD (incl. add-from-project)

## Overview

This specification details the technical architecture, data flow, validation rules, API endpoints, and UI components for **Tasks CRUD** within Abra Timesheet (Epic 4: Entity Management, KAN-44 / KAN-52).

Figma Design Reference: [Time Report Files - Admin Web Portal](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/%E2%8F%B0-Time-report-files-%E2%8F%B0--1-?timeline=keyframe&node-id=0-1&p=f&t=eqnq7B5ZQf8z458q-0)

---

## 1. Domain Rules & Validation

### Validation Rules (Registry §9.3)

- **VAL-24 (Task Name Required)**: `name` must be a non-empty string (trimmed length >= 1).
- **VAL-25 (Active Project Reference)**: `projectId` must reference an existing `Project` record where `status = 'ACTIVE'` and `deleted_at IS NULL`. If referenced project is closed or soft-deleted, reject with HTTP 400 (`VAL-25: Project is not active or deleted`).

### Soft Delete & Cascade Rules (§8.3)

- **Task "Deletion"**: Calling `DELETE /api/v1/tasks/:id` updates the record to `status = 'CLOSED'` and `deleted_at = NOW()`.
- **Assignment Preservation**: Soft-deleting/closing a task does **NOT** remove existing `TaskAssignment` records.
- **Historical Reporting Preservation**: Existing `TimeEntry` records linked to closed tasks continue to render normally in historical reporting screens (e.g., Monthly view, Admin reports).
- **Picker Visibility**: Closed or soft-deleted tasks (`status = CLOSED` or `deleted_at != NULL`) are automatically hidden from employee time-entry pickers (`GET /api/v1/me/assignments`).
- **Admin Visibility**: Admin `/admin/tasks` displays tasks with status badges. By default, active tasks are listed; passing `?includeDeleted=true` includes closed/deleted tasks.

---

## 2. API Architecture (§12.5 Endpoints)

### `GET /api/v1/tasks`

- **Query Params**:
  - `projectId?: string` - Filter tasks belonging to a specific project.
  - `includeDeleted?: boolean` - Defaults to `false`.
- **Response**: `200 OK` with list of task objects including parent `project` details (`name`, `clientId`, `clientName`).

### `POST /api/v1/tasks`

- **Body**:
  ```json
  {
    "name": "Frontend Refactoring",
    "projectId": "proj_123",
    "description": "Optional task details"
  }
  ```
- **Validation**:
  - `name`: non-empty string (VAL-24).
  - `projectId`: valid UUID/CUID referencing active project (VAL-25).
- **Response**: `201 Created` with task payload.

### `PATCH /api/v1/tasks/:id`

- **Body**: `{ "name"?: string, "description"?: string, "status"?: "OPEN" | "CLOSED" }`
- **Response**: `200 OK` with updated task payload.

### `DELETE /api/v1/tasks/:id`

- **Behavior**: Sets `status = 'CLOSED'` and `deleted_at = new Date()`.
- **Response**: `200 OK` or `204 No Content`.

---

## 3. Admin UI Layout & User Experience

### 3.1 `/admin/tasks` Screen

1. **Header**: "משימות" (Tasks) heading with search bar, Project dropdown filter, and "+ יצירת משימה" button.
2. **DataTable**:
   - Columns: שם המשימה (Task Name), פרויקט (Project), לקוח (Client), תיאור (Description), סטטוס (Status), פעולות (Actions).
   - Status Badge: `פתוח` (Green/Open) / `סגור` (Gray/Closed).
   - Actions: עריכה (Edit), סגירת משימה (Close/Delete).
3. **URL State Synchronization**: Navigating to `/admin/tasks?projectId=XYZ` automatically filters table rows to project `XYZ` and sets the project filter dropdown.

### 3.2 Add Task from Project Flow (PRD p.8 / KAN-52)

1. On `/admin/projects`, each row includes an action button: **"+ הוספת משימה"**.
2. Clicking "+ הוספת משימה" opens the `TaskCreateModal` with the `projectId` pre-selected and read-only/disabled for change.
3. Submitting the modal creates the task and updates both local state and project task counters without requiring full page reload.

---

## 4. Security & Permissions

- All task management endpoints require `JwtAuthGuard` and `RolesGuard` enforcing `Role.ADMIN`.
- Non-admin users attempting to invoke `/api/v1/tasks` endpoints receive `403 Forbidden`.
