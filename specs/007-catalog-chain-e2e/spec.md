# Feature Specification: Full Catalog Chain E2E

**Feature Branch**: `007-catalog-chain-e2e`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Jira KAN-54 (Epic KAN-44 — Entity Management). Playwright e2e: full catalog chain. Acceptance: (1) admin creates client → project under it → task under that → assigns an employee — all via the console UI; (2) the assigned employee's picker data now contains exactly that chain; (3) runs in CI as part of the required e2e check. Confluence Epic 4 spec and Figma time-report file provided as context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prove the catalog chain in the admin console (Priority: P1)

A teammate (or the required quality gate) walks the Epic 4 happy path as a real admin would: an admin signs into the admin console, creates a new client, creates a project under that client, creates a task under that project, then assigns an employee to that task — each of those four steps on the console screens an operator uses, not a hidden shortcut. After each step the new row is visible in its catalog (the client on Clients, the project on Projects with that client, the task on Tasks with that project, the assignment on Assignments with that employee and task).

**Why this priority**: This is the first KAN-54 acceptance criterion and the Epic 4 definition of done for the catalog. Separate checks on Clients, Projects, Tasks, or Assignments alone do not prove an admin can build the whole chain in the console.

**Independent Test**: Sign in as an admin against a fresh demo organization, create a uniquely named client, project, task, and assignment through the console, and confirm each appears in its catalog with the parent names matching.

**Acceptance Scenarios**:

1. **Given** a known admin can sign in to the admin console, **When** they sign in, **Then** they reach the authenticated console (not the admin sign-in screen).
2. **Given** the admin is in the console, **When** they open Clients and create a new client with a unique name, **Then** create succeeds and that client appears in the Clients catalog as active.
3. **Given** that client exists, **When** they open Projects and create a project whose parent is that client, **Then** create succeeds and the Projects catalog shows the project under that client as active.
4. **Given** that project exists, **When** they open Tasks and create a task whose parent is that project, **Then** create succeeds and the Tasks catalog shows the task under that project as open.
5. **Given** that task exists and a dedicated employee exists, **When** they assign that employee to that task from the console, **Then** the assignment succeeds and appears in the Assignments catalog for that employee and task.
6. **Given** the same journey, **When** any of the four create/assign steps is performed, **Then** it happens on the matching console screen (Clients, Projects, Tasks, Assignments) — a hidden create that the admin never performs in the console does not count.

---

### User Story 2 - Prove the assigned employee’s picker shows exactly that chain (Priority: P1)

After the admin has built the chain and assigned the dedicated employee, that employee’s time-report picker data contains exactly that client, that project, and that task — the three names match what the admin just created, and the employee has no other live assignment in that result. An employee who was never assigned that task must not see it.

**Why this priority**: KAN-54’s second acceptance criterion and Epic 4’s reason the catalog exists: it scopes every picker in the employee app. A console chain that never shows up in picker data is not done.

**Independent Test**: After User Story 1, load the assigned employee’s picker data and confirm it contains one assignment whose client, project, and task names match the uniquely named chain; confirm an unassigned employee’s picker data does not include that task.

**Acceptance Scenarios**:

1. **Given** the admin just created the unique client → project → task chain and assigned the dedicated employee, **When** that employee’s picker data is loaded, **Then** it contains an assignment whose client name, project name, and task name are exactly those three names.
2. **Given** that dedicated employee had no other live assignments, **When** their picker data is loaded, **Then** that assignment is the only one in the result (exactly that chain — not extra leftover work).
3. **Given** the same chain, **When** a different employee who was not assigned that task loads picker data, **Then** that task does not appear for them.
4. **Given** picker data contains the chain, **When** a teammate inspects it, **Then** they can identify the client, the project under it, and the task under that project without opening the admin catalogs again.

---

### User Story 3 - Required quality gate and safe reruns (Priority: P1)

The catalog-chain journey runs as part of the project’s required automated end-to-end check. A failure blocks merge. Reruns and parallel jobs do not collide on the same client name or the same employee. Existing smoke checks (employee app shell, service health, and the Epic 3 create-then-login / deactivated-cannot-sign-in journeys) still run.

**Why this priority**: KAN-54’s third acceptance criterion is that this is not an optional local script — it is part of the required e2e check.

**Independent Test**: Trigger the required e2e check; confirm the catalog-chain journey and the existing checks run; rerun and confirm a second catalog-chain still succeeds with new unique names.

**Acceptance Scenarios**:

