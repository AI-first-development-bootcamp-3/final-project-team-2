# Specification: Edit User, Change Role, Reset Password

## Requirements

### Requirement 1: Edit User Profile

The system MUST allow an authenticated admin to update a user's full name, email, role, and active status via `PATCH /api/v1/users/:id`.

- **Validation Rules**:
  - `fullName`: Minimum 2 characters, required.
  - `email`: Valid email format, required, must be unique across all non-deleted users (HTTP 409 Conflict if taken by another user).
  - `role`: Must be either `'admin'` or `'employee'`.
  - `isActive`: Boolean flag.

### Requirement 2: Reset User Password

The system MUST allow an authenticated admin to set a new password for any user via `POST /api/v1/users/:id/reset-password`.

- **Validation Rules**:
  - `password`: Minimum 8 characters.
- **Security Rule**:
  - Updating a user's password MUST hash the new password with bcrypt and increment `tokenVersion` (or invalidate existing JWT sessions) so old user tokens are immediately revoked.

### Requirement 3: Admin Console UI Modal & Actions

The Admin Console `UsersPage` MUST provide row actions for editing user details and triggering a password reset.

- **UI Language**: Hebrew (RTL).
- **Form Controls**:
  - Full Name input
  - Email input
  - Role dropdown selector (`אדמין` / `משתמש רגיל`)
  - Status toggle (`פעיל` / `לא פעיל`)
  - New Password & Confirm Password inputs in Reset Password modal.
- **Feedback**: Display clear Hebrew error messages on duplicate email or validation failures.

## Acceptance Criteria

1. **Given** an admin opens the Edit User modal for user X, **When** they update the full name and role and submit, **Then** the record updates in the database and the table row refreshes with the new values.
2. **Given** an admin attempts to change user X's email to an email already owned by user Y, **When** submitting the form, **Then** the API returns HTTP 409 Conflict and the UI displays "כתובת האימייל כבר קיימת במערכת".
3. **Given** an admin resets the password for user X, **When** user X tries to make requests with their old JWT token, **Then** the request is rejected with HTTP 401 Unauthorized.
4. **Given** a non-admin employee tries to invoke `PATCH /api/v1/users/:id` or `POST /api/v1/users/:id/reset-password`, **Then** the API rejects the request with HTTP 403 Forbidden.
