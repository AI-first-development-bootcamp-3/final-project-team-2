# Design Document: Deactivate / Soft-Delete User with Instant Logout & Reactivation (KAN-48)

## Architecture Overview

```mermaid
graph TD
    subgraph Admin Console (apps/admin)
        UP[UsersPage] --> DUM[DeactivateUserModal]
        UP --> RUM[RestoreUserModal]
        DUM --> APIClient[lib/api/client.ts]
        RUM --> APIClient
    end

    subgraph Shared Contracts (packages/contracts)
        Zod[Deactivate & Restore Response Schemas]
    end

    subgraph Backend API (server/api)
        APIClient -->|DELETE /api/v1/users/:id| UC[UsersController]
        APIClient -->|POST /api/v1/users/:id/restore| UC
        UC --> Guard[JwtGuard & RolesGuard 'admin']
        Guard --> ActiveCheck[is_active & token_version Check]
        UC --> US[UsersService]
        US --> Prisma[PrismaService -> PostgreSQL]
    end
```

## Shared Contracts (`packages/contracts/src/users/deactivate.ts`)

```ts
import { z } from 'zod';

export const DeactivateUserResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.literal(false),
  deletedAt: z.string(),
});

export type DeactivateUserResponse = z.infer<typeof DeactivateUserResponseSchema>;

export const RestoreUserResponseSchema = z.object({
  id: z.string().uuid(),
  isActive: z.literal(true),
  deletedAt: z.null(),
});

export type RestoreUserResponse = z.infer<typeof RestoreUserResponseSchema>;
```

## Endpoint Specifications

### 1. `DELETE /api/v1/users/:id` (Deactivate User)

- **Auth**: Required (`JwtGuard`, `@Roles('admin')`).
- **Logic**:
  - Finds user by `id`. If missing, throws `404 Not Found`.
  - Sets `is_active: false`.
  - Sets `deleted_at: new Date()`.
  - Updates `updated_at: new Date()` for audit visibility.
  - Increments `token_version: { increment: 1 }` to revoke active user JWT tokens immediately.
- **Data Integrity**: All foreign keys to `TimeEntry` and `Absence` remain intact without cascade deletion.
- **Response**: `200 OK` `{ "id": "<uuid>", "isActive": false, "deletedAt": "2026-08-17T..." }`.

### 2. `POST /api/v1/users/:id/restore` (Reactivate User)

- **Auth**: Required (`JwtGuard`, `@Roles('admin')`).
- **Logic**:
  - Finds user by `id` (including soft-deleted users).
  - Sets `is_active: true`.
  - Sets `deleted_at: null`.
  - Updates `updated_at: new Date()`.
- **Response**: `200 OK` `{ "id": "<uuid>", "isActive": true, "deletedAt": null }`.

### 3. `JwtGuard` & `JwtStrategy` Security Rule

- Check `is_active` on every authenticated request in `JwtGuard` / `JwtStrategy`.
- Reject deactivated users (`is_active === false` or `deleted_at !== null`) with HTTP `401 Unauthorized`.
