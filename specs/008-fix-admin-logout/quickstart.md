# Quickstart: Fix Admin Logout Relogin

**Feature**: `008-fix-admin-logout` | **Date**: 2026-08-19

Prove that admin Logout stays logged out. Details: [data-model.md](./data-model.md), [contracts/admin-logout.md](./contracts/admin-logout.md).

## Prerequisites

- Node ≥ 22, pnpm 9
- PostgreSQL with migrations + seed (`admin@abra.co` / `Admin123!`)
- Admin console + API (Playwright `webServer` or `pnpm dev`)
- Playwright Chromium for the journey: `pnpm --filter @abra/e2e exec playwright install chromium`

## Setup

```bash
pnpm install
pnpm --filter @abra/api exec prisma migrate deploy
pnpm --filter @abra/api exec prisma db seed
```

## Automated checks

Unit (sidebar + `logout()` + API logout/cookie):

```bash
pnpm --filter @abra/admin test
pnpm --filter @abra/api test
```

End-to-end (cookie jar + remount):

```bash
pnpm test:e2e
# iterate:
pnpm --filter @abra/e2e exec playwright test specs/admin-logout.spec.ts
```

Expect:

1. Existing smokes and other e2e specs still run
2. **Admin logout** (`admin-logout.spec.ts`): sidebar `התנתקות` → sign-in stays → reload stays → valid credentials sign in again

A failure of this file fails the existing CI `e2e` job.

## Manual validation (the KAN-116 report)

1. Open the admin console sign-in (`http://localhost:5174/login`).
2. Sign in as `admin@abra.co`.
3. On any authenticated page, click sidebar **התנתקות** (not only Users **התנתק**).
4. Confirm the sign-in screen stays up for at least 10 seconds — no bounce into Users.
5. Reload. Confirm still signed out.
6. Open `/admin/users` (or another catalog path). Confirm sign-in, not the table.
7. Sign in again with the same credentials. Confirm the console loads.
8. Optional: sign in with **זכור אותי**, Logout, reload — still signed out.

If step 4 bounces back into the console, the bug is not fixed.
