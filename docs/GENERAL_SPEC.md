# ABRA Timesheet — System Specification

**Version:** 1.0
**Date:** 2026-08-13
**Team:** Bootcamp 3, Team 2 (4 developers)
**Status:** Draft — pending team review

---

## 1. Purpose, Scope & Reading Guide

This is the system-level specification for the Abra Timesheet project. It defines everything shared across features: data model, API conventions, permissions, cross-cutting rules, and component contracts.

**Hierarchy of authority:**

- **PRD** (course requirements) → decides BEHAVIOR
- **Figma** → decides LOOKS
- **Blueprint** → decides STACK and ARCHITECTURE
- **This spec** → resolves contradictions and fills gaps

**Audience:** all 4 developers on Team 2, Bootcamp 3.

**What this spec does NOT contain:**

- Per-feature acceptance criteria (see feature specs)
- Per-screen detailed flows (see feature specs)
- Visual design details (see Figma)

Feature specs reference this document by section number (e.g. "see §8.1"). If a feature spec contradicts this document, this document wins.

---

## 2. Glossary & Enum Registry

All enums live in `packages/contracts/` and are consumed by both frontends and the API.

### 2.1 Roles (UserRole)

| Value      | English  | Hebrew            |
| ---------- | -------- | ----------------- |
| `employee` | Employee | משתמש רגיל (עובד) |
| `admin`    | Admin    | אדמין             |

### 2.2 Work Location (WorkLocation)

| Value         | English     | Hebrew |
| ------------- | ----------- | ------ |
| `office`      | Office      | משרד   |
| `client_site` | Client Site | לקוח   |
| `home`        | Home        | בית    |

### 2.3 Absence Type (AbsenceType)

| Value      | English          | Hebrew  |
| ---------- | ---------------- | ------- |
| `vacation` | Vacation         | חופשה   |
| `sick`     | Sick Leave       | מחלה    |
| `military` | Military Reserve | מילואים |
| `other`    | Other            | אחר     |

### 2.4 Day Status (DayStatus) — calculated, not stored

| Value     | English | Hebrew | Rule                   |
| --------- | ------- | ------ | ---------------------- |
| `full`    | Full    | מלא    | reported hours >= 9    |
| `partial` | Partial | חסר    | 0 < reported hours < 9 |
| `excess`  | Excess  | חריג   | reported hours > 9     |
| `empty`   | Empty   | —      | no entries             |
| `absence` | Absence | —      | day covered by absence |

### 2.5 Half Day Period (HalfDayPeriod)

| Value       | English   | Hebrew |
| ----------- | --------- | ------ |
| `morning`   | Morning   | בוקר   |
| `afternoon` | Afternoon | צהריים |

### 2.6 Task Status (TaskStatus)

| Value    | English | Hebrew |
| -------- | ------- | ------ |
| `open`   | Open    | פתוחה  |
| `closed` | Closed  | סגורה  |

### 2.7 Entity Status (EntityStatus) — for User, Client, Project

| Value      | English  | Hebrew  |
| ---------- | -------- | ------- |
| `active`   | Active   | פעיל    |
| `inactive` | Inactive | לא פעיל |

### 2.8 Month Lock Status (MonthLockStatus)

| Value    | English                     |
| -------- | --------------------------- |
| `open`   | Month is open for reporting |
| `locked` | Month is locked by admin    |

### 2.9 Audit Action (AuditAction)

| Value          | English        |
| -------------- | -------------- |
| `create`       | Record created |
| `update`       | Record updated |
| `delete`       | Record deleted |
| `lock_month`   | Month locked   |
| `unlock_month` | Month unlocked |

---

## 3. System Context

### 3.1 Applications

```
┌─────────────────┐     ┌─────────────────┐
│  Employee App   │     │  Admin Console   │
│  React+Vite+    │     │  React+shadcn/ui │
│  Tailwind       │     │  Web (min 1024px) │
│  393px viewport │     │                  │
│  Hebrew RTL     │     │                  │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         └───────┐   ┌───────────┘
                 ▼   ▼
          ┌──────────────┐
          │   REST API   │
          │  NestJS +    │
          │  Prisma      │
          │  /api/v1/*   │
          └──────┬───────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  Vercel Blob │
│  (Neon,      │  │  (private,   │
│   pooled)    │  │  signed URLs)│
└──────────────┘  └──────────────┘
```

### 3.2 Monorepo Structure

```
// One repository — pnpm workspaces. Principle: folders mirror the product —
// each Figma flow is a feature folder, each domain entity is an API module.

timesheet-abra/
  apps/
    mobile/                       // Employee app — fixed 393px, RTL
      index.html                  // dir="rtl" lang="he" set here
      vite.config.ts + tailwind.config.ts   // Figma tokens: colors, spacing
      src/
        App.tsx                   // router + providers (Query, auth)
        features/                 // 1 folder per Figma flow
          auth/                   // LoginPage (design א), useAuth
          daily-report/           // HOME: 9h quota bar, multi-entry days,
                                  // ClientPicker→ProjectPicker→TaskPicker, location enum
          monthly-view/           // calendar: day status, edit entries
          timer/                  // punch clock (advanced phase): TimerBar, useTimer
          absences/               // HalfDayToggle, AttachmentUpload
        components/ui/            // shared: Button, Sheet, Toast, StatusChip
        lib/                      // api.ts (typed via contracts), dates.ts (Asia/Jerusalem)

    admin/                        // Admin console — web (min 1024px)
      src/
        features/
          users/                  // users table + form drawer, reset password
          entities/               // clients + projects + tasks CRUD, soft delete
          assignments/            // user + task assignment
          reports/                // view + edit employee reports (audit-logged)
          month-lock/             // lock / reopen, lock history
        components/ui/            // shadcn/ui primitives

  server/
    api/                          // NestJS — one Vercel Function
      prisma/
        schema.prisma             // User, Client, Project, Task, TaskAssignment,
                                  // TimeEntry, Absence, MonthLock, AuditLog
        seed.ts                   // demo org for development
      src/
        common/                   // guards (Jwt, Roles), @Roles(), zod validation
                                  // pipe, error filters
        modules/
          auth/                   // login/refresh/logout (email+password, remember me)
          users/                  // CRUD + roles + reset password (admin only)
          entities/               // clients/projects/tasks + user→task assignment
          time-entries/           // overlap + 9h-quota checks, allocation rule,
                                  // month-lock enforcement + timer.service.ts
          absences/               // types, half-days, Fri-Sat exclusion, attachments
          month-lock/             // lock / reopen month, lock history
          audit/                  // records every admin edit of a report (graded)
          files/                  // Blob signed upload/download URLs (private access)
      vercel.json                 // routes

  packages/
    contracts/                    // zod schemas per domain; API validates with
                                  // these, frontends import the inferred types —
                                  // breaking changes fail CI, not the demo
    config/                       // eslint, tsconfig, prettier presets

  docker-compose.yml              // postgres + api + frontends — containerized for dev
  pnpm-workspace.yaml + turbo.json
  .github/workflows/ci.yml        // lint + typecheck + test on PR
```

