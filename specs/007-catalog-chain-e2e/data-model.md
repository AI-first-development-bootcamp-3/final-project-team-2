# Data Model: Full Catalog Chain E2E

**Feature**: `007-catalog-chain-e2e` | **Date**: 2026-08-18

## Overview

This feature **does not change** the Prisma schema. It observes existing catalog rows created through the admin console and picker rows returned by `GET /api/v1/me/assignments`. Fixture identities below are test data only.

Sibling product models (authoritative for fields): Clients / Projects / Tasks / Assignments / User as delivered by KAN-50–53 and KAN-46. This file records only what the journey **creates and asserts**.

## Entities

### Demo admin (seed fixture)

Not created by the journey. Must exist before the spec runs (KAN-32 seed).

| Field | Value (overridable) |
| --- | --- |
| email | `admin@abra.co` (`E2E_ADMIN_EMAIL`) |
| password | `Admin123!` (`E2E_ADMIN_PASSWORD`) |
| role | `admin` |
| isActive | `true` |

If this row is missing, the check must fail fast (FR-012), not hang on admin sign-in.

### Dedicated employee (ephemeral fixture)

Produced on Users during the run (setup, not a KAN-54 catalog step). Not cleaned up.

| Field | Rule |
| --- | --- |
| email | `e2e.{timestamp}.{random}@abra.co` |
| fullName | Distinct display name including the unique suffix |
| password | `E2ePass12!` (typed on create; used only to load picker data) |
| role | employee (`רגיל`) |
| isActive | `true` |
| live assignments at picker check | **exactly one** — the assignment created in this run |

### Unassigned control (seed fixture)

| Field | Value |
| --- | --- |
| email | `employee1@abra.co` |
| password | `Employee123!` |
| role | employee |
| live assignments | seed tasks only (must **not** include this run’s unique task) |

### Catalog chain (ephemeral fixture)

Created through console screens this run. Identified by unique names, not by assuming an empty org.

| Entity | Console screen | Fields asserted after create |
| --- | --- | --- |
| Client | Clients `/admin/clients` | unique `name`; status **active** (`פעיל`); `deleted_at` null |
| Project | Projects `/admin/projects` | unique `name`; parent **that** client; status **active** |
| Task | Tasks `/admin/tasks` | unique `name`; parent **that** project; status **open** (`פתוחה`) |
| Assignment | Assignments `/admin/assignments` | dedicated employee + that task (row shows employee name/email and task name) |

Default create behavior (product, not re-specified here): new client/project active; new task open. The journey supplies valid names and an active parent so VAL-21–27 do not fire.

### Picker assignment (read model)

Not written by the journey. Observed via `GET /api/v1/me/assignments` after assign.

| Field | Dedicated employee | Unassigned control |
| --- | --- | --- |
| `clientName` | unique client name from this run | must not appear as this run’s task’s client on that task |
| `projectName` | unique project name from this run | — |
| `taskName` | unique task name from this run | **absent** |
| result length | **1** | seed assignments only (any length); none match unique `taskName` |

Schema (existing `@abra/contracts`): `MyAssignment` = `{ taskId, taskName, projectId, projectName, clientId, clientName }`. The journey asserts the three names (FR-006); ids need not be captured from the console.

## Validation rules (journey input)

| Rule | Behavior |
| --- | --- |
| Unique client name | Generated per run so VAL-21 uniqueness does not fail a healthy product |
| Unique project / task names | Generated per run so picker and catalog row search are unambiguous |
| Unique employee email | Generated per run so VAL-02 / VAL-11 do not fail reruns |
| Active parent | Client then project then task, in order, so VAL-23 / VAL-25 / VAL-26 do not fire |
| Duplicate assignment | Dedicated employee is assigned this task once |
| Admin credentials | Seed defaults unless env overrides are set |
| Employee password | ≥ 8 characters; never asserted in Users rows |

Create/assign validation failure cases (missing name, inactive parent, duplicate assignment) remain owned by KAN-50–53.

## State transitions (observed)

```text
(no dedicated employee)
  --Users create (setup)-->  active employee, zero live assignments

(no client)
  --Clients create-->  active client (unique name)

active client
  --Projects create-->  active project under that client

active project
  --Tasks create-->  open task under that project

open task + dedicated employee
  --Assignments create-->  live assignment
  --GET /me/assignments (dedicated)-->  exactly [{ clientName, projectName, taskName }]
  --GET /me/assignments (employee1)-->  no item with that taskName
```

Soft-delete, close, unassign, and historical name rendering are **not** exercised (FR-013).

## Relationships

```text
Demo admin
  └── creates Dedicated employee (Users)
  └── creates Client
        └── Project
              └── Task
                    └── Assignment ── Dedicated employee

Picker (dedicated)  = that Client + Project + Task
Picker (employee1)  ≠ that Task
```

## Uniqueness (test data, not product rules)

| Generated value | Why |
| --- | --- |
| Client name | VAL-21 among non-deleted clients |
| Employee email | unique among non-deleted users |
| Project name | product allows duplicates; unique in the run for search + picker |
| Task name | same |
