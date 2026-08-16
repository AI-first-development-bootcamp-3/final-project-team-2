# KAN-34: Playwright E2E — Two Smoke Specs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Playwright e2e infrastructure with two smoke specs (app shell renders, health returns 200) and a fifth CI required check.

**Architecture:** Root-level `e2e/` folder (not a pnpm workspace) with Playwright config and two spec files. Playwright's `webServer` config auto-starts the mobile Vite dev server and the NestJS API before tests run. A new `e2e` job in `.github/workflows/ci.yml` installs Chromium and runs the specs.

**Tech Stack:** Playwright (latest), Chromium only, TypeScript, GitHub Actions

## Global Constraints

- Node 22 LTS, pnpm 9 (pinned via `packageManager` field)
- `e2e/` is NOT a pnpm workspace — standalone folder with its own `package.json`
- Chromium only in CI (speed)
- Strict TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`
- Mobile app on port 5173 (Vite default), API on port 3000

---

## File Map

| Action | Path                          | Responsibility                      |
| ------ | ----------------------------- | ----------------------------------- |
| Create | `e2e/package.json`            | Playwright dependency               |
| Create | `e2e/tsconfig.json`           | Strict TS for e2e specs             |
| Create | `e2e/playwright.config.ts`    | Browser, webServer, reporter config |
| Create | `e2e/specs/app-shell.spec.ts` | Smoke 1: mobile app renders         |
| Create | `e2e/specs/health.spec.ts`    | Smoke 2: GET /health returns 200    |
| Modify | `.github/workflows/ci.yml`    | Add e2e job                         |
| Modify | `package.json` (root)         | Add `test:e2e` script               |
| Modify | `.gitignore`                  | Add Playwright artifacts            |

---

### Task 1: Scaffold e2e folder with Playwright, config, and both smoke specs

**Files:**

- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/specs/app-shell.spec.ts`
- Create: `e2e/specs/health.spec.ts`
- Modify: `package.json` (root, line 15 — add `test:e2e` script)
- Modify: `.gitignore` (append Playwright artifacts)

**Interfaces:**

- Consumes: Mobile app at `http://localhost:5173` (Vite dev server), API at `http://localhost:3000` (NestJS dev server)
- Produces: `pnpm test:e2e` command that starts both servers, runs two specs, and exits

- [ ] **Step 1: Create `e2e/package.json`**

```json
{
  "name": "e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  }
}
```

- [ ] **Step 2: Create `e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["specs/**/*.ts", "playwright.config.ts"]
}
```

- [ ] **Step 3: Create `e2e/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'html',

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @abra/mobile dev',
      port: 5173,
      reuseExistingServer: !isCI,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @abra/api dev',
      port: 3000,
      reuseExistingServer: !isCI,
      cwd: '..',
    },
  ],
});
```

- [ ] **Step 4: Create `e2e/specs/app-shell.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Employee app shell', () => {
  test('renders the app with correct title', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await expect(page).toHaveTitle('Abra Timesheet');

    const heading = page.getByRole('heading', { name: 'Abra Timesheet' });
    await expect(heading).toBeVisible();
  });
});
```

- [ ] **Step 5: Create `e2e/specs/health.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('API health check', () => {
  test('GET /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Add `test:e2e` script to root `package.json`**

Add this entry to the `scripts` object in `package.json` (root):

```json
"test:e2e": "cd e2e && npx playwright test"
```

- [ ] **Step 7: Add Playwright artifacts to `.gitignore`**

Append to `.gitignore`:

```
# Playwright
e2e/test-results/
e2e/playwright-report/
e2e/blob-report/
```

- [ ] **Step 8: Install dependencies**

Run from the repo root:

```bash
cd e2e && npm install
```

This installs Playwright into `e2e/node_modules`. We use `npm` here (not pnpm) because `e2e/` is not a pnpm workspace.

- [ ] **Step 9: Install Playwright browsers locally**

```bash
cd e2e && npx playwright install chromium
```

- [ ] **Step 10: Run the e2e tests locally to verify both pass**

```bash
cd e2e && npx playwright test
```

Expected: Playwright starts the mobile dev server on 5173 and the API on 3000, runs both specs, both pass (2 passed).

- [ ] **Step 11: Commit**

```bash
git add e2e/package.json e2e/package-lock.json e2e/tsconfig.json e2e/playwright.config.ts e2e/specs/app-shell.spec.ts e2e/specs/health.spec.ts package.json .gitignore
git commit -m "test(e2e): scaffold Playwright with app-shell and health smoke specs

KAN-34"
```

---

### Task 2: Add e2e job to CI pipeline

**Files:**

- Modify: `.github/workflows/ci.yml` (append new job after `build`)

**Interfaces:**

- Consumes: `e2e/` folder from Task 1
- Produces: Fifth required CI check `E2E` on every PR

- [ ] **Step 1: Add `e2e` job to `.github/workflows/ci.yml`**

Append this job after the existing `build` job:

```yaml
e2e:
  name: E2E
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4

    - uses: actions/setup-node@v4
      with:
        node-version-file: '.nvmrc'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Install e2e dependencies
      run: cd e2e && npm ci

    - name: Install Playwright Chromium
      run: cd e2e && npx playwright install --with-deps chromium

    - name: Run e2e tests
      run: cd e2e && npx playwright test

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: e2e/playwright-report/
        retention-days: 7
```

- [ ] **Step 2: Review the full CI file to verify all five jobs exist**

Read `.github/workflows/ci.yml` and confirm these five jobs: `lint`, `typecheck`, `test`, `build`, `e2e`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Playwright e2e job as fifth required check

KAN-34"
```

---

## Post-Implementation Checklist

After both tasks are done, verify:

1. `pnpm test:e2e` from root — both specs pass locally
2. Push branch, open PR — all five CI checks appear (lint, typecheck, test, build, e2e)
3. The e2e job installs only Chromium (not all browsers)
4. Playwright report is uploaded as an artifact on the PR
