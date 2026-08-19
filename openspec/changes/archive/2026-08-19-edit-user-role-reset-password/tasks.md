# Task Breakdown: Edit User, Change Role, Reset Password (KAN-47)

- [x] **Feature 1: Edit User Profile & HR Metadata (End-to-End Workflow)**
  - [x] **Contract & Validation**: Add `UpdateUserSchema` in `packages/contracts/src/users/update.ts` containing `fullName`, `email`, `role`, and HR metadata fields (`employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`). Exclude `isActive` to avoid KAN-48 overlap. Export schema and types from `index.ts` and write contract unit tests in `update.spec.ts`.
  - [x] **Backend API & Audit**: Implement `updateUser(id, payload)` in `UsersService` and `PATCH /api/v1/users/:id` in `UsersController` with `@Roles('admin')`. Handle duplicate email conflict (HTTP 409) and ensure Prisma automatically updates the `updated_at` timestamp for audit visibility. Write service & controller unit tests in `users.service.spec.ts`.
  - [x] **Frontend UI & Integration**: Build `EditUserModal` component in `apps/admin/src/features/users/` with inputs for core fields (`fullName`, `email`, `role`) and HR metadata fields (`employeeNumber`, `jobTitle`, `employmentType`, `employmentPercentage`, `orgUnit`). Wire edit action trigger in `users-columns.tsx`, connect to `apiFetch`, render Hebrew error messages on duplicate email or validation failure, and refresh Users table state on success. Write UI unit tests in `edit-user-modal.spec.tsx`.

- [x] **Feature 2: Reset User Password (End-to-End Workflow)**
  - [x] **Contract & Validation**: Add `ResetPasswordSchema` in `packages/contracts/src/users/update.ts` (password min 8 chars). Export schema and types from `index.ts` and write contract unit tests in `update.spec.ts`.
  - [x] **Backend API & Session Revocation**: Implement `resetPassword(id, payload)` in `UsersService` and `POST /api/v1/users/:id/reset-password` in `UsersController` with `@Roles('admin')`. Hash new password with bcrypt, update `updated_at` timestamp, and increment `token_version` to invalidate existing user JWT sessions. Write service & controller unit tests in `users.service.spec.ts`.
  - [x] **Frontend UI & Integration**: Build `ResetPasswordModal` component in `apps/admin/src/features/users/` with password & password confirmation inputs. Wire reset password trigger in `users-columns.tsx`, connect to `apiFetch`, handle Hebrew error messages & success banners, and refresh state. Write UI unit tests in `reset-password-modal.spec.tsx`.

- [x] **Feature 3: Monorepo Verification & Formatting**
  - [x] **Code Formatting**: Run `pnpm format:check` to ensure Prettier code style compliance across all workspace files before merging.
  - [x] **Full Monorepo Suite**: Run `pnpm build && pnpm typecheck && pnpm test` to verify that contracts, API, and admin console build cleanly and all unit tests pass with >70% coverage gate.
