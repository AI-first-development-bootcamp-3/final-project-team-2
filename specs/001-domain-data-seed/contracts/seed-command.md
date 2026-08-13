# Contract: Seed command

**Feature**: `001-domain-data-seed`  
**Consumers**: local developers, CI validation jobs

## Purpose

Define how teammates apply schema and seed demo data without product HTTP APIs.

## Invocations

| Step | Command (from `server/api`) | Precondition | Success | Failure |
|------|-----------------------------|--------------|---------|---------|
| 1. Migrate | `pnpm exec prisma migrate deploy` (or documented `migrate dev` on empty local DB) | Postgres reachable; empty or migratable DB | Exit 0; all blueprint tables exist | Exit ≠0; no silent partial accept for SC-001 |
| 2. Seed | `pnpm exec prisma db seed` | Schema applied | Exit 0; demo org matches [demo-org.md](./demo-org.md) | If schema missing: exit ≠0, **zero** demo rows (FR-011) |
| 3. Re-seed | `pnpm exec prisma db seed` again | Schema applied; may already have demo and/or non-demo data | Exit 0; demo matches demo-org; non-demo IDs unchanged | Exit ≠0; must not delete non-demo rows |

## Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | Postgres connection string |

## Non-goals

- No public REST endpoints in this feature
- No auto-migrate on seed
- No wipe of entire database
