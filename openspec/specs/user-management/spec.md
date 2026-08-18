# user-management Specification

## Purpose

Admin-side user lifecycle from the console: editing a user's profile, role, and HR metadata, resetting passwords with immediate revocation of the user's existing sessions, and deactivating/restoring users via soft-delete with instant logout (KAN-48).

## Requirements

### Requirement: Admin can edit a user's profile, role, and HR metadata

The system SHALL allow an authenticated admin to update a user's full name, email, role, and HR metadata via `PATCH /api/v1/users/:id`. Validation: `fullName` min 2 chars (optional on partial update); `email` valid format and unique across all non-deleted users (409 Conflict when taken by another user); `role` is `admin` or `employee`; optional HR fields `employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage` (1–100), `orgUnit`. Every successful PATCH SHALL update the record's `updated_at` timestamp for audit visibility. `isActive` modification is excluded from this endpoint.

#### Scenario: Successful edit updates the record and the table

- **WHEN** an admin updates a user's full name, role, and HR metadata via the edit modal and submits
- **THEN** the record updates in the database, `updated_at` changes, and the users-table row refreshes with the new values

#### Scenario: Duplicate email is rejected

- **WHEN** an admin changes user X's email to an email already owned by user Y
- **THEN** the API returns 409 Conflict and the UI displays "כתובת האימייל כבר קיימת במערכת"

#### Scenario: Non-admin is forbidden

- **WHEN** an employee token calls `PATCH /api/v1/users/:id`
- **THEN** the API rejects with 403 Forbidden

### Requirement: Admin can reset a user's password with immediate session revocation

The system SHALL allow an authenticated admin to set a new password for any user via `POST /api/v1/users/:id/reset-password` (min 8 characters). The new password SHALL be bcrypt-hashed; the operation SHALL update `updated_at` and increment `token_version` so the user's existing JWT sessions are immediately revoked.

#### Scenario: Old sessions die on reset

- **WHEN** an admin resets user X's password and X then makes a request with a previously issued token
- **THEN** the request is rejected with 401 Unauthorized

#### Scenario: Non-admin is forbidden

- **WHEN** an employee token calls the reset-password endpoint
- **THEN** the API rejects with 403 Forbidden

### Requirement: Admin console provides edit and reset-password actions

The console `UsersPage` SHALL provide row actions opening Hebrew RTL modals: an edit form (full name, email, role selector אדמין/משתמש רגיל, HR metadata inputs) and a reset-password form (new password + confirmation), with clear Hebrew error messages on validation failures and duplicate email.

#### Scenario: Edit flow round-trips through the modal

- **WHEN** an admin opens the edit modal, changes fields, and submits successfully
- **THEN** the modal closes and the table shows the updated values without a full page reload

#### Scenario: Validation errors surface in Hebrew

- **WHEN** a submitted form violates a validation rule (short name, invalid email, short password)
- **THEN** the field-level Hebrew message is shown and nothing is saved

### Requirement: Admin can deactivate a user with instant session revocation

The system SHALL allow an authenticated admin to soft-delete a user via `DELETE /api/v1/users/:id`: `is_active` becomes `false`, `deleted_at` and `updated_at` are set to the current timestamp, and `token_version` is incremented so all of the user's existing JWT and refresh tokens are immediately invalidated. Historical `TimeEntry` and `Absence` records belonging to the user MUST remain intact and continue to display the user's name (no cascade deletion).

#### Scenario: Deactivation logs the user out immediately

- **WHEN** an admin deactivates user X while X holds a live, unexpired token, and X then sends any request
- **THEN** the request is rejected with 401 Unauthorized

#### Scenario: Historical records survive deactivation

- **WHEN** user X with existing time entries and absences is deactivated
- **THEN** those records remain intact and keep displaying X's full name on reports

### Requirement: Authenticated requests from inactive users are rejected

The authentication guard SHALL check the user's live database state on every authenticated request: if `is_active` is `false` or `deleted_at` is set, the request MUST be rejected with 401 Unauthorized regardless of token validity.

#### Scenario: A stale token cannot outlive deactivation

- **WHEN** any request arrives bearing a syntactically valid token for a user whose record is inactive or soft-deleted
- **THEN** the API responds 401 Unauthorized

### Requirement: Admin can restore a deactivated user

The system SHALL allow an authenticated admin to reactivate a soft-deleted user via `POST /api/v1/users/:id/restore`: `is_active` becomes `true`, `deleted_at` becomes `null`, `updated_at` is refreshed, and the user's existing `password_hash` is preserved untouched.

#### Scenario: Restore re-enables login with the original password

- **WHEN** an admin restores user X and X logs in with their pre-deactivation password
- **THEN** authentication succeeds

### Requirement: Directory listing hides deactivated users by default

`GET /api/v1/users` SHALL exclude soft-deleted users by default; with `?includeDeleted=true` they SHALL be returned with `isActive: false` and shown as "לא פעיל". The console SHALL confirm deactivation and restoration through Hebrew confirmation modals and report the outcome with Hebrew notifications.

#### Scenario: Deactivated users appear only on request

- **WHEN** an admin lists users without parameters, then again with `includeDeleted=true`
- **THEN** the soft-deleted user is absent from the first response and present in the second, marked "לא פעיל"
