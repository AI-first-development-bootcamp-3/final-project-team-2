# Change Proposal: Edit User, Change Role, Reset Password (KAN-47)

## Summary

Implement user editing capabilities in the Admin Console and Backend API (Jira KAN-47, Epic 3 User Management). Admins can update core user details (full name, email, role), HR metadata fields (employee number, job title, employment type, employment percentage, organizational unit), and trigger password resets for any user.

## Why

After introducing the Users Directory (KAN-45), admins need to manage existing user profiles, correct names and emails, elevate or revoke admin privileges, surface employee HR metadata fields required by Epic §2 for employee-picker integration, and securely reset passwords when users forget credentials.

## Scope

### In Scope

- Shared Zod validation contracts in `packages/contracts`:
  - `UpdateUserSchema` (full name, email, role, `employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`).
  - `ResetPasswordSchema` (password min 8 characters).
- API endpoints in `server/api`:
  - `PATCH /api/v1/users/:id`: Updates profile details and HR metadata fields. Automatically updates the `updated_at` timestamp for audit visibility.
  - `POST /api/v1/users/:id/reset-password`: Updates user password & increments `token_version` to invalidate existing JWT sessions.
- Admin Console UI components in `apps/admin`:
  - Edit User Modal with core fields (Name, Email, Role) and HR metadata fields (`employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`).
  - Reset Password Dialog with password confirmation.
  - Hebrew validation messages, toast/banner error feedback, and loading states.
- Code style formatting compliance via `pnpm format:check` and Prettier.
- Unit tests & integration tests across `@abra/contracts`, `@abra/api`, and `@abra/admin`.

### Out of Scope

- User creation (KAN-46).
- User deactivation/restoration (`isActive` flag / `deleted_at` handling) - owned strictly by KAN-48 to maintain separation of concerns.
- Self-service password reset via email magic link (out of MVP scope).

## Non-Goals

- Self-service employee profile editing (admin-only).
- Audit logging of admin reads (deferred post-MVP).
