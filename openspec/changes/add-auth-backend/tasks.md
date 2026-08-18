# Tasks: add-auth-backend

Working agreements (apply to every task below):

- **Prerequisite: KAN-38 merges to `dev` first** (decided 17 Aug 2026). Its branch already ships `LoginSchema` + Hebrew `VAL_MESSAGES` in `packages/contracts` and the login UI with the זכור-אותי checkbox — start group 1 from a rebase on post-KAN-38 `dev`.
- **TDD**: every subtask is a vertical slice — write the failing test at the agreed seam first (red), then the minimal implementation (green). No implementation without a preceding failing test; no bulk test-writing ahead of implementation.
- **One commit per subtask**, message referencing the Jira key (e.g. `feat(auth): login endpoint issues access token [KAN-39]`).
- **One PR per task group**, branched in sequence: group 1 → `feat/kan-39-auth-api` off `dev`, each next group branches off the previous one (stacked) or off `dev` after the previous PR merges. PR title carries the Jira key; CI (lint, unit, e2e) must be green before review.

## 1. KAN-39 — Auth API: login, refresh, logout (PR `feat/kan-39-auth-api`)

- [x] 1.1 Contracts: red — failing zod tests in `packages/contracts` covering KAN-38's existing `LoginSchema` (VAL-01–04, `rememberMe` default false) plus new `LoginResponse` and `RefreshResponse`; green — reuse `LoginSchema` as the login request contract (do not add a parallel `LoginRequest`) and add the response schemas. Commit.
- [x] 1.2 Env: red — failing `env.spec.ts` cases: startup parse fails naming `JWT_SECRET` / `JWT_REFRESH_SECRET` when missing; green — extend the env schema, update `.env.example` (placeholders only). Commit.
- [x] 1.3 Auth module skeleton + login happy path: red — supertest spec: `POST /api/v1/auth/login` with seeded credentials returns access token + refresh `Set-Cookie` (httpOnly, Secure, SameSite=Strict); green — auth module/controller/service, bcrypt verify, `@nestjs/jwt` wiring. Commit.
- [x] 1.4 Login failures: red — wrong password → 401 generic (no cookie); malformed email / short password → validation error naming the field; green — zod validation pipe + generic unauthorized. Commit.
- [x] 1.5 Access token contract: red — token decodes to exactly `{ userId, role }` payload with ~15 min expiry; expired token rejected without DB lookup (fake timers); green — signing options. Commit.
- [x] 1.6 Refresh: red — valid cookie → new access token; missing/tampered cookie → 401; version-mismatch cookie → 401; green — refresh endpoint validating cookie JWT + `token_version` compare. Commit.
- [x] 1.7 Logout: red — logout increments `token_version`, clears cookie, previously issued refresh token now 401; green — logout endpoint. Commit.
- [x] 1.8 Swagger: document all three endpoints (request/response/cookie behavior); verify in `/api/docs`; coverage report ≥70%. Commit, open PR for KAN-39, move Jira to In Review.

## 2. KAN-40 — Remember-me durations (PR `feat/kan-40-remember-me`)

- [x] 2.1 Red — login with `rememberMe: false` sets cookie `Max-Age` ≈ 1 day AND refresh-token expiry claim ≈ 1 day (fake timers: refresh at +25h → 401); green — duration selection at login. Commit.
- [x] 2.2 Red — login with `rememberMe: true` sets both to 30 days (refresh at +29d succeeds, +31d → 401); green. Commit.
- [x] 2.3 Red — client-edited cookie lifetime cannot outlive the token claim (present a preserved cookie past claim expiry → 401); green — assert enforcement is claim-side, not only cookie-side. Commit, open PR for KAN-40, move Jira to In Review.

## 3. KAN-70 — Admin portal login screen (PR `feat/kan-70-admin-login`)

- [x] 3.1 Red — failing component tests for the portal login form: renders email + password + זכור-אותי fields RTL; submitting malformed email / short password shows the matching Hebrew `VAL_MESSAGES` text without any network call; green — login page in `apps/admin` using `LoginSchema` from `packages/contracts`, keeping the node 1-32908 visuals (split layout, illustration, greeting card). Commit.
- [x] 3.2 Red — submit with valid input calls `POST /api/v1/auth/login` with `{email, password, rememberMe}` and on success stores the access token and navigates to the portal home; green — submit handler + auth state. Commit.
- [x] 3.3 Red — 401 response shows the generic Hebrew error and stays on the login screen; while unauthenticated, portal routes redirect to login; green — error handling + route guard. Commit, open PR for KAN-70, move Jira to In Review.

## 4. KAN-41 — Role guards and route protection (PR `feat/kan-41-role-guards`)

- [x] 4.1 Red — guard unit specs via test controllers: no token on protected route → 401; `@Public()` route passes untokened; green — `JwtGuard` + `@Public()` decorator registered as global `APP_GUARD`; login, refresh, and health marked `@Public()` (three public routes total — recorded on KAN-41). Commit.
- [x] 4.2 Red — role matrix: EMPLOYEE token on `@Roles(ADMIN)` route → 403; ADMIN on employee route (`@Auth()`) → 200; ADMIN on admin route → 200; green — `RolesGuard` + `@Auth()`/`@Roles()` decorators (ADR-26 matrix). Commit.
- [x] 4.3 Red — deactivated user: `is_active=false` user with live access token → 401 on any request; refresh also 401; green — `is_active` lookup in `JwtGuard`. Guard files at near-100% coverage. Commit.
- [x] 4.4 Frontend route protection: red — failing component/route tests in the employee app (admin app covered in 3.3): expired/invalid session redirects to `/login` with the Hebrew message, protected routes unreachable logged out; green — auth context + route guard + 401 interceptor triggering refresh-then-redirect. Commit, open PR for KAN-41, move Jira to In Review.

## 5. KAN-42 — Playwright e2e login flow (PR `feat/kan-42-login-e2e`)

- [x] 5.1 Red — new `e2e/specs/login.spec.ts`: seeded employee + valid password lands on daily-report home (assert URL/heading); green — wire seeded credentials, stable selectors/test-ids coordinated with the KAN-38 UI. Commit.
- [x] 5.2 Red — wrong password shows the Hebrew error and stays on the login screen; green. Commit.
- [x] 5.3 CI: ensure the spec runs in the required e2e check (update the workflow/seed if needed) and passes against the compose stack. Commit, open PR for KAN-42, move Jira to In Review.

## 6. Wrap-up

- [ ] 6.1 After all five PRs merge: verify definition of done against `specs/auth/spec.md` scenarios end-to-end on `dev` (both apps), then run `/opsx:sync` and `/opsx:archive` for this change.
