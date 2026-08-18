# assignments-management Specification

## Purpose

Enables admins to create and remove user-to-task assignments, which control which tasks employees can report time against via the cascading picker.

## Requirements

### Requirement: List assignments with full entity names

The API SHALL expose `GET /api/v1/assignments` (admin only) returning a paginated list of assignments. Each item SHALL include `userFullName`, `userEmail`, `taskName`, `projectName`, and `clientName` resolved from the related entities.

#### Scenario: Default listing

- **WHEN** an admin calls `GET /api/v1/assignments` with no query params
- **THEN** the API SHALL return page 1 with limit 20, including all resolved names

#### Scenario: Filter by user

- **WHEN** an admin calls `GET /api/v1/assignments?userId={uuid}`
- **THEN** the API SHALL return only assignments for that user

#### Scenario: Filter by task

- **WHEN** an admin calls `GET /api/v1/assignments?taskId={uuid}`
- **THEN** the API SHALL return only assignments for that task

#### Scenario: Search by user or task name

- **WHEN** an admin calls `GET /api/v1/assignments?q=alice`
- **THEN** the API SHALL return assignments where the user's full name or the task's name contains "alice" (case-insensitive)

### Requirement: Create assignment with uniqueness enforcement

The API SHALL expose `POST /api/v1/assignments` (admin only) to create a new user-to-task assignment.

#### Scenario: Successful creation

- **WHEN** an admin sends `{ userId: "{uuid}", taskId: "{uuid}" }` with a valid, non-duplicate pair
- **THEN** the API SHALL create the assignment and return `{ data: AssignmentListItem }` with status 201

#### Scenario: Invalid references (VAL-26)

- **WHEN** an admin sends a `userId` or `taskId` that does not reference an existing user or task
- **THEN** the API SHALL return status 422 with error details containing rule `VAL-26`

#### Scenario: Duplicate assignment (VAL-27)

- **WHEN** an admin sends a `(userId, taskId)` pair that already exists
- **THEN** the API SHALL return status 409 with error details containing rule `VAL-27`

### Requirement: Remove assignment by hard delete

The API SHALL expose `DELETE /api/v1/assignments/:id` (admin only) to remove an assignment. This is a hard delete (TaskAssignment has no `deleted_at` column).

#### Scenario: Successful removal

- **WHEN** an admin calls `DELETE /api/v1/assignments/:id` with a valid assignment ID
- **THEN** the API SHALL delete the row and return status 204

#### Scenario: Removal preserves historical entries

- **WHEN** an assignment is removed
- **THEN** existing TimeEntry rows referencing that task for that user SHALL NOT be modified or deleted

#### Scenario: Removal blocks new reporting

- **WHEN** an assignment is removed and the employee attempts to create a new TimeEntry for that task
- **THEN** the time-entries API SHALL reject the request with status 403

#### Scenario: Assignment not found

- **WHEN** an admin calls `DELETE /api/v1/assignments/:id` with a non-existent UUID
- **THEN** the API SHALL return status 404

### Requirement: Admin console assignments page

The admin console SHALL provide an assignments management page at `/admin/assignments` with a data table showing all assignments and actions to create or remove them.

#### Scenario: Page renders assignments table

- **WHEN** an admin navigates to `/admin/assignments`
- **THEN** the page SHALL display a DataTable with columns: user full name, user email, task name, project name, client name, and a remove action button

#### Scenario: Create assignment form

- **WHEN** an admin clicks "שיוך חדש"
- **THEN** a CrudModal SHALL open with two dropdown fields: user (active users list) and task (open tasks list)

#### Scenario: Duplicate error display

- **WHEN** a create submission returns 409
- **THEN** the modal SHALL display "השיוך כבר קיים במערכת" as an error message

#### Scenario: No edit action

- **WHEN** an admin views the assignments table
- **THEN** there SHALL be no edit button -- assignments can only be created or removed

### Requirement: Assignment Creation and Validation (VAL-26, VAL-27)

The system SHALL allow admin users to assign a user to a task via `POST /api/v1/assignments`.

- **VAL-26**: The `userId` MUST reference an existing active user, and `taskId` MUST reference an existing open task.
- **VAL-27**: The pair `(userId, taskId)` MUST be unique.
- If the assignment pair `(userId, taskId)` already exists, the system SHALL return **HTTP 409 Conflict** with error code `VAL-27`.

#### Scenario: Admin creates a valid user-to-task assignment

- **WHEN** admin submits `POST /api/v1/assignments` with valid `userId` and `taskId`
- **THEN** system creates the assignment join record and returns HTTP 201 Created.

#### Scenario: Creating a duplicate assignment returns HTTP 409 Conflict (VAL-27)

- **WHEN** admin attempts to create an assignment for a `(userId, taskId)` pair that already exists
- **THEN** system rejects with HTTP 409 Conflict and message `VAL-27: User is already assigned to this task`.

### Requirement: Assignment Listing and Filtering

The admin console `/admin/assignments` screen SHALL list task assignments and support filtering by `userId` and `taskId`.

#### Scenario: Admin filters assignments by user or task

- **WHEN** admin selects a user or task in the filter dropdown on `/admin/assignments`
- **THEN** assignment table displays only assignments matching the selected criteria.

### Requirement: Assignment Removal and Reporting Scoping (§8.2, §8.3)

Deleting an assignment via `DELETE /api/v1/assignments/:id` SHALL remove the assignment join record.

- Removing an assignment SHALL immediately block **NEW** time entry reporting on that task for the unassigned employee (unassigned write attempts return HTTP 403 Forbidden).
- Removing an assignment SHALL NOT delete, modify, or conceal existing historical `TimeEntry` records.

#### Scenario: Removing an assignment blocks new reporting but preserves existing entries

- **WHEN** admin removes an assignment
- **THEN** assignment record is deleted, employee no longer sees task in `/me/assignments`, new time entry submissions return HTTP 403 Forbidden, and existing historical time entries continue rendering intact.
