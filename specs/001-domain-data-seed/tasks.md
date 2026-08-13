# Tasks: Domain Data Model and Demo Seed

**Input**: Design documents from `/specs/001-domain-data-seed/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Optional — not explicitly requested in the feature spec; validation via Independent Test criteria and quickstart.md. Automated Jest/Postgres tests can be added later if the team wants TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- API / Prisma: `server/api/`
- Shared enums: `packages/contracts/`
- Feature docs: `specs/001-domain-data-seed/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and scaffolding so Prisma + contracts can be authored

- [ ] T001 Add Prisma Client, bcrypt, and `@types/bcrypt` dependencies to `server/api/package.json` and wire `prisma.seed` to `prisma/seed.ts`
- [ ] T002 [P] Create `server/api/prisma/` directory with empty placeholder `server/api/prisma/schema.prisma` (generator + PostgreSQL datasource using `DATABASE_URL` only)
- [ ] T003 [P] Add `.env.example` under `server/api/` documenting `DATABASE_URL` for local Postgres
- [ ] T004 [P] Add domain enum modules in `packages/contracts/src/` for `UserRole`, `WorkLocation`, `AbsenceType`, `HalfDayPeriod`, `TaskStatus`, and `AuditAction` (Zod), and re-export from `packages/contracts/src/index.ts`

**Checkpoint**: Dependencies and package layout ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete blueprint schema that ALL user stories depend on — MUST finish before US1–US3

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement full Prisma models and enums in `server/api/prisma/schema.prisma` per `specs/001-domain-data-seed/data-model.md` and `contracts/schema-entities.md` (User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, AbsenceAttachment, MonthLock, AuditLog; soft-delete only where required; TaskAssignment unique `(userId, taskId)`; MonthLock unique `(year, month)`)
- [ ] T006 [P] Create stable demo identity constants in `server/api/prisma/demo-ids.ts` (fixed UUIDs for demo clients/projects/tasks/users and stable demo emails) for wipe-safe seeding
- [ ] T007 Create stub `server/api/prisma/seed.ts` that connects with PrismaClient and exits with a clear “seed not implemented” message (so `prisma db seed` is wired before US2)
- [ ] T008 Add npm/pnpm scripts in `server/api/package.json` for `prisma:generate`, `prisma:migrate`, and `prisma:seed` wrapping Prisma CLI commands from `contracts/seed-command.md`

**Checkpoint**: Foundation ready — schema defined; migrate/seed scripts exist; user stories can start

---

## Phase 3: User Story 1 - Apply domain schema on a fresh database (Priority: P1) 🎯 MVP

**Goal**: First committed migration applies cleanly on an empty database and creates all blueprint structures with correct soft-delete / append-only rules

**Independent Test**: On a fresh empty database, run the first schema application once and verify it completes without errors and that all required domain entities (with soft-delete distinction where applicable) are present and usable

### Implementation for User Story 1

- [ ] T009 [US1] Generate and commit the first Prisma migration under `server/api/prisma/migrations/` from `server/api/prisma/schema.prisma` (empty-DB baseline)
- [ ] T010 [US1] Document migrate-on-empty-DB steps in `specs/001-domain-data-seed/quickstart.md` (replace placeholders with real script names from T008)
- [ ] T011 [US1] Verify migration against `contracts/schema-entities.md` (all 10 models present; `deletedAt` only on User/Client/Project/Task/TimeEntry/Absence; constraints for TaskAssignment and MonthLock) using `pnpm exec prisma migrate deploy` on an empty DB from `server/api/`

**Checkpoint**: User Story 1 fully functional — empty DB → migrate → schema inventory passes

---

## Phase 4: User Story 2 - Seed a demo organization for local development (Priority: P1)

**Goal**: After schema apply, seed creates the demo org (credentials, projects/tasks/assignments, full + partial weeks, absence, locked past month) with fail-fast if schema is missing

**Independent Test**: After schema application, run the seed and verify minimum counts/relationships in `contracts/demo-org.md`; confirm frontends could use this data without admin CRUD

### Implementation for User Story 2

- [ ] T012 [US2] Implement schema-presence fail-fast at the start of `server/api/prisma/seed.ts` (FR-011 / SC-007): if required tables/migrations are missing, exit non-zero with a clear error and create no rows
- [ ] T013 [US2] Implement demo user creation in `server/api/prisma/seed.ts` using `server/api/prisma/demo-ids.ts`: 1 admin + 2 employees with bcrypt-hashed passwords and stable emails (FR-004, FR-009)
- [ ] T014 [US2] Implement demo Client (2), Project (3), Task (≥1 per project, open), and TaskAssignment graph in `server/api/prisma/seed.ts` linking employees to tasks in each project (FR-005)
- [ ] T015 [US2] Implement time entries in `server/api/prisma/seed.ts`: Employee A Sun–Thu × 9h completed entries; Employee B partial week in same Sunday-start week context (FR-006); no running timers
- [ ] T016 [US2] Implement Absence sample for the partial employee and MonthLock samples in `server/api/prisma/seed.ts`: demo week month left open; one locked MonthLock for a different past month locked by demo admin; no AuditLog or AbsenceAttachment rows (FR-010)
- [ ] T017 [US2] Fill demo credential table in `specs/001-domain-data-seed/quickstart.md` with the stable emails/passwords from `server/api/prisma/demo-ids.ts` / seed constants

