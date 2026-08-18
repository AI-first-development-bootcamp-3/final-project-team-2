# Implementation Plan: Admin Projects CRUD

**Branch**: `006-admin-projects-crud` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-admin-projects-crud/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver Jira KAN-51 (Epic KAN-44): admin-only Projects catalog — Hebrew RTL table of name, parent client, and active/inactive status; search, client filter, include-removed, pagination (fixed UI page size 20), and column sort; create under an active client (VAL-22 / VAL-23, default active); edit name/client/status; soft-remove with historical names still rendering on old time reports and new-entry pickers hiding inactive/removed projects. Frontend and backend ship in the **same phase**. Approach: shared Zod CRUD contract in `@abra/contracts` (GENERAL_SPEC §12.4), NestJS `/api/v1/projects` module on the existing Prisma `Project` model, and `/admin/projects` on the shared `DataTable` + `CrudModal` used by Clients (KAN-50). Reuse the entity-management projects slice already in the monorepo; close the spec gaps in [research.md](./research.md) (inactive vs remove, distinguishable removed rows, client-name sort, keep-current-client on edit, picker/history tests).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: NestJS 10 (API), Prisma 6, Zod 3 (`@abra/contracts`), React 18 + Vite 6 + Tailwind 3 (admin), existing `DataTable` + `CrudModal`

**Storage**: PostgreSQL 16 via Prisma; existing `Project` model (`name`, `client_id`, `is_active`, `deleted_at`) and `Client` parent — no schema migration. Seed clients/projects from KAN-32.

**Testing**: Vitest (contracts + API + admin), Nest integration tests for list/get/create/update/remove + VAL-22/VAL-23, React Testing Library for Projects screen and modal states; CI 70% coverage gate (GENERAL_SPEC §14.1)

**Target Platform**: Web — NestJS API (`/api/v1`) + admin console (Vite SPA)

**Project Type**: Monorepo web application (API + admin console + shared contracts)

**Performance Goals**: List queries paginated (max limit 100); create/update p95 under 500ms (GENERAL_SPEC §13.1)

**Constraints**: Admin-only; Hebrew RTL; soft-delete never physically destroys; same-phase FE+BE (FR-017); names not unique; no lead-manager/dates/description (FR-018); no combined assignment table / tasks CRUD / hour-report type (FR-019); auth/login owned by KAN-39; Clients catalog (KAN-50) is the picker prerequisite

**Scale/Scope**: Demo/seed org size for MVP; one admin screen (`/admin/projects`); five §12.4 endpoints; shared project contract consumed by API and admin in one delivery

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **GENERAL_SPEC** + this feature’s FR-017 until a real constitution is adopted.

| Gate | Status | Notes |
| ---- | ------ | ----- |
| Shared contracts in `packages/contracts/` for API + admin | PASS | List/get/create/update/remove designed in Phase 1 `contracts/` |
| Same-phase FE + BE (no FE-only or BE-only ship) | PASS | Plan and quickstart require contract + API + admin together |
| Soft-delete + pagination conventions (§6.4, §6.6, §6.7, §6.10, §8.3) | PASS | Documented in research + data-model; DELETE → 204 + `deleted_at` |
| VAL-22 / VAL-23 (§9.3); 400 vs 422 (§6.6) | PASS | Missing name 400 VAL-22; unusable client 422 VAL-23 |
| Admin-only Projects (§7.2, §11.2); employees denied | PASS | JwtGuard + RolesGuard from KAN-39 |
| Historical names + picker hide (§8.3 / ADR-15) | PASS | Picker `/me/assignments`; history via stored Project row + TimeEntry join |
| No cascade to tasks on deactivate/remove | PASS | Encoded in data-model state transitions |
| No unjustified new packages/services | PASS | Reuse Project/Client models, projects module, DataTable, CrudModal, Clients list for picker |
| Test-first / coverage discipline (§14) | PASS | Contract + integration + UI state tests in quickstart |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate | Status | Notes |
| ---- | ------ | ----- |
| Shared contracts designed | PASS | `contracts/projects.md` → `@abra/contracts` |
| Same-phase validation path | PASS | `quickstart.md` requires contract + API + admin |
| Soft-delete / VAL ids / no cascade | PASS | Encoded in `research.md` + `data-model.md` + contract |
| No unjustified complexity | PASS | Complexity Tracking empty; reuses Project model, Clients picker, monorepo layout |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-projects-crud/
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
│   ├── index.ts                 # VAL-22 / VAL-23 already in VAL_MESSAGES; export project schemas
│   └── projects/
│       ├── list.ts              # query + ProjectListItem (incl. isDeleted, clientName sort)
│       ├── create.ts            # CreateProjectBody + ProjectCreateSuccess
│       └── update.ts            # UpdateProjectBody + ProjectUpdateSuccess

server/api/
├── prisma/schema.prisma         # Project + Client (unchanged)
└── src/modules/projects/
    ├── projects.controller.ts   # GET list, GET :id, POST, PATCH, DELETE
    ├── projects.service.ts      # list/join clientName, VAL-23, no cascade
    └── *.spec.ts                # integration: 201/400/422/204, picker hide, no cascade

apps/admin/src/
├── components/ui/data-table.tsx # existing
├── components/ui/crud-modal.tsx # existing
├── features/projects/
│   ├── projects-page.tsx        # catalog, filters, include-removed, stay-on-page refresh
│   ├── projects-columns.tsx     # name, client name, status; sort including clientName
│   ├── project-create-form.tsx  # שם הפרויקט, שם הלקוח, צור פרויקט
│   └── project-edit-modal.tsx   # keep current client if later deactivated
└── lib/api/client.ts            # reuse apiFetch (401 → sign-in)
```

**Structure Decision**: Monorepo web app — shared Zod project contract, Nest projects module, admin Projects feature on existing DataTable/CrudModal. Matches GENERAL_SPEC §3 / §10.2 / §11.2; no new top-level apps.

## Complexity Tracking

> No constitution violations requiring justification.
