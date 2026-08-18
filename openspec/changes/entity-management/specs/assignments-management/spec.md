## Purpose

Enables admins to create and remove user-to-task assignments, which control which tasks employees can report time against via the cascading picker.

## ADDED Requirements

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
