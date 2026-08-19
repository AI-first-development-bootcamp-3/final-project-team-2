# Research: Fix Admin Logout Relogin

**Feature**: `008-fix-admin-logout` | **Date**: 2026-08-19

## 1. Root cause (KAN-116)

**Decision**: The defect is in the admin **sidebar** Logout control (`התנתקות`), not in `POST /api/v1/auth/logout` itself.

`AdminSidebar.handleLogout` only:

1. Clears the in-memory session (`clearAccessToken` → `clearAuthSession`)
2. Full-page navigates to `/login` (`window.location.assign`)

It never calls `POST /api/v1/auth/logout`. The httpOnly refresh cookie stays valid. `App` remounts, `bootstrapSession()` exchanges that cookie via `POST /api/v1/auth/refresh`, `setAuthSession` restores an admin session, and `RedirectIfAdmin` immediately sends the operator from `/login` to `/` → `/admin/users`. That is “instantly login inside again.”

A second Logout control on Users (`התנתק`) already calls `logout()` then assigns `/login`. That path is not the reported console-wide control. The sidebar is on every authenticated page.

**Rationale**: Matches FR-001–FR-004 and the ticket wording. Reproducing does not require remember-me; any still-valid refresh cookie is enough. Remember-me (30-day cookie) makes the same bug last longer (FR-006).

**Alternatives considered**:

- Treat this as a server bug in login/refresh → rejected; those endpoints behave as specified. Refresh succeeding after a client-only clear is correct until logout revokes the cookie.
- Treat `RedirectIfAdmin` as the bug → rejected; bouncing a signed-in admin off the login screen is intended. The session must not exist after Logout.
- Client-side navigate without full reload and skip the API → rejected; FR-004 requires reload to stay signed out. Only revoking the cookie / `token_version` survives a remount.

## 2. Sidebar must call existing `logout()`, then redirect

**Decision**: Both console Logout controls call the existing `logout()` in `apps/admin/src/lib/api.ts` (POST `/auth/logout` with `credentials: 'include'`), then redirect to `/login` only after that request settles (`finally`). Do not introduce a second session store.

Keep one helper, e.g. `logoutAndRedirect()`, used by:

- Sidebar `התנתקות` (KAN-116 product path)
- Users page `התנתק` (already close; must not drift again)

Do **not** remove the Users button in this change (KAN-49 helper `signOutAdmin` clicks `התנתק`). Point both at the same helper.

**Rationale**: `logout()` already documents “The cookie is cleared even when the request fails so a dead session cannot bounce the visitor back in via bootstrap” — but the sidebar never used it. Full-page `/login` is the right proof of FR-004 **after** the cookie is dead.

**Alternatives considered**:

- React Router `navigate('/login')` without API logout → fails FR-004 on reload.
- Clear only memory and hope refresh 401s → refresh will 200 while the cookie lives.
- Remove Users `התנתק` now → extra UX change, breaks `signOutAdmin` until rewritten; defer.

## 3. Ignore in-flight refresh after Logout starts

**Decision**: `logout()` must make a concurrent `refreshSession()` unable to write a new session. Today `refreshSession` always `setAuthSession` on 200. An in-flight catalog fetch (spec edge case: logout while a page is still loading) can 401 → refresh → restore the session **after** `clearAuthSession`, and `RedirectIfAdmin` will bounce the operator back in without a remount.

Implementation sketch (details in tasks): a logout generation / “signed-out” flag that `refreshSession` checks before `setAuthSession`, and/or drop `inflightRefresh` in `logout()` so a late success is ignored.

**Rationale**: Spec edge case “Logout while a console page is still loading data.” FR-002 forbids automatic re-admission.

**Alternatives considered**:

- Disable the 401 interceptor globally → too broad; needed for normal expiry.
- Await all in-flight `apiFetch` before logout → unbounded wait.

## 4. Server logout must still end the session when the access token is dead

**Decision**: Change `POST /api/v1/auth/logout` from “401 unless a valid access JWT” to **idempotent session end**:

1. Identify the user from a valid access Bearer token **or**, if that is missing/expired, from the refresh cookie (same verification as refresh).
2. If identified, increment `token_version` (existing revoke).
3. **Always** `clearCookie` for `refresh_token` (same cookie options as login).
4. Return **204** in all of the above, including “no tokens at all” (clear cookie, no row to bump).

Mark the handler `@Public()` (like login/refresh). CSRF posture stays SameSite=Strict + `credentials: 'include'`, same as refresh.

Replace the current API test “rejects logout without a valid access token” with: no access token + valid refresh cookie still 204, bumps version, subsequent refresh 401; no tokens still 204 and Set-Cookie expires the cookie.

**Rationale**: Access tokens last ~15 minutes. Sidebar (and Users) then `location.assign('/login')`. If logout 401s, the cookie is **not** cleared today, and `bootstrapSession` restores the session — the same user-visible bug after idle. FR-001 / FR-004 / FR-006 require Logout to stick even after remember-me and reload. Auth spec already says logout SHALL increment `token_version` and clear the cookie; it does not require a live access token to *attempt* that.

**Alternatives considered**:

- Client: refresh first, then logout → extra round-trip; loses the race if refresh is what restores the UI; fails if cookie is the only credential we need to kill.
- Client-only fix, leave 401-without-Bearer → fixes the “just logged in” report, leaves idle + remember-me reload broken.
- 401 but still `clearCookie` without bumping version → same-browser OK, other devices keep the refresh token; weaker than existing revoke semantics.

## 5. Proof: Vitest + one Playwright journey; reuse e2e helper

**Decision**:

| Layer        | What                                                                                          | Why                                      |
| ------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Vitest admin | Sidebar calls `logout` then redirect; `logout()` POSTs `/auth/logout` and ignores late refresh | Fast regression on the actual bug        |
| Vitest API   | Logout with refresh cookie only; logout with no credentials still clears cookie               | Server hardening                         |
| Playwright   | New `e2e/specs/admin-logout.spec.ts`: sign in → sidebar Logout → stay on sign-in → reload → sign in again | FR/SC that only a real browser cookie can prove |
| Helper       | `signOutAdmin` keeps working; new journey clicks sidebar `התנתקות`                            | Product control, not Users-only button   |

Do **not** add a new CI job. Existing `e2e` job picks up `e2e/specs/*.spec.ts`. Employee-app logout remains out of scope.

Optional P2 coverage in the same Playwright file: sign in with “זכור אותי”, sidebar Logout, reload still signed out (FR-006 / SC-005). Cheap if the happy path exists.

**Rationale**: Unit tests cannot see httpOnly cookies in the real browser. SC-001–SC-004 need an origin + cookie jar. Catalog-chain already starts admin on 5174.

**Alternatives considered**:

- Only Vitest → cannot prove FR-004/reload.
- Only Playwright → slower, misses the refresh-race unit case.
- New CI workflow → rejected; required check is already `e2e`.

## 6. No schema, no new packages, employee app unchanged

**Decision**: Reuse `User.token_version` and cookie name `refresh_token`. No Prisma migration. No new workspace packages. Do not change `apps/mobile` sign-out in this feature.

**Rationale**: Spec assumptions: admin console only; existing auth entities.

**Alternatives considered**: Client-readable session storage so logout can wipe it → rejected; session is in-memory by design (KAN-70); durable credential is the httpOnly cookie.
