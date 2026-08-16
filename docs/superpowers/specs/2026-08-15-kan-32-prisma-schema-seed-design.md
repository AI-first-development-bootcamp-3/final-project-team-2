# KAN-32: Prisma Schema, First Migration & Seed Script

**Date:** 2026-08-15
**Status:** Accepted
**Epic:** KAN-29 (Setup & Infrastructure)
**Approach:** Option A — single migration, full schema, seed, thin PrismaService

---

## 1. Scope

Deliver the data layer foundation for the Abra Timesheet system:

- Prisma schema with 10 models matching GENERAL_SPEC section 4
- One initial migration committed and applying cleanly
- Seed script creating a demo org with realistic data
- Thin PrismaService/PrismaModule for NestJS integration
- Env validation (DATABASE_URL) via zod at boot

Out of scope: API endpoints, guards, auth logic, frontend changes.

---

## 2. Prisma Schema

**Provider:** `postgresql`
**PK convention:** `@id @default(uuid()) @db.Uuid`
**Timestamps:** `created_at DateTime @default(now())`, `updated_at DateTime @updatedAt`, `deleted_at DateTime?` where applicable
**FK convention:** `@db.Uuid` with explicit `@relation`

### 2.1 Enums

Defined in schema.prisma (Prisma-native enums, mapped to Postgres enums):

- `UserRole`: employee, admin
- `WorkLocation`: office, client_site, home
- `AbsenceType`: vacation, sick, military, other
- `TaskStatus`: open, closed
- `HalfDayPeriod`: morning, afternoon
- `AuditAction`: create, update, delete, lock_month, unlock_month

### 2.2 Models

#### User

| Column        | Type                    | Constraints        |
| ------------- | ----------------------- | ------------------ |
| id            | UUID                    | PK, auto-generated |
| email         | String @db.VarChar(255) | not null           |
| full_name     | String @db.VarChar(255) | not null           |
| password_hash | String @db.VarChar(255) | not null           |
| role          | UserRole                | not null           |
| is_active     | Boolean                 | default true       |
| token_version | Int                     | default 0          |
| created_at    | DateTime                | default now()      |
| updated_at    | DateTime                | @updatedAt         |
| deleted_at    | DateTime?               | soft delete        |

Index: unique(email) where deleted_at IS NULL (partial unique index)

Relations: TaskAssignment[], TimeEntry[], Absence[], MonthLock[] (as locked_by), MonthLock[] (as unlocked_by), AuditLog[]

#### Client

| Column       | Type                    | Constraints   |
| ------------ | ----------------------- | ------------- |
| id           | UUID                    | PK            |
| name         | String @db.VarChar(255) | not null      |
| contact_info | String? @db.Text        | nullable      |
| is_active    | Boolean                 | default true  |
| created_at   | DateTime                | default now() |
| updated_at   | DateTime                | @updatedAt    |
| deleted_at   | DateTime?               | soft delete   |

Relations: Project[]

#### Project

| Column     | Type                    | Constraints            |
| ---------- | ----------------------- | ---------------------- |
| id         | UUID                    | PK                     |
| client_id  | UUID FK                 | not null, -> Client.id |
| name       | String @db.VarChar(255) | not null               |
| is_active  | Boolean                 | default true           |
| created_at | DateTime                | default now()          |
| updated_at | DateTime                | @updatedAt             |
| deleted_at | DateTime?               | soft delete            |

Relations: client Client, Task[]

#### Task

| Column      | Type                    | Constraints             |
| ----------- | ----------------------- | ----------------------- |
| id          | UUID                    | PK                      |
| project_id  | UUID FK                 | not null, -> Project.id |
| name        | String @db.VarChar(255) | not null                |
| description | String? @db.Text        | nullable                |
| status      | TaskStatus              | default open            |
| created_at  | DateTime                | default now()           |
| updated_at  | DateTime                | @updatedAt              |
| deleted_at  | DateTime?               | soft delete             |

