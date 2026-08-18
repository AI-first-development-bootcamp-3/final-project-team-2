# Contract: Catalog Chain E2E (KAN-54)

**Feature**: `007-catalog-chain-e2e` | **Date**: 2026-08-18  
**Kind**: Required automated journey (Playwright in `@abra/e2e`)  
**Not**: a new HTTP/Zod contract in `@abra/contracts`

Product APIs used (already specified elsewhere; **not** a substitute for console UI on the four catalog steps):

- Admin sign-in — KAN-39 / KAN-70 (`POST /api/v1/auth/login` from the admin console)
- `POST /api/v1/users` — Users create (setup only; driven via Users UI helper)
- Clients / Projects / Tasks / Assignments CRUD — KAN-50–53 (driven via console)
- `POST /api/v1/auth/login` + `GET /api/v1/me/assignments` — picker-data proof (employee JWT)

This file is the **journey contract**: origins, order, assertions, and independence. Implementation must not replace the four catalog steps with hidden API creates.

## Origins

| Product       | Default origin                 | Spec `goto`                                                                                               |
| ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Employee app  | `http://localhost:5173`        | Playwright `baseURL` (existing smokes only)                                                               |
| Admin console | `http://localhost:5174`        | Absolute `ADMIN_BASE_URL`                                                                                 |
| API           | `http://localhost:3000/api/v1` | Picker GET + employee login for picker; **not** a substitute UI for client/project/task/assignment create |

Ports follow `MOBILE_PORT` / `ADMIN_PORT` / `API_PORT` when set.

Admin routes on the admin origin:

| Screen        | Path                          |
| ------------- | ----------------------------- |
| Sign-in       | `/login` (not `/admin/login`) |
| Users (setup) | `/admin/users`                |
| Clients       | `/admin/clients`              |
| Projects      | `/admin/projects`             |
| Tasks         | `/admin/tasks`                |
| Assignments   | `/admin/assignments`          |

## Journey — Full catalog chain

**File**: `e2e/specs/entity-chain.spec.ts` (rewrite; remove `describe.skip`)  
**Timeout**: 240s  
**Independence**: does not require KAN-49 lifecycle specs to have passed; creates its own dedicated employee.

| #   | Actor                            | Action                                                                                | Expected                                                                                        |
| --- | -------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Admin                            | Open admin sign-in, submit seed credentials                                           | Authenticated console (Users heading `משתמשים`; not `/login`)                                   |
| 2   | Admin                            | Users: create dedicated employee (unique email, role `רגיל`)                          | Active employee row; password **not** shown. **Setup** — not one of the four catalog steps      |
| 3   | Admin                            | Sidebar `לקוחות` → `לקוח חדש` → unique name → `שמירה`                                 | Dialog closes; success; search finds the client as `פעיל`                                       |
| 4   | Admin                            | Sidebar `פרויקטים` → `פרויקט חדש` → unique name + parent = that client → `צור פרויקט` | Dialog closes; success; search finds the project under that client as `פעיל`                    |
| 5   | Admin                            | Sidebar `משימות` → `משימה חדשה` → unique name + parent = that project → `שמירה`       | Dialog closes; success; search finds the task under that project as `פתוחה`                     |
| 6   | Admin                            | Sidebar `שיוכים` → `שיוך חדש` → dedicated employee + that task → `שמירה`              | Dialog closes; success; search finds the assignment for that employee and task                  |
| 7   | Dedicated employee               | `POST /auth/login` then `GET /me/assignments`                                         | HTTP 200; `data.length === 1`; `clientName` / `projectName` / `taskName` match the unique names |
| 8   | Unassigned (`employee1@abra.co`) | `POST /auth/login` then `GET /me/assignments`                                         | HTTP 200; **no** item has this run’s `taskName`                                                 |

Failure modes that **must** fail the check:

- Still on admin `/login` after seed credentials (missing seed / missing sign-in).
- Any of steps 3–6 performed only via `request.post` to catalog APIs.
- Catalog row missing or wrong parent/status after create.
- Dedicated employee login for picker fails (setup failure message).
- Picker for dedicated employee empty, has extra live assignments, or names mismatch.
- Picker for `employee1@abra.co` includes the unique task.

## Required check

| Check        | Command                        | Must include                                                                                       |
| ------------ | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| CI `e2e` job | `pnpm --filter @abra/e2e test` | This journey **and** existing `app-shell`, `health`, create-then-login, deactivated-cannot-sign-in |
| Local        | `pnpm test:e2e`                | Same                                                                                               |

A failed journey fails the job (non-zero exit). `entity-chain.spec.ts` must not use `test.fixme` / `test.skip` in CI.

Existing smokes stay in `e2e/specs/`. This feature must not delete or skip them.

## Credentials and generated names

| Name                          | Default                              | Override             |
| ----------------------------- | ------------------------------------ | -------------------- |
| Admin email                   | `admin@abra.co`                      | `E2E_ADMIN_EMAIL`    |
| Admin password                | `Admin123!`                          | `E2E_ADMIN_PASSWORD` |
| Dedicated employee email      | `e2e.{timestamp}.{random}@abra.co`   | generated            |
| Dedicated employee password   | `E2ePass12!`                         | n/a                  |
| Unassigned control            | `employee1@abra.co` / `Employee123!` | seed fixture         |
| Client / project / task names | `e2e.{kind}.{timestamp}.{random}`    | generated            |

## Picker response (existing contract)

`GET /api/v1/me/assignments` (employee role) returns `{ data: MyAssignment[] }` where each item includes `clientName`, `projectName`, `taskName` (see `packages/contracts/src/me/assignments.ts`). Live-only filter (open task, active non-deleted project and client) is product behavior owned by the picker slice — this journey only asserts the happy-path chain.

## Out of scope

- Hidden API create of client, project, task, or assignment
- Employee-app on-screen cascading pickers and daily time-report submit
- Soft-delete / close / unassign / historical names on old entries
- Per-project hour-report type (KAN-63)
- New `@abra/contracts` schemas or catalog product rules
- Unskipping KAN-49 specs if they are still skipped
