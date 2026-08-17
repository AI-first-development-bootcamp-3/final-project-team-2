# Proposal: add-auth-backend

## Why

Nothing in the system is identity-checked today: the API serves every request anonymously, so no epic that depends on "who is asking" (user management, time reporting, admin console) can land. Epic 2 (Jira KAN-37, Confluence "Epic 2 Spec - Authentication") defines the contract; the login UI (KAN-38) is already in review, so the backend and its e2e proof are now the blocking pieces.

This change covers five tasks of the epic — KAN-39 (auth API), KAN-40 (remember-me durations), KAN-41 (role guards), KAN-42 (Playwright login e2e), and KAN-70 (admin portal login screen) — built test-first (TDD), with one commit per subtask and one PR per task.

## What Changes

- New `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` endpoints on the NestJS API (KAN-39): bcrypt verification, ~15-min stateless access JWT with payload `{ userId, role }`, refresh token as httpOnly/Secure/SameSite=Strict cookie validated against `token_version` on the User row; logout increments `token_version` and clears the cookie. Request/response shapes come from zod schemas in `packages/contracts` (VAL-01–VAL-04).
- Remember-me support on login (KAN-40): refresh token lifetime 1 day when unchecked, 30 days when checked — enforced server-side in both the cookie `Max-Age` and the token's own expiry claim.
- Global route protection (KAN-41): `JwtGuard` → `RolesGuard` with `@Public()` (login/refresh only), `@Auth()`, `@Roles(ADMIN)` decorators. `JwtGuard` rejects `is_active = false` users on every request. Employee-app routes accept EMPLOYEE and ADMIN (per ADR-26: admin keeps all regular-user abilities); admin-console routes are ADMIN-only.
- Playwright e2e login spec (KAN-42): seeded employee logs in and lands on the daily-report home; wrong password shows the Hebrew error and stays on login; runs in CI as part of the required e2e check.
- Admin portal login screen in `apps/admin` (KAN-70): keeps the designed visuals (Figma node 1-32908 split layout), replaces the single-button card with email + password + זכור אותי, reuses `LoginSchema`/`VAL_MESSAGES` from `packages/contracts`, submits to the KAN-39 login endpoint — closing the epic DoD "login works from both apps".
- Env schema gains required `JWT_SECRET` and `JWT_REFRESH_SECRET`; Swagger documents all three auth endpoints.

Note: the Confluence Epic 2 page §3 wording ("an admin never accesses the employee app") is stale; this change follows the ADR-26 correction captured in KAN-41's acceptance criteria.

## Capabilities

### New Capabilities

- `auth`: authentication and authorization — credential login, token issuance/refresh/revocation, remember-me durations, and role-based route protection for every API endpoint.

### Modified Capabilities

- `env-validation`: the schema gains `JWT_SECRET` and `JWT_REFRESH_SECRET` as required variables (no safe default; startup must fail without them).

## Impact

- **Code**: `server/` (new auth module: controller, service, guards, decorators, JWT strategy; env schema), `packages/contracts` (auth request/response zod schemas), `apps/admin` (login page + auth context), `e2e/` (login flow spec), Prisma seed (known test credentials).
- **APIs**: three new public endpoints under `/api/v1/auth/*`; every other endpoint becomes protected by default (behavioral change for any existing consumer).
- **Dependencies**: `@nestjs/jwt` (or `jsonwebtoken`), `bcrypt`, `cookie-parser`.
- **Systems**: CI e2e job now exercises the login flow; deploy environments need `JWT_SECRET`/`JWT_REFRESH_SECRET` set (Vercel env vars / GitHub Actions secrets — never in git).
- **Process**: five PRs (one per Jira task, branched in sequence off `dev`), each subtask an individual commit, every subtask developed red → green.
