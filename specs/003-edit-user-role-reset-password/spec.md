# Feature Specification: Edit User, Change Role, Reset Password

**Feature Branch**: `47Edit-user,-change-role,-reset-password`
**Jira Issue**: KAN-47 (Epic 3: User Management)
**Created**: 2026-08-17
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Edit User Profile & Role (Priority: P1)

An authenticated admin opens the Users directory in the Admin Console and selects "Edit" on a user row. A modal appears allowing the admin to update full name, email address, role (`admin` vs `employee`), and status (`active` vs `inactive`). Submitting updates the database and refreshes the table row.

### User Story 2 - Reset User Password (Priority: P1)

An authenticated admin selects "Reset Password" on a user row. A modal prompts for a new password (min 8 characters). Submitting hashes the new password with bcrypt and revokes old user sessions by incrementing the user's `tokenVersion`.

### User Story 3 - Duplicate Email & Validation Handling (Priority: P1)

If the admin attempts to assign an email that already belongs to another active user, the API returns HTTP 409 Conflict, and the UI displays a clear Hebrew error message.

## Requirements

- **FR-001**: `PATCH /api/v1/users/:id` MUST allow admins to update `fullName`, `email`, `role`, and `isActive`.
- **FR-002**: `POST /api/v1/users/:id/reset-password` MUST allow admins to set a new password (min 8 chars) and revoke active tokens.
- **FR-003**: The Admin Console MUST provide an Edit User Modal and Reset Password Dialog in Hebrew (RTL).
- **FR-004**: Non-admin users MUST be forbidden (HTTP 403) from modifying user profiles or resetting passwords.
