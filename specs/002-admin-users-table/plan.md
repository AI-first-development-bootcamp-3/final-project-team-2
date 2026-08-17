# Implementation Plan: Admin Users Table

**Branch**: `002-admin-users-table` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-users-table/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver Jira KAN-45 (Epic KAN-43): an admin-only Users directory that lists people with full name, email, role, and status; supports search, role/status filters, include-deactivated, pagination (fixed UI page size 20), and column sort; with loading, empty, and Hebrew error states. Frontend and backend ship in the **same phase**. Approach: shared Zod list contract in `@abra/contracts` (KAN-69), NestJS `GET /api/v1/users` module using existing Prisma `User` + soft-delete middleware, and admin `/admin/users` screen built on a first shared `DataTable` plus auth session redirect from KAN-39.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: NestJS 10 (API), Prisma 6, Zod 3 (`@abra/contracts`), React 18 + Vite 6 + Tailwind 3 (admin), shadcn/ui patterns for DataTable

**Storage**: PostgreSQL 16 via Prisma; existing `User` model (`full_name`, `email`, `role`, `is_active`, `deleted_at`, `password_hash`, `token_version`) — no schema migration required for list

**Testing**: Vitest (API + admin + contracts), Nest Supertest-style integration tests for list endpoint, React Testing Library for Users screen states; CI 70% coverage gate (GENERAL_SPEC §14.1)

**Target Platform**: Web — NestJS API (`/api/v1`) + admin console (Vite SPA)

**Project Type**: Monorepo web application (API + admin console + shared contracts)

**Performance Goals**: Initial Users screen usable under typical admin load; list queries paginated (max limit 100) so unbounded scans are rejected (GENERAL_SPEC §13.1)

**Constraints**: Admin-only access; never return `password_hash` or `token_version`; Hebrew RTL UI; soft-deleted users hidden unless `includeDeleted`; same-phase FE+BE delivery (FR-014); auth/login owned by KAN-39

**Scale/Scope**: Demo/seed org size for MVP; one admin screen (`/admin/users`); one list endpoint; shared list contract + DataTable foundation reused by later admin lists

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **GENERAL_SPEC** + this feature’s FR-014 until a real constitution is adopted.

| Gate | Status | Notes |
|------|--------|-------|
| Shared contracts in `packages/contracts/` for API + admin | PASS | List query + item + envelopes designed in Phase 1 `contracts/` |
| Same-phase FE + BE (no FE-only or BE-only ship) | PASS | Plan and quickstart require both sides verifiable together |
| Soft-delete + pagination conventions (§6.4, §6.7, §6.10, §8.3) | PASS | Documented in research + data-model |
| Secrets never in list responses (§13.2) | PASS | DTO excludes `password_hash`, `token_version` |
| Admin-only Users (§7.2, §11.2); employees denied | PASS | Requires JwtGuard + RolesGuard from KAN-39 |
| Test-first / coverage discipline (§14) | PASS | Contract + integration + UI state tests in quickstart |
| No unjustified new packages/services | PASS | Reuse Prisma User, Nest module layout, shadcn DataTable |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate | Status | Notes |
|------|--------|-------|
| Shared contracts designed | PASS | `contracts/users-list.md` → `@abra/contracts` |
| Same-phase validation path | PASS | `quickstart.md` requires contract + API + admin |
| Soft-delete / pagination / secrets | PASS | Encoded in `research.md` + `data-model.md` |
| No unjustified complexity | PASS | Complexity Tracking empty; reuses User model & monorepo layout |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-users-table/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/contracts/
├── src/
│   ├── index.ts
│   ├── enums/                 # existing (UserRole, …)
│   ├── common/                # NEW: list meta + error envelope helpers
│   └── users/                 # NEW: list query + list item schemas (KAN-69)

server/api/
├── prisma/schema.prisma       # User model (unchanged)
└── src/
    ├── common/                # JwtGuard, RolesGuard (KAN-39 prerequisite)
    └── modules/users/         # NEW: controller, service, module (list only)

apps/admin/src/
├── components/ui/             # NEW: DataTable (+ loading/empty primitives as needed)
├── features/users/            # NEW: Users page, columns, filters, hooks
├── lib/api/                   # NEW or extend: authenticated fetch client
└── routes / App routing       # /admin/users (and login redirect on 401)
```

**Structure Decision**: Monorepo web app — shared Zod contracts, Nest users list module, admin Users feature + shared DataTable. Matches GENERAL_SPEC §3 layout; no new top-level apps.

## Complexity Tracking

> No constitution violations requiring justification.
