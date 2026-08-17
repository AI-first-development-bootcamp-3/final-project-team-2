# Quickstart: Admin Create User

**Feature**: `003-admin-create-user` | **Date**: 2026-08-17

Validate that the shared create contract, `POST /api/v1/users`, and the Users create form work together in one delivery. Details: [data-model.md](./data-model.md), [contracts/users-create.md](./contracts/users-create.md). Directory list behavior is [002-admin-users-table](../002-admin-users-table/quickstart.md).

## Prerequisites

- Node ≥ 22, pnpm 9
- PostgreSQL available (docker compose or Neon) with migrations + seed applied
- **KAN-39 auth** available: admin can sign in; API enforces Jwt + admin role; login looks up the normalized (lowercase) email
- **KAN-45 directory** available: `/admin/users` lists people
- Seed users from KAN-32 present (e.g. `admin@abra.co`, `employee1@abra.co`)

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
pnpm --filter @abra/contracts test          # CreateUserBody VAL ids, email lowercase, password not trimmed, no secrets in success schema
pnpm --filter @abra/api test                # POST /users 201/400/409/401/403; hash absent; soft-deleted email reuse
pnpm --filter @abra/admin test              # create modal: fields, saving, Hebrew errors, stay-on-page refresh
pnpm test:coverage                          # monorepo gate ≥ 70%
```

## Manual validation scenarios

### 1. Create employee and admin (P1)

1. Sign in as admin → open Users (`/admin/users`) on page 1 with no filters that would hide new people.
2. Open create. Expect required fields: full name, email, initial password, role (רגיל / אדמין). Default role is רגיל.
3. Create an employee with a unique email → form closes; stay on the same page; row appears active as משתמש רגיל; password is not shown.
4. Create an admin with a unique email → same page refresh; appears as אדמין, active.

### 2. Validation and duplicate email (P1)

1. Submit empty name / empty password / 7-character password / malformed email → Hebrew field errors; no new person.
2. Password of exactly 8 characters (rest valid) → success.
3. Submit an email already used by a live person (different capitalization) → form stays open; Hebrew uniqueness error that names VAL-11; no second person.
4. If a soft-deleted person used an email, creating a new person with that email succeeds.

### 3. Mixed-case email (clarification)

1. Create with `Nadav@Org.com`.
2. Directory (if the row is on the current page) shows `nadav@org.com`.
3. Sign in as that person with `Nadav@Org.com` and the initial password on the matching product (employee app vs admin console) on the first try. No forced password change.

### 4. Stay on current page (clarification)

1. On page 2 (or with filters that would hide the new person), create someone who would sort onto another page or fail the filter.
2. Form closes; URL/query page and filters unchanged; that page refreshes; the new person is absent until filters/page change — not an error.

### 5. Loading, session, unavailable (P1)

1. During a slow submit: saving state; cannot double-submit.
2. Expire the admin session with the form open and submit → sent to admin sign-in (not a silent/generic-only failure).
3. Simulate service unavailable (API down or 5xx): form stays open with a Hebrew error; typed values remain; retry works; not treated as sign-in expiry.
4. Employee token against `POST /api/v1/users` → 403. Unsigned-in → 401.

### 6. Edge API checks

```bash
# 201 — email stored lowercase; body has no password material
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Nadav Cohen","email":"Nadav@Org.com","password":"secret123","role":"employee"}' \
  http://localhost:3000/api/v1/users

# 409 — duplicate live email (case-insensitive)
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Other","email":"admin@abra.co","password":"secret123","role":"employee"}' \
  http://localhost:3000/api/v1/users

# 400 — short password (VAL-04)
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":"unique-create@abra.co","password":"1234567","role":"employee"}' \
  http://localhost:3000/api/v1/users
```

Confirm responses never include password hashes or token versions ([contracts/users-create.md](./contracts/users-create.md)).

## Done when

- [ ] Contract, API, and admin tests above pass in one branch/PR
- [ ] Manual scenarios 1–5 succeed against seeded data
- [ ] Created people can sign in immediately with the initial password on the matching product (KAN-39 login)
- [ ] No edit, reset-password, or deactivate UI shipped (out of scope)
