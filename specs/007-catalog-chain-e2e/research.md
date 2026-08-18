# Research: Full Catalog Chain E2E

**Feature**: `007-catalog-chain-e2e` | **Date**: 2026-08-18

## 1. Product prerequisites (KAN-50 / 51 / 52 / 53) — not this feature

**Decision**: This feature does **not** implement or change Clients, Projects, Tasks, Assignments, or `GET /api/v1/me/assignments`. Those remain KAN-50–53 (and the employee-picker slice). The Playwright journey drives the already-shipped console screens; if a prerequisite is missing, the required check fails (that is the proof — FR-011).

Admin sign-in and Users create (dedicated employee setup) reuse helpers from KAN-49 (`e2e/helpers/users-directory.ts`). This feature does not change user-management rules.

**Rationale**: Spec FR-011 / FR-013. Folding catalog CRUD into KAN-54 would hide whether Epic 4 actually works.

**Alternatives considered**:

- Implement missing catalog screens on this branch so e2e can go green → rejected (FR-011).
- Keep the existing skipped API-only chain as the required check → rejected (FR-002).

## 2. Replace the skipped service-only spec with a console-driven journey

**Decision**: Rewrite `e2e/specs/entity-chain.spec.ts` in place:

- Remove `test.describe.skip`.
- Drive the four catalog steps on the admin console (`page`), not `request.post` to `/clients`, `/projects`, `/tasks`, `/assignments`.
- Keep picker proof as authenticated `GET ${API_BASE_URL}/me/assignments` (see §6).
- One test in that file is the catalog-chain journey (US1 + US2 in a single ordered walk). Do not split the chain across parallel tests — later steps need the unique names from earlier steps.

Dedicated-employee **person** setup MAY use the Users console (already proven by KAN-49). That is not one of the four KAN-54 catalog steps. Creating the person via a hidden API is allowed only for the user record; **assigning** them to the task is still a console step. Prefer `createEmployeeViaUsers` so the journey stays UI-visible and reuses the existing helper.

**Rationale**: Spec assumption: “An existing skipped service-only catalog-chain check does not satisfy FR-002. `/speckit-plan` should replace or extend it.” Replacing in place keeps one chain spec in CI output (SC-008) and avoids a skipped leftover that looks like coverage.

**Alternatives considered**:

- Add `catalog-chain.spec.ts` and leave `entity-chain.spec.ts` skipped → two files, one still skip; rejected.
- Extend the skipped file with UI steps while keeping API creates as fallback → still violates FR-002.
- `test.describe.serial` with four tests → a mid-chain failure skips later tests; one journey test is clearer for KAN-54.

## 3. E2E harness: already starts admin + seeds — no CI job change

**Decision**:

1. Keep the existing Playwright `webServer` trio: employee app **5173**, admin **5174**, API **3000**. Catalog-chain `goto`s use absolute `ADMIN_BASE_URL`.
2. Keep Playwright `baseURL` as the employee app so `app-shell` / `login` smokes stay unchanged.
3. CI `e2e` job already runs `prisma migrate deploy` + `prisma db seed` then `pnpm --filter @abra/e2e test`. **Do not** add a new workflow or extra seed step.
4. Catalog-chain is picked up automatically (`testDir: ./specs`). A failure fails the job (non-zero exit). Specs must not use `test.skip` / `test.fixme` on this file in CI.

**Rationale**: Spec FR-008 / FR-009 / FR-012. 005 already added admin `webServer` and CI seed.

**Alternatives considered**:

- New CI job for catalog-chain → rejected; KAN-54 is part of the **required** e2e check, not a sidecar.
- Playwright `globalSetup` to seed → extra moving part; CI already seeds.

## 4. Selectors: accessible Hebrew names, no product testids

**Decision**: Prefer role + accessible name already in the UIs. Do not add `data-testid` from this feature.

Admin origin is `ADMIN_BASE_URL` (default `http://localhost:5174`). Sign-in path is **`/login` on that origin**, not `/admin/login` (the SPA has no `/admin/login` route). After sign-in the seed admin lands on Users (`/admin/users`, heading `משתמשים`) via existing `signInAsAdmin`.

| Step          | Target                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin sign-in | `${ADMIN_BASE_URL}/login`; labels `אימייל`, `סיסמה`; button `התחבר למערכת`; fail fast if the form never appears (FR-012)                                                                                                                        |
| Nav           | sidebar links `לקוחות`, `פרויקטים`, `משימות`, `שיוכים` (also `משתמשים` for employee setup)                                                                                                                                                      |
| Users setup   | heading `משתמשים`; button `יצירת משתמש`; dialog labels from KAN-49 helper                                                                                                                                                                       |
| Clients       | heading `לקוחות`; button `לקוח חדש`; dialog `לקוח חדש`; label `שם לקוח`; submit `שמירה`; success `הלקוח נוצר בהצלחה`; row status `פעיל`                                                                                                         |
| Projects      | heading `פרויקטים`; button `פרויקט חדש`; dialog `יצירת פרויקט`; labels `שם הפרויקט`, `שם הלקוח` (select option = client name); submit `צור פרויקט`; success `הפרויקט נוצר בהצלחה`; row shows project name + parent client + `פעיל`              |
| Tasks         | heading `משימות`; button `משימה חדשה`; dialog `משימה חדשה`; labels `שם משימה`, `פרויקט` (option text `{project} ({client})`); submit `שמירה`; success `המשימה נוצרה בהצלחה`; row status `פתוחה`                                                 |
| Assignments   | heading `שיוכים`; button `שיוך חדש`; dialog `שיוך חדש`; labels `עובד` (option `{fullName} ({email})`), `משימה` (option `{task} ({project} - {client})`); submit `שמירה`; success `השיוך נוצר בהצלחה`; row shows employee name/email + task name |
| Find row      | catalog search label `חיפוש` with the unique name (page size 20; seed data already exists — do not assume an empty org)                                                                                                                         |

