# projects-crud Specification

## Purpose

Enables admins to manage the Project entity -- the middle level of the Client > Project > Task hierarchy -- with foreign-key validation against active clients and drill-down navigation to tasks.

## Requirements

### Requirement: List projects with client name join

The API SHALL expose `GET /api/v1/projects` (admin only) returning a paginated list of projects. Each item SHALL include `clientName` resolved from the parent client relationship.

#### Scenario: Default listing

- **WHEN** an admin calls `GET /api/v1/projects` with no query params
- **THEN** the API SHALL return page 1 with limit 20, sorted by name ascending, excluding soft-deleted projects, each item including `clientName`

#### Scenario: Filter by client

- **WHEN** an admin calls `GET /api/v1/projects?clientId={uuid}`
- **THEN** the API SHALL return only projects belonging to that client

#### Scenario: Search by name

- **WHEN** an admin calls `GET /api/v1/projects?q=website`
- **THEN** the API SHALL return only projects whose name contains "website" (case-insensitive)

#### Scenario: Include deleted projects

- **WHEN** an admin calls `GET /api/v1/projects?includeDeleted=true`
- **THEN** the API SHALL include soft-deleted projects in the results

### Requirement: Get project by ID

The API SHALL expose `GET /api/v1/projects/:id` (admin only) returning a single project with `clientName`.

#### Scenario: Project exists

- **WHEN** an admin calls `GET /api/v1/projects/:id` with a valid UUID
- **THEN** the API SHALL return `{ data: Project }` with status 200, including `clientName`

#### Scenario: Project not found

- **WHEN** an admin calls `GET /api/v1/projects/:id` with a non-existent or soft-deleted UUID
- **THEN** the API SHALL return status 404

### Requirement: Create project with client validation

The API SHALL expose `POST /api/v1/projects` (admin only) to create a new project.

#### Scenario: Successful creation

- **WHEN** an admin sends `{ name: "New Project", clientId: "{valid-active-client-uuid}" }`
- **THEN** the API SHALL create the project with `isActive: true` and return `{ data: Project }` with status 201

#### Scenario: Missing name (VAL-22)

- **WHEN** an admin sends `{ name: "" }` or omits the name field
- **THEN** the API SHALL return status 400 with error details containing rule `VAL-22`

#### Scenario: Invalid client reference (VAL-23)

- **WHEN** an admin sends a `clientId` that references an inactive, soft-deleted, or non-existent client
- **THEN** the API SHALL return status 422 with error details containing rule `VAL-23`

### Requirement: Update project

The API SHALL expose `PATCH /api/v1/projects/:id` (admin only) to update a project's name, clientId, or isActive status.

#### Scenario: Successful update

- **WHEN** an admin sends `{ name: "Updated Project" }` to a valid project ID
- **THEN** the API SHALL update the project and return `{ data: Project }` with status 200

#### Scenario: Client re-validated on update

- **WHEN** an admin changes `clientId` to a UUID that references an inactive or deleted client
- **THEN** the API SHALL return status 422 with rule `VAL-23`

#### Scenario: Deactivation does not cascade

- **WHEN** an admin sets `{ isActive: false }` on a project that has open tasks
- **THEN** the API SHALL deactivate only the project; its tasks SHALL remain unchanged

### Requirement: Soft delete project

The API SHALL expose `DELETE /api/v1/projects/:id` (admin only) to soft-delete a project.

#### Scenario: Successful soft delete

- **WHEN** an admin calls `DELETE /api/v1/projects/:id`
- **THEN** the API SHALL set `deleted_at` to the current timestamp and return status 204

#### Scenario: Soft delete does not cascade

- **WHEN** a project is soft-deleted
- **THEN** its tasks SHALL NOT be soft-deleted or closed

### Requirement: Admin console projects page

The admin console SHALL provide a projects management page at `/admin/projects` with a data table, client filter, and CRUD modals.

#### Scenario: Page renders project table

- **WHEN** an admin navigates to `/admin/projects`
- **THEN** the page SHALL display a DataTable with columns: name, client name, status, task count, and action buttons

#### Scenario: Client filter dropdown

- **WHEN** an admin selects a client from the filter dropdown
- **THEN** the table SHALL show only projects belonging to that client

#### Scenario: Create project modal with client picker

- **WHEN** an admin clicks "פרויקט חדש"
- **THEN** a CrudModal SHALL open with fields: name (required), clientId (required dropdown showing only active clients)

#### Scenario: View Tasks drill-down

- **WHEN** an admin clicks the "View Tasks" action on a project row
- **THEN** the browser SHALL navigate to `/admin/tasks?projectId={id}`
