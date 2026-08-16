# KAN-34: Playwright E2E — Two Smoke Specs

**Date:** 2026-08-15
**Status:** Approved
**JIRA:** KAN-34
**Epic:** KAN-29 (Setup & Infrastructure)

---

## Purpose

Wire Playwright e2e infrastructure from day zero so later epics only add specs, never plumbing.

## Acceptance Criteria (from JIRA)

1. Playwright installed and running in CI against the composed stack
2. Smoke spec 1: the employee app shell renders
3. Smoke spec 2: GET /health returns 200
4. CI e2e job is a required check

## Structure

```
e2e/
  playwright.config.ts
  specs/
    app-shell.spec.ts
    health.spec.ts
  package.json            # Playwright dep only, NOT a pnpm workspace
```

Root-level `e2e/` folder — not registered in `pnpm-workspace.yaml`. E2e tests cut across apps/services and don't export anything other workspaces consume.

## Stack Startup

Playwright's built-in `webServer` config starts both services before tests run and tears them down after:

- **Mobile app:** `pnpm --filter @abra/mobile dev` — Vite on port 5173
- **API:** `pnpm --filter @abra/api dev` — NestJS on port 3000

No docker-compose or Postgres needed for these two smoke specs — the health endpoint doesn't touch the DB, and the mobile app shell is static.

## Smoke Specs

### `app-shell.spec.ts`

- Navigate to `http://localhost:5173`
- Assert page title is "Abra Timesheet"
- Assert heading "Abra Timesheet" is visible on screen

### `health.spec.ts`

- Send `GET http://localhost:3000/health` via Playwright's `request` API
- Assert response status is 200
- Assert response body is `{ "status": "ok" }`

## Playwright Config

- **Browser:** Chromium only (keeps CI fast)
- **Retries:** 0 locally, 2 in CI
- **Reporter:** html locally, github in CI
- **Base URLs:** configured via `webServer` entries
- **Timeout:** 30s per test (default)

## CI Job

Added as a fifth job `e2e` in `.github/workflows/ci.yml`:

1. Checkout + pnpm/node setup (same as other jobs)
2. `pnpm install --frozen-lockfile`
3. `npx playwright install --with-deps chromium` (only Chromium)
4. `npx playwright test` from `e2e/` directory
5. `webServer` config auto-starts mobile + API

This job becomes a required check alongside lint, typecheck, test, and build.

## Root Script

Add to root `package.json`:

```json
"test:e2e": "cd e2e && npx playwright test"
```

## What This Does NOT Include

- Admin app e2e (not in acceptance criteria)
- Database-dependent tests (no Postgres service in this job)
- Visual regression testing
- Multiple browser testing (Chromium only for now)
