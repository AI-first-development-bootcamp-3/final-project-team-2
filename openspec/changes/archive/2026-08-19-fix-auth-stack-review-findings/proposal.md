# Proposal: fix-auth-stack-review-findings

## Why

Code reviews across the open auth PR stack (#16 → #17 → #20 → #21 → #22) left a set of verified findings unresolved — one security-relevant (the admin app persists the access JWT in web storage, readable by XSS), one functional (the admin app lacks the 401 interceptor its acceptance criteria require), and roughly fifteen smaller correctness and hygiene items. The stack's base PR is also conflicting with `dev` again, blocking all merges. Fixing these together, bottom-up, unblocks the whole stack.

## What Changes

- **Merge mechanics**: resolve #16's conflict with `dev` (PRs #23/#24 landed) and propagate the merge up all four stacked branches.
- **Admin session hardening (#20/#21, the substantive change)**: the admin app stops persisting the access token in `localStorage`/`sessionStorage`. The token lives in memory only; on app load the client bootstraps the session via `POST /auth/refresh` (the httpOnly refresh cookie is the source of truth); a 401 on any authenticated request triggers one refresh-and-retry, then clears the session and redirects to `/login`. This retires the XSS finding and makes "remember me" (1-day vs 30-day cookie) actually observable in the client.
- **#21 guard fixes**: make `@Auth()` a meaningful enforcement marker instead of a no-op; extract the duplicated `isPublic` check and `AuthenticatedRequest` type shared by the two guards; reuse `UserRole` from contracts instead of a re-inlined role union.
- **#22 e2e fixes**: tighten the post-login URL assertion (exact path, not `/\/$/`); move seeded credentials into a shared `e2e/fixtures/users.ts`; extract the login-form fill helper; drop the unrelated `.claude/settings.local.json` permission additions from the PR.
- **#20 hygiene**: `isAdmin()` predicate, remove the dead `isAuthenticated` export, `API_URL` boot-time sanity assertion, shared `SESSION_USER` test fixture, typed navigation-state unwrap, `fillAndSubmit` test helper.
- Deliberately **not** changed: #17 (approved, no blockers); the KAN-70 visual redesign bundled in #21 stays (unwinding it mid-stack costs more than it saves — noted to the reviewer); server-side auth behavior from #16 (already fixed in `e4dc485`).

## Capabilities

### New Capabilities

- `admin-session`: how the admin client acquires, holds, refreshes, and destroys its session — in-memory access token, refresh-cookie bootstrap, 401 refresh-retry-then-logout, and admin-role gating.

### Modified Capabilities

<!-- none — dev-runtime, api-docs and env-validation requirements are untouched; all other work is implementation-level fix-up of behavior already specified in the stack's tickets -->

## Impact

- **Branches**: `feat/kan-39-auth-api`, `feat/kan-40-remember-me`, `feat/kan-70-admin-login`, `feat/kan-41-role-guards`, `feat/kan-42-login-e2e` (bottom-up propagation).
- **Code**: `apps/admin/src/lib/auth.ts` (rewritten: in-memory store), `apps/admin/src/lib/api.ts` (refresh + interceptor), `apps/admin/src/App.tsx`, admin test files; `server/api/src/auth/` guards + decorators; `e2e/specs/login.spec.ts` + new `e2e/fixtures/`; no API surface changes.
- **Risk**: the admin session refactor changes what #20's tests assert (storage-location assertions become in-memory assertions); stacked-merge conflicts are expected and handled bottom-up.
