# Quickstart: Domain schema + demo seed

**Feature**: `001-domain-data-seed`  
**Goal**: Empty Postgres → migrated schema → seeded demo org in under 5 minutes (SC-004).

## Prerequisites

- Node.js ≥ 22, pnpm 9  
- Postgres reachable via `DATABASE_URL` (local docker-compose Postgres when KAN-31 is available, or any empty Postgres instance)  
- Repo dependencies installed: `pnpm install` from monorepo root

## Setup

1. Set `DATABASE_URL` for `server/api` (env file or shell).  
2. From `server/api`:

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

(Exact package script aliases may wrap these; prefer documented `package.json` scripts once added.)

## Validate schema (User Story 1)

- Migration exits 0 on a fresh empty database.  
- Models listed in [contracts/schema-entities.md](./contracts/schema-entities.md) exist.  
- Soft-deletable models have `deleted_at`; TaskAssignment / MonthLock / AuditLog follow non-soft-delete rules.

## Validate seed (User Story 2)

Assert invariants in [contracts/demo-org.md](./contracts/demo-org.md), including:

- 1 admin + 2 employees with documented demo emails/passwords  
- 2 clients, 3 projects with tasks + assignments  
- One employee: full Sun–Thu 9h week  
- Other employee: partial week + Absence  
- Locked MonthLock for a past month; demo week month open  
- No required AuditLog / AbsenceAttachment seed rows  

### Demo credentials

Document the stable emails/passwords chosen in implementation here after seed constants land (placeholder until implement):

| Role | Email | Password |
|------|-------|----------|
| Admin | _(set in seed constants)_ | _(set in seed constants)_ |
| Employee (full week) | _…_ | _…_ |
| Employee (partial + absence) | _…_ | _…_ |

## Validate re-seed (User Story 3)

1. Optionally insert a non-demo row (e.g. Client with non-demo id/name).  
2. Run seed again.  
3. Expect: demo org restored to minimums; non-demo row still present.

## Validate fail-fast (FR-011 / SC-007)

1. Point at empty DB **without** migrate.  
2. Run seed.  
3. Expect: non-zero exit, clear error, no demo tables/rows created.

## Non-goals

- Do not expect admin/employee HTTP CRUD in this feature.  
- Frontends consume DB shapes later via APIs; this quickstart only proves data presence.