1. **Given** the required e2e check is configured, **When** a change is proposed for merge, **Then** the catalog-chain journey runs as part of that check.
2. **Given** the catalog-chain journey fails, **When** the check finishes, **Then** the check is reported as failed (merge is not treated as green).
3. **Given** the catalog-chain journey is added, **When** the required e2e check runs, **Then** the existing employee-app-shell, service-health, create-then-login, and deactivated-cannot-sign-in checks still run and still pass when those products are healthy.
4. **Given** the catalog-chain journey runs twice in a row (or two overlapping runs), **When** each run creates a client, project, task, and employee, **Then** each run uses unique names and a unique employee email, and neither fails because of a duplicate-client-name or duplicate-email conflict from the other run.

---

### Edge Cases

- Client name already used by a non-deleted client: the journey MUST generate a unique client name per run so VAL-21 uniqueness does not fail a healthy product.
- Employee email already used: the dedicated employee MUST use a unique email per run.
- Create/assign validation failure (missing name, inactive parent, duplicate assignment): the catalog-chain journey uses valid input; those cases remain owned by KAN-50–53 and are not re-specified here.
- Hidden or service-only create of the client, project, task, or assignment: does **not** satisfy this check — KAN-54 requires those four steps via the console UI.
- Seeded catalog data already present: the proof MUST identify the chain by the unique names created in this run, not by assuming the demo organization is empty.
- Dedicated employee who already has other live assignments: the journey MUST use an employee with no other live assignments at the picker check so “exactly that chain” is unambiguous.
- Employee who cannot sign in (deactivated or never created): the picker-data step MUST fail with a clear setup failure rather than an empty picker that looks like a product bug.
- Empty demo organization (no admin): the check MUST have a known admin who can sign in (demo seed); otherwise the chain cannot start.
- Add-task-from-project (create a task from the Projects row): allowed as the task-create step if the console still collects a task under that project; not required — creating from Tasks is enough.
- Soft-delete / close / unassign after the chain is built: out of scope for this check (sibling stories and Epic 4’s separate soft-delete DoD).
- Per-project hour-report type (סכום שעות vs כניסה/יציאה): out of scope (KAN-63).
- Driving the employee app’s on-screen cascading pickers (בחר פרויקט / בחר משימה): not required; this check proves picker **data**, which is what scopes those pickers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The required end-to-end check MUST include an automated catalog-chain journey that walks, in order: admin signs into the admin console → admin creates a client → admin creates a project under that client → admin creates a task under that project → admin assigns a dedicated employee to that task.
- **FR-002**: Each of the four catalog steps (create client, create project, create task, assign employee) MUST happen on the admin console screens an operator uses. They MUST NOT be replaced by a hidden create the admin never performs in the console.
- **FR-003**: The created client MUST be active and uniquely named for that run. The created project MUST belong to that client and be active. The created task MUST belong to that project and be open.
- **FR-004**: After each successful create or assign, the new row MUST be visible in its catalog with the expected parent name (project shows the client; task shows the project; assignment shows the employee and the task).
- **FR-005**: The assigned employee MUST be a dedicated employee created or reserved for that run, with no other live assignments at the picker check. The person MUST be an active employee (not an admin).
- **FR-006**: After the assignment succeeds, that employee’s time-report picker data MUST contain exactly one live assignment, and that assignment MUST carry the client name, project name, and task name created in the journey.
- **FR-007**: An employee who was not assigned that task MUST NOT see that task in their picker data.
- **FR-008**: The catalog-chain journey MUST run as part of the project’s required automated end-to-end check. A failure MUST fail that check.
- **FR-009**: Existing smoke and Epic 3 journeys (employee app shell for an unsigned-in visitor, service health, create-then-login, deactivated-cannot-sign-in) MUST continue to run in that same required check.
- **FR-010**: Each run MUST use a unique client name and a unique employee email so reruns and overlapping jobs do not fail on uniqueness rules.
- **FR-011**: This feature MUST NOT implement or change Clients, Projects, Tasks, Assignments, or employee-picker product behavior. It only proves those already-delivered behaviors as one required check. Failures MUST indicate a regression in those products, not a new product rule.
- **FR-012**: The journey MUST have a known admin account that can sign into the console (the demo organization admin). If that admin is missing, the check MUST fail with a clear setup failure rather than hang on the admin sign-in screen.
- **FR-013**: Soft-delete of a client, close of a task, removal of an assignment, historical name rendering on old time reports, and per-project hour-report type are out of scope for this feature.
- **FR-014**: Completing the employee app’s on-screen cascading pickers (choose project, then task) is out of scope. Picker **data** that would populate those controls is the required proof.

### Key Entities

