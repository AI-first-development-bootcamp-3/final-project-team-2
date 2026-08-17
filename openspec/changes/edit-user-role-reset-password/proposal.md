# Change Proposal: Edit User, Change Role, Reset Password (KAN-47)

## Summary

Implement user editing capabilities in the Admin Console and Backend API (Jira KAN-47, Epic 3 User Management). Admins can update full name, email address, role (`admin` vs `employee`), active status, and trigger password resets for any user.

## Why

After introducing the Users Directory (KAN-45), admins need to manage existing user profiles, correct typos in names/emails, elevate or revoke admin privileges, activate/deactivate accounts, and securely reset passwords when users forget credentials.

## Scope

### In Scope

- Shared Zod validation contracts in `packages/contracts` (`UpdateUserSchema`, `ResetPasswordSchema`).
- API endpoints in `server/api`:
  - `PATCH /api/v1/users/:id` to update `fullName`, `email`, `role`, `isActive`.
  - `POST /api/v1/users/:id/reset-password` to update user password & invalidate active user sessions.
- Admin Console UI components in `apps/admin`:
  - Edit User Modal in `UsersPage` table actions.
  - Reset Password Dialog with password confirmation.
  - Hebrew validation messages, toast/banner error feedback, and loading states.
- Unit tests & integration tests across `@abra/contracts`, `@abra/api`, and `@abra/admin`.

### Out of Scope

- User creation (KAN-46).
- User deactivation/restoration (KAN-48).
- Self-service password reset via email magic link (out of MVP scope).

## Non-Goals

- Adding non-standard HR metadata fields (employee number, org unit, job title).
- Audit logging of admin edits (deferred post-MVP).
