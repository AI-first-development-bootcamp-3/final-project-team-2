# Feature Specification: Domain Data Model and Demo Seed

**Feature Branch**: `001-domain-data-seed`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Jira: KAN-32 (Epic KAN-29 — Setup & Infrastructure). Domain data model + first schema migration + demo-org seed so local development has realistic data before any admin CRUD exists."

## Clarifications

### Session 2026-08-13

- Q: When a teammate runs the demo seed again on a database that already has demo data, what should happen? → A: Wipe and recreate demo-org data only (never delete non-demo / customer data), then seed fresh to the required minimums
- Resolved from `docs/GENERAL_SPEC.md` (authoritative domain blueprint for this feature): soft-delete via `deleted_at` applies to User, Client, Project, Task, TimeEntry, and Absence only; TaskAssignment has no soft-delete; MonthLock uses lock/unlock state (not soft-delete); AuditLog is append-only (no updates/deletes). TaskAssignment links User → Task (unique per user+task). Week starts Sunday (Israeli); a “full” reporting day targets 9 hours. Demo Users require email + password (stored hashed) for local login readiness. AbsenceAttachment is part of the blueprint data model alongside Absence.
- Q: Besides the required demo users, clients, projects, tasks, assignments, and fully reported week, which extra sample rows should the seed create? → A: Seed Absence + MonthLock samples only; skip AuditLog and AbsenceAttachment rows/files in seed
- Q: Should the seeded MonthLock sample leave the demo reporting month open or locked? → A: Demo week’s month open; plus one locked MonthLock for a different past month
- Q: Who should receive the seeded fully reported week of time entries? → A: Fully reported week for one employee; other employee has partial entries + the Absence sample
- Q: If someone runs the demo seed before the schema has been applied, what should happen? → A: Fail fast with a clear error; create no demo data

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply domain schema on a fresh database (Priority: P1)

A teammate starts with an empty local database and applies the first committed schema change set. After it completes, the database contains all blueprint domain structures needed for the product (users, clients, projects, tasks, assignments, time entries, absences and attachments, month locks, and audit records), with soft-delete support on entities that use it per the system data model.

**Why this priority**: Without a stable domain schema, neither seed data nor later product work can proceed. This is the foundation for the epic’s “working local system” definition of done.

**Independent Test**: On a fresh empty database, run the first schema application once and verify it completes without errors and that all required domain entities (with soft-delete distinction where applicable) are present and usable.

**Acceptance Scenarios**:

1. **Given** an empty fresh database, **When** the first schema change set is applied, **Then** it completes successfully with no errors.
2. **Given** the schema has been applied, **When** a teammate inspects the domain model, **Then** User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, AbsenceAttachment, MonthLock, and AuditLog are all available.
3. **Given** the schema has been applied, **When** a soft-deletable record is marked deleted versus left active, **Then** the system can distinguish soft-deleted records from active ones for User, Client, Project, Task, TimeEntry, and Absence.

---

### User Story 2 - Seed a demo organization for local development (Priority: P1)

A teammate runs the demo seed after the schema is in place and gets a realistic organization: one admin, two employees (each with known local demo login identity), two clients, three projects with tasks and assignments, one fully reported week of time entries for one employee in an open month, partial time entries plus the Absence sample for the other employee, and a locked MonthLock for a different past month. AuditLog and AbsenceAttachment rows are not required in seed. Frontends can then build against this data before any admin CRUD exists.

**Why this priority**: The seed unblocks parallel frontend work and satisfies the epic requirement that local bring-up includes usable demo data.

**Independent Test**: After schema application, run the seed and verify the exact minimum counts and relationships; confirm both employee and admin frontends can read/use the seeded demo data without needing admin create/update/delete flows.

**Acceptance Scenarios**:

1. **Given** a database with the domain schema applied and no demo data yet, **When** the seed is run, **Then** it creates at least 1 admin user, 2 employee users, 2 clients, and 3 projects, including known demo emails/passwords for those users.
2. **Given** the seed has completed, **When** a teammate inspects each of the 3 projects, **Then** each project has tasks and task assignments linking employees to tasks in that project.
3. **Given** the seed has completed, **When** a teammate inspects time reporting data, **Then** one employee has a fully reported week of completed time entries (Sunday-start week; reporting days filled to the 9-hour full-day target) and the other employee has a partial (not full) set of time entries in that same week context.
4. **Given** the seed has completed, **When** a teammate inspects absence and month-lock data, **Then** the Absence sample belongs to the employee with partial time entries, the month containing the fully reported week is open (no locked MonthLock for that month), and a separate locked MonthLock exists for a different past month; AuditLog and AbsenceAttachment seed rows are not required.
5. **Given** the seed has completed, **When** either frontend develops against the local system, **Then** it can use the seeded demo organization without waiting for admin CRUD features.

