# Data Model: Admin Users Table

**Feature**: `002-admin-users-table` | **Date**: 2026-08-17

## Overview

This feature **reads** existing `User` rows. No Prisma schema changes. Directory presentation adds a derived **status** label (`active` / `inactive`) from `is_active` (and removed users always display as inactive when included).

## Entities

### User (existing — Prisma `User` / table `users`)

| Field (DB)      | Type                  | List exposure     | Notes                                            |
| --------------- | --------------------- | ----------------- | ------------------------------------------------ |
| `id`            | UUID                  | Yes (`id`)        | Row key                                          |
| `email`         | VARCHAR(255)          | Yes (`email`)     | Partial unique among non-deleted                 |
| `full_name`     | VARCHAR(255)          | Yes (`fullName`)  | Default sort                                     |
| `password_hash` | VARCHAR(255)          | **Never**         | FR-011                                           |
| `role`          | `employee` \| `admin` | Yes (`role`)      | `UserRole` enum                                  |
| `is_active`     | Boolean               | Yes (`isActive`)  | Table “status”                                   |
| `token_version` | Int                   | **Never**         | Session revocation internal                      |
| `created_at`    | DateTime              | No (this feature) | Available later if needed                        |
| `updated_at`    | DateTime              | No                |                                                  |
| `deleted_at`    | DateTime?             | No (control only) | Soft-delete marker; gated by include-deactivated |

**Relationships**: Task assignments, time entries, etc. are unused by the directory list.

### User directory page (read model)

Not stored. Composed per request:

| Field        | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `data[]`     | Matching `UserListItem` rows for the page                            |
| `meta.page`  | Requested page (≥ 1)                                                 |
| `meta.limit` | Page size (UI always 20; API max 100)                                |
| `meta.total` | Total matches under current filters (including when `data` is empty) |

## Validation rules (list query)

| Rule             | Behavior                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `page`           | Integer ≥ 1; default 1; invalid → 400                                                                                  |
| `limit`          | Integer 1–100; default 20; UI always 20; out of range → 400                                                            |
| `q`              | Optional string; trim; empty after trim → no text filter; case-insensitive partial match on `full_name` **or** `email` |
| `role`           | Optional `employee` \| `admin`                                                                                         |
| `isActive`       | Optional boolean (`true` / `false`)                                                                                    |
| `includeDeleted` | Optional boolean; default `false`; when `true`, include rows with `deleted_at` set                                     |
| `sort`           | Optional enum: `fullName` \| `email` \| `role` \| `isActive`; default `fullName`                                       |
| `order`          | Optional `asc` \| `desc`; default `asc`                                                                                |

## Filter semantics

```text
base = users matching q / role / isActive
IF includeDeleted = false:
  AND deleted_at IS NULL
ELSE:
  include rows regardless of deleted_at
  (middleware bypass via explicit deleted_at predicate)
```

- Default list: shows inactive-but-not-removed users; hides soft-deleted.
- Soft-deleted users, when included, appear with status **inactive**.
- `includeDeleted=true` + `isActive=true` → soft-deleted users still excluded if `is_active` is false (typical after deactivate).

## State transitions

This feature does **not** change user state. Lifecycle for reference (owned by later stories):

```text
active (is_active=true, deleted_at=null)
  → deactivate/remove (KAN-48): is_active=false, deleted_at=set, token_version++
inactive non-removed (is_active=false, deleted_at=null)
  → still listed by default unless filtered out
```

## Indexes / query notes

- Prefer filtering on `deleted_at`, `role`, `is_active` and searching `email` / `full_name`.
- Existing partial unique index on `email` where `deleted_at IS NULL` (migrations) remains untouched.
- Offset pagination: `skip = (page - 1) * limit`, `take = limit`; past-last page → empty `data`, unchanged real `total`.
