# Tasks: add-swagger-env-validation-readme

## 1. Branch and dependencies

- [x] 1.1 Create `feat/kan-36-swagger-readme` off `feat/kan-31-docker-compose` (PR #6 — same files touched)
- [x] 1.2 Add `@nestjs/swagger` (^8) and `zod` (^3) to `server/api` dependencies; `pnpm install`

## 2. Env validation

- [x] 2.1 Create `server/api/src/env.ts`: zod schema (`PORT` coerced number default 3000; `CORS_ORIGINS` comma-list default `http://localhost:5173,http://localhost:5174`; `DATABASE_URL` optional but must be a `postgresql://` URL when set) with `parseEnv()` that prints each offending variable and exits 1 on failure
- [x] 2.2 Rework `main.ts` to call `parseEnv()` before `NestFactory.create` and use only the parsed values (no raw `process.env` outside `env.ts`)
- [x] 2.3 Verify failure modes: `PORT=abc` and `DATABASE_URL=not-a-url` each fail startup naming the variable; empty env boots on 3000

## 3. API prefix and Swagger

- [x] 3.1 Add `app.setGlobalPrefix('api/v1')`; confirm health now answers at `/api/v1/health` (and no longer at `/health`)
- [x] 3.2 Configure `SwaggerModule` with title/version, mount UI at `/docs`; decorate the health endpoint (`@ApiTags`, `@ApiOkResponse`) so it renders with its response schema
- [x] 3.3 Redirect `/api/v1/docs` → `/docs`; verify both paths reach Swagger UI
- [x] 3.4 Run the full compose stack: `/api/v1/health` returns `{"status":"ok"}`, `/docs` renders, frontends still pass CORS

## 4. README

- [x] 4.1 Update service URL table: health at `/api/v1/health`, add `/docs` row
- [x] 4.2 Add "Running tests" section: `pnpm test` (unit, per-workspace via turbo) documented as active; e2e marked pending the Playwright story
- [x] 4.3 Add "Deployments" section with structured pending markers naming the Vercel CD story (mobile, admin, API, health, docs URLs)

## 5. Coordination

- [x] 5.1 Grep repo and PR #6 body for bare `/health` references; update repo docs, note the path change in the new PR description
- [ ] 5.2 Open PR into `dev` once PR #6 merges (rebase if #6 changed); include the health-path change callout for the e2e story owner