### 3.3 Deployment

| Target       | Platform                              | Method              |
| ------------ | ------------------------------------- | ------------------- |
| apps/mobile  | Vercel Static                         | git push            |
| apps/admin   | Vercel Static (web, min 1024px)       | git push            |
| server/api   | Vercel Serverless Function            | git push            |
| PostgreSQL   | Neon (via Vercel Marketplace, pooled) | managed             |
| Blob storage | Vercel Blob                           | managed             |
| Local dev    | docker-compose                        | `docker-compose up` |

### 3.4 Excluded Technologies

No Redis, no MongoDB, no cron jobs. Deliberately excluded. All state lives in PostgreSQL.

---

## 4. Data Model

All tables use UUID primary keys. All timestamps stored in UTC. Soft-delete: `deleted_at` column (nullable timestamp). Queries exclude deleted rows by default via Prisma middleware.

### 4.1 User

| Column        | Type         | Notes                                   |
| ------------- | ------------ | --------------------------------------- |
| id            | UUID PK      | auto-generated                          |
| email         | VARCHAR(255) | unique, not null                        |
| full_name     | VARCHAR(255) | not null                                |
| password_hash | VARCHAR(255) | not null                                |
| role          | ENUM         | UserRole (employee \| admin)            |
| is_active     | BOOLEAN      | default true                            |
| token_version | INTEGER      | default 0, for refresh token revocation |
| created_at    | TIMESTAMP    | auto                                    |
| updated_at    | TIMESTAMP    | auto                                    |
| deleted_at    | TIMESTAMP    | nullable, soft delete                   |

Index: `unique(email) WHERE deleted_at IS NULL`

### 4.2 Client

| Column       | Type         | Notes                      |
| ------------ | ------------ | -------------------------- |
| id           | UUID PK      |                            |
| name         | VARCHAR(255) | not null                   |
| contact_info | TEXT         | nullable, optional per PRD |
| is_active    | BOOLEAN      | default true               |
| created_at   | TIMESTAMP    |                            |
| updated_at   | TIMESTAMP    |                            |
| deleted_at   | TIMESTAMP    | nullable                   |

### 4.3 Project

| Column     | Type         | Notes                 |
| ---------- | ------------ | --------------------- |
| id         | UUID PK      |                       |
| client_id  | UUID FK      | → Client.id, not null |
| name       | VARCHAR(255) | not null              |
| is_active  | BOOLEAN      | default true          |
| created_at | TIMESTAMP    |                       |
| updated_at | TIMESTAMP    |                       |
| deleted_at | TIMESTAMP    | nullable              |

### 4.4 Task

| Column      | Type         | Notes                       |
| ----------- | ------------ | --------------------------- |
| id          | UUID PK      |                             |
| project_id  | UUID FK      | → Project.id, not null      |
| name        | VARCHAR(255) | not null                    |
| description | TEXT         | nullable                    |
| status      | ENUM         | TaskStatus (open \| closed) |
| created_at  | TIMESTAMP    |                             |
| updated_at  | TIMESTAMP    |                             |
| deleted_at  | TIMESTAMP    | nullable                    |

### 4.5 TaskAssignment

| Column     | Type      | Notes               |
| ---------- | --------- | ------------------- |
| id         | UUID PK   |                     |
| user_id    | UUID FK   | → User.id, not null |
| task_id    | UUID FK   | → Task.id, not null |
| created_at | TIMESTAMP |                     |

Constraint: `unique(user_id, task_id)`

### 4.6 TimeEntry

| Column      | Type      | Notes                           |
| ----------- | --------- | ------------------------------- |
| id          | UUID PK   |                                 |
| user_id     | UUID FK   | → User.id, not null             |
| task_id     | UUID FK   | → Task.id, nullable*            |
| date        | DATE      | not null, derived from start_at |
| start_at    | TIMESTAMP | not null                        |
| end_at      | TIMESTAMP | nullable (null = running timer) |
| location    | ENUM      | WorkLocation, nullable*         |
| description | TEXT      | nullable                        |
| created_at  | TIMESTAMP |                                 |
| updated_at  | TIMESTAMP |                                 |
| deleted_at  | TIMESTAMP | nullable                        |

\* `task_id` and `location` are nullable because a running timer (`end_at = null`) has no task/location yet — assigned on stop.

**Validations:**

- `end_at > start_at` (midnight crossing allowed for night shifts)
- No overlapping `[start_at, end_at]` for the same user (checked across dates for midnight-crossing entries)
- `date` = date of `start_at` (entry belongs to the day it started)
- User must be assigned to the task (via TaskAssignment)
- Month must not be locked (except: see §8.1 exceptions)
- At most one entry with `end_at = null` per user (one running timer)

### 4.7 Absence

| Column          | Type      | Notes                                                                        |
| --------------- | --------- | ---------------------------------------------------------------------------- |
| id              | UUID PK   |                                                                              |
| user_id         | UUID FK   | → User.id, not null                                                          |
| type            | ENUM      | AbsenceType                                                                  |
| start_date      | DATE      | not null                                                                     |
| end_date        | DATE      | not null                                                                     |
| is_half_day     | BOOLEAN   | default false                                                                |
| half_day_period | ENUM      | HalfDayPeriod (morning \| afternoon), nullable, required if is_half_day=true |
| notes           | TEXT      | nullable                                                                     |
| created_at      | TIMESTAMP |                                                                              |
| updated_at      | TIMESTAMP |                                                                              |
| deleted_at      | TIMESTAMP | nullable                                                                     |

**Validations:**

- `end_date >= start_date`
- Friday and Saturday excluded from range
- Sick and military types: attachment mandatory (can be added later)

### 4.8 AbsenceAttachment

| Column     | Type         | Notes                   |
| ---------- | ------------ | ----------------------- |
| id         | UUID PK      |                         |
| absence_id | UUID FK      | → Absence.id, not null  |
| file_name  | VARCHAR(255) | original file name      |
| file_type  | VARCHAR(50)  | jpg, png, or pdf        |
| file_size  | INTEGER      | bytes, max 5MB          |
| blob_key   | VARCHAR(500) | Vercel Blob storage key |
| created_at | TIMESTAMP    |                         |

### 4.9 MonthLock

