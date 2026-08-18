## Purpose

Provides a single API endpoint for employees to retrieve their assigned tasks with parent project and client names, powering the cascading Client > Project > Task picker in the employee app.

## ADDED Requirements

### Requirement: Employee assignments endpoint with active-entity filtering

The API SHALL expose `GET /api/v1/me/assignments` (employee role only) returning all task assignments for the authenticated user, filtered to only include assignments where the task is open, the parent project is active and not deleted, and the parent client is active and not deleted.

#### Scenario: Employee with assignments

- **WHEN** an authenticated employee calls `GET /api/v1/me/assignments`
- **THEN** the API SHALL return `{ data: MyAssignment[] }` where each item contains `taskId`, `taskName`, `projectId`, `projectName`, `clientId`, `clientName`

#### Scenario: Inactive entities filtered out

- **WHEN** an employee has an assignment to a task whose parent project is inactive
- **THEN** that assignment SHALL NOT appear in the response

#### Scenario: Closed tasks filtered out

- **WHEN** an employee has an assignment to a task with `status: closed`
- **THEN** that assignment SHALL NOT appear in the response

#### Scenario: Deleted entities filtered out

- **WHEN** an employee has an assignment to a task whose parent client is soft-deleted
- **THEN** that assignment SHALL NOT appear in the response

#### Scenario: No pagination

- **WHEN** an employee calls `GET /api/v1/me/assignments`
- **THEN** the API SHALL return all matching assignments without pagination (employees typically have fewer than 50 assignments)

#### Scenario: Admin cannot access

- **WHEN** an admin calls `GET /api/v1/me/assignments`
- **THEN** the API SHALL return status 403

#### Scenario: Employee with no assignments

- **WHEN** an employee with no active assignments calls `GET /api/v1/me/assignments`
- **THEN** the API SHALL return `{ data: [] }` with status 200
