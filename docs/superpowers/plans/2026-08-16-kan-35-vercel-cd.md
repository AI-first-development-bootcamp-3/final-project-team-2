# KAN-35: Vercel CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up continuous deployment with three Vercel projects, Neon Postgres (branching), Vercel Blob, and proper environment separation.

**Architecture:** Vercel native Git integration deploys each app from a monorepo root directory. Production deploys on push to `dev`, preview deploys on PRs. Neon provides branch databases per preview. GitHub Actions handles schema migrations separately.

**Tech Stack:** Vercel (hosting/CD), Neon Postgres (database), Vercel Blob (file storage), pnpm + Turborepo (monorepo build), GitHub Actions (migrations)

## Global Constraints

- Production branch: `dev`
- Package manager: pnpm 9.15.9, Node >= 22
- Monorepo: pnpm workspaces + Turborepo
- Three Vercel projects: `timesheet-mobile`, `timesheet-admin`, `timesheet-api`
- Neon pooled connection for runtime, unpooled for migrations

---

### Task 1: Update Vercel configs and migration workflow

**Files:**

- Modify: `apps/mobile/vercel.json`
- Modify: `apps/admin/vercel.json`
- Modify: `server/api/vercel.json`
- Create: `.vercelignore`
- Modify: `.github/workflows/migrate.yml:5`

**Interfaces:**

- Consumes: nothing
- Produces: Vercel-ready configuration files for all three projects; migration workflow targeting `dev` branch

- [ ] **Step 1: Update `apps/mobile/vercel.json` with monorepo build commands**

