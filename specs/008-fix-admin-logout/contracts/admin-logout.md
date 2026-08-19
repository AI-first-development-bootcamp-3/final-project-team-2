# Contract: Admin Logout (KAN-116)

**Feature**: `008-fix-admin-logout` | **Date**: 2026-08-19  
**Kind**: Existing auth HTTP + admin console UI  
**Not**: a new Zod schema in `@abra/contracts`

Login, refresh, and access-token shapes stay KAN-39. This file records the **logout** behavior the console must use so a remount cannot rebuild the session.

## Origins

| Product       | Default origin                 | Logout UI                |
| ------------- | ------------------------------ | ------------------------ |
| Admin console | `http://localhost:5174`        | Sidebar button `התנתקות` |
| API           | `http://localhost:3000/api/v1` | `POST /auth/logout`      |

Admin sign-in path on the admin origin: `/login` (not `/admin/login`).

## `POST /api/v1/auth/logout`

Idempotent session end. Public (no live access token required). `credentials: include` so the refresh cookie is sent and can be cleared.

| Input                                                     | Server action                                                                               | Status |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| Valid `Authorization: Bearer` access JWT                  | Increment that user’s `token_version`; `Set-Cookie` expire `refresh_token`                  | 204    |
| Missing/expired access JWT + valid `refresh_token` cookie | Identify user from cookie (same rules as refresh); increment `token_version`; expire cookie | 204    |
| No usable access JWT and no usable refresh cookie         | Expire `refresh_token` cookie anyway (no user row to bump)                                  | 204    |
| Tampered refresh cookie, no valid access JWT              | Expire cookie; do not bump an arbitrary user                                                | 204    |

Cookie clear attributes MUST match login (`httpOnly`, `Secure`, `SameSite=Strict`, `path=/`, Max-Age 0 / epoch Expires).

After a 204 that identified a user, `POST /api/v1/auth/refresh` with the **pre-logout** cookie MUST be 401 and MUST NOT issue an access token.

Error bodies for this route are not used on success; clients ignore non-204 and still clear the in-memory session (existing `logout()` `finally`).

## Admin console Logout UI

| Control            | Accessible name | Where                                   |
| ------------------ | --------------- | --------------------------------------- |
| Primary (this bug) | `התנתקות`       | Admin sidebar, all authenticated routes |
| Existing duplicate | `התנתק`         | Users page header                       |

Both MUST:

1. Call `POST ${API_URL}/auth/logout` with `credentials: 'include'` and Bearer access token if one is in memory.
2. Clear the in-memory admin session (even if the request fails).
3. Not apply a later `refreshSession` success.
4. Navigate to `/login` (full-page assign is acceptable and preferred after the request settles).

After that navigation:

- Sign-in heading `ברוכים הבאים למערכת` is visible.
- Authenticated shell / Users heading `משתמשים` is not visible.
- URL matches `/login`.
- `RedirectIfAdmin` must **not** fire (session is not an admin).

## Session restore (must not run after Logout)

| Event                                   | After successful Logout                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `bootstrapSession` on remount           | `POST /auth/refresh` 401 or no cookie → session stays null → stay on `/login` |
| In-flight `apiFetch` 401 interceptor    | Must not `setAuthSession` from a refresh that started before/during Logout    |
| Browser reload of `/login`              | Stay on sign-in                                                               |
| Visit `/admin/users` (or other catalog) | `RequireAdmin` → `/login`                                                     |

## Intentional sign-in after Logout

Unchanged `POST /api/v1/auth/login`: valid admin email/password returns access token + new refresh cookie; console may admit the admin. Invalid credentials stay on `/login` with the existing Hebrew failure.

## Playwright journey (required proof)

**File**: `e2e/specs/admin-logout.spec.ts`  
**Independence**: uses seed admin; does not require catalog rows.

| #   | Action                                             | Expected                                        |
| --- | -------------------------------------------------- | ----------------------------------------------- |
| 1   | Sign in as seed admin on admin origin `/login`     | Authenticated console (Users `משתמשים`)         |
| 2   | Click sidebar `התנתקות`                            | `/login`; welcome heading; not bounced to Users |
| 3   | Wait ≥ 10s on sign-in without credentials          | Still `/login`                                  |
| 4   | Reload `/login`                                    | Still sign-in                                   |
| 5   | Open `/admin/users`                                | Sign-in, not Users table                        |
| 6   | Submit valid seed credentials                      | Authenticated console again                     |
| 7   | (P2) Repeat 1–4 with “זכור אותי” checked at step 1 | Same signed-out outcomes                        |

`signOutAdmin` in `e2e/helpers/users-directory.ts` remains for KAN-49; this journey must click **sidebar** `התנתקות` so it cannot pass via the Users-only button alone.
