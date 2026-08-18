# Task Breakdown: Deactivate / Soft-Delete User with Instant Logout (KAN-48)

- [x] **Feature 1: User Deactivation & Instant Logout (End-to-End Workflow)**
  - [x] **Contract & Validation**: Define `DeactivateUserResponseSchema` in `packages/contracts/src/users/deactivate.ts`. Re-export schema and types in `index.ts` and write contract unit tests in `deactivate.spec.ts`.
  - [x] **Backend API & Security Guard**:
    - [x] Update `JwtGuard` & `JwtStrategy` in `server/api/src/common/guards/jwt.guard.ts` to check `is_active` and reject deactivated users with HTTP 401.
    - [x] Implement `deactivateUser(id)` in `UsersService` setting `is_active = false`, `deleted_at = now()`, updating `updated_at`, and incrementing `token_version`.
    - [x] Add `DELETE /api/v1/users/:id` endpoint in `UsersController` with `@Roles('admin')`.
    - [x] Write service & controller unit tests verifying instant session revocation, soft-delete, and historical data preservation.
  - [x] **Frontend UI & Integration**:
    - [x] Build `DeactivateUserModal` confirmation dialog in `apps/admin/src/features/users/deactivate-user-modal.tsx` in Hebrew ("האם אתה בטוח שברצונך להשבית את המשתמש [שם המשתמש]?").
    - [x] Add "השבת" (Deactivate) action button in `users-columns.tsx` for active rows.
    - [x] Wire API call `apiFetch('DELETE /api/v1/users/:id')`, display Hebrew success toast, and refresh Users table. Write UI unit tests.

- [x] **Feature 2: User Reactivation / Restoration (End-to-End Workflow)**
  - [x] **Contract & Validation**: Define `RestoreUserResponseSchema` in `packages/contracts/src/users/deactivate.ts`. Re-export schema and types in `index.ts` and write contract unit tests in `deactivate.spec.ts`.
  - [x] **Backend API**:
    - [x] Implement `restoreUser(id)` in `UsersService` setting `is_active = true`, `deleted_at = null`, and updating `updated_at`.
    - [x] Add `POST /api/v1/users/:id/restore` endpoint in `UsersController` with `@Roles('admin')`.
    - [x] Write service & controller unit tests for reactivation.
  - [x] **Frontend UI & Integration**:
    - [x] Build `RestoreUserModal` confirmation dialog in `apps/admin/src/features/users/restore-user-modal.tsx` in Hebrew ("האם אתה בטוח שברצונך להפעיל מחדש את המשתמש [שם המשתמש]?").
    - [x] Add "הפעל מחדש" (Restore) action button in `users-columns.tsx` when `includeDeleted` is enabled.
    - [x] Wire API call `apiFetch('POST /api/v1/users/:id/restore')`, display Hebrew success toast, and refresh Users table. Write UI unit tests.

- [x] **Feature 3: Directory List Filtering & Data Integrity**
  - [x] **Backend API**:
    - [x] Ensure `GET /api/v1/users` filters out `deleted_at !== null` by default, and includes them when `?includeDeleted=true` is passed.
    - [x] Verify Prisma schema relations for `TimeEntry` and `Absence` preserve historical name data without cascade deletion.
  - [x] **Frontend UI & Integration**:
    - [x] Verify "כולל מושבתים" (`includeDeleted`) checkbox renders soft-deleted rows with status "לא פעיל". Write UI integration unit tests.

- [x] **Feature 4: Monorepo Verification & Code Formatting**
  - [x] **Code Formatting**: Run `pnpm format:check` to ensure Prettier code style compliance across all workspace files before merging.
  - [x] **Full Monorepo Suite**: Run `pnpm build && pnpm typecheck && pnpm test` to verify that contracts, API, and admin console build cleanly and all unit tests pass.