| Column      | Type      | Notes                       |
| ----------- | --------- | --------------------------- |
| id          | UUID PK   |                             |
| year        | INTEGER   | not null                    |
| month       | INTEGER   | 1–12, not null              |
| locked_by   | UUID FK   | → User.id (admin), not null |
| locked_at   | TIMESTAMP | not null                    |
| is_locked   | BOOLEAN   | default true                |
| unlocked_by | UUID FK   | → User.id, nullable         |
| unlocked_at | TIMESTAMP | nullable                    |

Constraint: `unique(year, month)`
Note: Lock/unlock events also recorded in AuditLog.

### 4.10 AuditLog

| Column      | Type        | Notes                         |
| ----------- | ----------- | ----------------------------- |
| id          | UUID PK     |                               |
| actor_id    | UUID FK     | → User.id, not null           |
| action      | ENUM        | AuditAction                   |
| entity_type | VARCHAR(50) | e.g. "TimeEntry", "MonthLock" |
| entity_id   | UUID        | the affected record           |
| before      | JSONB       | nullable, previous state      |
| after       | JSONB       | nullable, new state           |
| created_at  | TIMESTAMP   |                               |

This table is **append-only**. No updates, no deletes. Visible to admin only.

### 4.11 Entity Relationship Diagram

```
User ──< TaskAssignment >── Task
User ──< TimeEntry >── Task
User ──< Absence ──< AbsenceAttachment
User ──< MonthLock (locked_by)
User ──< AuditLog (actor_id)
Client ──< Project ──< Task

Legend: ──< means "one to many"
```

---

## 5. Authentication & Authorization

### 5.1 Auth Flow

- **Login:** `POST /api/v1/auth/login { email, password }`
- Returns: `{ accessToken }` + sets refreshToken as httpOnly cookie
- **Access token:** JWT, ~15 min expiry, stateless, contains `{ userId, role }`
- **Refresh token:** httpOnly cookie, checked against `token_version` in User table
- **Refresh:** `POST /api/v1/auth/refresh` (reads cookie, returns new accessToken)
- **Logout:** `POST /api/v1/auth/logout` (increments token_version, clears cookie)
- SSO / Azure / Google: **out of scope** (Figma Azure button is a confirmed design mistake)

### 5.2 User Creation

- Only admins create users (no self-registration)
- Admin sets initial password
- No force-change-on-first-login (not in PRD)
- No forgot-password flow — admin resets password manually
- "Remember me": unchecked = refresh token lasts 1 day, checked = 30 days

### 5.3 Password Policy

- Minimum 8 characters, no additional complexity requirements
- Stored as bcrypt hash

### 5.4 Role Guards

Every API endpoint is protected by one of:

| Decorator       | Requirement                            |
| --------------- | -------------------------------------- |
| `@Public()`     | No auth required (login, refresh only) |
| `@Auth()`       | Any authenticated user                 |
| `@Roles(ADMIN)` | Admin only                             |

Guard logic (applied as NestJS guards in this order):

1. **JwtGuard** — validates access token, attaches user to request
2. **RolesGuard** — checks `user.role` against `@Roles()` decorator

### 5.5 Route Access Matrix

- Employee app routes → require role = EMPLOYEE
- Admin console routes → require role = ADMIN
- An admin NEVER accesses the employee app
- An employee NEVER accesses the admin console

### 5.6 Token Revocation

- Refresh token carries `token_version`
- On logout or password reset: `token_version++` in User table
- Any refresh attempt with old version is rejected
- Access tokens remain valid until natural expiry (~15 min)
- Deactivating a user (`is_active = false`): `token_version++`, JwtGuard also checks `is_active` on every request

---

## 6. API Conventions

### 6.1 Base URL

```
/api/v1/{resource}
```

### 6.2 HTTP Methods

| Method | Usage                         |
| ------ | ----------------------------- |
| GET    | Read (single or list)         |
| POST   | Create                        |
| PATCH  | Partial update                |
| DELETE | Soft delete (sets deleted_at) |

### 6.3 Request/Response Format

- Content-Type: `application/json`
- All request bodies validated via zod schemas from `packages/contracts/`

### 6.4 Standard Response Envelope

**Success (single):**

```json
{
  "data": { ... }
}
```

**Success (list with pagination):**

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

