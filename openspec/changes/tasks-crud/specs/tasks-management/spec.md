# Spec: Tasks Management

## ADDED Requirements

### Requirement: Task Creation and Validation

The system SHALL allow admin users to create tasks assigned to a specific project.

- **VAL-24**: The task name MUST be provided and non-empty.
- **VAL-25**: The referenced project MUST exist, be active (`status = 'ACTIVE'`), and not be soft-deleted (`deleted_at IS NULL`).

#### Scenario: Admin creates a task with valid project

- **WHEN** admin submits `POST /api/v1/tasks` with valid name and active `projectId`
- **THEN** system creates the task record and returns HTTP 201 Created.

#### Scenario: Task creation fails when project is inactive or deleted (VAL-25)

- **WHEN** admin attempts to create a task for an inactive or soft-deleted project
- **THEN** system rejects with HTTP 400 Bad Request and validation error `VAL-25: Project is not active or deleted`.

### Requirement: Add Task from Project Screen (PRD p.8)

The admin console SHALL provide an "Add Task" action on each project row in `/admin/projects`.

#### Scenario: Admin opens add-task modal from project row

- **WHEN** admin clicks "+ הוספת משימה" on a project row in `/admin/projects`
- **THEN** Task Creation Modal opens with `projectId` pre-populated and locked to that project.

### Requirement: Task Soft-Delete Semantics (§8.3)

Deleting a task via `DELETE /api/v1/tasks/:id` SHALL set `status = 'CLOSED'` and set `deleted_at` to the current timestamp.

#### Scenario: Soft-deleting a task updates status and preserves assignments

- **WHEN** admin deletes a task
- **THEN** task status becomes `CLOSED`, `deleted_at` is set to timestamp, existing `TaskAssignment` records remain intact, and task is hidden from employee time entry pickers.

### Requirement: Task Listing and Filtering

The admin console `/admin/tasks` screen SHALL list all tasks and support filtering by `projectId`.

#### Scenario: Admin filters tasks by project via URL query param

- **WHEN** admin navigates to `/admin/tasks?projectId=proj_123`
- **THEN** task table displays only tasks belonging to `proj_123` and pre-selects `proj_123` in the filter dropdown.

### Requirement: Employee Task Picker Filtering

The task picker in the employee time-entry screen (`apps/mobile`) MUST fetch and display ONLY open tasks.

- It MUST strictly exclude any tasks where `status = 'CLOSED'` or `deleted_at IS NOT NULL`.
- The employee app SHALL NOT pass `includeDeleted=true` when requesting task assignments or task lists.

#### Scenario: Employee opens daily time-entry task picker

- **WHEN** employee opens the task picker on the daily time-entry screen
- **THEN** picker displays only active tasks assigned to the employee where `status = 'OPEN'` and `deleted_at IS NULL`, and strictly excludes closed or soft-deleted tasks.

### Requirement: Historical Time Entry Data Rendering

Historical time entries previously logged by employees MUST continue to correctly render the task name, project name, and client name, even if that task was later closed or soft-deleted by an admin.

#### Scenario: Displaying historical time entry with closed task

- **WHEN** employee views historical time entries (e.g. monthly view or daily history) containing entries logged under a task that was subsequently closed or soft-deleted
- **THEN** historical time entry correctly renders the original task name without errors or missing label states.
