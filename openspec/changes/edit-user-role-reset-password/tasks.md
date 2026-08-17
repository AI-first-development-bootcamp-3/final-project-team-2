# Task Breakdown: Edit User, Change Role, Reset Password (KAN-47)

- [ ] **Task 1: Shared Contracts (`packages/contracts`)**
  - [ ] Add `UpdateUserSchema` and `ResetPasswordSchema` in `packages/contracts/src/users/update.ts`.
  - [ ] Export schemas and type definitions from `packages/contracts/src/index.ts`.
  - [ ] Write unit tests for schema validation in `packages/contracts/src/users/update.spec.ts`.

- [ ] **Task 2: Backend API (`server/api`)**
  - [ ] Add `updateUser(id, payload)` method in `UsersService` with duplicate email check and `tokenVersion` bump on password update.
  - [ ] Add `resetPassword(id, payload)` method in `UsersService`.
  - [ ] Add `PATCH /users/:id` and `POST /users/:id/reset-password` endpoints in `UsersController` with `@Roles('admin')`.
  - [ ] Write unit tests for controller & service in `server/api/src/modules/users/users.service.spec.ts`.

- [ ] **Task 3: Admin Console UI (`apps/admin`)**
  - [ ] Add Edit action button & modal trigger in `users-columns.tsx`.
  - [ ] Implement `EditUserModal` component with `fullName`, `email`, `role`, and `isActive` fields.
  - [ ] Implement `ResetPasswordModal` component with password input & Hebrew validation messages.
  - [ ] Wire API calls `apiFetch` in `UsersPage` with state refresh on success and error feedback.
  - [ ] Write unit tests for `EditUserModal` and `ResetPasswordModal` in `apps/admin/src/features/users/`.

- [ ] **Task 4: Verification**
  - [ ] Run `pnpm build && pnpm format:check && pnpm typecheck && pnpm test` across all monorepo workspaces.
