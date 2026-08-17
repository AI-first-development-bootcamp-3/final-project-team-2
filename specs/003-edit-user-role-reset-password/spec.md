# Feature Specification: Edit User, Change Role, Reset Password

**Feature Branch**: `47Edit-user,-change-role,-reset-password`
**Jira Issue**: KAN-47 (Epic 3: User Management)
**Created**: 2026-08-17
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Edit User Profile & HR Metadata (Priority: P1)

An authenticated admin opens the Users directory in the Admin Console and selects "Edit" on a user row. A modal appears allowing the admin to update full name, email address, role (`admin` vs `employee`), and HR metadata fields (`employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`). Submitting updates the database, updates the `updated_at` timestamp for audit visibility, and refreshes the table row.

### User Story 2 - Reset User Password (Priority: P1)

An authenticated admin selects "Reset Password" on a user row. A modal prompts for a new password (min 8 characters). Submitting hashes the new password with bcrypt, updates `updated_at`, and revokes old user sessions by incrementing the user's `token_version`.

### User Story 3 - Duplicate Email & Validation Handling (Priority: P1)

If the admin attempts to assign an email that already belongs to another active user, the API returns HTTP 409 Conflict, and the UI displays a clear Hebrew error message.

## Requirements

- **FR-001**: `PATCH /api/v1/users/:id` MUST allow admins to update `fullName`, `email`, `role`, and HR metadata fields (`employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`).
- **FR-002**: Every `PATCH /api/v1/users/:id` execution MUST update `updated_at` for audit visibility.
- **FR-003**: `POST /api/v1/users/:id/reset-password` MUST allow admins to set a new password (min 8 chars), update `updated_at`, and revoke active tokens.
- **FR-004**: `isActive` flag / Deactivation handling MUST be excluded from KAN-47 and owned by KAN-48.
- **FR-005**: The Admin Console MUST provide an Edit User Modal with HR fields and Reset Password Dialog in Hebrew (RTL).
- **FR-006**: Non-admin users MUST be forbidden (HTTP 403) from modifying user profiles or resetting passwords.
- **FR-007**: Code submitted MUST pass `pnpm format:check` using Prettier prior to merge.