Add-task-from-project (`+ הוספת משימה` on a Projects row) is **allowed** by the spec but **not required**. Create from Tasks is enough.

**Rationale**: FR-002 / FR-004; Hebrew RTL console; YAGNI vs testids.

**Alternatives considered**:

- Sprinkle `data-testid` on every field → couples e2e to implementation and invites product edits this story must not make.
- Navigate by typing URLs only, never clicking sidebar → weaker proof that an operator can walk the console; prefer clicking nav links after sign-in.

## 5. Unique names, dedicated employee, unassigned control

**Decision**:

- Unique **client name** per run: `e2e.client.{timestamp}.{random}` so VAL-21 cannot fail a healthy product (FR-010).
- Unique **project** and **task** names per run even though the product does not require uniqueness — picker assertions stay unambiguous.
- Unique **employee email** via existing `uniqueEmail()` (`e2e.{timestamp}.{random}@abra.co`).
- Dedicated employee: created on Users this run, role employee (`רגיל`), active, **no other live assignments** before the Assignments step. Password: `CREATED_EMPLOYEE_PASSWORD` (`E2ePass12!`).
- Unassigned control (FR-007): seeded `employee1@abra.co` / `Employee123!` (`e2e/fixtures/users.ts`). They already have other live seed assignments; their picker MUST NOT include the unique task name. Do not assign them in this journey.
- Demo admin: `admin@abra.co` / `Admin123!`, overridable via `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.
- Do not clean up created rows (CI DB is ephemeral; local reruns rely on unique names).
- Catalog-chain timeout: `test.setTimeout(240_000)` to match SC-001 (4 minutes). Default 30s remains for smokes.
- CI `workers: 1`; unique names still required for local `fullyParallel` and consecutive reruns (SC-006).

**Rationale**: FR-005 / FR-007 / FR-010; seed employees already have assignments, so they cannot be the dedicated “exactly that chain” person.

**Alternatives considered**:

- Reuse `employee1@abra.co` as the assigned employee → picker would contain seed tasks plus the new chain; fails “exactly one live assignment” (FR-006).
- Create a second unique employee as the unassigned control → extra Users step; seeded employee1 already proves “not this task.”
- UUID-only client names → valid, but a dotted prefix matches the email helper style and is easy to spot in CI logs.

## 6. Picker data is `GET /api/v1/me/assignments`, not the employee-app pickers

**Decision**: After the Assignments catalog row is visible:

1. `POST ${API_BASE_URL}/auth/login` as the dedicated employee (email + `CREATED_EMPLOYEE_PASSWORD`). If this fails, fail with a **setup** message (employee cannot sign in), not an empty-picker assertion.
2. `GET ${API_BASE_URL}/me/assignments` with `Authorization: Bearer {accessToken}`.
3. Assert `data` has length **1** and that item’s `clientName`, `projectName`, `taskName` equal the unique names from this run.
4. Repeat login + GET as `employee1@abra.co`; assert **no** item has `taskName` equal to this run’s task.

Use absolute `API_BASE_URL` (`http://localhost:${API_PORT}/api/v1`). Relative `/api/v1/...` on Playwright `baseURL` would hit the employee Vite app, which is why the skipped spec was not a reliable API check.

Do **not** open the employee app’s cascading pickers (בחר פרויקט / בחר משימה). FR-014.

**Rationale**: Spec assumption names `GET /api/v1/me/assignments` as the picker-data source; OpenSpec entity-e2e and KAN-54 accept API proof of picker data. A check that only asserts admin tables does not satisfy KAN-54.

**Alternatives considered**:

- Drive on-screen employee pickers → rejected (FR-014); daily reporting UI is a later epic.
- Inject the admin’s JWT and call `/me/assignments` → 403 (employee-only); rejected.
- Assert picker only via UI tables → rejected (FR-006 / KAN-54).

## 7. Existing required checks must keep running

**Decision**: Do not delete, skip, or `fixme` `app-shell.spec.ts`, `health.spec.ts`, `create-then-login.spec.ts`, or `deactivated-cannot-login.spec.ts`. Do not change `login.spec.ts` (KAN-42). Unskipping KAN-49 files (if they are still skipped) is **not** this feature’s job.

**Rationale**: FR-009 / SC-007 — catalog-chain is additive.

**Alternatives considered**:

- Fold catalog-chain into `create-then-login.spec.ts` → mixes Epic 3 and Epic 4; rejected.

## 8. Helpers vs page objects

**Decision**: Small functions under `e2e/helpers/` (unique catalog names; maybe `createClientViaConsole` / `createProjectViaConsole` / `createTaskViaConsole` / `assignEmployeeViaConsole`; `fetchMyAssignments(request, email, password)`). Keep the spec readable as Given/When/Then. Reuse `signInAsAdmin` and `createEmployeeViaUsers`. Do **not** introduce a page-object framework.

**Rationale**: One journey, four screens; YAGNI. 005 already chose helpers over POM.

**Alternatives considered**:

- Playwright POM classes per catalog screen → extra abstraction for one test.
