# Contract: User Lifecycle E2E (KAN-49)

**Feature**: `005-create-user-login-e2e` | **Date**: 2026-08-17  
**Kind**: Required automated journeys (Playwright in `@abra/e2e`)  
**Not**: a new HTTP/Zod contract in `@abra/contracts`

Product APIs used (already specified elsewhere):

- Admin sign-in / logout — KAN-39 (`POST /api/v1/auth/login`, admin session)
- `POST /api/v1/users` — [003-admin-create-user/contracts/users-create.md](../../003-admin-create-user/contracts/users-create.md)
- `GET /api/v1/users` — [002-admin-users-table/contracts/users-list.md](../../002-admin-users-table/contracts/users-list.md)
- `DELETE /api/v1/users/:id` — KAN-48 (deactivate)
- Employee sign-in — KAN-39 (`POST /api/v1/auth/login` from the employee app)

This file is the **journey contract**: origins, order, assertions, and independence. Implementation must not replace UI steps with hidden API calls.

## Origins

| Product       | Default origin                 | Spec `goto`                                         |
| ------------- | ------------------------------ | --------------------------------------------------- |
| Employee app  | `http://localhost:5173`        | Playwright `baseURL` (existing smokes)              |
| Admin console | `http://localhost:5174`        | Absolute `ADMIN_BASE_URL`                           |
| API           | `http://localhost:3000/api/v1` | Used by apps, not by the journey as a substitute UI |

Ports follow `MOBILE_PORT` / `ADMIN_PORT` / `API_PORT` when set.

## Journey 1 — Create then login

**File**: `e2e/specs/create-then-login.spec.ts`  
**Timeout**: 180s

| #   | Actor    | Action                                                                                   | Expected                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Admin    | Open admin sign-in, submit seed credentials                                              | Users directory (`/admin/users`, heading `משתמשים`)                            |
| 2   | Admin    | Open `יצירת משתמש`, fill unique employee + password ≥ 8, role `רגיל`, `שמירה`            | Dialog closes; person is an active employee; password **not** shown in the row |
| 3   | Admin    | Sign out                                                                                 | `/admin/login`; Users not visible                                              |
| 4   | Employee | Open employee app login (`ברוכים הבאים!`), submit same email + initial password, `התחבר` | Leaves `/login`; heading `עמוד ראשי - דיווח יומי`; no password-change screen   |

Failure: still on `/login` after a valid new account, or password visible in Users.

## Journey 2 — Deactivated cannot sign in

**File**: `e2e/specs/deactivated-cannot-login.spec.ts`  
**Timeout**: 180s  
**Independence**: creates its own employee; must not require Journey 1 to have passed.

| #   | Actor    | Action                                                       | Expected                                                                 |
| --- | -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Admin    | Sign in → Users                                              | Directory visible                                                        |
| 2   | Admin    | Create a unique employee (same create contract as Journey 1) | Active employee row                                                      |
| 3   | Admin    | `השבת` on that row → confirm `השבת משתמש`                    | Success `המשתמש הושבת בהצלחה` (or row no longer in default list)         |
| 4   | Employee | Sign in with that email + password                           | Stay on `/login`; Hebrew error visible; authenticated heading **absent** |

## Required check

| Check        | Command                        | Must include                                                |
| ------------ | ------------------------------ | ----------------------------------------------------------- |
| CI `e2e` job | `pnpm --filter @abra/e2e test` | Journeys 1–2 **and** existing `app-shell` + `health` smokes |
| Local        | `pnpm test:e2e`                | Same                                                        |

A failed journey fails the job (non-zero exit). Specs must not use `test.fixme` / `test.skip` for these two files in CI.

## Credentials

| Name                      | Default                                     | Override             |
| ------------------------- | ------------------------------------------- | -------------------- |
| Admin email               | `admin@abra.co`                             | `E2E_ADMIN_EMAIL`    |
| Admin password            | `Admin123!`                                 | `E2E_ADMIN_PASSWORD` |
| Created employee email    | `e2e.{timestamp}.{random}@abra.co`          | generated            |
| Created employee password | valid ≥ 8 char secret used only in the spec | n/a                  |

## Out of scope

- Create-admin-then-console-login
- Edit, reset password, restore
- Instant logout of an already-open employee session (KAN-48)
- New fields on User or new `@abra/contracts` schemas
