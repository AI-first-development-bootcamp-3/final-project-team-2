# Specification: Deactivate User with Instant Logout & Reactivation (KAN-48)

## Requirements

### Requirement 1: User Deactivation & Instant Token Revocation

The system MUST allow an authenticated admin to soft-delete a user via `DELETE /api/v1/users/:id`.

- **Database State Changes**:
  - `is_active`: MUST be set to `false`.
  - `deleted_at`: MUST be set to current timestamp `new Date()`.
  - `updated_at`: MUST be updated to current timestamp for audit visibility.
  - `token_version`: MUST be incremented by 1 (`token_version: { increment: 1 }`).
- **Security Rule (Instant Logout)**:
  - Incrementing `token_version` MUST immediately invalidate all active JWT tokens and refresh tokens belonging to the user.
- **Data Integrity Rule**:
  - Historical `TimeEntry` and `Absence` records belonging to the deactivated user MUST remain completely intact and retain the user's name (no cascade deletion).

### Requirement 2: Authentication Guard Rejection

The system MUST update `JwtGuard` & `JwtStrategy` in `server/api` to check `is_active` on every authenticated request.

- **Security Enforcement**:
  - If a user's database record has `is_active === false` or `deleted_at !== null`, any incoming API request MUST be immediately rejected with HTTP `401 Unauthorized` (`"משתמש זה אינו פעיל"`).

### Requirement 3: User Reactivation / Restoration

The system MUST allow an authenticated admin to reactivate a soft-deleted user via `POST /api/v1/users/:id/restore`.

- **Database State Changes**:
  - `is_active`: MUST be set to `true`.
  - `deleted_at`: MUST be set to `null`.
  - `updated_at`: MUST be updated to current timestamp.
- **Credential Integrity**:
  - Reactivation MUST NOT overwrite or reset the user's existing `password_hash`.

### Requirement 4: Directory List Filtering & Admin Console Modals

- **List Filtering**:
  - `GET /api/v1/users` MUST exclude soft-deleted users (`deleted_at !== null`) by default.
  - When `?includeDeleted=true` is passed, soft-deleted users MUST be returned with `isActive: false` and status "לא פעיל".
- **Admin Console UI**:
  - Provide a Hebrew `DeactivateUserModal` confirmation dialog ("האם אתה בטוח שברצונך להשבית את המשתמש [שם המשתמש]?").
  - Provide a Hebrew `RestoreUserModal` confirmation dialog ("האם אתה בטוח שברצונך להפעיל מחדש את המשתמש [שם המשתמש]?").
  - Provide Hebrew toast/banner notifications upon success or failure.

## Acceptance Criteria

1. **Given** an admin deactivates user X via `DELETE /api/v1/users/:id`, **When** the operation completes, **Then** user X's `is_active` is `false`, `deleted_at` is set, `token_version` is incremented, and user X is logged out immediately.
2. **Given** user X was logged in prior to deactivation, **When** user X sends any subsequent HTTP request using their existing JWT token, **Then** `JwtGuard` rejects the request with HTTP 401 Unauthorized.
3. **Given** user X has historical time entries and absences, **When** user X is deactivated, **Then** all historical time entries and absences remain intact and continue displaying user X's full name on reports.
4. **Given** user X is soft-deleted, **When** an admin queries `GET /api/v1/users`, **Then** user X is hidden by default, but appears as "לא פעיל" when `?includeDeleted=true` is passed.
5. **Given** an admin reactivates user X via `POST /api/v1/users/:id/restore`, **When** the operation completes, **Then** `is_active` becomes `true`, `deleted_at` becomes `null`, and user X can log in again with their original password.
