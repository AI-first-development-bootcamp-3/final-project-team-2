# Implementation Plan: Admin Create User

**Branch**: `003-admin-create-user` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-admin-create-user/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver Jira KAN-46 (Epic KAN-43): admin-only create-person from the Users screen — Hebrew RTL modal collecting full name, email, initial password, and role (רגיל / אדמין). `POST /api/v1/users` creates an active person with a bcrypt-hashed secret that is never returned; email is trimmed and stored lowercase and unique among non-deleted people. On success the form closes and the current directory page refreshes in place. Frontend and backend ship in the **same phase**. Approach: shared Zod create contract in `@abra/contracts`, NestJS create on the existing users module, first shared `CrudModal` on `/admin/users`, bcrypt hashing already used by seed.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22

**Primary Dependencies**: NestJS 10 (API), Prisma 6, Zod 3 (`@abra/contracts`), bcrypt 6, React 18 + Vite 6 + Tailwind 3 (admin)

**Storage**: PostgreSQL 16 via Prisma; existing `User` model (`full_name`, `email`, `role`, `is_active`, `deleted_at`, `password_hash`, `token_version`) — no schema migration. Partial unique index `users_email_unique` on `email` where `deleted_at IS NULL`.

**Testing**: Vitest (contracts + API + admin), Nest integration tests for create endpoint, React Testing Library for create modal states; CI 70% coverage gate (GENERAL_SPEC §14.1)

**Target Platform**: Web — NestJS API (`/api/v1`) + admin console (Vite SPA)

**Project Type**: Monorepo web application (API + admin console + shared contracts)

**Performance Goals**: Create p95 under 500ms (GENERAL_SPEC §13.1); bcrypt cost matches seed (`SALT_ROUNDS = 10`)

**Constraints**: Admin-only; never return or log password material; Hebrew RTL; same-phase FE+BE (FR-013); no edit / reset-password / deactivate (FR-014); no extra HR fields (FR-015); auth/login owned by KAN-39; directory list owned by KAN-45

**Scale/Scope**: Demo/seed org size for MVP; one create endpoint; one Users create modal; shared `CrudModal` foundation reused by later admin create/edit screens

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Project `.specify/memory/constitution.md` is still a template (not ratified). Gates below are taken from **GENERAL_SPEC** + this feature’s FR-013 until a real constitution is adopted.

| Gate                                                                   | Status | Notes                                                                                                              |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Shared contracts in `packages/contracts/` for API + admin              | PASS   | Create request + created-person + envelopes designed in Phase 1 `contracts/`                                       |
| Same-phase FE + BE (no FE-only or BE-only ship)                        | PASS   | Plan and quickstart require contract + API + admin together                                                        |
| Secrets never in responses or logs (§13.2)                             | PASS   | Hash only; DTO reuses public list fields                                                                           |
| Admin-only create (§5.2, §7.2); employees denied                       | PASS   | Same JwtGuard + RolesGuard as list                                                                                 |
| Unique email among non-deleted (§4.1 / VAL-11); 409 on conflict (§6.6) | PASS   | Partial unique index + service mapping                                                                             |
| 201 on create; 400 with VAL ids (§6.5 / §6.6 / §9.2)                   | PASS   | Encoded in research + contract                                                                                     |
| No force-change-on-first-login (§5.2 / ADR-16)                         | PASS   | Create does not set a must-change flag (none exists)                                                               |
| Test-first / coverage discipline (§14)                                 | PASS   | Contract + integration + UI state tests in quickstart                                                              |
| No unjustified new packages/services                                   | PASS   | Reuse User model, users module, bcrypt from seed, introduce CrudModal as first consumer (like DataTable in KAN-45) |

**Gate result**: PASS — proceed to Phase 0 / Phase 1.

### Post-design re-check (after Phase 1)

| Gate                           | Status | Notes                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------- |
| Shared contracts designed      | PASS   | `contracts/users-create.md` → `@abra/contracts`                           |
| Same-phase validation path     | PASS   | `quickstart.md` requires contract + API + admin                           |
| Secrets / uniqueness / VAL ids | PASS   | Encoded in `research.md` + `data-model.md` + contract                     |
| No unjustified complexity      | PASS   | Complexity Tracking empty; reuses User model, list item DTO, users module |

**Post-design gate result**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-create-user/
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
│   ├── index.ts                 # extend VAL_MESSAGES + create exports
│   ├── common/api-error.ts      # map create-field VAL ids in details
│   └── users/create.ts          # NEW: CreateUserBody + UserCreateSuccess

server/api/
├── prisma/schema.prisma         # User model (unchanged)
└── src/modules/users/
    ├── users.controller.ts      # ADD POST /
    ├── users.service.ts         # ADD create (hash, normalize email, 409)
    └── users.controller.spec.ts # ADD create cases

apps/admin/src/
├── components/ui/crud-modal.tsx # NEW: first shared CrudModal (create mode)
├── features/users/
│   ├── users-page.tsx           # open modal, refresh current page on success
│   └── users-create-form.tsx    # NEW: four-field Hebrew form
└── lib/api/client.ts            # reuse apiFetch (401 → sign-in already)
```

**Structure Decision**: Monorepo web app — shared Zod create contract, Nest create on the existing users module, admin Users create form + shared CrudModal. Matches GENERAL_SPEC §3 / §10.2; no new top-level apps.

## Complexity Tracking

> No constitution violations requiring justification.
