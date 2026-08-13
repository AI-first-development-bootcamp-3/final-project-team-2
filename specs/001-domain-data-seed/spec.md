# Feature Specification: Domain Data Model and Demo Seed

**Feature Branch**: `001-domain-data-seed`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Jira: KAN-32 (Epic KAN-29 — Setup & Infrastructure). Domain data model + first schema migration + demo-org seed so local development has realistic data before any admin CRUD exists."

## Clarifications

### Session 2026-08-13

- Q: When a teammate runs the demo seed again on a database that already has demo data, what should happen? → A: Wipe and recreate demo-org data only (never delete non-demo / customer data), then seed fresh to the required minimums

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Apply domain schema on a fresh database (Priority: P1)

A teammate starts with an empty local database and applies the first committed schema change set. After it completes, the database contains all blueprint domain structures needed for the product (users, clients, projects, tasks, assignments, time entries, absences, month locks, and audit records), including soft-delete support on every entity.

**Why this priority**: Without a stable domain schema, neither seed data nor later product work can proceed. This is the foundation for the epic’s “working local system” definition of done.

**Independent Test**: On a fresh empty database, run the first schema application once and verify it completes without errors and that all required domain entities (with soft-delete distinction) are present and usable.

**Acceptance Scenarios**:

1. **Given** an empty fresh database, **When** the first schema change set is applied, **Then** it completes successfully with no errors.
2. **Given** the schema has been applied, **When** a teammate inspects the domain model, **Then** User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, MonthLock, and AuditLog are all available.
3. **Given** the schema has been applied, **When** a record is marked deleted versus left active, **Then** the system can distinguish soft-deleted records from active ones for every entity above.

---

### User Story 2 - Seed a demo organization for local development (Priority: P1)

A teammate runs the demo seed after the schema is in place and gets a realistic organization: one admin, two employees, two clients, three projects with tasks and assignments, and one fully reported week of time entries. Frontends can then build against this data before any admin CRUD exists.

**Why this priority**: The seed unblocks parallel frontend work and satisfies the epic requirement that local bring-up includes usable demo data.

**Independent Test**: After schema application, run the seed and verify the exact minimum counts and relationships; confirm both employee and admin frontends can read/use the seeded demo data without needing admin create/update/delete flows.

**Acceptance Scenarios**:

1. **Given** a database with the domain schema applied and no demo data yet, **When** the seed is run, **Then** it creates at least 1 admin user, 2 employee users, 2 clients, and 3 projects.
2. **Given** the seed has completed, **When** a teammate inspects each of the 3 projects, **Then** each project has tasks and task assignments linking employees to that work.
3. **Given** the seed has completed, **When** a teammate inspects time reporting data, **Then** there is one fully reported week of time entries suitable for timesheet/reporting UI development.
4. **Given** the seed has completed, **When** either frontend develops against the local system, **Then** it can use the seeded demo organization without waiting for admin CRUD features.

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

- What happens when the first schema application is attempted on a database that is not empty or already partially applied?
- How does the system behave if seed is run before the schema has been applied?
- If seed fails halfway through (partial demo org), a subsequent seed run MUST recover by wiping remaining demo-org data and recreating a complete usable demo org (non-demo data untouched).
- How are soft-deleted seeded records treated relative to active demo records (seed should create active usable records by default)?
- What credentials or identity details does the seed provide for local demo use without implementing full product auth flows?
- Seed wipe/recreate MUST target only identifiable demo-org records; it MUST NOT delete real customer or other non-demo data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist the blueprint domain entities: User, Client, Project, Task, TaskAssignment, TimeEntry, Absence, MonthLock, and AuditLog.
- **FR-002**: System MUST support soft-delete for every entity in FR-001 so deleted records are distinguishable from active records.
- **FR-003**: System MUST provide a first committed schema change set that applies cleanly to a fresh empty database.
- **FR-004**: System MUST provide a seed that creates a demo organization with at least: 1 admin user, 2 employee users, 2 clients, and 3 projects.
- **FR-005**: System MUST ensure each of the 3 seeded projects includes tasks and task assignments.
- **FR-006**: System MUST seed one fully reported week of time entries usable for timesheet/reporting UI development.
- **FR-007**: After schema application and seed, both employee and admin frontends MUST be able to develop against the seeded data without requiring admin CRUD features.
- **FR-008**: Seed MUST be safely re-runnable for local reset by wiping and recreating only demo-org data to the required minimums; it MUST NOT delete non-demo / customer data.
- **FR-009**: Seed MAY include minimal local demo credentials/identities needed for development use, but MUST NOT depend on full product authentication or login feature delivery.

### Key Entities

- **User**: A person in the system with a role such as admin or employee; can be soft-deleted.
- **Client**: An external customer organization the company works for; can be soft-deleted.
- **Project**: Work for a client; belongs to a client; can be soft-deleted.
- **Task**: A unit of work within a project; can be soft-deleted.
- **TaskAssignment**: Links a user (typically an employee) to a task/project for work ownership; can be soft-deleted.
- **TimeEntry**: Reported time against assigned work for a given day/period; used to form a fully reported week in the demo seed; can be soft-deleted.
- **Absence**: A recorded period when a user is not available for work; can be soft-deleted.
- **MonthLock**: A control that marks a reporting month as locked (no further changes expected); can be soft-deleted.
- **AuditLog**: A record of significant changes for traceability; can be soft-deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh empty database, the first schema application completes successfully 100% of the time in a clean local environment (no manual schema fixes required).
- **SC-002**: After seed, the demo organization always includes at least 1 admin, 2 employees, 2 clients, 3 projects with tasks and assignments, and 1 fully reported week of time entries.
- **SC-003**: 100% of the required domain entities support distinguishing soft-deleted records from active records.
- **SC-004**: A teammate can go from empty database to usable seeded demo data in under 5 minutes (schema apply + seed), enabling frontend work without admin CRUD.
- **SC-005**: Re-running seed for local reset wipes and recreates only demo-org data so the demo organization matches SC-002 without manual repair and without deleting non-demo / customer data.
- **SC-006**: Both employee and admin frontend developers can begin feature UI work against seeded data before any admin create/update/delete product flows exist.

## Assumptions

- This work is part of Epic KAN-29 (Setup & Infrastructure) and tracks Jira KAN-32; detailed stack choices (API, ORM, database engine) are already decided at the epic level and will be handled in planning/implementation, not as product requirements here.
- Monorepo scaffolding (KAN-30) is already done; Docker compose (KAN-31), CI/CD, e2e, docs (KAN-33–36) are out of scope for this feature.
- Product features and admin CRUD APIs are out of scope; the seed is the temporary unblocker for parallel frontend development.
- Full product authentication/login flows are out of scope beyond whatever minimal demo identities/credentials the seed needs for local use.
- Seed re-runnability means wipe-and-recreate of identifiable demo-org data only (never customer/non-demo data), restoring a known good demo state; how demo records are marked/identified is a planning/implementation detail.
- Soft-deleted records remain stored but are distinguishable from active ones; seed creates active usable demo records by default.
- “Fully reported week” means a contiguous work week where the relevant employee time entries cover the expected reporting days for demo timesheet/reporting UI.
- Frontends “developing against seeded data” means the seeded records exist in the shared local database in the shapes later APIs will expose; this feature does not itself deliver product CRUD endpoints.
