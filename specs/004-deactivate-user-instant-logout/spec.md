# Feature Specification: Deactivate / Soft-Delete User with Instant Logout

**Feature Branch**: `48Deactivate-user-instant-logout`
**Jira Issue**: KAN-48 (Epic 3: User Management)
**Created**: 2026-08-17
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Deactivate User & Instant Logout (Priority: P1)

An authenticated admin opens the Users directory in the Admin Console and selects "השבת" (Deactivate) on an active user row. A Hebrew confirmation modal appears ("האם אתה בטוח שברצונך להשבית את המשתמש [שם]?"). Submitting soft-deletes the user (`is_active = false`, `deleted_at = now()`), updates `updated_at`, and increments `token_version` by 1. The user's active session dies instantly; any subsequent API call with their existing token is rejected by `JwtGuard` with HTTP 401 Unauthorized.

### User Story 2 - Historical Data Integrity (Priority: P1)

When a user is soft-deleted, their historical time entries (`TimeEntry`) and absence records (`Absence`) MUST remain intact in the database and continue to display the user's name on reports and time tracking history without cascade deletion.

### User Story 3 - Directory List Filtering & Reactivation (Priority: P1)

Deactivated users are hidden from the default `GET /api/v1/users` list view. When an admin checks "כולל מושבתים" (`?includeDeleted=true`), deactivated users appear with status "לא פעיל". The admin can select "הפעל מחדש" (Restore) to reactivate the user (`is_active = true`, `deleted_at = null`), allowing the user to log in again using their original password.

## Requirements

- **FR-001**: `DELETE /api/v1/users/:id` MUST set `is_active = false`, `deleted_at = now()`, update `updated_at`, and increment `token_version` by 1.
- **FR-002**: `JwtGuard` MUST reject deactivated users (`is_active === false` or `deleted_at !== null`) on every request with HTTP 401 Unauthorized.
- **FR-003**: Historical `TimeEntry` and `Absence` records MUST NOT be cascade deleted when a user is deactivated.
- **FR-004**: `GET /api/v1/users` MUST exclude soft-deleted users by default unless `?includeDeleted=true` is passed.
- **FR-005**: `POST /api/v1/users/:id/restore` MUST reactivate soft-deleted users (`is_active = true`, `deleted_at = null`).
- **FR-006**: Admin Console UI MUST provide Hebrew confirmation modals for deactivation and reactivation, toast notifications, and Prettier code formatting compliance.