```json
{
  "framework": "vite",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@abra/mobile",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Update `apps/admin/vercel.json` with monorepo build commands**

```json
{
  "framework": "vite",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@abra/admin",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Update `server/api/vercel.json` with monorepo build commands**

```json
{
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@abra/api",
  "functions": {
    "api/index.js": {
      "includeFiles": "dist/**"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

- [ ] **Step 4: Create `.vercelignore` at repo root**

```
# Test & dev files — not needed in Vercel builds
e2e/
docs/
openspec/
.github/
docker-compose.yml
Dockerfile
.dockerignore
*.md
!README.md
```

- [ ] **Step 5: Update `.github/workflows/migrate.yml` — change trigger branch from `main` to `dev`**

Change line 5 from:

```yaml
branches: [main]
```

to:

```yaml
branches: [dev]
```

- [ ] **Step 6: Validate JSON files are valid**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/mobile/vercel.json','utf8')); console.log('mobile OK')"
node -e "JSON.parse(require('fs').readFileSync('apps/admin/vercel.json','utf8')); console.log('admin OK')"
node -e "JSON.parse(require('fs').readFileSync('server/api/vercel.json','utf8')); console.log('api OK')"
```

Expected: all three print OK.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/vercel.json apps/admin/vercel.json server/api/vercel.json .vercelignore .github/workflows/migrate.yml
git commit -m "feat(cd): update vercel configs for monorepo and switch migrate trigger to dev"
```

---

### Task 2: Vercel project setup (manual — requires human interaction)

This task is a guided wizard. Each step requires the human to perform actions in the terminal or Vercel dashboard. The agent should guide step-by-step and verify after each.

**Files:**

- No file changes — infrastructure setup only

**Interfaces:**

- Consumes: vercel.json files from Task 1
- Produces: three linked Vercel projects, ready for deployment

- [ ] **Step 1: Install Vercel CLI**

```bash
npm i -g vercel
```

Verify: `vercel --version` prints a version number.

- [ ] **Step 2: Login to Vercel**

```bash
vercel login
```

Follow the browser-based auth flow. Verify: `vercel whoami` prints your username.

- [ ] **Step 3: Create `timesheet-mobile` project**

```bash
cd apps/mobile
vercel link
```

When prompted:

- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (create new)
- Project name: **timesheet-mobile**
- In which directory is your code located? **.** (current)

Then go to Vercel dashboard → `timesheet-mobile` → Settings → Git:

- Production branch: **dev**
- Root directory: **apps/mobile**

- [ ] **Step 4: Create `timesheet-admin` project**

```bash
cd ../../apps/admin
vercel link
```

Same prompts as Step 3, project name: **timesheet-admin**.

Dashboard → `timesheet-admin` → Settings → Git:

- Production branch: **dev**
- Root directory: **apps/admin**

- [ ] **Step 5: Create `timesheet-api` project**

```bash
cd ../../server/api
vercel link
```

Same prompts as Step 3, project name: **timesheet-api**.

Dashboard → `timesheet-api` → Settings → Git:

- Production branch: **dev**
- Root directory: **server/api**
- Framework preset: **Other**

- [ ] **Step 6: Connect all three projects to the GitHub repo**

For each project in the Vercel dashboard → Settings → Git:

- Connect to GitHub repo: `AI-first-development-bootcamp-3/final-project-team-2`
- Confirm the production branch is set to `dev`

- [ ] **Step 7: Verify `.vercel/` directories are gitignored**

Check that `.vercel/` is in `.gitignore`. If not, add it:

```bash
echo ".vercel" >> .gitignore
```

---

### Task 3: Neon Postgres + Vercel Blob setup (manual — dashboard)

**Files:**

- No file changes — infrastructure setup only

**Interfaces:**

- Consumes: three Vercel projects from Task 2
- Produces: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `BLOB_READ_WRITE_TOKEN` env vars injected into Vercel projects

- [ ] **Step 1: Add Neon Postgres from Vercel Marketplace**

1. Go to Vercel dashboard → Storage tab (or Marketplace)
2. Search for **Neon Postgres**
3. Click **Create** / **Add**
4. Select your Vercel account/scope
5. Name the database: **timesheet-db**
6. Region: choose closest to your users (e.g., `eu-central-1` for Israel)
7. Connect to all three projects: `timesheet-mobile`, `timesheet-admin`, `timesheet-api`

Verify: each project's Environment Variables page now shows `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.

- [ ] **Step 2: Enable Neon branching for previews**

1. In the Neon integration settings on Vercel, find the branching toggle
2. Enable **"Create a branch for each preview deployment"**

This ensures each PR gets an isolated database branch.

- [ ] **Step 3: Create Vercel Blob store**

1. Go to Vercel dashboard → Storage tab
2. Click **Create** → **Blob**
3. Name: **timesheet-blob**
4. Connect to: `timesheet-api`

Verify: `timesheet-api` project's Environment Variables page now shows `BLOB_READ_WRITE_TOKEN`.

---

### Task 4: Environment variables and GitHub secrets (manual)

**Files:**

- No file changes — configuration only

**Interfaces:**

- Consumes: Neon connection strings from Task 3, Vercel project URLs
- Produces: fully configured env vars for preview and production across all projects

- [ ] **Step 1: Set `CORS_ORIGINS` on `timesheet-api`**

Vercel dashboard → `timesheet-api` → Settings → Environment Variables:

| Name           | Environment | Value                                                                        |
| -------------- | ----------- | ---------------------------------------------------------------------------- |
| `CORS_ORIGINS` | Production  | `https://timesheet-mobile.vercel.app,https://timesheet-admin.vercel.app`     |
| `CORS_ORIGINS` | Preview     | `https://*-timesheet-mobile.vercel.app,https://*-timesheet-admin.vercel.app` |

Note: update the production URLs once you know the actual domains.

- [ ] **Step 2: Set `VITE_API_URL` on `timesheet-mobile`**

Vercel dashboard → `timesheet-mobile` → Settings → Environment Variables:

| Name           | Environment | Value                                                                |
| -------------- | ----------- | -------------------------------------------------------------------- |
| `VITE_API_URL` | Production  | `https://timesheet-api.vercel.app/api/v1`                            |
| `VITE_API_URL` | Preview     | `https://timesheet-api-git-$VERCEL_GIT_COMMIT_REF.vercel.app/api/v1` |

Note: preview URL pattern may vary. Alternatively, set a single preview value and update per-deployment if needed.

- [ ] **Step 3: Set `VITE_API_URL` on `timesheet-admin`**

Same values as Step 2, but on the `timesheet-admin` project.

- [ ] **Step 4: Copy production `DATABASE_URL` to GitHub Actions secrets**

1. Go to Vercel dashboard → `timesheet-api` → Settings → Environment Variables
2. Copy the **Production** value of `DATABASE_URL_UNPOOLED` (the unpooled connection string — needed for migrations)
3. Go to GitHub repo → Settings → Secrets and variables → Actions
4. Create secret: `DATABASE_URL` = the unpooled connection string from step 2

Verify: the existing `migrate.yml` workflow will now use this secret when prisma files change on `dev`.

---

### Task 5: Verification

**Files:**

- No file changes

**Interfaces:**

- Consumes: everything from Tasks 1-4
- Produces: confirmed working CD pipeline

- [ ] **Step 1: Push branch to remote and merge to `dev`**

```bash
git push origin feat/kan-35-vercel-cd
```

Create a PR targeting `dev`, merge it. This should trigger production deployments for all three projects.

- [ ] **Step 2: Verify production deployments**

Check Vercel dashboard for all three projects:

- `timesheet-mobile`: loads in browser, shows the React app
- `timesheet-admin`: loads in browser, shows the React app
- `timesheet-api`: hitting `/api/v1/health` returns a response

- [ ] **Step 3: Verify API can connect to Neon database**

Hit the production API health endpoint. If it includes a DB check, verify it passes. If not, any endpoint that queries the database should work.

- [ ] **Step 4: Open a test PR to verify preview deployments**

Create a small test branch, open a PR against `dev`. Verify:

- All three projects get preview deployment URLs (visible in PR checks/comments)
- The preview API connects to a Neon branch database (not the production one)
- Preview frontend apps load correctly

- [ ] **Step 5: Verify migration workflow**

If there are pending migrations, push a prisma schema change to `dev` and verify `migrate.yml` runs successfully in GitHub Actions.
