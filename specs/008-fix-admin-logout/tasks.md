---
description: 'Task list for Fix Admin Logout Relogin (KAN-116)'
---

# Tasks: Fix Admin Logout Relogin

**Input**: Design documents from `/specs/008-fix-admin-logout/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Requested by the plan (test-first gate) and `contracts/admin-logout.md`. Include failing Vitest + Playwright tasks **before** the matching implementation. Do **not** change `apps/mobile`. Do **not** add packages or a Prisma migration.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Admin: `apps/admin/src/`
- API: `server/api/src/auth/`
- E2E: `e2e/specs/`, `e2e/helpers/`
- Docs: `specs/008-fix-admin-logout/quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing stack; no new packages or schema

- [x] T001 Confirm no new npm/pnpm packages and no Prisma schema change: do not edit `package.json` workspace deps, `apps/admin/package.json`, `server/api/package.json`, `e2e/package.json`, or `server/api/prisma/schema.prisma`; reuse `User.token_version` and cookie name `refresh_token` from `server/api/src/auth/auth.constants.ts`
- [x] T002 [P] Confirm the e2e harness already exports `ADMIN_BASE_URL` (default `http://localhost:5174`) from `e2e/playwright.config.ts` and seed admin `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `e2e/helpers/credentials.ts`; do **not** add a CI job — existing `e2e` job must pick up `e2e/specs/admin-logout.spec.ts` via `testDir: './specs'`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Idempotent `POST /auth/logout` and client `logout()` that cannot be undone by a late refresh — MUST complete before any user-story UI or Playwright work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Replace the “rejects a logout without a valid access token” case in `server/api/src/auth/auth.spec.ts` with failing tests from `specs/008-fix-admin-logout/contracts/admin-logout.md`: (1) no Bearer + valid `refresh_token` cookie → 204, `token_version` incremented, subsequent `POST /api/v1/auth/refresh` with the old cookie → 401; (2) no Bearer and no cookie → 204 and `Set-Cookie` expires `refresh_token` (Max-Age 0 or epoch Expires). Keep the existing Bearer-success case that increments version, clears cookie, and kills prior refresh
- [x] T004 Implement idempotent logout in `server/api/src/auth/auth.controller.ts`: mark `POST logout` `@Public()` (remove `@Auth()`); identify the user from a valid Bearer via `AuthService.verifyAccessToken` **or**, if that is missing/expired, from the refresh cookie using the same verify rules as `AuthService.refresh` (add a small helper on `server/api/src/auth/auth.service.ts` if needed — do not issue a new access token); if identified, call existing `logout(userId)` to increment `token_version`; **always** `res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(0))`; return 204 in all three contract rows. Update the Swagger `@ApiOperation` text so it no longer says a valid access token is required. Run `pnpm --filter @abra/api test` until T003 passes
- [x] T005 [P] Add failing tests in `apps/admin/src/lib/session.spec.ts`: `logout()` from `apps/admin/src/lib/api.ts` POSTs `${API_URL}/auth/logout` with `credentials: 'include'` and `Authorization: Bearer` when a session exists; `clearAuthSession` runs even when fetch rejects; after `logout()` has started, a later successful `refreshSession()` must **not** leave `getAuthSession()` set (in-flight refresh race in `specs/008-fix-admin-logout/research.md` §3)
- [x] T006 Implement in `apps/admin/src/lib/api.ts`: a logout generation / signed-out flag that `refreshSession` checks before `setAuthSession`; abort or ignore `inflightRefresh` inside `logout()`; keep posting `/auth/logout` then `clearAuthSession` in `finally`. Export `logoutAndRedirect()` that `await logout()` then calls `redirectToSignIn()` from `apps/admin/src/lib/api/client.ts`. Run `pnpm --filter @abra/admin test` until T005 passes

**Checkpoint**: Foundation ready — API logout ends the cookie without a live access JWT; client logout cannot be restored by refresh. Sidebar still must not skip this helper.

---

## Phase 3: User Story 1 - Admin signs out and stays signed out (Priority: P1) 🎯 MVP

**Goal**: Sidebar **התנתקות** actually ends the console session. After Logout the admin stays on `/login` (wait, reload, visit catalog) and is not bounced back by `RedirectIfAdmin`

**Independent Test**: `pnpm --filter @abra/admin test` (sidebar). `pnpm --filter @abra/e2e exec playwright test specs/admin-logout.spec.ts` — sign in, click sidebar Logout, remain on sign-in ≥ 10s, reload still signed out, `/admin/users` shows sign-in not Users

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [US1] Rewrite `apps/admin/src/components/layout/admin-sidebar.spec.tsx` logout case: mock `logoutAndRedirect` from `apps/admin/src/lib/api.ts` (not `clearAccessToken` / `redirectToSignIn` alone); clicking `התנתקות` must call `logoutAndRedirect`. Confirm the test fails on current `apps/admin/src/components/layout/admin-sidebar.tsx`
- [x] T008 [P] [US1] Create `e2e/specs/admin-logout.spec.ts` with `test.setTimeout(60_000)` and **no** `test.skip` / `describe.skip`. Journey A (US1): `signInAsAdmin` from `e2e/helpers/users-directory.ts`; click sidebar `getByRole('button', { name: 'התנתקות' })` (must not rely only on Users `התנתק`); assert URL `/login`, heading `/ברוכים הבאים למערכת/`, Users heading `משתמשים` count 0; `waitForTimeout` ≥ 10_000 still on `/login`; `reload()` still sign-in; `goto(${ADMIN_BASE_URL}/admin/users)` still sign-in. Leave `signOutAdmin` in `e2e/helpers/users-directory.ts` unchanged

### Implementation for User Story 1

- [x] T009 [US1] Change `handleLogout` in `apps/admin/src/components/layout/admin-sidebar.tsx` to `void logoutAndRedirect()` from `apps/admin/src/lib/api.ts`; remove the `clearAccessToken` + `redirectToSignIn` shortcut. Run `pnpm --filter @abra/admin test` until T007 passes
- [x] T010 [P] [US1] Change the Users header button in `apps/admin/src/features/users/users-page.tsx` to `void logoutAndRedirect()` (same helper as the sidebar) so `התנתק` cannot drift again; keep the label `התנתק`. Update `apps/admin/src/features/users/users-page.spec.tsx` mocks if they still mock `logout` only
- [x] T011 [US1] Run `pnpm --filter @abra/e2e exec playwright test specs/admin-logout.spec.ts` and fix only logout/session code (not test weakening) until Journey A passes — cookie must be dead before `window.location.assign('/login')` so `bootstrapSession` in `apps/admin/src/App.tsx` cannot restore the admin

**Checkpoint**: User Story 1 is independently testable (KAN-116 MVP). Re-login is not required yet.

---

## Phase 4: User Story 2 - Signed-out admin can sign in again on purpose (Priority: P1)

**Goal**: After sidebar Logout, valid credentials admit the admin again; invalid credentials stay on sign-in with the existing Hebrew failure

**Independent Test**: Same `e2e/specs/admin-logout.spec.ts` after Journey A: bad password stays on `/login` with the credentials-error alert; good `ADMIN_EMAIL` / `ADMIN_PASSWORD` reach Users `משתמשים` within 30s

### Tests for User Story 2 ⚠️

- [x] T012 [US2] Extend `e2e/specs/admin-logout.spec.ts` Journey B after Journey A (same test or a second test that logs in, logs out via sidebar, then): submit wrong password → remain on `/login`, see `שם המשתמש או הסיסמה שהוזנו אינם נכונים.`; submit valid seed credentials → leave `/login`, Users heading `משתמשים` visible within 30s (SC-004). Do not skip Journey A

### Implementation for User Story 2

- [x] T013 [US2] If Journey B fails, fix only `apps/admin/src/features/auth/LoginPage.tsx` / `apps/admin/src/lib/api.ts` `login()` so a **new** login after logout can set a session (logout flag from T006 must reset on successful `login` / `setAuthSession`). Do not weaken assertions. Run the Playwright file until Journey A + B pass

**Checkpoint**: User Stories 1 and 2 both pass in `admin-logout.spec.ts` (stay signed out, then intentional sign-in)

---

## Phase 5: User Story 3 - Explicit logout overrides a remembered session (Priority: P2)

**Goal**: Sign-in with **זכור אותי**, sidebar Logout, later visit/reload in the same browser still requires credentials

**Independent Test**: `pnpm --filter @abra/e2e exec playwright test specs/admin-logout.spec.ts` — remember-me login, sidebar `התנתקות`, reload `/login` still signed out; `goto` `/admin/users` still sign-in

### Tests for User Story 3 ⚠️

- [x] T014 [US3] Add Journey C in `e2e/specs/admin-logout.spec.ts`: on admin `/login` check `זכור אותי`, sign in as seed admin, click sidebar `התנתקות`, assert `/login`; `reload()` still sign-in; `goto(${ADMIN_BASE_URL}/admin/users)` still sign-in (FR-006 / SC-005)

### Implementation for User Story 3

- [x] T015 [US3] If Journey C fails, fix cookie clear so `refreshCookieOptions` in `server/api/src/auth/auth.constants.ts` used by `clearCookie` in `server/api/src/auth/auth.controller.ts` matches login (`path`, `httpOnly`, `secure`, `sameSite`) for both 1-day and 30-day cookies (same cookie name). Re-run Journey C until it passes without skipping

**Checkpoint**: All three user stories independently pass in `admin-logout.spec.ts`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, scope, and quickstart validation

- [x] T016 [P] Confirm `apps/mobile` is untouched (`git diff -- apps/mobile` empty for this feature) and `e2e/helpers/users-directory.ts` `signOutAdmin` still clicks Users `התנתק` (KAN-49 helper unchanged)
- [x] T017 [P] Run `pnpm --filter @abra/admin typecheck` and `pnpm --filter @abra/api typecheck` (and `pnpm --filter @abra/e2e typecheck` if that script exists) after adding `e2e/specs/admin-logout.spec.ts`
- [x] T018 Run the validation in `specs/008-fix-admin-logout/quickstart.md`: `pnpm --filter @abra/admin test`, `pnpm --filter @abra/api test`, `pnpm --filter @abra/e2e exec playwright test specs/admin-logout.spec.ts`. Do not `test.skip` the new spec to go green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational
  - US1 then US2 then US3 extend the **same** Playwright file (`admin-logout.spec.ts`) — sequential in that file
  - US1 sidebar/users-page implementation can proceed once T006 exists; Playwright Journey A needs T009
- **Polish (Phase 6)**: Depends on US1–US3 desired for the release (MVP can polish after US1)

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3. **MVP**
- **User Story 2 (P1)**: After US1 in `e2e/specs/admin-logout.spec.ts` (needs a completed logout before re-login). Watch T006 logout flag: must not block a later intentional `login()`
- **User Story 3 (P2)**: After US1 (same sidebar control); remember-me is an extra login option on the same journey. Can follow US2 in the same file

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- T003 before T004; T005 before T006
- T007 before T009; T008 can start in parallel with T007 (different files)
- T010 can run in parallel with T009 (different files, both need T006)
- T011 after T009 (Playwright needs the sidebar wired)
- Core logout before re-login (US2) before remember-me (US3)

### Parallel Opportunities

- T001 and T002 (confirm-only, different files)
- T003 and T005 (API spec vs admin session spec)
- T007 and T008 (sidebar unit vs new Playwright file) after T006
- T009 and T010 (sidebar.tsx vs users-page.tsx)
- T016 and T017 (diff vs typecheck)
- US1/US2/US3 **cannot** be fully staffed in parallel on `admin-logout.spec.ts` — one writer for that file

---

## Parallel Example: Foundational tests

```bash
# Different files — can be staffed in parallel:
Task: "Failing logout contract tests in server/api/src/auth/auth.spec.ts (T003)"
Task: "Failing logout/refresh-race tests in apps/admin/src/lib/session.spec.ts (T005)"
```

---

## Parallel Example: User Story 1

```bash
# After T006:
Task: "Failing sidebar spec in apps/admin/src/components/layout/admin-sidebar.spec.tsx (T007)"
Task: "Create e2e/specs/admin-logout.spec.ts Journey A (T008)"
# After T007:
Task: "Wire admin-sidebar.tsx to logoutAndRedirect (T009)"
Task: "Wire users-page.tsx to logoutAndRedirect (T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (API logout + client logout helper)
3. Complete Phase 3: User Story 1 (sidebar + Journey A)
4. **STOP and VALIDATE**: sidebar unit tests + `playwright test specs/admin-logout.spec.ts` Journey A (KAN-116 demo)
5. Ship/demo stay-signed-out; re-login and remember-me can follow

