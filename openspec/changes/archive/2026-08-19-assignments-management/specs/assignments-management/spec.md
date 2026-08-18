# Spec: Assignments Management

## ADDED Requirements

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
