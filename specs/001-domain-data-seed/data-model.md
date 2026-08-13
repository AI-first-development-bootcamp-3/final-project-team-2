# Data Model: Domain Data Model and Demo Seed

**Feature**: `001-domain-data-seed` | **Date**: 2026-08-13  
**Authority**: `docs/GENERAL_SPEC.md` §2, §4, §8 + `specs/001-domain-data-seed/spec.md`

All IDs are UUID. Timestamps stored in UTC. Soft-delete column name: `deleted_at` (nullable).

## Enums (shared via `packages/contracts`)

| Enum | Values |
|------|--------|
| UserRole | `employee`, `admin` |
| WorkLocation | `office`, `client_site`, `home` |
| AbsenceType | `vacation`, `sick`, `military`, `other` |
| HalfDayPeriod | `morning`, `afternoon` |
| TaskStatus | `open`, `closed` |
| AuditAction | `create`, `update`, `delete`, `lock_month`, `unlock_month` |

EntityStatus (`active`/`inactive`) is represented as `is_active` boolean on User, Client, Project (not a separate table).

## Entities

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| email | string(255) | unique among non-deleted |
| full_name | string(255) | required |
| password_hash | string(255) | bcrypt |
| role | UserRole | |
| is_active | boolean | default true |
| token_version | int | default 0 |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

**Validation**: email unique where `deleted_at IS NULL`; password min 8 chars before hash (seed uses known demo passwords).

### Client

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| name | string(255) | required |
| contact_info | text? | |
| is_active | boolean | default true |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

### Project

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| client_id | UUID FK → Client | required |
| name | string(255) | required |
| is_active | boolean | default true |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

### Task

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| project_id | UUID FK → Project | required |
| name | string(255) | required |
| description | text? | |
| status | TaskStatus | default `open` |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

### TaskAssignment

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → User | required |
| task_id | UUID FK → Task | required |
| created_at | timestamp | |

**Constraints**: `unique(user_id, task_id)`. **No** `deleted_at`.

### TimeEntry

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → User | required |
| task_id | UUID FK → Task | nullable (running timer only) |
| date | date | = date of `start_at` |
| start_at | timestamp | required |
| end_at | timestamp? | null = running timer |
| location | WorkLocation? | nullable for running timer |
| description | text? | |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

**Seed rules**: only completed entries (`end_at` set, `task_id` + `location` set); user must be assigned to task; no overlaps.

### Absence

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → User | required |
| type | AbsenceType | |
| start_date / end_date | date | `end_date >= start_date` |
| is_half_day | boolean | default false |
| half_day_period | HalfDayPeriod? | required if half-day |
| notes | text? | |
| created_at / updated_at | timestamp | |
| deleted_at | timestamp? | soft-delete |

**Validation**: Fri/Sat excluded from ranges. Seed: vacation sample for partial employee (no attachment required).

### AbsenceAttachment

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| absence_id | UUID FK → Absence | required |
| file_name | string(255) | |
| file_type | string(50) | jpg, png, or pdf |
| file_size | int | max 5MB |
| blob_key | string(500) | storage key |
| created_at | timestamp | |

**Seed**: no rows. Schema required for blueprint completeness.

### MonthLock

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| year | int | |
| month | int | 1–12 |
| locked_by | UUID FK → User | admin |
| locked_at | timestamp | |
| is_locked | boolean | default true |
| unlocked_by | UUID FK → User? | |
| unlocked_at | timestamp? | |

**Constraints**: `unique(year, month)`. **No** soft-delete. Seed: locked past month only; demo week month has no locked row.

### AuditLog

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| actor_id | UUID FK → User | |
| action | AuditAction | |
| entity_type | string(50) | |
| entity_id | UUID | |
| before / after | JSONB? | |
| created_at | timestamp | |

**Rules**: append-only in product. Seed: no rows. Local demo wipe may remove demo-linked rows as seed-reset exception only.

## Relationships

```text
User ──< TaskAssignment >── Task
User ──< TimeEntry >── Task
User ──< Absence ──< AbsenceAttachment
User ──< MonthLock (locked_by / unlocked_by)
User ──< AuditLog (actor_id)
Client ──< Project ──< Task
```

## Seed graph (minimum)

| Artifact | Rule |
|----------|------|
| Users | 1 admin + 2 employees; known emails + bcrypt passwords; `is_active=true`, `deleted_at=null` |
| Clients | ≥2 |
| Projects | ≥3, each with a Client |
| Tasks | ≥1 per project (open) |
| TaskAssignments | employees linked to tasks in each of the 3 projects |
| TimeEntries | Employee A: Sun–Thu × 9h completed; Employee B: partial same week |
| Absence | ≥1 on Employee B |
| MonthLock | 1 locked past month; demo week month open |
| AuditLog / AbsenceAttachment | none |

## State notes

| Entity | States |
|--------|--------|
| User / Client / Project | active ↔ inactive (`is_active`); soft-deleted via `deleted_at` |
| Task | `open` ↔ `closed`; soft-delete sets closed + `deleted_at` (product rule; seed uses open) |
| MonthLock | open (no locked row / `is_locked=false`) ↔ locked |
| AuditLog | immutable after insert |
