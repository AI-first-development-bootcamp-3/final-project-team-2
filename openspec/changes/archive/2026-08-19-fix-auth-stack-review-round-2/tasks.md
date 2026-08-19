# Tasks: fix-auth-stack-review-round-2

## 1. Service cleanups (feat/kan-39-auth-api)

- [x] 1.1 Extract the duplicated account-standing check in `auth.service.ts` (`!user || user.deleted_at !== null || !user.is_active`) into a private `assertAccountUsable(user)` used by both `login()` and `refresh()`; existing tests stay green unmodified (71 api tests)
- [x] 1.2 Rename `DAY_MS` to the ADR-16 policy pair `REFRESH_TTL_DEFAULT_MS` / `REFRESH_TTL_REMEMBER_ME_MS`, updating all call sites; propagated to `feat/kan-40-remember-me`, whose service ternary and spec assertions now use the named constants (76 api tests)

## 2. Guard-branch cleanups (feat/kan-41-role-guards)

- [x] 2.1 Rewrite `logout` in `auth.controller.ts`: guard-attached `req.user` + explicit `@Auth()`; `makeAuthApp` now registers the production guard pipeline (guards.spec delegates to it), so the 401-without-token specs hold via `JwtGuard`; stale login/refresh Swagger fixed in passing
- [x] 2.2 Derive `isAdmin()`'s role literal in `apps/admin/src/lib/auth.ts` from the shared `UserRole` enum options instead of the hardcoded string

## 3. E2E and docs

- [x] 3.1 Add the one-line comment in `e2e/specs/login.spec.ts` explaining that `new URL('/', page.url()).href` resolves to the origin root (on `feat/kan-42-login-e2e`)
- [x] 3.2 Update `docs/GENERAL_SPEC.md`: §5.1 refresh returns `{ accessToken, user }` + fixed-window cookie documented; §11.2 records the app-local route convention (`/login` on the admin deployment) — landed on kan-39

## 4. Propagation and verification

- [x] 4.1 Propagate merges up the stack (kan-39 → kan-40 → kan-70 → kan-41 → kan-42), running typecheck + test:coverage + build per branch; prettier on touched files
- [x] 4.2 Confirm #16's CI (the only stack PR with checks) is green after the pushes (E2E + main job both pass)

## 5. Review replies

- [x] 5.1 Reply on #16: extractions + rename done; §5.6 confirmed covered by KAN-41's `JwtGuard` per-request `is_active` check; spec-doc updated for refresh response; fixed-window cookie documented; branded token types declined with rationale
- [x] 5.2 Reply on #20: route convention decision (`/login`, app-local — spec doc updated); `DenyNonAdmin` clearing confirmed intentional and moot under in-memory sessions; interim web-storage window acknowledged (dies when #21 merges); shared-package extraction is the planned `extract-auth-client` change
- [x] 5.3 Reply on #21: logout interim code removed + `@Auth()` added; `bootstrapSession`-duplication claim refuted (it delegates to `refreshSession()`); `RefreshResponse` lockstep-consumers point; mobile in-memory alignment deferred to `extract-auth-client` with rationale
- [x] 5.4 Reply on #22: comment nit fixed; `fillLoginForm` promotion to a shared fixture deferred until a second spec file needs login
