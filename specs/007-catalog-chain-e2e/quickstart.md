# Quickstart: Full Catalog Chain E2E

**Feature**: `007-catalog-chain-e2e` | **Date**: 2026-08-18

Validate the required catalog-chain journey against a seeded demo org. Details: [data-model.md](./data-model.md), [contracts/catalog-chain-e2e.md](./contracts/catalog-chain-e2e.md). Product Clients / Projects / Tasks / Assignments / picker behavior is **not** owned here (KAN-50–53).

## Prerequisites

- Node ≥ 22, pnpm 9, Playwright Chromium (`pnpm --filter @abra/e2e exec playwright install chromium`)
- PostgreSQL available (CI service or local) with **migrations + seed** applied
- **KAN-50–53**: admin console Clients, Projects, Tasks, Assignments create + tables; employee picker `GET /api/v1/me/assignments`
- **KAN-39 / 70**: real admin sign-in
- **KAN-46 / 49 helper**: Users create employee (for dedicated person setup)
- Seed admin `admin@abra.co` / `Admin123!` present
- Seed employee `employee1@abra.co` / `Employee123!` present (unassigned control)

If catalog screens are missing or picker data never includes the new chain, this journey **must fail**. Do not bypass the console creates to force a green check.

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

Expect the required suite to include:

1. Employee app shell (existing smoke)
2. API health (existing smoke)
3. Epic 3 create-then-login and deactivated-cannot-sign-in (existing; this feature must not remove them)
4. **Catalog chain** (`entity-chain.spec.ts`) — admin creates client → project → task → assignment on the console; dedicated employee picker data is exactly that chain; `employee1@abra.co` does not see the new task

Re-run `pnpm test:e2e` a second time: catalog-chain still passes (unique client names and emails, SC-006).

Filter to this journey while iterating:

```bash
pnpm --filter @abra/e2e exec playwright test specs/entity-chain.spec.ts
```

## Manual validation (optional, same path as the robots)

1. Sign in to the admin console as `admin@abra.co` (admin origin, `/login`).
2. Users: create a unique employee (role רגיל, password `E2ePass12!`).
3. Clients: `לקוח חדש` with a unique name → row is `פעיל`.
4. Projects: `פרויקט חדש` under that client → row shows that client, `פעיל`.
5. Tasks: `משימה חדשה` under that project → row shows that project, `פתוחה`.
6. Assignments: `שיוך חדש` of that employee to that task → row shows employee + task.
7. As that employee, `GET /api/v1/me/assignments` (after login) returns exactly one item whose three names match.
8. As `employee1@abra.co`, the same endpoint does not include that task.

## Done when

- [ ] `pnpm test:e2e` runs existing smokes **and** the catalog-chain journey (no `skip` / `fixme` on `entity-chain.spec.ts`)
- [ ] The four catalog steps happen on console screens, not via hidden API creates
- [ ] Dedicated employee picker data is exactly the unique client / project / task
- [ ] Unassigned seeded employee does not see that task
- [ ] Second consecutive local run still passes
- [ ] CI `e2e` job still seeds the DB and starts the admin console; a failed journey fails the job
- [ ] No Clients / Projects / Tasks / Assignments / picker product rules were changed in this feature