---

### User Story 3 - Safely reset local demo data (Priority: P2)

A teammate needs to reset their local environment. They can re-run the seed safely so the demo organization is wiped and recreated to a known good state without leaving the database broken or duplicated-unusable, and without deleting any non-demo / customer data.

**Why this priority**: Local reset is important for day-to-day development, but secondary to first-time schema + seed succeeding.

**Independent Test**: Run the seed twice in a row (or run seed after an intentional local reset) and verify the demo org remains usable with the required minimum counts and relationships, while any non-demo records that were present remain intact.

**Acceptance Scenarios**:

1. **Given** a database that already contains demo seed data, **When** the seed is run again, **Then** prior demo-org data is removed and recreated so the demo organization matches the minimum seed requirements.
2. **Given** a database that also contains non-demo (e.g. customer-like) records alongside demo data, **When** the seed is run again, **Then** only demo-org data is wiped/recreated and non-demo records remain unchanged.
3. **Given** a teammate wants a clean local demo, **When** they re-apply seed after reset, **Then** they can continue frontend development against the known demo org without manual data cleanup.

---

### Edge Cases

- First schema application on a non-empty or partially applied database: deferred to planning (migration tooling / failure messaging); this feature’s acceptance remains “applies cleanly to a fresh empty database” (FR-003 / SC-001).
- If seed is run before the schema has been applied, the seed MUST fail fast with a clear error and MUST NOT create any demo data.
- If seed fails halfway through (partial demo org), a subsequent seed run MUST recover by wiping remaining demo-org data and recreating a complete usable demo org (non-demo data untouched).
- Soft-deleted seeded records vs active demo records: seed creates active usable records by default (`deleted_at` null; User/Client/Project `is_active` true; Task status open).
- Seed MUST provide known local demo emails and passwords for the admin and employee users (password stored hashed); full product auth/login feature delivery remains out of scope.
- Seed wipe/recreate MUST target only identifiable demo-org records; it MUST NOT delete real customer or other non-demo data.
- AuditLog is append-only in product behavior; any local demo wipe that removes demo-linked audit rows is a seed-reset exception only and MUST NOT imply product support for deleting audit history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist the blueprint domain entities from the system data model: User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, AbsenceAttachment, MonthLock, and AuditLog.
- **FR-002**: System MUST support soft-delete (`deleted_at` distinguishable from active) for User, Client, Project, Task, TimeEntry, and Absence. TaskAssignment MUST NOT use soft-delete. MonthLock MUST use lock/unlock state (not soft-delete). AuditLog MUST be append-only (no updates or deletes in product behavior).
- **FR-003**: System MUST provide a first committed schema change set that applies cleanly to a fresh empty database.
- **FR-004**: System MUST provide a seed that creates a demo organization with at least: 1 admin user, 2 employee users, 2 clients, and 3 projects, each user having a known demo email and password (stored hashed).
- **FR-005**: System MUST ensure each of the 3 seeded projects includes tasks and TaskAssignments linking employees to those tasks (unique user+task).
- **FR-006**: System MUST seed one fully reported week of completed time entries for exactly one employee (Sunday-start week; reporting days filled to the 9-hour full-day target) and MUST seed a partial (not full) set of time entries for the other employee in the same week context, usable for timesheet/reporting UI development.
- **FR-007**: After schema application and seed, both employee and admin frontends MUST be able to develop against the seeded data without requiring admin CRUD features.
- **FR-008**: Seed MUST be safely re-runnable for local reset by wiping and recreating only demo-org data to the required minimums; it MUST NOT delete non-demo / customer data.
- **FR-009**: Seed MUST include minimal local demo credentials/identities (email + password) for the seeded admin and employees, but MUST NOT depend on full product authentication or login feature delivery beyond storing those identities for later auth work.
- **FR-010**: Seed MUST include at least one Absence sample belonging to the employee with partial time entries. Seed MUST leave the month containing the fully reported week open, and MUST also include one locked MonthLock for a different past month. Seed MUST NOT require AuditLog or AbsenceAttachment sample rows/files.
- **FR-011**: If seed is run before the domain schema has been applied, the operation MUST fail fast with a clear error and MUST NOT create any demo data.

