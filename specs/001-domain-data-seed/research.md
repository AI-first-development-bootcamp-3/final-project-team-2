# Research: Domain Data Model and Demo Seed

**Feature**: `001-domain-data-seed` | **Date**: 2026-08-13  
**Sources**: `docs/GENERAL_SPEC.md`, `specs/001-domain-data-seed/spec.md`, monorepo scaffold (`server/api`, `packages/contracts`)

## 1. ORM, schema location, and first migration

**Decision**: Use Prisma 6 in `server/api/prisma/` with PostgreSQL. First deliverable is `schema.prisma` plus an initial migration committed under `server/api/prisma/migrations/`, applied with `prisma migrate deploy` (or `migrate dev` locally on empty DB).

**Rationale**: GENERAL_SPEC §3.2 and KAN-32 name Prisma + first migration; `server/api` already lists `prisma` as a dependency. Empty DB acceptance (FR-003 / SC-001) matches Prisma’s migrate workflow.

**Alternatives considered**:
- SQL-only migrations without Prisma — rejected; conflicts with epic/GENERAL_SPEC.
- `db push` without committed migration — rejected; KAN-32 requires a committed first migration.

## 2. Soft-delete and append-only rules in Prisma

**Decision**: Model `deletedAt DateTime?` on User, Client, Project, Task, TimeEntry, Absence only. TaskAssignment has no soft-delete. MonthLock uses `isLocked` + lock/unlock metadata. AuditLog has no update/delete paths (append-only). Add Prisma client extension/middleware later for default `deletedAt: null` filtering; for this feature, schema + seed correctness are sufficient (middleware can land with first read APIs).

**Rationale**: Aligns with clarified spec + GENERAL_SPEC §4 / §8.3 / §8.4; contradicts the looser Jira “soft-delete everywhere” wording in favor of GENERAL_SPEC.

**Alternatives considered**:
- Soft-delete on all FR-001 entities — rejected; breaks AuditLog append-only and unused columns on TaskAssignment/MonthLock.
- Physical deletes for seed wipe of AuditLog — allowed only as local seed-reset exception (spec edge case); product API must never delete audit rows.

## 3. Demo-org identification for wipe-and-recreate

**Decision**: Seed uses **stable demo keys**: fixed emails for the 3 users and fixed, documented UUIDs (or deterministic IDs) for demo Clients/Projects/Tasks/related rows. Re-seed procedure: delete demo-graph by those IDs (children first), then recreate. Do **not** add an `is_demo` column in MVP.

**Rationale**: Spec requires wipe of demo-org only without touching non-demo/customer data. Stable IDs/emails are explicit, testable, and avoid schema pollution. Non-demo rows with other emails/IDs remain untouched (FR-008 / SC-005).

**Alternatives considered**:
- `is_demo` boolean on every table — workable but adds permanent product surface for a local-dev concern.
- Wipe entire database — rejected by product owner (must not delete customer-like data).
- Idempotent upsert only — rejected in clarify (Option A wipe-recreate).

## 4. Seed entrypoint and fail-fast before schema

**Decision**: Implement `server/api/prisma/seed.ts` wired via `prisma.seed` in `package.json`. Seed starts by verifying required tables/migrations exist (e.g. query `_prisma_migrations` or a lightweight `SELECT` against `User`); if schema missing, exit non-zero with a clear message and create no rows (FR-011 / SC-007).

**Rationale**: Clarified fail-fast behavior; Prisma seed is the GENERAL_SPEC-documented entrypoint.

**Alternatives considered**:
- Auto-migrate then seed — rejected in clarify.
- Leave partial failure for next wipe — rejected for pre-schema case (no tables to write).

## 5. Password hashing for demo users

**Decision**: Hash demo passwords with bcrypt (cost factor consistent with NestJS auth later, e.g. 10). Document plaintext demo passwords only in local-dev docs (`quickstart.md`), never in committed production configs.

**Rationale**: GENERAL_SPEC §5.3 / §13.2; User.password_hash is required.

**Alternatives considered**: Store plaintext — rejected (security NFR). Skip passwords until auth feature — rejected (FR-009 / User model requires hash).

## 6. Fully reported week calendar semantics

**Decision**: Sunday-start week; reporting days **Sunday–Thursday** (5 days); each full day = completed TimeEntry totaling **9 hours** (GENERAL_SPEC day-status FULL). One employee gets all 5 days at 9h; the other gets fewer days and/or <9h on days present (partial), plus the Absence sample on a workday without conflicting full coverage.

**Rationale**: Spec + GENERAL_SPEC §8.5; Fri/Sat excluded from absence ranges.

**Alternatives considered**: Mon–Fri western week — rejected (Israeli week starts Sunday). Exact hours = 9 only vs >=9 — use exactly 9h for FULL demo clarity.

## 7. MonthLock and Absence seed shape

**Decision**:
- No MonthLock row (or an open/unlocked representation) for the demo week’s calendar month — month remains open for edits.
- One locked MonthLock for a **different past** `(year, month)`, `lockedBy` = demo admin.
- One Absence for the partial employee; prefer type `vacation` so AbsenceAttachment is not required.

**Rationale**: Clarify session answers A/B for month lock and seed extras.

**Alternatives considered**: Lock the demo week month — rejected (blocks edit UIs). Seed sick absence with attachment — rejected (no AbsenceAttachment in seed).

## 8. Shared enums in `packages/contracts`

**Decision**: Add Zod enums (UserRole, WorkLocation, AbsenceType, TaskStatus, HalfDayPeriod, AuditAction) in `packages/contracts` in the same feature tranche as schema, so Prisma enums and API/contracts stay aligned from day one. Seed may import enum values from contracts or duplicate string literals that match contracts — prefer contracts.

**Rationale**: GENERAL_SPEC §2 / §3.2; breaking changes fail CI via shared package.

**Alternatives considered**: Prisma-only enums until later — risk of drift with frontends.

## 9. Schema apply on non-empty / partial DB (deferred acceptance)

**Decision**: Product acceptance remains “fresh empty DB” only. Operationally document: `prisma migrate deploy` on DBs with conflicting objects may fail; teammates should use a fresh Postgres volume or reset. No custom repair tooling in this feature.

**Rationale**: Spec edge case deferred to planning; keep scope small.

**Alternatives considered**: Custom baseline repair scripts — out of scope for KAN-32.

## 10. Testing approach for this feature

**Decision**: Integration tests against a real Postgres (docker-compose or CI service) that (1) apply migration on empty DB, (2) run seed and assert counts/relationships, (3) re-run seed and assert demo wipe invariants + non-demo survival, (4) assert seed-before-migrate fails. Jest as Nest/GENERAL_SPEC default; co-located or `server/api/prisma/*.spec.ts` / `test/` as implementer prefers.

**Rationale**: GENERAL_SPEC §14 — no mocking Prisma for DB behavior; this feature is entirely DB-shaped.

**Alternatives considered**: Unit-only mocks — insufficient for SC-001–SC-007.
