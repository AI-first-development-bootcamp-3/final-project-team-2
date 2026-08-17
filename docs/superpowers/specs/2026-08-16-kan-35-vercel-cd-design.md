# KAN-35: Vercel CD Design

## Summary

Set up continuous deployment for the Abra Timesheet monorepo using Vercel's native Git integration. Three Vercel projects, Neon Postgres with branch databases per preview, Vercel Blob store, and proper secrets separation.

## Vercel Projects

Three projects, same GitHub repo, different root directories:

| Project            | Root Directory | Framework | Build Command                                                            | Output Dir |
| ------------------ | -------------- | --------- | ------------------------------------------------------------------------ | ---------- |
| `timesheet-mobile` | `apps/mobile`  | Vite      | `cd ../.. && pnpm install && pnpm turbo run build --filter=@abra/mobile` | `dist`     |
| `timesheet-admin`  | `apps/admin`   | Vite      | `cd ../.. && pnpm install && pnpm turbo run build --filter=@abra/admin`  | `dist`     |
| `timesheet-api`    | `server/api`   | Other     | `cd ../.. && pnpm install && pnpm turbo run build --filter=@abra/api`    | `dist`     |

- **Production branch:** `dev`
- **Preview:** every PR gets a deployment per project automatically
- **Install command (all projects):** `cd ../.. && pnpm install` (monorepo root)

## Neon Postgres (Vercel Marketplace)

- Add Neon integration from Vercel dashboard Marketplace
- Neon auto-injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` into all linked Vercel projects
- **Branching enabled:** each preview deployment gets an isolated Neon branch database — preview data never touches production
- Only `timesheet-api` uses `DATABASE_URL`; frontend projects receive it but ignore it (harmless)
- Use the **pooled** connection string (`DATABASE_URL`) for runtime; **unpooled** (`DATABASE_URL_UNPOOLED`) for migrations

## Vercel Blob

- Create a Blob store from Vercel dashboard Storage tab
- Connect to `timesheet-api` project
- Injects `BLOB_READ_WRITE_TOKEN` env var automatically
- Not consumed by application code yet — ready for future attachment upload endpoints

## Environment Variables

### Runtime env (Vercel, per project)

| Variable                | Project(s)    | Preview               | Production               |
| ----------------------- | ------------- | --------------------- | ------------------------ |
| `DATABASE_URL`          | api           | auto (Neon branch)    | auto (Neon main)         |
| `CORS_ORIGINS`          | api           | preview frontend URLs | production frontend URLs |
| `VITE_API_URL`          | mobile, admin | preview API URL       | production API URL       |
| `BLOB_READ_WRITE_TOKEN` | api           | auto (Blob store)     | auto (Blob store)        |

### Pipeline secrets (GitHub Actions)

| Secret         | Purpose                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Used by `migrate.yml` for `prisma migrate deploy` on push to `dev`. Must be the **unpooled** production Neon connection string. |

## Migration Strategy

The existing `.github/workflows/migrate.yml` handles schema migrations. Required changes:

- **Change trigger** from `push: branches: [main]` to `push: branches: [dev]` — production is now `dev`
- Runs `prisma migrate deploy` using `DATABASE_URL` from GitHub Actions secrets (unpooled production Neon string)
- Only triggers when `server/api/prisma/**` files change

Preview deployments use Neon branch databases. Neon auto-applies the parent branch schema to new branches, so preview DBs are ready without running migrations.

## Code Changes

1. **`server/api/vercel.json`** — verify serverless function config works with monorepo build
2. **`.vercelignore`** — add at repo root to skip unnecessary files (e2e, docs, docker files)
3. **`.github/workflows/migrate.yml`** — change trigger branch from `main` to `dev`

## Setup Steps (manual, in order)

1. `npm i -g vercel` — install Vercel CLI
2. `vercel login` — authenticate with Vercel account
3. Run `vercel link` in each app directory (`apps/mobile`, `apps/admin`, `server/api`) to create and connect the three projects
4. Configure each project: set root directory, build command, output directory, production branch to `dev`
5. Vercel dashboard: add Neon Postgres integration from Marketplace, enable branching
6. Vercel dashboard: create Blob store under Storage, connect to `timesheet-api`
7. Set env vars per project: `CORS_ORIGINS` on api, `VITE_API_URL` on mobile and admin
8. Copy production Neon `DATABASE_URL_UNPOOLED` to GitHub Actions secrets as `DATABASE_URL`
9. Update `migrate.yml` trigger branch to `dev`
10. Push to `dev` — verify production deployment works
11. Open a test PR — verify preview deployments and Neon branch DB creation
