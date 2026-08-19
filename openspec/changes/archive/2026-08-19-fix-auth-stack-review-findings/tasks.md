# Tasks: fix-auth-stack-review-findings

## 1. Unblock the stack base (feat/kan-39-auth-api)

- [x] 1.1 Merge `origin/dev` (PRs #23/#24 landed) into `feat/kan-39-auth-api`, resolve the conflict, regenerate the lockfile, verify typecheck/tests/build, push
- [x] 1.2 Propagate: merge kan-39 → `feat/kan-40-remember-me`, verify, push

## 2. Guard and decorator fixes (feat/kan-41-role-guards)

- [x] 2.1 Make `@Auth()` set an explicit authenticated-marker metadata key that `RolesGuard` honors as "any authenticated user"; add a spec proving `@Auth()`-only routes reject anonymous and accept both roles
- [x] 2.2 Extract the duplicated `isPublic(reflector, context)` check and a shared `AuthenticatedRequest` type used by both guards
- [x] 2.3 Replace the inline `'employee' | 'admin'` union in `jwt.guard.ts` with `UserRole` from `@abra/contracts`

## 3. Admin session hardening (feat/kan-41-role-guards)

- [x] 3.1 Rewrite `apps/admin/src/lib/auth.ts` as an in-memory session store (module variable + existing subscribe/`useSyncExternalStore` mechanism); remove web-storage reads/writes and the `storage`-event listener
- [x] 3.2 Add `refreshSession()` to the API layer calling `POST /auth/refresh` with credentials, deduplicated so concurrent callers share one in-flight refresh
- [x] 3.3 Bootstrap on app load: gate the router on the initial refresh settling (loading state → session or logged-out)
- [x] 3.4 Add `authFetch` wrapper: attach in-memory token, on 401 refresh-once-and-retry, on second 401 clear session and redirect to `/login` (upgraded the existing `apiFetch` client; `RefreshResponse` gained a `user` field per design D5b)
- [x] 3.5 Rewrite the #20 remember-me storage tests as bootstrap/interceptor behavior tests; keep coverage ≥ 70% (admin at 88/84/83/91)
- [x] 3.6 Verify remember-me end-to-end: bootstrap-from-cookie, dedup, 401-retry and dead-cookie logout covered in `session.spec.ts`; storage proven token-free even with rememberMe ticked; server TTL tests unchanged in `remember-me.spec.ts`

## 4. Admin hygiene (feat/kan-41-role-guards)

- [x] 4.1 Add `isAdmin(session)` predicate; use it in `RequireAdmin`, `RedirectIfAdmin`, `CatchAll`
- [x] 4.2 Remove the dead `isAuthenticated` export; add an `API_URL` boot-time sanity assertion (must start with `http`)
- [x] 4.3 Extract shared `SESSION_USER` test fixture used by `LoginPage.test.tsx` and `App.routes.test.tsx`; add `fillAndSubmit` test helper
- [x] 4.4 Replace the inline `location.state as { from?: ... }` cast with a typed unwrap helper (`lib/navigation.ts`)

## 5. E2E fixes (feat/kan-42-login-e2e)

- [x] 5.1 Tighten the post-login URL assertion to an exact path match instead of `/\/$/`
- [x] 5.2 Create `e2e/fixtures/users.ts` with the seeded employee credentials (comment pointing at the seed file); use it in `login.spec.ts`
- [x] 5.3 Extract `fillLoginForm(page, email, password)` helper for the duplicated preamble
- [x] 5.4 Remove the unrelated `.claude/settings.local.json` permission additions from the branch

## 6. Propagation and verification

- [x] 6.1 Merge upward in order: kan-40 → kan-70 → kan-41 → kan-42, resolving conflicts bottom-up, lockfile regenerated per branch (remote pushes to kan-41/kan-42 mid-flight were merged in too)
- [x] 6.2 Run full pipeline (typecheck, test:coverage, build, lint, prettier on touched files) on each branch after its merge; fix fallout (contracts refresh-shape test + mobile interceptor mock updated for RefreshResponse.user)
- [x] 6.3 Reply on PRs #20, #21, #22 summarizing what was fixed vs deliberately kept (scope-creep items, KAN-70 redesign bundling), and note the deferred follow-ups (shared auth-client package, VAL const object, email uniqueness ticket)