Relations: project Project, TaskAssignment[], TimeEntry[]

#### TaskAssignment

| Column     | Type     | Constraints          |
| ---------- | -------- | -------------------- |
| id         | UUID     | PK                   |
| user_id    | UUID FK  | not null, -> User.id |
| task_id    | UUID FK  | not null, -> Task.id |
| created_at | DateTime | default now()        |

Constraint: @@unique([user_id, task_id])
No soft delete.

#### TimeEntry

| Column      | Type              | Constraints                     |
| ----------- | ----------------- | ------------------------------- |
| id          | UUID              | PK                              |
| user_id     | UUID FK           | not null, -> User.id            |
| task_id     | UUID FK?          | nullable (running timer)        |
| date        | DateTime @db.Date | not null                        |
| start_at    | DateTime          | not null                        |
| end_at      | DateTime?         | nullable (null = running timer) |
| location    | WorkLocation?     | nullable (running timer)        |
| description | String? @db.Text  | nullable                        |
| created_at  | DateTime          | default now()                   |
| updated_at  | DateTime          | @updatedAt                      |
| deleted_at  | DateTime?         | soft delete                     |

Relations: user User, task Task?

#### Absence

| Column          | Type              | Constraints                       |
| --------------- | ----------------- | --------------------------------- |
| id              | UUID              | PK                                |
| user_id         | UUID FK           | not null, -> User.id              |
| type            | AbsenceType       | not null                          |
| start_date      | DateTime @db.Date | not null                          |
| end_date        | DateTime @db.Date | not null                          |
| is_half_day     | Boolean           | default false                     |
| half_day_period | HalfDayPeriod?    | nullable, required if is_half_day |
| notes           | String? @db.Text  | nullable                          |
| created_at      | DateTime          | default now()                     |
| updated_at      | DateTime          | @updatedAt                        |
| deleted_at      | DateTime?         | soft delete                       |

Relations: user User, attachments AbsenceAttachment[]

#### AbsenceAttachment

| Column     | Type                    | Constraints             |
| ---------- | ----------------------- | ----------------------- |
| id         | UUID                    | PK                      |
| absence_id | UUID FK                 | not null, -> Absence.id |
| file_name  | String @db.VarChar(255) | not null                |
| file_type  | String @db.VarChar(50)  | not null                |
| file_size  | Int                     | not null (bytes)        |
| blob_key   | String @db.VarChar(500) | not null                |
| created_at | DateTime                | default now()           |

No soft delete.

#### MonthLock

| Column      | Type      | Constraints          |
| ----------- | --------- | -------------------- |
| id          | UUID      | PK                   |
| year        | Int       | not null             |
| month       | Int       | not null (1-12)      |
| locked_by   | UUID FK   | not null, -> User.id |
| locked_at   | DateTime  | not null             |
| is_locked   | Boolean   | default true         |
| unlocked_by | UUID FK?  | nullable, -> User.id |
| unlocked_at | DateTime? | nullable             |

Constraint: @@unique([year, month])
No soft delete.

#### AuditLog

| Column      | Type                   | Constraints          |
| ----------- | ---------------------- | -------------------- |
| id          | UUID                   | PK                   |
| actor_id    | UUID FK                | not null, -> User.id |
| action      | AuditAction            | not null             |
| entity_type | String @db.VarChar(50) | not null             |
| entity_id   | UUID                   | not null             |
| before      | Json?                  | nullable             |
| after       | Json?                  | nullable             |
| created_at  | DateTime               | default now()        |

Append-only. No soft delete.

---

## 3. NestJS Integration

### 3.1 PrismaService (`server/api/src/prisma/prisma.service.ts`)

- Extends `PrismaClient`, implements `OnModuleInit`
- Calls `$connect()` on module init
- Registers soft-delete middleware for query operations (`findMany`, `findFirst`, `findUnique`, `count`, `findRaw`, `aggregate`, `groupBy`) on models with `deleted_at`: User, Client, Project, Task, TimeEntry, Absence
- Middleware auto-injects `deleted_at: null` filter unless explicitly overridden
- Models without soft delete (TaskAssignment, AbsenceAttachment, MonthLock, AuditLog) are unaffected

