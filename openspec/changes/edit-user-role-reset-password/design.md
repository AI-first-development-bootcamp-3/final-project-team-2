# Design Document: Edit User, Change Role, Reset Password (KAN-47)

## Architecture Overview

```mermaid
graph TD
    subgraph Admin Console (apps/admin)
        UP[UsersPage] --> EUM[EditUserModal]
        UP --> RPM[ResetPasswordModal]
        EUM --> APIClient[lib/api/client.ts]
        RPM --> APIClient
    end

    subgraph Shared Contracts (packages/contracts)
        Zod[UpdateUserSchema & ResetPasswordSchema]
    end

    subgraph Backend API (server/api)
        APIClient -->|PATCH /api/v1/users/:id| UC[UsersController]
        APIClient -->|POST /api/v1/users/:id/reset-password| UC
        UC --> Guard[JwtAuthGuard & RolesGuard 'admin']
        UC --> US[UsersService]
        US --> Prisma[PrismaService -> PostgreSQL]
    end
```

## API Contracts (`packages/contracts/src/users/update.ts`)

```ts
import { z } from 'zod';
import { UserRole } from '../enums';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים').optional(),
  email: z.string().email('כתובת אימייל אינה תקינה').optional(),
  role: UserRole.optional(),
  // HR Metadata fields required by Epic §2
  employeeNumber: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentType: z.string().optional(),
  employmentPercentage: z.number().min(1).max(100).optional(),
  orgUnit: z.string().optional(),
});

export type UpdateUserPayload = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל 8 תווים לפחות'),
});

export type ResetPasswordPayload = z.infer<typeof ResetPasswordSchema>;
```

## Endpoint Specifications

### 1. `PATCH /api/v1/users/:id`

- **Auth**: Required (`JwtAuthGuard`, `@Roles('admin')`).
- **Request Body**: `UpdateUserPayload`.
- **Audit Visibility**: Prisma automatically updates `updated_at: new Date()` upon executing `prisma.user.update(...)` for full audit visibility.
- **Scope Note**: `isActive` is omitted from `UpdateUserSchema` to avoid conflicting with KAN-48 (Deactivation/Restoration).
- **Response**: `200 OK` with updated User object (excluding `password_hash`).
- **Error Responses**:
  - `400 Bad Request`: Validation failure.
  - `404 Not Found`: User ID does not exist.
  - `409 Conflict`: Email already taken by another active user.

### 2. `POST /api/v1/users/:id/reset-password`

- **Auth**: Required (`JwtAuthGuard`, `@Roles('admin')`).
- **Request Body**: `ResetPasswordPayload`.
- **Audit & Security**: Hashes new password with bcrypt, updates `updated_at`, and increments `token_version` to immediately revoke active JWT sessions.
- **Response**: `200 OK` `{ "message": "הסיסמה שונתה בהצלחה" }`.
- **Error Responses**:
  - `400 Bad Request`: Password validation failure (<8 chars).
  - `404 Not Found`: User ID does not exist.
