# Technical & UI Design: Assign users to tasks (Assignments CRUD)

## Overview

This specification details the technical architecture, data validation, API endpoints, and UI components for **Assigning users to tasks** within Abra Timesheet (Epic 4: Entity Management, KAN-44).

Figma Design Reference: [Time Report Files - Admin Web Portal](https://figma.com/design/3CK80SB84FluVRrWCDlmaw/%E2%8F%B0-Time-report-files-%E2%8F%B0--1-?timeline=keyframe&t=Te9tJMDcJn4cKVKc-0)

---

## 1. Domain Rules & Validation

### Validation Rules (Registry §9.3)

- **VAL-26 (Valid References)**: `userId` must reference an existing active `User` record, and `taskId` must reference an existing open `Task` record. If either reference is missing, inactive, or soft-deleted, return HTTP 400/422.
- **VAL-27 (Assignment Uniqueness)**: The pair `(userId, taskId)` MUST be unique. If an assignment already exists for the given user and task, return **HTTP 409 Conflict** with message `VAL-27: User is already assigned to this task`.

### Assignment Scope & Deletion Rules (§8.2, §8.3)

- **Employee App Picker Scoping**: `GET /api/v1/me/assignments` queries `TaskAssignment` records for the logged-in user where task is open and active, returning only assigned task chains.
- **Time Entry Access Control**: Creating a time entry for a task requires the employee to be assigned to that task. Unassigned users receive HTTP 403 Forbidden.
- **Hard Delete Semantics**: Deleting an assignment via `DELETE /api/v1/assignments/:id` deletes the `TaskAssignment` record. Removing an assignment:
  - Immediately blocks **NEW** time entry reporting on that task for the unassigned employee.
  - **NEVER** deletes, alters, or hides existing historical `TimeEntry` records logged under that task.

---

## 2. API Architecture (§12.6 Endpoints)

### `GET /api/v1/assignments`

- **Query Params**:
  - `userId?: string` - Filter assignments for a specific user.
  - `taskId?: string` - Filter assignments for a specific task.
  - `page?: number` (default 1)
  - `limit?: number` (default 20)
- **Response**: `200 OK` with paginated list of assignment items including user full name, email, task name, project name, and client name.

### `POST /api/v1/assignments`

- **Body**:
  ```json
  {
    "userId": "usr_123",
    "taskId": "tsk_456"
  }
  ```
- **Validation**:
  - Validates `userId` and `taskId` presence and existence (VAL-26).
  - Checks if `(userId, taskId)` pair already exists in `TaskAssignment` table. If existing, returns **HTTP 409 Conflict** (VAL-27).
- **Response**: `201 Created` with assignment payload.

### `DELETE /api/v1/assignments/:id`

- **Behavior**: Deletes the `TaskAssignment` join record by ID.
- **Response**: `204 No Content`.

---

## 3. Admin UI Layout & User Experience

### 3.1 `/admin/assignments` Screen

1. **Header**: "שיוכי משימות" (Task Assignments) heading with "+ שיוך עובד למשימה" button.
2. **Filters**:
   - `עובד` (Employee) dropdown filter.
   - `משימה` (Task) dropdown filter.
3. **DataTable**:
   - Columns: שם עובד (Employee Name), אימייל (Email), משימה (Task Name), פרויקט (Project Name), לקוח (Client Name), פעולות (Actions).
   - Actions: ביטול שיוך (Remove Assignment button).
4. **Assign Employee Modal (`assignment-create-form.tsx`)**:
   - Select Employee (filtered to active users).
   - Select Task (filtered to open tasks with parent project and client names).
   - Displays inline Hebrew validation error if 409 Conflict is returned.
5. **Remove Assignment Modal (`assignment-delete-modal.tsx`)**:
   - Confirmation dialog explaining that removing an assignment blocks new reporting but preserves historical entries.