**Checkpoint**: User Stories 1 and 2 work — migrate then seed yields a usable demo org

---

## Phase 5: User Story 3 - Safely reset local demo data (Priority: P2)

**Goal**: Re-running seed wipes and recreates only demo-org data (stable IDs/emails) and never deletes non-demo/customer rows; recovers from partial seed failures

**Independent Test**: Run seed twice (optionally with an extra non-demo row present) and verify demo org matches minimums while non-demo data remains intact

### Implementation for User Story 3

- [ ] T018 [US3] Implement demo-graph wipe in `server/api/prisma/seed.ts` (delete by `demo-ids.ts` keys / stable emails, children-first) before recreate so re-seed restores SC-002 without touching non-demo IDs (FR-008 / SC-005)
- [ ] T019 [US3] Ensure partial-failure recovery path in `server/api/prisma/seed.ts`: a second seed run after interrupted first run completes wipe+recreate to a full usable demo org
- [ ] T020 [US3] Document re-seed and non-demo survival validation steps in `specs/001-domain-data-seed/quickstart.md` (User Story 3 section)

**Checkpoint**: All user stories independently functional — schema, first seed, and safe re-seed

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Alignment and end-to-end validation across stories

- [ ] T021 [P] Align Prisma enum value names in `server/api/prisma/schema.prisma` with Zod enums in `packages/contracts/src/` (same string literals as GENERAL_SPEC §2)
- [ ] T022 [P] Update `specs/001-domain-data-seed/contracts/demo-org.md` if any stable email/UUID choices differ from initial placeholders
- [ ] T023 Run full `specs/001-domain-data-seed/quickstart.md` validation path (empty DB → migrate → seed → re-seed → seed-before-migrate fail-fast) from `server/api/`
- [ ] T024 [P] Add a short “Prisma / seed” note to repo developer docs if a root or `server/api` README exists; otherwise add `server/api/README.md` with migrate + seed commands only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP (schema/migration)
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 migration applied (seed needs tables)
- **User Story 3 (Phase 5)**: Depends on US2 seed create path (extends same `seed.ts` with wipe)
- **Polish (Phase 6)**: Depends on US1–US3 complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependency on US2/US3
- **User Story 2 (P1)**: After US1 migration exists/applies — independently testable with migrate + seed once
- **User Story 3 (P2)**: After US2 create-seed works — independently testable with double seed + non-demo row

### Within Each User Story

- Schema/migration before seed
- Demo constants before seed writes
- Create path (US2) before wipe path (US3)
- Story complete before moving to next priority when staffing is sequential

### Parallel Opportunities

- T002, T003, T004 in Setup can run in parallel
- T006 parallel with T005 completion handoff (after schema field names known) or after T005
- T021, T022, T024 in Polish can run in parallel
- US1 can finish while another teammate drafts seed helpers, but seed must not run until migration exists

---

## Parallel Example: Setup + Foundational

```bash
# After T001:
Task: "Create server/api/prisma/schema.prisma placeholder (T002)"
Task: "Add server/api/.env.example (T003)"
Task: "Add packages/contracts domain enums (T004)"

# After Setup:
Task: "Implement full schema.prisma (T005)"
Task: "Create demo-ids.ts (T006)"  # can start once UUID strategy agreed
```

## Parallel Example: User Story 2 (sequential within seed file)

```bash
# Same file seed.ts — run in order, not parallel:
Task: "Fail-fast schema check (T012)"
Task: "Demo users (T013)"
Task: "Clients/projects/tasks/assignments (T014)"
Task: "Time entries (T015)"
Task: "Absence + MonthLock (T016)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup  
2. Complete Phase 2: Foundational  
3. Complete Phase 3: User Story 1 (first migration)  
4. **STOP and VALIDATE**: empty DB → `migrate deploy` → schema inventory  
5. Demo schema readiness even before seed exists  

### Incremental Delivery

1. Setup + Foundational → schema ready to migrate  
2. US1 → committed migration applies on empty DB (MVP)  
3. US2 → first-time demo seed + fail-fast  
4. US3 → safe demo-only wipe/recreate  
5. Polish → quickstart end-to-end  

### Parallel Team Strategy

1. Together: Setup + Foundational  
2. Dev A: US1 migration  
3. Dev B: draft `demo-ids.ts` + seed create modules (merge after US1)  
4. Either: US3 wipe logic after US2 create path merges  

---

## Notes

- [P] = different files, no incomplete-task dependencies  
- [US1]/[US2]/[US3] map to spec user stories  
- Do not soft-delete AuditLog / TaskAssignment / MonthLock  
- Seed must never wipe non-demo IDs  
- Commit after each task or logical group  
- Avoid implementing Nest CRUD/auth modules in this feature  
