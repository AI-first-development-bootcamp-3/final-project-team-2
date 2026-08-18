# tasks-crud Specification

## Purpose

Enables admins to manage the Task entity -- the leaf level of the Client > Project > Task hierarchy -- with project foreign-key validation, open/closed status, and URL-aware project pre-filtering.

## Requirements

### Requirement: List tasks with project and client name joins

The API SHALL expose `GET /api/v1/tasks` (admin only) returning a paginated list of tasks. Each item SHALL include `projectName` and `clientName` resolved from the parent relationships.

#### Scenario: Default listing

- **WHEN** an admin calls `GET /api/v1/tasks` with no query params
- **THEN** the API SHALL return page 1 with limit 20, sorted by name ascending, excluding soft-deleted tasks, each item including `projectName` and `clientName`

#### Scenario: Filter by project

- **WHEN** an admin calls `GET /api/v1/tasks?projectId={uuid}`
- **THEN** the API SHALL return only tasks belonging to that project

#### Scenario: Filter by status

- **WHEN** an admin calls `GET /api/v1/tasks?status=closed`
- **THEN** the API SHALL return only closed tasks

#### Scenario: Search by name

- **WHEN** an admin calls `GET /api/v1/tasks?q=design`
- **THEN** the API SHALL return only tasks whose name contains "design" (case-insensitive)

### Requirement: Get task by ID

The API SHALL expose `GET /api/v1/tasks/:id` (admin only) returning a single task with `projectName` and `clientName`.

#### Scenario: Task exists

- **WHEN** an admin calls `GET /api/v1/tasks/:id` with a valid UUID
- **THEN** the API SHALL return `{ data: Task }` with status 200

#### Scenario: Task not found

- **WHEN** an admin calls `GET /api/v1/tasks/:id` with a non-existent or soft-deleted UUID
- **THEN** the API SHALL return status 404

### Requirement: Create task with project validation

The API SHALL expose `POST /api/v1/tasks` (admin only) to create a new task.

#### Scenario: Successful creation

- **WHEN** an admin sends `{ name: "New Task", projectId: "{valid-active-project-uuid}" }`
- **THEN** the API SHALL create the task with `status: open` and return `{ data: Task }` with status 201

#### Scenario: Missing name (VAL-24)

- **WHEN** an admin sends `{ name: "" }` or omits the name field
- **THEN** the API SHALL return status 400 with error details containing rule `VAL-24`

#### Scenario: Invalid project reference (VAL-25)

- **WHEN** an admin sends a `projectId` that references an inactive, soft-deleted, or non-existent project
- **THEN** the API SHALL return status 422 with error details containing rule `VAL-25`

#### Scenario: Optional description

- **WHEN** an admin sends `{ name: "Task", projectId: "{uuid}", description: "Details..." }`
- **THEN** the API SHALL store the description text

### Requirement: Update task

The API SHALL expose `PATCH /api/v1/tasks/:id` (admin only) to update a task's name, description, projectId, or status.

#### Scenario: Successful update

- **WHEN** an admin sends `{ name: "Updated Task" }` to a valid task ID
- **THEN** the API SHALL update the task and return `{ data: Task }` with status 200

#### Scenario: Change status to closed

- **WHEN** an admin sends `{ status: "closed" }` to a task
- **THEN** the API SHALL set `status: closed` but SHALL NOT set `deleted_at` (explicit close without delete)

#### Scenario: Project re-validated on update

- **WHEN** an admin changes `projectId` to a UUID referencing an inactive or deleted project
- **THEN** the API SHALL return status 422 with rule `VAL-25`

### Requirement: Soft delete task with close semantics

The API SHALL expose `DELETE /api/v1/tasks/:id` (admin only). Unlike other entities, deleting a task SHALL set both `status: closed` AND `deleted_at`.

#### Scenario: Delete sets status and deleted_at

- **WHEN** an admin calls `DELETE /api/v1/tasks/:id`
- **THEN** the API SHALL set `status = 'closed'` AND `deleted_at = NOW()` and return status 204

#### Scenario: Delete does not remove assignments

- **WHEN** a task is soft-deleted
- **THEN** existing TaskAssignment rows for that task SHALL NOT be removed

### Requirement: Admin console tasks page with URL-aware filtering

The admin console SHALL provide a tasks management page at `/admin/tasks` that reads `?projectId=` from the URL to pre-filter the table.

#### Scenario: Page renders task table

- **WHEN** an admin navigates to `/admin/tasks`
- **THEN** the page SHALL display a DataTable with columns: name, project name, client name, status (open/closed badge), description (truncated), and action buttons

#### Scenario: URL pre-filter from projects page

- **WHEN** an admin navigates to `/admin/tasks?projectId={uuid}`
- **THEN** the table SHALL be pre-filtered to show only tasks for that project, and the project filter dropdown SHALL be pre-selected

#### Scenario: Create task modal with project pre-selection

- **WHEN** an admin clicks "משימה חדשה" while `?projectId=` is in the URL
- **THEN** the CrudModal SHALL open with the project dropdown pre-selected to that project

#### Scenario: Create task modal without pre-selection

- **WHEN** an admin clicks "משימה חדשה" without a projectId in the URL
- **THEN** the CrudModal SHALL open with the project dropdown showing all active projects, none pre-selected