### Incremental Delivery

1. Setup + Foundational → cookie actually dies on logout
2. US1 → MVP: sidebar Logout stays on sign-in (the reported bug)
3. US2 → intentional sign-in still works (logout flag reset)
4. US3 → remember-me does not restore
5. Polish → typecheck + quickstart + mobile untouched

Do not ship a green check by skipping `admin-logout.spec.ts` or by only clicking Users `התנתק`.

### Parallel Team Strategy

1. Team completes Setup together; then T003/T005 in parallel
2. One developer: T004 + T006
3. After T006: one developer on sidebar (T007/T009) + Users helper (T010); same or second on Playwright file T008→T012→T014 (single owner for `admin-logout.spec.ts`)
4. Then polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps task to US1–US3 for traceability
- Sidebar accessible name is `התנתקות`; Users duplicate is `התנתק` — KAN-116 proof must click the sidebar
- Admin sign-in path is `${ADMIN_BASE_URL}/login`, not `/admin/login`
- `window.location.assign('/login')` is correct **after** logout HTTP completes so remount bootstrap cannot refresh
- Employee-app logout, deactivation-forced logout, and new Zod contracts are out of scope
- Commit after each task or logical group
- Stop at checkpoints to validate stories independently
- Avoid: client-only session clear, `test.skip`, implementing mobile logout, new packages
