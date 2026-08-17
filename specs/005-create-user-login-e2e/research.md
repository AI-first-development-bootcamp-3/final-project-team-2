# Research: Create User Then Login E2E

**Feature**: `005-create-user-login-e2e` | **Date**: 2026-08-17

## 1. Product prerequisites (KAN-39 / 45 / 46 / 48) — not this feature

**Decision**: This feature does **not** implement `POST /api/v1/auth/login`, JWT parsing in `JwtGuard`, the admin sign-in form, admin logout, or wiring the employee `LoginForm` to the API. Those remain KAN-39. Create, Users table, and deactivate remain KAN-45/46/48. The Playwright journeys drive those UIs; if a prerequisite is missing, the required check fails (that is the proof).

Current gaps that will fail the journeys until KAN-39 lands:

- Admin `SignInPage` is a stub heading (“התחברות”) with no form.
- No admin logout control.
- Employee `LoginForm` mocks login (any email except `error@example.com` succeeds) and never calls the API.
- API has `JwtGuard` / `RolesGuard` but no auth module that issues tokens or attaches `request.user` from a JWT. Users routes therefore cannot be used from a real browser session yet.

**Rationale**: Spec FR-011. Folding auth into KAN-49 would mix epic stories and hide whether login actually works.

**Alternatives considered**:

- Implement login/logout inside this branch so e2e can go green → rejected (FR-011).
- Bypass UIs with `request.post('/auth/login')` and inject tokens → rejected (FR-009 / FR-010).

## 2. E2E harness: start admin console + seed demo org

**Decision**:

1. Add a third Playwright `webServer` for `pnpm --filter @abra/admin dev` on `ADMIN_PORT` (default **5174**), with `VITE_API_URL=http://localhost:${API_PORT}/api/v1`. Keep mobile on 5173 and API on 3000.
2. Export `ADMIN_BASE_URL` and keep `baseURL` as the employee app (existing smoke specs). Lifecycle specs `goto` admin with the absolute admin origin.
3. CI `e2e` job: after `prisma migrate deploy`, run `pnpm --filter @abra/api exec prisma db seed` so `admin@abra.co` / `Admin123!` exist (FR-012). Local `pnpm test:e2e` documents the same seed requirement.
4. Pass `DATABASE_URL` into the API `webServer` env as today.

**Rationale**: Spec FR-013 (both products) and FR-012 (known admin). Today Playwright only starts mobile + API and CI never seeds — create-then-login cannot start.

**Alternatives considered**:

- Drive only the employee app and create users via API → rejected (FR-009).
- Seed inside a Playwright `globalSetup` instead of CI → extra moving part; CI step next to migrate is the obvious place. Local docs in quickstart cover teammates who already have a seeded DB.

## 3. Two independent spec files, sequential UI in each

**Decision**: Add `e2e/specs/create-then-login.spec.ts` (US1) and `e2e/specs/deactivated-cannot-login.spec.ts` (US2). Each file is its own Playwright test so a failure in one does not skip the other (`fullyParallel` / separate tests). Keep `app-shell.spec.ts` and `health.spec.ts` unchanged.

Inside each lifecycle spec, use **one browser context** and walk screens in order (admin origin → employee origin). Do not split admin and employee across two parallel tests for the same person.

US2 **creates its own employee** on Users, then deactivates that row, then tries employee-app sign-in. It must not reuse the person from US1.

**Rationale**: FR-005 / FR-007; spec assumption that US2 may create its own employee.

**Alternatives considered**:

- One spec file with `test.describe.serial` → a first-test failure can skip the second depending on config; two files are clearer in CI output (SC-006).
- Deactivate a seeded employee (`employee1@abra.co`) → pollutes shared seed and races with a parallel create-then-login; rejected.

## 4. Selectors: accessible Hebrew names, no new testids unless blocked

**Decision**: Prefer role + accessible name already in the UIs:

| Step | Target |
| ---- | ------ |
| Admin Users | heading `משתמשים`, button `יצירת משתמש` |
| Create form | dialog `יצירת משתמש`; labels `שם מלא`, `אימייל`, `סיסמה ראשונית`, `תפקיד`; submit `שמירה`; default role `רגיל` |
| Deactivate | row button `השבת` → dialog `השבתת משתמש` → `השבת משתמש`; success status `המשתמש הושבת בהצלחה` |
| Employee login | heading `ברוכים הבאים!`; labels `אימייל`, `סיסמה`; button `התחבר` |
| Employee success | leave `/login`; heading `עמוד ראשי - דיווח יומי` (current authenticated placeholder) |
| Deactivated failure | still on `/login`; Hebrew error visible (`role=alert` or the login form error region); **not** the authenticated heading |

Admin sign-in and logout copy is owned by KAN-39. Helpers should use whatever accessible names that story ships (email/password fields + a logout control that returns the admin to `/admin/login`). If those names are missing, the journey fails — do not add `data-testid` in product code from this feature unless a control is otherwise untargetable (last resort, still not a behavior change).

**Rationale**: Spec FR-010 / Figma employee login; Users screen inventory already uses these Hebrew strings.

**Alternatives considered**:

- Sprinkle `data-testid` on every field now → couples e2e to implementation and invites product edits this story must not make.

## 5. Unique emails, credentials, and timeouts

**Decision**:

- Unique email: `e2e.${Date.now()}.${random}@abra.co` (valid address; unique among non-deleted). Same helper for both specs.
- Password for created employees: a fixed valid secret ≥ 8 chars used only in the test (e.g. `E2ePass12!`). Never assert it in the Users table (FR-014).
- Demo admin: `admin@abra.co` / `Admin123!` from KAN-32 seed, overridable via `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.
- Lifecycle specs: `test.setTimeout(180_000)` to satisfy SC-001 (3 minutes) with bcrypt + two SPAs. Default 30s remains for smokes.
- CI already uses `workers: 1`; unique emails still required for local `fullyParallel` and reruns (SC-004).

**Rationale**: FR-008 / FR-012 / SC-001 / SC-004.

**Alternatives considered**:

- Reuse `employee1@abra.co` for login-only → does not prove **create**-then-login.
- UUID-only local-part without `@abra.co` → invalid email (VAL-02).

## 6. What “signed in” and “cannot sign in” mean

**Decision**:

- **Admin signed in**: URL is `/admin/users` (or Users heading visible), not `/admin/login`.
- **Admin signed out**: URL is `/admin/login` and Users is not shown without signing in again.
- **Employee signed in**: URL is not `/login`; authenticated heading `עמוד ראשי - דיווח יומי` is visible; no forced password-change screen (none exists — ADR-16).
- **Employee refused**: URL still `/login`; authenticated heading absent; a Hebrew error is shown. Do not require a specific VAL id here — KAN-39 owns the exact copy (generic invalid-credentials vs inactive-user). Assert failure is visible and success is not.

**Rationale**: Spec FR-003 / FR-004; current mobile dashboard placeholder is the only authenticated home.

**Alternatives considered**:

- Assert HTTP 401 on `POST /auth/login` instead of the employee UI → rejected (FR-010). Instant logout of an already-open session stays KAN-48.

## 7. Helpers vs page objects

**Decision**: Small functions under `e2e/helpers/` (`uniqueEmail()`, seed credentials, maybe `adminOrigin` / `mobileOrigin`). Keep the two specs readable as Given/When/Then. Do **not** introduce a full page-object framework.

**Rationale**: Two journeys, few screens; YAGNI.

**Alternatives considered**:

- Playwright POM classes per screen → extra abstraction for two tests.
