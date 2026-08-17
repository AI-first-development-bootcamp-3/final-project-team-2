# Data Model: Create User Then Login E2E

**Feature**: `005-create-user-login-e2e` | **Date**: 2026-08-17

## Overview

This feature **does not change** the Prisma schema. It observes existing `User` rows created and deactivated through the admin console. Fixture identities below are test data only.

## Entities

### User (existing — Prisma `User` / table `users`)

Observed through the UIs only. Schema details: [002-admin-users-table/data-model.md](../002-admin-users-table/data-model.md).

| Field (public) | Create-then-login | Deactivated-cannot-sign-in |
| -------------- | ----------------- | -------------------------- |
| `fullName`     | Set on create     | Set on create              |
| `email`        | Unique per run    | Unique per run             |
| `role`         | `employee`        | `employee`                 |
| `isActive`     | `true` after create | `false` after deactivate |
| `password`     | Initial secret typed on create and on employee login; **never** shown in Users |

`password_hash`, `token_version`, and `deleted_at` are never asserted in the directory.

### Demo admin (seed fixture)

Not created by the journeys. Must exist before either spec runs.

| Field     | Value (KAN-32 seed; overridable) |
| --------- | -------------------------------- |
| email     | `admin@abra.co`                  |
| password  | `Admin123!`                      |
| role      | `admin`                          |
| isActive  | `true`                           |

If this row is missing, the check must fail fast (FR-012), not hang on admin sign-in.

### Created employee (ephemeral fixture)

Produced by the create form during a run. Not cleaned up (demo DB is CI-ephemeral; local reruns rely on unique emails).

| Field            | Rule                                      |
| ---------------- | ----------------------------------------- |
| email            | `e2e.{timestamp}.{random}@abra.co`        |
| fullName         | Distinct display name including the unique suffix |
| password         | Valid initial password (≥ 8 characters)   |
| role             | employee (`רגיל`)                         |
| isActive         | true until US2 deactivates its own person |

US1 and US2 each create **their own** employee.

## Validation rules (journey input)

| Rule | Behavior |
| ---- | -------- |
| Unique email | Generated per run; valid email format so create is not rejected as VAL-02 / VAL-11 |
| Initial password | ≥ 8 characters; not trimmed by the product (KAN-46) |
| Role | Always employee for these journeys |
| Admin credentials | Seed defaults unless `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are set |

## State transitions (observed)

```text
(no row)
  --admin create (US1 / US2)-->  active employee (is_active=true, deleted_at=null)
  --employee sign-in (US1)---->  authenticated employee app

active employee
  --admin deactivate (US2)---->  deactivated (is_active=false, deleted_at=set)
  --employee sign-in (US2)---->  refused (stay on /login, Hebrew error)
```

Restore is **not** exercised.

## Relationships

- Demo admin creates and deactivates Created employees via Users.
- Created employee authenticates only on the employee app, not the admin console.
