# Implementation Plan: Domain Data Model and Demo Seed

**Branch**: `001-domain-data-seed` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-domain-data-seed/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver the ABRA Timesheet blueprint persistence layer and local demo organization for KAN-32: Prisma schema + first committed migration for User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, AbsenceAttachment, MonthLock, and AuditLog (soft-delete and append-only rules per GENERAL_SPEC), plus a wipe-and-recreate seed that creates a realistic demo org (credentials, full/partial weeks, absence, locked past month) without deleting non-demo data. Product CRUD/auth APIs are out of scope; shared Zod enums land in `packages/contracts` for alignment.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥22 (pnpm 9 monorepo)

**Primary Dependencies**: NestJS 10 (`@abra/api`), Prisma 6, Zod (`@abra/contracts`), bcrypt for password hashes

**Storage**: PostgreSQL (local via docker-compose when available; Neon in production per GENERAL_SPEC)

**Testing**: Jest + real Postgres integration tests (no Prisma mocks for migrate/seed behavior); Vitest unused for this backend-only feature

**Target Platform**: Local developer machines + CI with Postgres service; API later deploys as Vercel serverless (out of scope here)

**Project Type**: Monorepo web system — this feature is backend data layer (`server/api` + `packages/contracts`)

**Performance Goals**: Schema apply + seed under 5 minutes on empty local DB (SC-004); no runtime API latency targets in this feature

**Constraints**: Demo wipe must not delete non-demo/customer data; seed must fail fast if schema missing; AuditLog append-only in product; no Redis/Mongo

**Scale/Scope**: Demo minimums only (1 admin, 2 employees, 2 clients, 3 projects, one full + one partial week, 1 absence, 1 locked past month); not production data volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (no ratified project principles). Gates for this feature therefore follow **`docs/GENERAL_SPEC.md`** and the clarified feature spec:

| Gate | Status | Notes |
|------|--------|-------|
| Align with GENERAL_SPEC data model (§4) | PASS | data-model.md mirrors entities, soft-delete, append-only |
| Prefer simplicity / YAGNI (no extra product surface for local seed) | PASS | stable demo IDs/emails instead of `is_demo` columns |
| Test against real DB for persistence behavior (§14) | PASS | research + quickstart require Postgres integration checks |
| Shared contracts for enums (§2 / §3.2) | PASS | enums planned in `packages/contracts` |
| Scope: no CRUD/auth product delivery | PASS | contracts are migrate/seed/demo invariants only |

**Post-design re-check**: PASS — Phase 1 artifacts stay within schema + seed + contracts; no unjustified new services or API modules.

## Project Structure

### Documentation (this feature)

```text
specs/001-domain-data-seed/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── seed-command.md
│   ├── demo-org.md
│   └── schema-entities.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
server/api/
├── prisma/
│   ├── schema.prisma          # Blueprint models + enums
│   ├── migrations/            # First committed migration
│   ├── seed.ts                # Demo org wipe + recreate
│   └── (optional) seed-data.ts / demo-ids.ts
├── package.json               # prisma seed config; @prisma/client + bcrypt deps
├── src/                       # Nest bootstrap exists; no CRUD modules required for this feature
└── test/ or *.spec.ts         # migrate + seed integration tests

packages/contracts/
├── src/
│   ├── enums/ or index exports  # UserRole, WorkLocation, AbsenceType, …
│   └── index.ts
└── package.json
```

**Structure Decision**: Follow GENERAL_SPEC §3.2 — Prisma and seed live under `server/api/prisma/`; shared enums in `packages/contracts`. Frontends (`apps/mobile`, `apps/admin`) are consumers of later APIs only; no frontend work in this feature.

## Complexity Tracking

> No constitution violations requiring justification. Complexity table left empty.