### 3.2 PrismaModule (`server/api/src/prisma/prisma.module.ts`)

- `@Global()` decorator
- Provides and exports `PrismaService`
- Imported once in `AppModule`

### 3.3 Env Validation (`server/api/src/config/env.validation.ts`)

- Zod schema requiring `DATABASE_URL` (string, starts with `postgres`)
- Called in `main.ts` before `NestFactory.create()`
- Missing or invalid DATABASE_URL = process exits with clear error message

---

## 4. Seed Script

**File:** `server/api/prisma/seed.ts`
**Runner:** `npx prisma db seed` (configured in package.json `prisma.seed` field)

### 4.1 Demo Data

**Users (3):**

| Email             | Role     | Password (pre-hash) |
| ----------------- | -------- | ------------------- |
| admin@abra.co     | admin    | Admin123!           |
| employee1@abra.co | employee | Employee123!        |
| employee2@abra.co | employee | Employee123!        |

**Clients (2):** Acme Corp, Globex Ltd (both active)

**Projects (3):**

- Acme Corp -> Website Redesign, Mobile App
- Globex Ltd -> CRM Integration

**Tasks (6):**

- Website Redesign -> UI Design, Frontend Dev
- Mobile App -> API Integration, Testing
- CRM Integration -> Data Migration, User Training

**TaskAssignments:**

- Employee 1: UI Design, Frontend Dev, API Integration
- Employee 2: Testing, Data Migration, User Training

**TimeEntries — one fully reported week (Sun 2026-08-09 to Thu 2026-08-13):**

- Employee 1: 5 days, ~8-9h each, varying locations (office, home, client_site), all completed (end_at set)
- Employee 2: 3-4 days of entries, similar pattern

All entries have task_id and location filled (completed entries, not running timers).

### 4.2 Implementation Details

- Uses `bcrypt` for password hashing (added as dependency)
- Idempotent: deletes existing seed data then re-creates (uses a transaction)
- Deterministic UUIDs not required — seed creates fresh UUIDs each run
- Runs with `ts-node` via the prisma seed config

### 4.3 package.json Changes

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

The `--compiler-options` flag is needed because the NestJS API uses CommonJS modules while ts-node needs explicit configuration.

New dependencies: `bcrypt` (runtime) + `@types/bcrypt` (devDep), `ts-node` (devDep, if not already present)

---

## 5. Migration

Single initial migration via `prisma migrate dev --name init`.

The committed migration folder (`server/api/prisma/migrations/`) contains one migration with all 10 tables created atomically.

---

## 6. Files Changed/Created

| File                                      | Action                                |
| ----------------------------------------- | ------------------------------------- |
| `server/api/prisma/schema.prisma`         | Create                                |
| `server/api/prisma/seed.ts`               | Create                                |
| `server/api/prisma/migrations/*`          | Create (generated)                    |
| `server/api/src/prisma/prisma.service.ts` | Create                                |
| `server/api/src/prisma/prisma.module.ts`  | Create                                |
| `server/api/src/config/env.validation.ts` | Create                                |
| `server/api/src/main.ts`                  | Edit (add env validation)             |
| `server/api/src/app.module.ts`            | Edit (import PrismaModule)            |
| `server/api/package.json`                 | Edit (add bcrypt, prisma.seed config) |
| `server/api/.env.example`                 | Create (DATABASE_URL template)        |

---

## 7. Acceptance Criteria (from Jira)

1. First migration committed and applies cleanly against a fresh Postgres 16
2. Seed creates the demo org: 1 admin, 2 employees, 2 clients, 3 projects with tasks and assignments, one fully reported week
3. Frontends can develop against seeded data before admin CRUD exists
