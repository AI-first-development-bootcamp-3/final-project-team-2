# Change Proposal: Deactivate / Soft-Delete User with Instant Logout (KAN-48)

## Summary

Implement user deactivation (soft-delete), instant session revocation, and reactivation capabilities in the Admin Console and Backend API (Jira KAN-48, Epic 3 User Management). Admins can soft-delete users (`is_active = false`, `deleted_at = now()`), triggering instant token revocation (`token_version + 1`), and reactivate previously soft-deleted users (`is_active = true`, `deleted_at = null`).

## Why

Following user listing (KAN-45), profile creation (KAN-46), and user editing (KAN-47), organization admins need to offboard departing employees, immediately revoke their active sessions so they cannot perform unauthorized requests, preserve all historical time entries and absence records intact for auditing, and offer reactivation for returning employees.

## Scope

### In Scope

- Shared Zod validation contracts in `packages/contracts`:
  - `DeactivateUserResponseSchema` (`id`, `isActive: false`, `deletedAt`).
  - `RestoreUserResponseSchema` (`id`, `isActive: true`, `deletedAt: null`).
- API endpoints & security guards in `server/api`:
  - `DELETE /api/v1/users/:id`: Soft-deletes user (`is_active = false`, `deleted_at = now()`), updates `updated_at`, and increments `token_version` by 1.
  - `POST /api/v1/users/:id/restore`: Reactivates user (`is_active = true`, `deleted_at = null`), updates `updated_at`.
  - `JwtGuard` & `JwtStrategy`: Rejects requests from users where `is_active === false` or `deleted_at !== null` with HTTP 401 Unauthorized.
  - Historical Data Integrity: Preserves all `TimeEntry` and `Absence` records without cascade deletion (user's name remains visible on historical reports).
- Admin Console UI components in `apps/admin`:
  - `DeactivateUserModal`: Hebrew confirmation modal for deactivating active users.
  - `RestoreUserModal`: Hebrew confirmation modal for reactivating soft-deleted users when `includeDeleted` is enabled.
  - Action buttons in `users-columns.tsx` ("השבת", "הפעל מחדש").
  - Hebrew toast/banner error and success feedback.
- Documentation & Code Formatting:
  - OpenSpec and Spec documentation artifacts.
  - Formatting compliance via Prettier (`pnpm format:check`).

### Out of Scope

- Permanent hard-deletion of user records from database (soft-delete only per §8.3).
- Password reset during reactivation (password hash remains unchanged).

## Non-Goals

- Anonymization or scrambling of historical employee names on locked time sheets.
- Automated email notification upon account deactivation (deferred post-MVP).
