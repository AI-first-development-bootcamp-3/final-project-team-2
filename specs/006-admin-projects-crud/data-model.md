# Data Model: Admin Projects CRUD

**Feature**: `006-admin-projects-crud` | **Date**: 2026-08-18

## Overview

This feature **lists, creates, updates, and soft-removes** `Project` rows. No Prisma schema changes. Public read shape is `ProjectListItem` (identity, name, parent client identity and name, active flag, removed flag). Parent `Client` is consumed from KAN-50; child `Task` rows are not mutated.

## Entities

### Project (existing — Prisma `Project` / table `projects`)

| Field (DB)   | Type      | List/write exposure | Notes                                                     |
| ------------ | --------- | ------------------- | --------------------------------------------------------- |
| `id`         | UUID      | Yes (`id`)          | Row key                                                   |
| `client_id`  | UUID FK   | Yes (`clientId`)    | → `clients.id`; VAL-23 on create and on client **change** |
| `name`       | VARCHAR   | Yes (`name`)        | Trim; whitespace-only is missing (VAL-22); **not unique** |
| `is_active`  | Boolean   | Yes (`isActive`)    | Default `true` on create                                  |
| `created_at` | DateTime  | No                  |                                                           |
| `updated_at` | DateTime  | No                  |                                                           |
| `deleted_at` | DateTime? | Derived `isDeleted` | Soft-remove marker; not a raw timestamp in the DTO        |

**Relationships**: `client` (required parent); `tasks` (must remain unchanged on deactivate/remove).

Joined on every public read: `clientName` from `Client.name` (even if that client is later inactive). Soft-deleted parent clients are not expected on live projects; if a join is needed for include-removed history, bypass middleware on the related Client the same way as Project.

### Client (existing — consumed, not owned)

| Use                                  | Rule                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| Create picker / client-change picker | Active and not removed only                                         |
| Catalog filter                       | Non-removed clients (active and inactive allowed)                   |
| VAL-23                               | Target of a **new** assignment must be active and `deleted_at` null |
| Keep-current                         | Existing `client_id` may stay even if that client is later inactive |

### Task (existing — not mutated)

Deactivating or removing a project MUST NOT set `Task.status = closed` or `Task.deleted_at`. Assignments under those tasks are unchanged.

### Historical time report (read model, not stored as a name snapshot)

`TimeEntry.task_id` → `Task.project_id` → `Project.name`. After deactivate/remove, that name is still on the Project row. Reads that render history must include related Project rows even when `deleted_at` is set.

### Projects catalog page (not stored)

| Field        | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `data[]`     | Matching `ProjectListItem` rows for the page                         |
| `meta.page`  | Requested page (≥ 1)                                                 |
| `meta.limit` | Page size (UI always 20; API max 100)                                |
| `meta.total` | Total matches under current filters (including when `data` is empty) |

### Create/edit form (transient UI)

| Field        | UI label       | Maps to                                                                       |
| ------------ | -------------- | ----------------------------------------------------------------------------- |
| Project name | שם הפרויקט     | `name`                                                                        |
| Client       | שם הלקוח       | `clientId` (picker shows active clients; edit also keeps current if inactive) |
| Active       | פעיל / לא פעיל | `isActive` (edit only; create always active)                                  |

Remove is a confirmation, not a form field.

## Validation rules

| Rule   | Field      | When                                                                                       | HTTP         |
| ------ | ---------- | ------------------------------------------------------------------------------------------ | ------------ |
| VAL-22 | `name`     | Required; trim; empty after trim                                                           | 400          |
| VAL-23 | `clientId` | Required UUID on create; malformed/missing                                                 | 400          |
| VAL-23 | `clientId` | Create, or update that **changes** client: must be an active, non-removed, existing client | 422          |
| —      | `name`     | Uniqueness                                                                                 | Not enforced |

Whitespace-only name is VAL-22, not a valid name.

## List query rules

| Param            | Behavior                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `page`           | Integer ≥ 1; default 1; invalid → 400                                                       |
| `limit`          | Integer 1–100; default 20; UI always 20; out of range → 400                                 |
| `q`              | Optional; trim; empty after trim → no text filter; case-insensitive partial match on `name` |
| `clientId`       | Optional UUID; exact `client_id`                                                            |
| `isActive`       | Optional boolean on `is_active`                                                             |
| `includeDeleted` | Optional boolean; default false; when true, include `deleted_at IS NOT NULL`                |
| `sort`           | `name` \| `clientName` \| `isActive`; default `name`                                        |
| `order`          | `asc` \| `desc`; default `asc`                                                              |

```text
base = projects matching q / clientId / isActive
IF includeDeleted = false:
  AND deleted_at IS NULL
ELSE:
  include rows regardless of deleted_at
  (middleware bypass via explicit deleted_at predicate)
```

- Default list: inactive-but-not-removed projects **remain**; removed are hidden.
- Removed rows, when included, have `isDeleted=true` (distinct from `isActive=false`).

## State transitions

```text
create:
  is_active = true
  deleted_at = null

active (is_active=true, deleted_at=null)
  --PATCH isActive=false--> inactive (still listed by default; hidden from pickers)
  --DELETE--> removed (deleted_at set; hidden from default list and pickers)
  --PATCH name / clientId--> still active (VAL-23 only if clientId changed)

inactive (is_active=false, deleted_at=null)
  --PATCH isActive=true--> active
  --DELETE--> removed
  tasks unchanged in all cases

removed (deleted_at set)
  -- not physically destroyed
  -- tasks unchanged
  -- TimeEntry joins still resolve Project.name when the read includes deleted relations
```

Entity CRUD is **not** audit-logged in MVP (GENERAL_SPEC §8.4).

## Indexes / query notes

- Filter on `deleted_at`, `client_id`, `is_active`; search `name` (insensitive contains).
- Sort `clientName` via `orderBy: { client: { name } }`.
- Offset pagination: `skip = (page - 1) * limit`, `take = limit`; past-last page → empty `data`, unchanged real `total`.
- No unique index on project name.