### 6.5 Standard Error Envelope

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [{ "field": "email", "rule": "VAL-01", "message": "Email is required" }]
}
```

### 6.6 HTTP Status Codes

| Code | Usage                                           |
| ---- | ----------------------------------------------- |
| 200  | OK (read, update)                               |
| 201  | Created                                         |
| 204  | No Content (delete)                             |
| 400  | Bad Request (validation)                        |
| 401  | Unauthorized (missing/invalid token)            |
| 403  | Forbidden (wrong role, month locked)            |
| 404  | Not Found                                       |
| 409  | Conflict (duplicate email, overlapping entries) |
| 422  | Unprocessable Entity (business rule violation)  |

### 6.7 Pagination

- Offset-based on all list endpoints
- Query params: `?page=1&limit=20`
- Defaults: `page=1`, `limit=20`
- Max limit: `100`

### 6.8 Filtering & Sorting

Filtering via query params per endpoint (defined in feature specs). Common patterns:

| Param            | Usage                            |
| ---------------- | -------------------------------- |
| `?month=2026-08` | Filter by month                  |
| `?userId=<uuid>` | Filter by user (admin endpoints) |
| `?isActive=true` | Filter active/inactive entities  |

Sorting: `?sort=createdAt&order=desc`
Defaults defined per endpoint in feature specs.

### 6.9 Timestamps

| Layer            | Format                                     |
| ---------------- | ------------------------------------------ |
| Database         | All stored in UTC                          |
| API              | ISO 8601 UTC (e.g. `2026-08-13T09:00:00Z`) |
| Frontend         | Converted to Asia/Jerusalem for display    |
| Date-only fields | `YYYY-MM-DD` format                        |

### 6.10 Soft Delete

- `DELETE` endpoints set `deleted_at = NOW()`, return 204
- All queries exclude `deleted_at IS NOT NULL` by default (Prisma middleware)
- Admin list endpoints may optionally include `?includeDeleted=true`

### 6.11 Swagger

- Auto-generated from NestJS decorators
- Available at `/api/v1/docs` in development

---

## 7. Permission Matrix

### 7.1 Employee Permissions

| Resource         | Action        | Condition                                           |
| ---------------- | ------------- | --------------------------------------------------- |
| Own TimeEntries  | Create        | Month open                                          |
| Own TimeEntries  | Read          | Always                                              |
| Own TimeEntries  | Update        | Month open                                          |
| Own TimeEntries  | Delete        | Month open                                          |
| Own Absences     | Create        | Month open, OR month locked + type is sick/military |
| Own Absences     | Read          | Always                                              |
| Own Absences     | Update        | Month open                                          |
| Own Absences     | Delete        | Month open                                          |
| Own Attachments  | Upload        | Always (even locked month)                          |
| Own Attachments  | Read/Download | Always                                              |
| Own Timer        | Start         | Month open, no active timer running                 |
| Own Timer        | Stop          | Has active timer                                    |
| Assigned Tasks   | Read          | Always (for pickers)                                |
| Clients/Projects | Read          | Only those linked to assigned tasks                 |
| MonthLock        | Read          | Always (to show lock status)                        |
| Other Users      | —             | No access                                           |
| AuditLog         | —             | No access                                           |

### 7.2 Admin Permissions

| Resource             | Action        | Condition                 |
| -------------------- | ------------- | ------------------------- |
| Users                | CRUD          | Always                    |
| Clients              | CRUD          | Always                    |
| Projects             | CRUD          | Always                    |
| Tasks                | CRUD          | Always                    |
| TaskAssignments      | CRUD          | Always                    |
| Employee TimeEntries | Read          | Always                    |
| Employee TimeEntries | Update        | Always (audit-logged)     |
| Employee Absences    | Read          | Always                    |
| Employee Absences    | Update        | Always (audit-logged)     |
| Employee Absences    | Delete        | Always (audit-logged)     |
| MonthLock            | Lock          | Always                    |
| MonthLock            | Unlock/Reopen | Always                    |
| AuditLog             | Read          | Always                    |
| Own TimeEntries      | —             | Admin never reports hours |
| Own Absences         | —             | Admin never reports       |

### 7.3 Locked Month Override Summary

When a month is locked, ALL write operations are blocked EXCEPT:

1. Employee can create sick/military absence for the locked month
2. Employee can upload attachments to existing absences
3. Admin can reopen (unlock) the month
4. Admin can edit employee time entries (audit-logged)
5. Admin can edit/delete employee absences (audit-logged)

---

## 8. Cross-Cutting Rules

These rules are defined once here. Feature specs reference them by section number (e.g. "see §8.1") and must not redefine them.

### 8.1 Month Locking

**States:** OPEN → LOCKED (by admin only)

**Storage:** MonthLock table, one row per `(year, month)`.

- No row = month is open
- Row with `is_locked=true` = month is locked
- Row with `is_locked=false` = month was locked, then reopened

**Lock:** Admin calls `POST /api/v1/month-lock { year, month }`. Sets `is_locked=true`, `locked_by`, `locked_at`. Creates AuditLog entry.

**Lock warnings:** Before locking, the API checks for:

- Employees with a running timer — returns a warning listing affected employees
- Sick/military absences without attachments — returns a warning listing affected absences
  The admin sees these warnings but can still proceed with locking.

**Unlock:** Admin calls `PATCH /api/v1/month-lock/:id { is_locked: false }`. Sets `is_locked=false`, `unlocked_by`, `unlocked_at`. Creates AuditLog entry.

**Enforcement function:** `assertMonthNotLocked(year, month)`

- Called by every write endpoint on TimeEntry and Absence
- Throws 403 if month is locked, UNLESS the operation is in the exception list (see §7.3)
- Must be planted on day one — retrofitting is expensive

### 8.2 Assignment Scoping

**Enforcement function:** `assertUserAssignedToTask(userId, taskId)`

- Called on TimeEntry create/update
- Verifies a TaskAssignment row exists for `(userId, taskId)`
- Throws 403 if not assigned

**Picker scoping (frontend):**

- Employee pickers show only: Tasks they are assigned to, the parent Projects of those tasks, and the parent Clients of those projects
- Cascading filter: Client → Project → Task
- Deactivated/closed entities hidden from pickers but still render on historical entries (see §8.3)

### 8.3 Soft Delete

**Write path:**

- `DELETE` sets `deleted_at = NOW()`, never physically removes the row
- Task "delete" sets `status = CLOSED` and `deleted_at` (per PRD p.8)
- User "delete" sets `is_active = false` and `deleted_at`

**Read path:**

- All default queries: `WHERE deleted_at IS NULL` (Prisma middleware)
- Historical entries (existing TimeEntries/Absences) continue to display the name of a deleted/deactivated Client/Project/Task/User
- New-entry pickers: exclude inactive/deleted/closed entities
- Admin lists: may include deleted via `?includeDeleted=true`

**Cascade rules:**

- Deactivating a Client does NOT auto-deactivate its Projects/Tasks
- Closing a Task does NOT remove existing TaskAssignments
- Deactivating a User increments `token_version` (forces logout)

### 8.4 Audit Logging

**Enforcement function:** `writeAuditLog(actor, action, entityType, entityId, before, after)`

- Append-only, no updates, no deletes

**Must log (graded):**

- Admin edits to employee TimeEntries (before + after state)
- Month lock/unlock (who + when)

**Should log (best practice):**

- TimeEntry create/update/delete by employee
- Absence create/update/delete by employee

**Not logged (MVP):**

- Entity management CRUD (clients, projects, tasks)
- User management CRUD
- Login attempts

**Visibility:** admin only, via admin console.

### 8.5 Time Semantics

**Timezone:**

| Layer       | Rule                                  |
| ----------- | ------------------------------------- |
| Database    | All timestamps in UTC                 |
| API         | ISO 8601 UTC (`2026-08-13T09:00:00Z`) |
| Frontend    | Display in Asia/Jerusalem             |
| Date fields | `YYYY-MM-DD`                          |

**9-Hour Quota:**

- Soft visual target, not a hard cap
- Frontend shows a quota bar: green (>=9h), yellow (<9h), red (>9h)
- API does NOT reject entries based on total hours

**Entry Validations:**

- `end_at > start_at` (mandatory)
- Midnight crossing allowed (night shifts supported, e.g. 22:00–06:00)
- `date` field = date of `start_at` (entry belongs to the day it started)
- No overlapping `[start_at, end_at]` for same user (checked across dates for midnight-crossing entries)
- Minimum entry duration: none (1 minute is valid)
- Maximum entry duration: none

**Week:**

- Week starts on Sunday (Israeli standard)
- Friday and Saturday excluded from absence date ranges

**Day Status Calculation** (DayStatus enum, computed not stored):

- Sum all TimeEntry durations for user+date
- **EMPTY:** 0 hours (no entries)
- **PARTIAL:** 0 < hours < 9
- **FULL:** hours = 9 (exactly meets quota)
- **EXCESS:** hours > 9
- **ABSENCE:** day fully covered by an absence record

**Israeli holidays:** not handled. Fri/Sat exclusion only.

### 8.6 Running Timer

A running timer is a TimeEntry with:

- `end_at = NULL`
- `task_id = NULL`
- `location = NULL`
- Only `start_at`, `user_id`, and `date` are set

**Rules:**

- At most one running timer per user at any time
- Timer state must survive page refresh (query API on load)
- On stop: employee fills completion dialog (task, location, description), then `end_at` + `task_id` + `location` are set
- Timer cannot be started if the current month is locked
- If month is locked while timer is running: admin receives a warning listing employees with active timers (see §8.1). Timer is NOT auto-stopped — the employee must stop it manually

### 8.7 File Uploads

**Storage:** Vercel Blob (private access)

**Constraints:**

| Rule          | Value                         |
| ------------- | ----------------------------- |
| Allowed types | JPG, PNG, PDF                 |
| Max size      | 5MB per file                  |
| Access        | Signed URLs, 60 minute expiry |

**Upload flow:**

1. Frontend requests upload URL: `POST /api/v1/files/upload-url`
2. API generates signed upload URL from Vercel Blob
3. Frontend uploads directly to Blob storage
4. Frontend confirms upload: `POST /api/v1/absences/:id/attachments`
5. API stores AbsenceAttachment record with `blob_key`

**Download flow:**

1. `GET /api/v1/absences/:absenceId/attachments/:id/url`
2. API generates signed download URL, returns it
3. Frontend opens/downloads via signed URL

---

## 9. Validation Rule Registry

All validation rules have a stable ID (`VAL-nn`). Both frontend and backend reference these IDs. Zod schemas in `packages/contracts/` implement them. Error responses include the rule ID in the `details` array.

### 9.1 Authentication

| ID     | Rule                               |
| ------ | ---------------------------------- |
| VAL-01 | Email is required                  |
| VAL-02 | Email must be a valid email format |
| VAL-03 | Password is required               |
| VAL-04 | Password minimum 8 characters      |

### 9.2 User Management

| ID     | Rule                                              |
| ------ | ------------------------------------------------- |
| VAL-10 | Full name is required                             |
| VAL-11 | Email must be unique (among non-deleted users)    |
| VAL-12 | Role must be a valid UserRole enum value          |
| VAL-13 | Initial password is required when creating a user |

### 9.3 Entity Management

| ID     | Rule                                                    |
| ------ | ------------------------------------------------------- |
| VAL-20 | Client name is required                                 |
| VAL-21 | Client name must be unique (among non-deleted clients)  |
| VAL-22 | Project name is required                                |
| VAL-23 | Project must reference an active, non-deleted client    |
| VAL-24 | Task name is required                                   |
| VAL-25 | Task must reference an active, non-deleted project      |
| VAL-26 | TaskAssignment must reference an existing user and task |
| VAL-27 | TaskAssignment must be unique (user_id + task_id)       |

### 9.4 Time Entries

| ID     | Rule                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------- |
| VAL-30 | start_at is required                                                                                 |
| VAL-31 | end_at must be after start_at (midnight crossing allowed for night shifts)                           |
| VAL-32 | Time entries must not overlap for the same user (checked across dates for midnight-crossing entries) |
| VAL-33 | User must be assigned to the selected task                                                           |
| VAL-34 | Month must not be locked (see §8.1 exceptions)                                                       |
| VAL-35 | Task is required (except running timer)                                                              |
| VAL-36 | Location is required (except running timer)                                                          |
| VAL-37 | Only one running timer per user at a time                                                            |
| VAL-38 | Date must match the date portion of start_at                                                         |

### 9.5 Absences

| ID     | Rule                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| VAL-40 | Absence type must be a valid AbsenceType enum value                                                           |
| VAL-41 | start_date is required                                                                                        |
| VAL-42 | end_date must be >= start_date                                                                                |
| VAL-43 | Date range must exclude Fridays and Saturdays                                                                 |
| VAL-44 | Sick and military absences require attachment (can be added after creation, but must exist before month lock) |
| VAL-45 | Month must not be locked, UNLESS type is sick or military                                                     |

### 9.6 Month Lock

| ID     | Rule                                     |
| ------ | ---------------------------------------- |
| VAL-50 | Year and month are required              |
| VAL-51 | Month cannot be locked if already locked |
| VAL-52 | Month cannot be unlocked if already open |

### 9.7 File Uploads

| ID     | Rule                                          |
| ------ | --------------------------------------------- |
| VAL-60 | File type must be JPG, PNG, or PDF            |
| VAL-61 | File size must not exceed 5MB                 |
| VAL-62 | Attachment must reference an existing absence |

---

## 10. Shared Component Inventory

Components listed here are built ONCE and consumed by multiple screens. Feature specs reference them by name and must not rebuild them. New shared components must be added here first.

### 10.1 Employee App (`apps/mobile/src/components/ui/`)

| Component        | Consumed By                                                                           | Props / Notes                                                               |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| CascadingPicker  | Daily report (manual entry), Timer stop dialog                                        | `userId` → filters Client→Project→Task to assigned tasks only               |
| EntryForm        | Daily report (create + edit), Timer stop dialog (completion mode)                     | `mode` (manual \| timer-complete), optional prefilled `start_at`/`end_at`   |
| EntriesTable     | Home screen (today's entries), Monthly view (day detail), Admin: employee report view | Columns: time range, duration, client, project, task, location, description |
| QuotaBar         | Home screen, multi-entry day view                                                     | `totalHours`, `quota` (default 9). Visual: green >=9, yellow <9, red >9     |
| DayStatusBadge   | Monthly calendar, monthly list                                                        | `status` (DayStatus enum). Shows: מלא / חסר / חריג with color               |
| TimerBar         | Home screen (persistent top bar when timer is running)                                | `startAt`, `onStop` callback. Shows elapsed time                            |
| LocationDropdown | EntryForm, Timer stop dialog                                                          | `value`, `onChange`. Options: WorkLocation enum                             |
| AttachmentUpload | Absence form                                                                          | `absenceId`, `onUploadComplete`. Validates: VAL-60, VAL-61                  |
| HalfDayToggle    | Absence form                                                                          | `value`, `onChange`                                                         |

### 10.2 Admin Console (`apps/admin/src/components/ui/`)

| Component           | Consumed By                                                                 | Props / Notes                                                 |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| DataTable           | Users list, Clients list, Projects list, Tasks list, Assignments list       | Config-driven: columns, sort, filter, pagination, row actions |
| CrudModal           | User create/edit, Client create/edit, Project create/edit, Task create/edit | Config-driven: fields, validation, submit handler             |
| EntriesTable        | Employee report view                                                        | Same data contract as mobile, different styling (shadcn/ui)   |
| LockStatusIndicator | Month lock screen, report headers                                           | `year`, `month`, `isLocked`, `lockedAt`                       |

### 10.3 Shared (`packages/contracts/`)

Not UI components — shared logic and types:

- Zod schemas per entity (used by API for validation, frontends for type inference)
- Enum definitions (all from §2)
- Date utility types (DateRange, MonthYear)

---

## 11. Screen Inventory

Every screen, its route, required role, and states. Detailed flows and acceptance criteria belong in feature specs.

### 11.1 Employee App

| Screen              | Route          | Role     | States                                                               |
| ------------------- | -------------- | -------- | -------------------------------------------------------------------- |
| Login               | `/login`       | Public   | default, loading, error (invalid credentials)                        |
| Home / Daily Report | `/`            | Employee | default (with/without entries), loading, timer-running, month-locked |
| New Entry           | `/entry/new`   | Employee | default, saving, validation-error                                    |
| Edit Entry          | `/entry/:id`   | Employee | default, saving, validation-error, month-locked (read only)          |
| Monthly View        | `/monthly`     | Employee | default (calendar + list), loading, empty-month, month-locked        |
| Absence Report      | `/absence/new` | Employee | default, saving, validation-error, upload-in-progress                |
| Timer Stop Dialog   | (dialog)       | Employee | completion form, saving                                              |

**Navigation (employee):**

- Bottom nav or side menu: Home, Monthly View, Absences
- Timer bar: persistent at top when timer is running
- היסטוריית דיווחים (report history) = Monthly View (folded in, not a separate screen)

### 11.2 Admin Console

| Screen           | Route                                  | Role   | States                                                             |
| ---------------- | -------------------------------------- | ------ | ------------------------------------------------------------------ |
| Admin Login      | `/admin/login`                         | Public | default, loading, error                                            |
| Users            | `/admin/users`                         | Admin  | table, loading, empty, modal (create/edit)                         |
| Clients          | `/admin/clients`                       | Admin  | table, loading, empty, modal                                       |
| Projects         | `/admin/projects`                      | Admin  | table, loading, empty, modal                                       |
| Tasks            | `/admin/tasks`                         | Admin  | table, loading, empty, modal                                       |
| Assignments      | `/admin/assignments`                   | Admin  | table, loading, empty, modal                                       |
| Employee Reports | `/admin/reports`, `/admin/reports/:id` | Admin  | employee list, employee detail (entries table), edit mode, loading |
| Month Lock       | `/admin/month-lock`                    | Admin  | month selector, lock/unlock controls, lock history                 |
| Audit Log        | `/admin/audit`                         | Admin  | table with filters, loading, empty                                 |

**Navigation (admin):** sidebar with links to all screens above.

---

## 12. Endpoint Index

One line per endpoint. Full request/response shapes defined in `packages/contracts/` zod schemas. Feature specs detail behavior.

### 12.1 Auth

| Method | Path                   | Auth   | Description             |
| ------ | ---------------------- | ------ | ----------------------- |
| POST   | `/api/v1/auth/login`   | Public | Login                   |
| POST   | `/api/v1/auth/refresh` | Public | Refresh access token    |
| POST   | `/api/v1/auth/logout`  | Auth   | Logout (revoke refresh) |

### 12.2 Users (Admin only)

| Method | Path                               | Auth  | Description            |
| ------ | ---------------------------------- | ----- | ---------------------- |
| GET    | `/api/v1/users`                    | Admin | List users (paginated) |
| GET    | `/api/v1/users/:id`                | Admin | Get user by ID         |
| POST   | `/api/v1/users`                    | Admin | Create user            |
| PATCH  | `/api/v1/users/:id`                | Admin | Update user            |
| DELETE | `/api/v1/users/:id`                | Admin | Soft delete user       |
| POST   | `/api/v1/users/:id/reset-password` | Admin | Reset user password    |

### 12.3 Clients (Admin only)

| Method | Path                  | Auth  | Description              |
| ------ | --------------------- | ----- | ------------------------ |
| GET    | `/api/v1/clients`     | Admin | List clients (paginated) |
| GET    | `/api/v1/clients/:id` | Admin | Get client by ID         |
| POST   | `/api/v1/clients`     | Admin | Create client            |
| PATCH  | `/api/v1/clients/:id` | Admin | Update client            |
| DELETE | `/api/v1/clients/:id` | Admin | Soft delete client       |

### 12.4 Projects (Admin only)

| Method | Path                   | Auth  | Description               |
| ------ | ---------------------- | ----- | ------------------------- |
| GET    | `/api/v1/projects`     | Admin | List projects (paginated) |
| GET    | `/api/v1/projects/:id` | Admin | Get project by ID         |
| POST   | `/api/v1/projects`     | Admin | Create project            |
| PATCH  | `/api/v1/projects/:id` | Admin | Update project            |
| DELETE | `/api/v1/projects/:id` | Admin | Soft delete project       |

### 12.5 Tasks (Admin only)

| Method | Path                | Auth  | Description              |
| ------ | ------------------- | ----- | ------------------------ |
| GET    | `/api/v1/tasks`     | Admin | List tasks (paginated)   |
| GET    | `/api/v1/tasks/:id` | Admin | Get task by ID           |
| POST   | `/api/v1/tasks`     | Admin | Create task              |
| PATCH  | `/api/v1/tasks/:id` | Admin | Update task              |
| DELETE | `/api/v1/tasks/:id` | Admin | Soft delete (close) task |

### 12.6 Task Assignments (Admin only)

| Method | Path                      | Auth  | Description                  |
| ------ | ------------------------- | ----- | ---------------------------- |
| GET    | `/api/v1/assignments`     | Admin | List assignments (paginated) |
| POST   | `/api/v1/assignments`     | Admin | Assign user to task          |
| DELETE | `/api/v1/assignments/:id` | Admin | Remove assignment            |

### 12.7 Time Entries

| Method | Path                       | Auth     | Description                                                                |
| ------ | -------------------------- | -------- | -------------------------------------------------------------------------- |
| GET    | `/api/v1/time-entries`     | Auth     | List own entries (employee) or any user's (admin). `?userId=&date=&month=` |
| GET    | `/api/v1/time-entries/:id` | Auth     | Get entry by ID                                                            |
| POST   | `/api/v1/time-entries`     | Employee | Create entry                                                               |
| PATCH  | `/api/v1/time-entries/:id` | Auth     | Update entry (employee own, admin any — audit-logged)                      |
| DELETE | `/api/v1/time-entries/:id` | Employee | Soft delete own entry                                                      |

### 12.8 Timer

| Method | Path                   | Auth     | Description                                  |
| ------ | ---------------------- | -------- | -------------------------------------------- |
| POST   | `/api/v1/timer/start`  | Employee | Start timer (creates entry with end_at=null) |
| POST   | `/api/v1/timer/stop`   | Employee | Stop timer (sets end_at, task_id, location)  |
| GET    | `/api/v1/timer/active` | Employee | Get active timer (if any)                    |

### 12.9 Absences

| Method | Path                   | Auth     | Description                                                  |
| ------ | ---------------------- | -------- | ------------------------------------------------------------ |
| GET    | `/api/v1/absences`     | Auth     | List own (employee) or any user's (admin). `?userId=&month=` |
| GET    | `/api/v1/absences/:id` | Auth     | Get absence by ID                                            |
| POST   | `/api/v1/absences`     | Employee | Create absence                                               |
| PATCH  | `/api/v1/absences/:id` | Employee | Update own absence                                           |
| DELETE | `/api/v1/absences/:id` | Employee | Soft delete own absence                                      |

### 12.10 Absence Attachments

| Method | Path                                              | Auth     | Description             |
| ------ | ------------------------------------------------- | -------- | ----------------------- |
| POST   | `/api/v1/files/upload-url`                        | Employee | Get signed upload URL   |
| POST   | `/api/v1/absences/:id/attachments`                | Employee | Register uploaded file  |
| GET    | `/api/v1/absences/:absenceId/attachments/:id/url` | Auth     | Get signed download URL |

### 12.11 Month Lock (Admin only)

| Method | Path                     | Auth  | Description                        |
| ------ | ------------------------ | ----- | ---------------------------------- |
| GET    | `/api/v1/month-lock`     | Admin | List month lock statuses. `?year=` |
| POST   | `/api/v1/month-lock`     | Admin | Lock a month                       |
| PATCH  | `/api/v1/month-lock/:id` | Admin | Unlock (reopen) a month            |

### 12.12 Audit Log (Admin only)

| Method | Path                | Auth  | Description                                                               |
| ------ | ------------------- | ----- | ------------------------------------------------------------------------- |
| GET    | `/api/v1/audit-log` | Admin | List audit entries (paginated, filterable). `?entityType=&userId=&month=` |

### 12.13 Employee Picker Data

| Method | Path                     | Auth     | Description                                                                |
| ------ | ------------------------ | -------- | -------------------------------------------------------------------------- |
| GET    | `/api/v1/me/assignments` | Employee | Get own task assignments with parent project+client (for cascading picker) |

---

## 13. Non-Functional Requirements (NFRs)

### 13.1 Performance

- API response time: < 500ms for all endpoints (p95)
- Page load (initial): < 3 seconds on 3G connection
- Pagination on all list endpoints to prevent unbounded queries
- Database indexes on all FK columns and common query patterns (`user_id+date` on TimeEntry, `year+month` on MonthLock)

### 13.2 Security

- Passwords: bcrypt hashed, never logged or returned in responses
- JWT: access token ~15 min, no sensitive data in payload beyond userId and role
- Refresh token: httpOnly, Secure, SameSite=Strict cookie
- CORS: whitelist only the employee app and admin console origins
- File uploads: server-side validation of type and size (VAL-60, VAL-61), do not rely on frontend validation alone
- Vercel Blob: private access only, signed URLs for download
- SQL injection: mitigated by Prisma parameterized queries
- XSS: React default escaping, no `dangerouslySetInnerHTML`

### 13.3 Accessibility

- Semantic HTML elements
- All form inputs must have labels
- Keyboard navigable
- Minimum contrast ratio per WCAG 2.1 AA
- RTL layout fully supported (`dir="rtl"`, `lang="he"`)

### 13.4 Browser Support

- Chrome (latest 2 versions)
- Safari (latest 2 versions, for mobile)
- Firefox (latest 2 versions)
- Edge (latest 2 versions)
- No IE support

### 13.5 Uptime & Error Handling

- Vercel handles availability (no self-managed infra)
- API returns consistent error envelope on all failures (§6.5)
- Frontend shows user-friendly Hebrew error messages
- No silent failures — all API errors surfaced to user

### 13.6 Data Retention

- Soft-deleted records retained indefinitely
- Audit log entries retained indefinitely, append-only
- No automated cleanup or archival in MVP

---

## 14. Testing Strategy

### 14.1 Coverage Gate

CI enforces **70% code coverage minimum** on every PR. PRs below 70% are blocked from merging.

### 14.2 What to Test

**Priority 1 — Cross-cutting functions (must be near 100%):**

- `assertMonthNotLocked()`
- `assertUserAssignedToTask()`
- `writeAuditLog()`
- JWT guard and role guard logic
- Zod validation schemas (`packages/contracts/`)

**Priority 2 — API endpoints (integration tests):**

- Each endpoint: happy path + auth failure + validation failure
- Time entry overlap rejection
- Month lock enforcement and exceptions
- Soft delete behavior
- Pagination

**Priority 3 — Frontend shared components:**

- CascadingPicker: filtering, selection, scoping
- EntryForm: validation, manual vs timer-complete mode
- EntriesTable: rendering, empty state
- QuotaBar: correct color by hours
- DataTable: sort, filter, pagination
- CrudModal: submit, validation display

**Priority 4 — Feature-specific:** defined in each feature spec's test plan.

### 14.3 Testing Tools

| Layer    | Tool                                                      |
| -------- | --------------------------------------------------------- |
| Backend  | Jest + Supertest (NestJS default)                         |
| Frontend | Vitest + React Testing Library                            |
| Database | Test database (separate Neon branch or docker-compose pg) |

### 14.4 Test Conventions

- Test files co-located: `*.spec.ts` next to source file
- Naming: `describe("FeatureName")` > `describe("methodName")` > `it("should...")`
- No mocking of Prisma in integration tests — use test database
- Shared test utilities in a `test/` folder at each app root
- Seed data for tests: minimal fixtures, not full `seed.ts`

### 14.5 Acceptance Criteria Convention

Feature specs use **Given/When/Then** format:

```
Given: precondition (state of the system)
When:  action (user or API call)
Then:  expected outcome (response, state change, UI change)
```

Each acceptance criterion maps to at least one test. The feature spec's test plan references the criterion by ID.

---

## 15. Ways of Working

### 15.1 File Ownership

| Path                     | Ownership Rule                                               |
| ------------------------ | ------------------------------------------------------------ |
| `packages/contracts/`    | Joint — PR requires review from at least one other developer |
| `prisma/schema.prisma`   | Joint — PR requires review                                   |
| `server/api/src/common/` | Joint — PR requires review                                   |

Rule: if your PR touches `packages/contracts/` or `schema.prisma`, it must be reviewed by at least one other team member.

### 15.2 Branching Strategy

| Branch              | Purpose                            |
| ------------------- | ---------------------------------- |
| `main`              | Production, always deployable      |
| `stage`             | Pre-production testing             |
| `dev`               | Integration branch, PRs merge here |
| `feat/<epic-name>`  | Feature branches                   |
| `fix/<description>` | Bugfix branches                    |

**Flow:**

1. Branch from `dev`: `feat/<epic-name>`
2. Commit often, push daily
3. Open PR to `dev` when feature (or story) is complete
4. CI must pass (lint + typecheck + test at 70%)
5. At least one team member reviews
6. Squash merge to `dev`
7. `dev` → `stage` for pre-production testing
8. `stage` → `main` for production deploy

### 15.3 PR Rules

- PR title: clear, descriptive (e.g. "feat: add time entry CRUD")
- PR must include: what changed, how to test
- CI must pass before review
- No self-merging — at least one approval required
- Contracts/schema changes require extra reviewer

### 15.4 Definition of Done (per story)

A story is done when:

1. Code is written and follows project conventions
2. Tests pass and coverage >= 70%
3. Zod schemas in `packages/contracts/` updated if needed
4. API endpoint documented via NestJS Swagger decorators
5. PR reviewed and approved
6. Merged to `dev`
7. No regressions in CI

### 15.5 Spec Freeze

The general SPEC (this document) is frozen once all team members have reviewed it. Changes after freeze require:

1. Written proposal (what + why)
2. Team agreement (majority)
3. Update this spec + affected feature specs
4. Commit with message `spec: <change description>`

### 15.6 Communication

- Jira board for story tracking (restructure to match 9 epics)
- Daily standup or async update
- Blockers raised immediately, not at standup

---

## 16. Decision Log

Resolved decisions from the blueprint's open questions and PRD contradictions.

| ID     | Question                                  | Resolution                                                                                                                                                                                                                       | Rationale                                                                |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ADR-01 | One app or two?                           | Two separate React frontends. Employee app (`apps/mobile`): React+Vite+Tailwind, 393px, RTL. Admin console (`apps/admin`): React+shadcn/ui, web (min 1024px).                                                                    | Different viewports, different audiences, independent deployability.     |
| ADR-02 | TimeEntry shape: startAt/endAt or hours?  | `start_at` + nullable `end_at`. `end_at=null` means running timer. No separate timer table.                                                                                                                                      | Timer is a state, not a migration.                                       |
| ADR-03 | Work location: per-day or per-entry?      | Per-entry. Each TimeEntry carries its own WorkLocation value.                                                                                                                                                                    | Employee may work from different locations in the same day.              |
| ADR-04 | 9-hour quota: warning or hard block?      | Soft visual target. API does not reject entries based on total hours. Frontend shows color-coded quota bar.                                                                                                                      | User confirmed advisory, not enforcement.                                |
| ADR-05 | Overlapping entries: allowed or rejected? | Rejected. API validates no overlapping `[start_at, end_at]` for same user on same date.                                                                                                                                          | User confirmed.                                                          |
| ADR-06 | Timezone                                  | UTC in database, ISO 8601 UTC in API, Asia/Jerusalem in frontend display.                                                                                                                                                        | Standard practice.                                                       |
| ADR-07 | Midnight crossing / night shifts          | Supported. `end_at` must be > `start_at`, but can cross midnight (e.g. 22:00–06:00). `date` field = date of `start_at`.                                                                                                          | Night shifts are a real use case. Overlap detection checks across dates. |
| ADR-08 | Timer edge cases                          | At most one running timer per user. Timer cannot start if month is locked. If month is locked while timer is running: admin gets a warning, timer is NOT auto-stopped.                                                           | Admin warned, employee must stop manually.                               |
| ADR-09 | Half-day absence quota                    | Deferred to feature spec for absences.                                                                                                                                                                                           | Feature-specific detail.                                                 |
| ADR-10 | Israeli holidays                          | Not handled. Only Fri/Sat excluded from absence ranges. No holiday calendar.                                                                                                                                                     | PRD does not mention holidays.                                           |
| ADR-11 | Absence attachment status                 | Sick and military absences require attachments. Attachment can be added after absence creation (even in locked month). No explicit status field for "missing attachment."                                                        | Detail in feature spec.                                                  |
| ADR-12 | Month lock model                          | Two states only — Open and Locked. No employee-close step. Month is open until admin locks. Admin can reopen. Locked month is read-only with exceptions per §7.3.                                                                | User confirmed single state change.                                      |
| ADR-13 | Audit log scope and UI                    | Must log admin edits to reports + month lock/unlock. Should log time entry and absence CRUD. Admin-only visibility. UI: filterable table at `/admin/audit`.                                                                      | PRD requirement + best practice.                                         |
| ADR-14 | היסטוריית דיווחים (report history)        | Folded into Monthly View screen. Not a separate screen.                                                                                                                                                                          | Avoids inventing unspecified UI.                                         |
| ADR-15 | Soft-delete read path                     | Deactivated/deleted entities hidden from new-entry pickers. Historical entries still display the name of deleted entities. See §8.3.                                                                                             | Data integrity for historical records.                                   |
| ADR-16 | Auth gaps                                 | No forgot-password flow — admin resets manually. No force-change on first login. No lockout policy. Password minimum 8 chars, no additional complexity rules. "Remember me": unchecked = 1 day refresh token, checked = 30 days. | Scope limited to PRD requirements.                                       |
| ADR-17 | Attachments                               | JPG/PNG/PDF only. 5MB max. Vercel Blob private access, signed URLs 60 min expiry.                                                                                                                                                | Security best practice.                                                  |
| ADR-18 | Containers in production                  | No. docker-compose for local dev only. Production is Vercel (static + serverless).                                                                                                                                               | User confirmed.                                                          |
| ADR-19 | Timer running at month lock               | Admin gets warning listing employees with active timers. Locking proceeds. Timer is NOT auto-stopped.                                                                                                                            | Admin informed, employee handles stop.                                   |
| ADR-20 | Missing attachment at month lock          | Admin gets warning listing absences without attachments. Locking proceeds. Employee can still upload after lock.                                                                                                                 | Warn but don't block — prevents employees from blocking month closure.   |
| ADR-21 | Admin edit/delete employee absences       | Yes, admin can edit and delete employee absences (audit-logged).                                                                                                                                                                 | User confirmed.                                                          |
| ADR-22 | Audit log retention                       | Indefinite retention, no export in MVP.                                                                                                                                                                                          | Course project, no compliance constraints.                               |
| ADR-23 | Admin console viewport                    | Web app, minimum 1024px width.                                                                                                                                                                                                   | Covers standard laptops.                                                 |
| ADR-24 | Half-day absence: morning or afternoon    | Both options available. Employee chooses morning or afternoon.                                                                                                                                                                   | User confirmed.                                                          |
| ADR-25 | Branching strategy                        | `main` → `stage` → `dev` → `feat/<name>`. Stage branch added for pre-production testing.                                                                                                                                         | User confirmed.                                                          |

---

## 17. Open Questions

Most questions from the original list have been resolved (see §16 Decision Log). Remaining items:

| ID    | Question                                                                                                                                                                    | Resolve In            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| OQ-04 | Half-day absence details — is a half day always 4.5 hours? Does the remaining half require time entries? Can be morning or afternoon (confirmed), but exact hour split TBD. | Absences feature spec |
