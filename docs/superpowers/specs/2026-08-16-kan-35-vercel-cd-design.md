# KAN-35: Vercel CD Design

## Summary

Set up continuous deployment for the Abra Timesheet monorepo using GitHub Actions + Vercel CLI. Three Vercel projects, Neon Postgres with branch databases per preview, Vercel Blob store, and proper secrets separation.

## Deployment Approach

GitHub Actions CD workflow (`.github/workflows/cd.yml`) deploys all three projects via `vercel deploy`. No Vercel Git integration needed — deployments are triggered by GitHub Actions.

- **Production:** `vercel deploy --prod` on push to `dev`
- **Preview:** `vercel deploy` on PRs targeting `dev`
- Each project's `.vercel/project.json` is created dynamically in the workflow using secrets

## Vercel Projects

Three projects, same GitHub repo, different root directories (set via Vercel API):

| Project            | Root Directory | Framework | Build                                                                                        |
| ------------------ | -------------- | --------- | -------------------------------------------------------------------------------------------- |
| `timesheet-mobile` | `apps/mobile`  | Vite      | auto-detected by Vercel                                                                      |
| `timesheet-admin`  | `apps/admin`   | Vite      | auto-detected by Vercel                                                                      |
| `timesheet-api`    | `server/api`   | Node.js   | `vercel-build` script runs `nest build`, `api/index.js` auto-detected as serverless function |

## Neon Postgres (Vercel Marketplace)

- Added via Vercel dashboard Marketplace
- Connected to `timesheet-api` only
- Neon auto-injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
- **Branching enabled:** each preview deployment gets an isolated Neon branch database
- **Pooled** connection string (`DATABASE_URL`) for runtime; **unpooled** (`DATABASE_URL_UNPOOLED`) for migrations

## Vercel Blob

- Created via Vercel dashboard Storage tab
- Connected to `timesheet-api`
- Injects `BLOB_READ_WRITE_TOKEN` env var automatically
- Not consumed by application code yet — ready for future attachment upload endpoints

## Environment Variables

### Runtime env (Vercel, per project)

| Variable                | Project(s)    | Preview               | Production               |
| ----------------------- | ------------- | --------------------- | ------------------------ |
| `DATABASE_URL`          | api           | auto (Neon branch)    | auto (Neon main)         |
| `CORS_ORIGINS`          | api           | preview frontend URLs | production frontend URLs |
| `VITE_API_URL`          | mobile, admin | production API URL    | production API URL       |
| `BLOB_READ_WRITE_TOKEN` | api           | auto (Blob store)     | auto (Blob store)        |

### GitHub Actions secrets

| Secret                     | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `VERCEL_TOKEN`             | Auth for `vercel deploy` in CD workflow          |
| `VERCEL_ORG_ID`            | Vercel team/org identifier                       |
| `VERCEL_MOBILE_PROJECT_ID` | Project ID for timesheet-mobile                  |
| `VERCEL_ADMIN_PROJECT_ID`  | Project ID for timesheet-admin                   |
| `VERCEL_API_PROJECT_ID`    | Project ID for timesheet-api                     |
| `DATABASE_URL`             | Unpooled Neon string for `prisma migrate deploy` |

## Migration Strategy

`.github/workflows/migrate.yml` runs `prisma migrate deploy` on push to `dev` when `server/api/prisma/**` files change, using the `DATABASE_URL` GitHub secret (unpooled production Neon connection string).