- **Catalog-chain journey**: The ordered proof that an admin can build client → project → task → assignment in the console and that the assigned employee’s picker then shows exactly that chain.
- **Demo admin**: The known administrator in the demo organization who can open Clients, Projects, Tasks, and Assignments.
- **Dedicated employee**: The active employee used for the assignment and picker check in one run; uniquely identified; has no other live assignments at the check.
- **Catalog chain**: The uniquely named client, its project, that project’s task, and the assignment of the dedicated employee to that task, created during the run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of catalog-chain runs against a healthy demo organization succeed: the four console steps complete and the assigned employee’s picker data contains exactly that client, project, and task, in under 4 minutes from admin sign-in through the picker check.
- **SC-002**: 100% of catalog-chain runs in tests perform create client, create project, create task, and assign employee on the console screens (not via a hidden shortcut).
- **SC-003**: After a successful run, 100% of assigned-employee picker results in tests contain exactly one live assignment, and that assignment’s three names match the unique names created in the run.
- **SC-004**: 100% of unassigned employees in tests do not see the newly created task in their picker data.
- **SC-005**: A failing catalog-chain journey fails the required automated end-to-end check 100% of the time in tests (the check is not reported as passed).
- **SC-006**: Two consecutive catalog-chain runs on the same demo organization both succeed (unique client names and unique employee emails; no uniqueness false failure).
- **SC-007**: The existing unsigned-in employee-app-shell, service-health, create-then-login, and deactivated-cannot-sign-in checks still run in the same required check and still pass when those products are healthy.
- **SC-008**: A teammate can demonstrate Epic 4’s catalog-chain done without manual clicking: the journey is visible in the required check output.

## Assumptions

- This work tracks Jira [KAN-54](https://nadav40450.atlassian.net/browse/KAN-54) under Epic [KAN-44](https://nadav40450.atlassian.net/browse/KAN-44). Product behavior is owned by sibling stories: KAN-50 (Clients), KAN-51 (Projects), KAN-52 (Tasks), KAN-53 (Assignments). Those stories are already delivered. This feature only adds the required end-to-end proof. Per-project hour-report type (KAN-63) is out of scope.
- [Epic 4 Spec — Entity Management](https://nadav40450.atlassian.net/wiki/spaces/~7120202b4bf28995db4c44819befd33c3b0321/pages/5734401/Epic+4+Spec+-+Entity+Management) DoD: “Full catalog chain proven by Playwright e2e (KAN-54): create client → project → task → assign employee → that employee sees the task in their picker.” The epic’s separate soft-delete DoD (“deleted client’s name still renders on an old entry; closed task vanishes from pickers”) is **not** this ticket — sibling CRUD specs already require those rules.
- GENERAL_SPEC wins on contradictions: Client → Project → Task hierarchy; assignment unique per (user, task) (VAL-27); employee pickers show only assigned, live, open work (§8.2); inactive/closed/removed entities hidden from new-entry pickers; entity CRUD is not audit-logged in MVP (§8.4); Hebrew RTL admin console and employee app.
- The established automated e2e tool is Playwright (KAN-34). The required check is the existing CI `e2e` job (`pnpm --filter @abra/e2e test`). Implementation may start the admin console alongside the employee app and API, and seed the demo organization (known admin `admin@abra.co`) before the journey runs. Those mechanics belong in `/speckit-plan`.
- Demo seed from KAN-32 is the known admin. Admin console screens used in the journey: Clients `/admin/clients`, Projects `/admin/projects`, Tasks `/admin/tasks`, Assignments `/admin/assignments`; admin sign-in `/admin/login`. Ports follow the documented local runtime (employee app 5173, admin console 5174, API 3000) unless overridden.
- KAN-54 names employee picker data as `GET /api/v1/me/assignments`. In this spec that is the established picker-data source: each item includes client name, project name, and task name for live assigned work. Functional requirements talk about picker data, not the path. A check that only asserts admin tables and never loads picker data does not satisfy KAN-54.
- An existing skipped service-only catalog-chain check (no console UI) does **not** satisfy FR-002. `/speckit-plan` should replace or extend it with a console-driven journey.
- Dedicated employee setup MAY reuse the Users console (already proven by KAN-49) so the person exists before assign. That setup is not one of the four KAN-54 catalog steps. Creating the employee via a hidden setup is allowed **only** for the person record; assigning them to the task is still a console step.
- Unique client names and emails may use a timestamp or random suffix; they MUST still be valid. Project and task names SHOULD also be unique per run so the picker assertion is unambiguous (project names are not required to be unique in the product).
- Figma file [Time report files](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw) (`node-id=0-1`) is the employee mobile app: login welcome “ברוכים הבאים!”, then time-report frames including cascading pickers **בחר פרויקט**, **המשך ובחר משימה**, **בחר משימה**. Admin portal frames live in the same file under [Management web portal](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/?node-id=1-3). This feature pixel-matches neither; it proves the catalog and picker **data** that those screens already implement.
- The daily time-report UI itself (filling hours after picking a task) is a later reporting epic. This check stops at picker data.
- Audit logging of entity CRUD is out of scope for MVP (Epic 4 §3).
