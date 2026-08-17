# Data Model: Admin Create User

**Feature**: `003-admin-create-user` | **Date**: 2026-08-17

## Overview

This feature **creates** `User` rows. No Prisma schema changes. The created person is immediately active, not soft-deleted, and can authenticate with the initial password once hashed. Public read shape is the same `UserListItem` as the directory.

## Entities

### User (existing — Prisma `User` / table `users`)

| Field (DB) | Type | Create input | Response exposure | Notes |
| ---------- | ---- | ------------ | ----------------- | ----- |
| `id` | UUID | generated | Yes (`id`) | |
| `email` | VARCHAR(255) | required | Yes (`email`) | Trim, then lowercase before store; unique among non-deleted |
| `full_name` | VARCHAR(255) | required | Yes (`fullName`) | Trim; whitespace-only is missing (VAL-10) |
| `password_hash` | VARCHAR(255) | from `password` | **Never** | bcrypt, 10 rounds; source password is not trimmed |
| `role` | `employee` \| `admin` | required | Yes (`role`) | VAL-12 |
| `is_active` | Boolean | default `true` | Yes (`isActive`) | Must be active on create |
| `token_version` | Int | default `0` | **Never** | Unchanged so first sign-in can issue tokens |
| `created_at` | DateTime | default now | No | |
| `updated_at` | DateTime | default now | No | |
| `deleted_at` | DateTime? | `null` | No | Must remain null (not deactivated/removed) |

**Relationships**: unused by create.

### Create-person form (not stored)

Transient UI state on Users:

| Field | UI label | Maps to |
| ----- | -------- | ------- |
| Full name | שם מלא | `fullName` |
| Email | אימייל | `email` |
| Initial password | סיסמה ראשונית | `password` (write-only) |
| Role | תפקיד | `role` — options רגיל (`employee`), אדמין (`admin`); default **employee** |

## Validation rules (create body)

| Rule | Field | Behavior |
| ---- | ----- | -------- |
| VAL-10 | `fullName` | Required; trim; empty after trim → 400 |
| VAL-02 | `email` | Required after trim; valid email format → else 400. Then store lowercase |
| VAL-11 | `email` | Unique among non-deleted people, case-insensitive → else **409** (not 400) |
| VAL-12 | `role` | Must be `employee` or `admin` → else 400 |
| VAL-13 | `password` | Required (empty / missing) → 400. **Do not trim** |
| VAL-04 | `password` | Length ≥ 8 (exactly 8 succeeds; 7 fails) → 400 |

Email that is only spaces: missing/invalid (VAL-02 or empty-after-trim treated as invalid/required email), not a unique address.

An email used only by a row with `deleted_at` set is **allowed**.

## Uniqueness and indexes

- Existing partial unique index: `users_email_unique` on `users (email) WHERE deleted_at IS NULL` (case-sensitive at the DB).
- Application always writes lowercase email so live duplicates with different capitalization cannot be inserted.
- Pre-insert lookup: case-insensitive match on `email` among non-deleted rows (soft-delete middleware already excludes `deleted_at IS NOT NULL`).
- Concurrent insert: Prisma `P2002` on `email` → 409 + VAL-11.

## State on create

```text
new User:
  is_active = true
  deleted_at = null
  token_version = 0
  password_hash = bcrypt(password, 10)
  email = lower(trim(input.email))
  full_name = trim(input.fullName)
  role = employee | admin
```

No transition to “must change password”. Deactivate/restore is KAN-48. Edit / reset password is KAN-47.

## Sign-in matching (owned by login, required by this feature)

| Stored | Typed at sign-in | Result |
| ------ | ---------------- | ------ |
| `nadav@org.com` | `Nadav@Org.com` | Match after login normalizes email (trim + lowercase) |
| bcrypt hash | exact initial password, including any leading/trailing spaces | Match via bcrypt.compare |

Employee vs admin product routing stays KAN-39 (employees do not use the admin console; admins do not use the employee app).
