# Quickstart: Admin Users Table

**Feature**: `002-admin-users-table` | **Date**: 2026-08-17

Validate that the shared list contract, `GET /api/v1/users`, and `/admin/users` work together in one delivery. Details: [data-model.md](./data-model.md), [contracts/users-list.md](./contracts/users-list.md).

## Prerequisites

- Node ≥ 22, pnpm 9
- PostgreSQL available (docker compose or Neon) with migrations + seed applied
- **KAN-39 auth** available: admin can sign in; API enforces Jwt + admin role
- Seed users from KAN-32 present (e.g. `admin@abra.co`, employees)

## Setup

```bash
pnpm install
# start DB per repo docs, then:
pnpm --filter @abra/api exec prisma migrate deploy
pnpm --filter @abra/api exec prisma db seed
pnpm dev   # or start API + admin apps per turbo scripts
```

Package names may match workspace filters in root `package.json` / `pnpm-workspace.yaml` — adjust filter names if local packages differ (`server/api`, `apps/admin`).

## Automated checks

```bash
pnpm --filter @abra/contracts test          # Zod list query / item / envelope
pnpm --filter @abra/api test                # users list integration (auth, filters, pagination)
pnpm --filter @abra/admin test              # Users screen loading / empty / error / columns
pnpm test:coverage                          # monorepo gate ≥ 70%
```

## Manual validation scenarios

### 1. Browse directory (P1)

1. Sign in as admin → open Users (`/admin/users`).
2. Expect table columns: full name, email, role, status; ≤ 20 rows; Hebrew RTL.
3. Soft-deleted users hidden by default.
4. No page-size control; next page works when total > 20.

### 2. Search and filter (P1)

1. Search unique email fragment → only that person.
2. Filter role = admin → only admins.
3. Filter inactive → only inactive.
4. Combine search + filters → AND semantics; page resets to 1 on change.
5. Search spaces-only → same as empty search (not empty state).

### 3. Include deactivated (P2)

1. With a soft-deleted user in DB, confirm hidden by default.
2. Enable include-deactivated → row appears as inactive.
3. Include-deactivated + status active → soft-deleted inactive users still absent.

### 4. Sort (clarification)

1. Default order: full name A–Z.
2. Click email (or other column) → reorder; page resets to 1.

### 5. Auth and session (P1)

1. Call list without token → 401.
2. Sign in as employee → 403 / denied UI.
3. Expire admin session on open Users → redirect to admin sign-in (not a silent blank table).

### 6. Edge API checks

```bash
# Past-last page: 200, data [], real total
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3000/api/v1/users?page=99&limit=20'

# Oversize limit: 400
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:3000/api/v1/users?limit=101'
```

Confirm response bodies never include password hashes or token versions ([contracts/users-list.md](./contracts/users-list.md)).

## Done when

- [ ] Contract, API, and admin tests above pass in one branch/PR
- [ ] Manual scenarios 1–5 succeed against seeded data
- [ ] No create/edit/deactivate UI shipped (out of scope)