### Key Entities

- **User**: Person with role `employee` or `admin`; unique email among active users; soft-deletable; also has active/inactive status.
- **Client**: External customer organization; soft-deletable; active/inactive status.
- **Project**: Work for a client; belongs to one Client; soft-deletable; active/inactive status.
- **Task**: Unit of work within a Project; status open or closed; soft-deletable.
- **TaskAssignment**: Links a User to a Task; unique per (user, task); not soft-deleted.
- **TimeEntry**: Reported time for a User against a Task (completed entries have start and end; running timers are out of scope for seed); soft-deletable.
- **Absence**: Period when a User is unavailable (type vacation/sick/military/other; Fri/Sat excluded from ranges); soft-deletable.
- **AbsenceAttachment**: File metadata attached to an Absence (for sick/military evidence); belongs to Absence.
- **MonthLock**: One lock control per (year, month); locked/unlocked with actor timestamps; not soft-deleted.
- **AuditLog**: Append-only trace of significant changes (actor, action, entity, before/after); no soft-delete; admin-visible in product.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh empty database, the first schema application completes successfully 100% of the time in a clean local environment (no manual schema fixes required).
- **SC-002**: After seed, the demo organization always includes at least 1 admin, 2 employees (with known demo credentials), 2 clients, 3 projects with tasks and assignments, 1 fully reported week for one employee (in an open month), partial time entries for the other employee, 1 Absence sample on the partial employee, and 1 locked MonthLock for a different past month (AuditLog and AbsenceAttachment seed rows not required).
- **SC-003**: 100% of soft-deletable entities (User, Client, Project, Task, TimeEntry, Absence) support distinguishing soft-deleted records from active records; AuditLog remains append-only; TaskAssignment and MonthLock follow their non-soft-delete rules.
- **SC-004**: A teammate can go from empty database to usable seeded demo data in under 5 minutes (schema apply + seed), enabling frontend work without admin CRUD.
- **SC-005**: Re-running seed for local reset wipes and recreates only demo-org data so the demo organization matches SC-002 without manual repair and without deleting non-demo / customer data.
- **SC-006**: Both employee and admin frontend developers can begin feature UI work against seeded data before any admin create/update/delete product flows exist.
- **SC-007**: Running seed before schema application fails with a clear error and leaves no demo-org data behind.

## Assumptions

- This work is part of Epic KAN-29 (Setup & Infrastructure) and tracks Jira KAN-32; `docs/GENERAL_SPEC.md` is the authoritative domain blueprint when it is more specific than the Jira ticket wording (e.g. soft-delete scope, relationships, week/time semantics). Detailed stack choices remain planning/implementation concerns.
- Monorepo scaffolding (KAN-30) is already done; Docker compose (KAN-31), CI/CD, e2e, docs (KAN-33–36) are out of scope for this feature.
- Product features and admin CRUD APIs are out of scope; the seed is the temporary unblocker for parallel frontend development.
- Full product authentication/login flows are out of scope beyond seeding demo emails/passwords (hashed) so later auth work and frontends have stable identities.
- Seed re-runnability means wipe-and-recreate of identifiable demo-org data only (never customer/non-demo data), restoring a known good demo state; how demo records are marked/identified is a planning/implementation detail.
- Soft-deleted records remain stored but are distinguishable from active ones; seed creates active usable demo records by default.
- “Fully reported week” means one Sunday-start work week where exactly one employee has completed time entries covering the expected reporting days at the 9-hour full-day target; the other employee has partial entries in that week context plus the Absence sample (per GENERAL_SPEC day-status rules), suitable for timesheet/reporting UI.
- Frontends “developing against seeded data” means the seeded records exist in the shared local database in the shapes later APIs will expose; this feature does not itself deliver product CRUD endpoints.
- AbsenceAttachment schema is in scope for the first blueprint change set; seed does not create AbsenceAttachment rows/files. AuditLog table exists after schema apply but seed does not create audit sample rows.
