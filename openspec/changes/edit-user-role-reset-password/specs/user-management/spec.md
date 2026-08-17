# Specification: Edit User, Change Role, Reset Password

## Requirements

### Requirement 1: Edit User Profile & HR Metadata

The system MUST allow an authenticated admin to update a user's full name, email, role, and HR metadata fields via `PATCH /api/v1/users/:id`.

- **Validation Rules**:
  - `fullName`: Minimum 2 characters, optional on partial update.
  - `email`: Valid email format, optional on partial update, MUST be unique across all non-deleted users (HTTP 409 Conflict if taken by another user).
  - `role`: Must be either `'admin'` or `'employee'`, optional.
  - `employeeNumber`: Optional string (e.g., "EMP-101").
  - `jobTitle`: Optional string (e.g., "Software Engineer").
  - `employmentType`: Optional string/enum (e.g., "full_time" / "part_time").
  - `employmentPercentage`: Optional number between 1 and 100.
  - `orgUnit`: Optional string (e.g., "Engineering").
- **Audit Rule**:
  - Every `PATCH` execution MUST update the user record's `updated_at` timestamp for audit visibility.
- **Scope Restriction**:
  - `isActive` modification is excluded from this requirement to prevent conflicts with KAN-48 (Deactivation/Restoration).

### Requirement 2: Reset User Password

The system MUST allow an authenticated admin to set a new password for any user via `POST /api/v1/users/:id/reset-password`.

- **Validation Rules**:
  - `password`: Minimum 8 characters.
- **Security & Audit Rule**:
  - Updating a user's password MUST hash the new password with bcrypt, update `updated_at`, and increment `token_version` so old user JWT sessions are immediately revoked.

### Requirement 3: Admin Console UI Modal & Actions

The Admin Console `UsersPage` MUST provide row actions for editing user details and triggering a password reset.

- **UI Language**: Hebrew (RTL).
- **Form Controls**:
  - Full Name input
  - Email input
  - Role dropdown selector (`אדמין` / `משתמש רגיל`)
  - HR Metadata inputs: `employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`.
  - New Password & Confirm Password inputs in Reset Password modal.
- **Feedback**: Display clear Hebrew error messages on duplicate email or validation failures.

## Acceptance Criteria

1. **Given** an admin opens the Edit User modal for user X, **When** they update the full name, role, and HR metadata fields (e.g. `employeeNumber`, `jobTitle`) and submit, **Then** the record updates in the database, `updated_at` is updated, and the table row refreshes with the new values.
2. **Given** an admin attempts to change user X's email to an email already owned by user Y, **When** submitting the form, **Then** the API returns HTTP 409 Conflict and the UI displays "כתובת האימייל כבר קיימת במערכת".
3. **Given** an admin resets the password for user X, **When** user X tries to make requests with their old JWT token, **Then** the request is rejected with HTTP 401 Unauthorized.
4. **Given** a non-admin employee tries to invoke `PATCH /api/v1/users/:id` or `POST /api/v1/users/:id/reset-password`, **Then** the API rejects the request with HTTP 403 Forbidden.
5. **Given** code changes are submitted, **When** running verification, **Then** `pnpm format:check` MUST run Prettier formatting checks and pass cleanly before merging.
