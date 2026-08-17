# Quickstart: Create User Then Login E2E

**Feature**: `005-create-user-login-e2e` | **Date**: 2026-08-17

Validate the two required user-lifecycle journeys against a seeded demo org. Details: [data-model.md](./data-model.md), [contracts/user-lifecycle-e2e.md](./contracts/user-lifecycle-e2e.md). Product create/deactivate/sign-in behavior is **not** owned here (KAN-39 / 46 / 48).

## Prerequisites

- Node ≥ 22, pnpm 9, Playwright Chromium (`pnpm --filter @abra/e2e exec playwright install chromium`)
- PostgreSQL available (CI service or local) with **migrations + seed** applied
- **KAN-39**: real admin sign-in + logout; employee login calls the API; deactivated users are refused at sign-in
- **KAN-45 / 46 / 48**: Users directory, create employee, deactivate from the row
- Seed admin `admin@abra.co` / `Admin123!` present

If admin sign-in is still a stub or employee login is still mocked, these journeys **must fail**. Do not bypass the UIs to force a green check.

## Setup

```bash
pnpm install
# start DB per repo docs, then:
pnpm --filter @abra/api exec prisma migrate deploy
pnpm --filter @abra/api exec prisma db seed
```

Playwright starts API (3000), employee app (5173), and admin console (5174) via `webServer`.

## Automated checks

```bash
pnpm test:e2e
# equivalent:
pnpm --filter @abra/e2e test
```

Expect four specs to run:

1. Employee app shell (existing smoke)
2. API health (existing smoke)
3. `create-then-login` — admin creates employee → logout → employee reaches authenticated home
4. `deactivated-cannot-login` — admin deactivates a (new) employee → employee sign-in refused

Re-run `pnpm test:e2e` a second time: both lifecycle specs still pass (unique emails, SC-004).

## Manual validation (optional, same path as the robots)

1. Sign in to the admin console as `admin@abra.co` → Users.
2. Create an employee with a unique email and password `E2ePass12!` (role רגיל). Confirm the row shows name/email/role/active and **not** the password.
3. Sign out of the console.
4. On the employee app (`ברוכים הבאים!`), sign in with that email and password → `עמוד ראשי - דיווח יומי`.
5. In a separate pass: create another employee, deactivate them (`השבת`), then try employee-app sign-in → stay on login with a Hebrew error.

## Done when

- [ ] `pnpm test:e2e` runs smokes **and** both new journeys
- [ ] CI `e2e` job seeds the DB and starts the admin console; a failed journey fails the job
- [ ] Second consecutive local run still passes
- [ ] No product login/create/deactivate rules were changed in this feature
