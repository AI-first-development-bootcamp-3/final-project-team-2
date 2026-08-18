# Feature Specification: Admin Projects CRUD

**Feature Branch**: `006-admin-projects-crud`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Jira KAN-51 (Epic KAN-44 — Entity Management). §12.4 endpoints + /admin/projects screen. Fields: name (VAL-22), client (must reference an active, non-deleted client — VAL-23), active/inactive (default active). Client picker in the modal shows active clients only. Soft delete; same historical-rendering rule as clients. Confluence Epic 4 spec and Figma time-report file provided as context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the projects catalog (Priority: P1)

An authenticated admin opens Projects in the admin console and sees a Hebrew right-to-left table of projects. Each row shows the project name, the parent client name, and status (active or inactive). The list is paginated at 20 projects per page, sorted by project name A–Z until the admin changes sort, and excludes projects that have been removed, unless the admin asks to include them. The admin can search by project name and narrow the list to one client.

**Why this priority**: Without a catalog, the admin cannot create, edit, or remove projects. This is the first usable slice of KAN-51 and the middle of the Client → Project → Task chain.

**Independent Test**: Sign in as an admin, open Projects, and confirm the table shows existing projects with name, client name, and status; default page size; search and client filter work; removed projects are absent until included.

**Acceptance Scenarios**:

1. **Given** an admin is signed in and the organization has projects, **When** they open the Projects screen, **Then** they see a table with columns for project name, client name, and status (פעיל / לא פעיל).
2. **Given** more than 20 matching projects exist, **When** the admin opens Projects with no extra filters, **Then** the first page shows at most 20 rows, they can move to the next page, and they have no control to change how many rows appear per page.
3. **Given** a project has been removed, **When** the admin opens Projects with default settings, **Then** that project does not appear in the list.
4. **Given** the admin asks to include removed projects, **When** the list refreshes, **Then** removed projects appear and are distinguishable from live ones.
5. **Given** projects belong to more than one client, **When** the admin filters to one client, **Then** only that client’s projects appear and the total count matches.
6. **Given** a unique project name exists, **When** the admin searches part of that name, **Then** matching projects appear and unrelated names do not.
7. **Given** an employee (non-admin) is signed in, **When** they try to open or request the Projects catalog, **Then** they are denied.
8. **Given** nobody is signed in, **When** they try to request the Projects catalog, **Then** they are denied.
9. **Given** matching projects fill only 2 pages, **When** the admin requests page 99, **Then** they see a successful empty page (0 rows) and the real total is still shown.
10. **Given** the catalog is showing the default project-name A–Z order, **When** the admin sorts by another visible column (for example client name or status), **Then** the rows reorder by that column and they are returned to page 1 of the same search/filters.
11. **Given** the catalog is loading, **When** the admin opens Projects, **Then** they see a loading state rather than a blank or broken table.
12. **Given** no live projects exist (and the admin is not including removed ones), **When** they open Projects, **Then** they see an empty state (Hebrew copy consistent with the portal empty illustration: אין מידע קיים עד כה).

---

### User Story 2 - Create a project under an active client (Priority: P1)

An authenticated admin opens Projects, starts create, and fills a Hebrew right-to-left form: project name and client. The client control lists only active, non-removed clients. On success the form closes, the new project is active, and the current page of the catalog is refreshed. The admin stays on that same page of the same search, filters, and sort.

**Why this priority**: Jira KAN-51 treats create fields, VAL-22, VAL-23, default-active, and the active-only client picker as required acceptance criteria. Downstream tasks cannot exist without a project.

**Independent Test**: With at least one active client in the catalog, create a project named uniquely, confirm it is active, belongs to that client, and appears on the refreshed Projects page when it belongs there.

**Acceptance Scenarios**:

1. **Given** an admin is signed in on Projects and at least one active client exists, **When** they open create, **Then** they see required fields for project name (שם הפרויקט) and client (שם הלקוח), and the primary action is צור פרויקט.
2. **Given** the create form is open, **When** the admin looks at the client picker, **Then** only active, non-removed clients appear — inactive and removed clients are absent.
3. **Given** the admin is on a catalog page that would include the new project, **When** they submit a valid name and an active client, **Then** the form closes, they stay on that page, the page refreshes, and the project appears as active under that client.
4. **Given** create succeeds, **When** the admin views the new row, **Then** status is active (פעיל) without the admin having chosen inactive.
5. **Given** create succeeds while the catalog is filtered to a different client, **When** the form closes, **Then** the admin stays on that filtered list, the page refreshes, and the new project is absent until filters change — not an error.
6. **Given** an employee is signed in, **When** they try to open or submit create-project, **Then** they are denied.
7. **Given** nobody is signed in, **When** they try to create a project, **Then** they are denied.

---

### User Story 3 - Catch invalid create and an unusable client (Priority: P1)

The admin must not create a nameless project or hang a project off a client that is inactive, removed, or missing. A missing or whitespace-only name is rejected with a Hebrew field error for the required-name rule (VAL-22). A missing client, or a client that is not an active live client, is rejected with a Hebrew error for the active-client rule (VAL-23). No project is created.

**Why this priority**: KAN-51 names VAL-22 and VAL-23 as acceptance criteria. Silent failures would orphan work in the catalog.

**Independent Test**: Submit empty name, whitespace-only name, no client, and a client that is inactive or removed; confirm each case shows the matching Hebrew error, names the rule, and creates no project.

**Acceptance Scenarios**:

1. **Given** the create form is open, **When** the admin submits with an empty name (or a name that is only spaces), **Then** they see a Hebrew error for VAL-22 (שם הפרויקט הוא שדה חובה) and no project is created.
2. **Given** the create form is open, **When** the admin submits without choosing a client, **Then** they see a Hebrew error for VAL-23 (יש לבחור לקוח תקין ופעיל) and no project is created.
3. **Given** the only available clients in the picker are active, **When** create is processed with a client that is inactive, removed, or does not exist (for example a stale or crafted choice), **Then** they see a Hebrew VAL-23 error and no project is created.
4. **Given** there are zero active clients, **When** the admin opens create, **Then** the client picker is empty and submit cannot succeed with VAL-23 until an active client exists.
5. **Given** two projects may share the same name (including under different clients), **When** the admin creates a second project with a name already in use, **Then** create succeeds — project names are not required to be unique.

---

### User Story 4 - Edit name, client, and active/inactive (Priority: P1)

The admin opens edit on a live project and can change its name, move it to another active client, or set it active/inactive. Changing the client re-checks that the new client is active and not removed. Deactivating a project does not close or remove its tasks. Inactive projects stay in the admin catalog (they are not removed) but disappear from new time-report pickers.

**Why this priority**: KAN-51 requires an active/inactive field (default active) alongside name and client. Admins must be able to hide a project from new reporting without destroying history.

**Independent Test**: Edit a project’s name, move it to another active client, deactivate it, and confirm tasks under it are unchanged and a new-entry picker no longer offers that project.

**Acceptance Scenarios**:

1. **Given** a live project exists, **When** the admin opens edit, **Then** the form is pre-filled with the current name, client, and active/inactive state.
2. **Given** edit is open, **When** the admin saves a new valid name, **Then** the catalog shows the updated name.
3. **Given** another active client exists, **When** the admin moves the project to that client, **Then** the catalog shows the new client name.
4. **Given** the admin tries to move the project to an inactive or removed client, **When** they save, **Then** they see a Hebrew VAL-23 error and the client does not change.
5. **Given** the project currently belongs to a client that was later deactivated, **When** the admin opens edit without changing the client, **Then** they can still save other fields (name or status) without being forced to pick a different client.
6. **Given** a project has tasks, **When** the admin sets it inactive, **Then** only the project becomes inactive; its tasks remain as they were (not closed, not removed).
7. **Given** a project is inactive, **When** an employee opens a new time-report picker, **Then** that project does not appear as a choice.
8. **Given** a whitespace-only name on edit, **When** the admin saves, **Then** they see a Hebrew VAL-22 error and the stored name does not change.

---

### User Story 5 - Soft-remove a project and keep historical names (Priority: P1)

The admin can remove a project. Removal is reversible in the data sense: the project is not physically destroyed. Default admin lists hide it. Existing time reports that already named that project still show the project name. New time-report pickers hide it. Removal does not close or remove the project’s tasks.

**Why this priority**: KAN-51 requires soft delete with the same historical-rendering rule as clients (Epic 4 / GENERAL_SPEC §8.3). Destroying names would break old reports.

**Independent Test**: Remove a project that already appears on an old time report; confirm the old report still shows the name, the default Projects list hides the row, include-removed shows it, and a new-entry picker omits it.

**Acceptance Scenarios**:

1. **Given** a live project, **When** the admin confirms remove, **Then** the project disappears from the default Projects list and is not physically destroyed.
2. **Given** the admin is about to remove a project, **When** the confirmation appears, **Then** they see a Hebrew confirmation they can cancel (ביטול) or confirm (מחיקה).
3. **Given** a time report already stored the project’s name, **When** that project is later removed or deactivated, **Then** the old report still displays that project name.
4. **Given** a project was removed, **When** an employee opens a new time-report picker, **Then** that project does not appear.
5. **Given** a project with tasks is removed, **When** removal completes, **Then** those tasks are not removed or closed as a side effect.
6. **Given** a removed project, **When** the admin includes removed rows, **Then** they can still see the name and client so they know what was removed.

---

### User Story 6 - Loading, field errors, and expired session (Priority: P1)

Create, edit, and remove must not look broken while saving, when validation fails, when the service is unavailable, or when the admin’s session expires. Submit shows a saving state (the admin cannot double-submit). Failures are Hebrew and never silent. An expired session sends the admin to sign-in. Any other failure keeps the form open with a Hebrew error so the admin can retry.

**Why this priority**: Screen inventory for Projects includes table, loading, empty, and modal states. Silent or duplicate submits would create duplicate projects or leave the console untrustworthy.

**Independent Test**: Observe create during a slow submit, a VAL-22 failure, a VAL-23 failure, a service-unavailable failure, and an expired session; confirm the five outcomes are distinct.

**Acceptance Scenarios**:

1. **Given** the admin has submitted a valid create or edit, **When** the request is still in progress, **Then** they see a saving state and cannot send a second submit for the same action.
2. **Given** validation fails, **When** the response returns, **Then** the form stays open, field errors are in Hebrew, and the failure is not hidden.
3. **Given** the admin is on a Projects form with a previously valid session, **When** that session expires and they try to submit, **Then** they are sent to the admin sign-in screen.
4. **Given** the admin submits a valid create and the service is unavailable (not a field error, not an expired session), **When** the failure is returned, **Then** the form stays open with a Hebrew error, what they typed is still there, they can retry, and they are not sent to sign-in.

---

### Edge Cases

- Project name that is only spaces: treated as missing name (VAL-22), not a valid name.
- Two projects may share a name; uniqueness is not required (unlike clients).
- Client picker on create and on client-change lists active, non-removed clients only.
- Inactive and removed clients never appear as new choices; a project already under a later-deactivated client can keep that client if the admin does not change it.
- Zero active clients: create cannot succeed until an active client exists (VAL-23).
- Deactivating a project does not cascade to tasks.
- Removing a project does not cascade to tasks.
- Removed projects are hidden from the default admin list and from new-entry pickers; they still render by name on old time reports.
- Inactive projects remain in the default admin list (they are not removed) but are hidden from new-entry pickers; old time reports still show the name.
- Employee or unsigned-in visitor cannot list, create, edit, or remove projects.
- Signed-in admin’s session expires while a form is open: send the admin to the sign-in screen.
- Create/edit fails because the service is unavailable: form stays open with a Hebrew error; typed values remain; admin can retry.
- After a successful create the admin stays on the current catalog page; only that page is refreshed. The new project is not shown if it belongs on another page or if current search/filters hide it.
- Lead manager, start/end dates, and project description from the Figma create-project modal are not collected on this form.
- Combined clients/projects assignment table (ניהול לקוחות/פרויקטים) is not this screen; this delivery is the dedicated Projects catalog.
- Per-project hour-report type (סכום שעות vs כניסה/יציאה) is out of scope (KAN-63).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An authenticated admin MUST be able to open a Projects catalog in the admin console and see each live project’s name, parent client name, and active/inactive status.
- **FR-002**: The catalog MUST paginate at 20 rows per page. The admin MUST NOT change page size on this screen. Default sort MUST be project name A–Z until the admin changes sort. Changing search, filters, or sort MUST return the admin to page 1 of the new result set. A page past the last page MUST return a successful empty page with the real total still shown.
- **FR-003**: Default catalog results MUST exclude removed projects. The admin MUST be able to include removed projects on demand. Inactive (not removed) projects MUST remain visible in the default catalog.
- **FR-004**: The admin MUST be able to search by project name (partial match, letter case ignored) and filter the catalog to a single client.
- **FR-005**: An authenticated admin MUST be able to open a create-project form from the Projects screen with required fields for name and client, and a primary action labeled צור פרויקט.
- **FR-006**: The client picker on create, and when changing client on edit, MUST list only active, non-removed clients.
- **FR-007**: On successful create the new project MUST be active. The form MUST close. The catalog MUST stay on the same page of the same search, filters, and sort, and MUST refresh that page only. The new project MUST appear in the visible rows only if it belongs on that current page.
- **FR-008**: Project name MUST be required (VAL-22). A name that is only whitespace MUST be treated as missing. The admin MUST see a Hebrew error that names VAL-22. Project names MUST NOT be required to be unique.
- **FR-009**: Client MUST be required on create and MUST refer to an active, non-removed client (VAL-23). Missing client, inactive client, removed client, or unknown client MUST be rejected with a Hebrew error that names VAL-23. No project MUST be created or reassigned in that case.
- **FR-010**: An authenticated admin MUST be able to edit a live project’s name, client, and active/inactive flag. Saving a client change MUST re-apply VAL-23. Saving without changing client MUST remain allowed even if the current client was later deactivated.
- **FR-011**: Setting a project inactive MUST NOT close or remove its tasks. Inactive and removed projects MUST be hidden from new time-report pickers. Existing time reports MUST still display the project name after deactivation or removal (same historical-rendering rule as clients).
- **FR-012**: An authenticated admin MUST be able to remove a project after Hebrew confirmation (cancel or confirm). Removal MUST hide the project from the default catalog and from new-entry pickers, MUST NOT physically destroy it, MUST NOT close or remove its tasks, and MUST leave the name visible on already-stored time reports.
- **FR-013**: Only admins MAY list, create, edit, or remove projects. Unauthenticated access MUST be rejected. Employees MUST be rejected. If the admin’s session expires while a Projects form is open, they MUST be sent to the sign-in screen.
- **FR-014**: The Projects screen and forms MUST be Hebrew and right-to-left, consistent with the admin console and the portal Figma. The screen MUST support table, loading, empty, and modal states. Errors shown to the admin MUST be in Hebrew.
- **FR-015**: While create, edit, or remove is in progress the admin MUST see a saving state and MUST NOT be able to submit the same action twice.
- **FR-016**: If create or edit fails for a reason other than field validation or expired session (for example the service is unavailable), the form MUST stay open with a Hebrew error, MUST keep what the admin typed, and MUST allow retry.
- **FR-017**: This feature MUST deliver Projects in one phase: the shared list/create/update/remove contract, the backend catalog capability, and the admin console screen together. It MUST NOT be split into a frontend-only or backend-only delivery.
- **FR-018**: This feature MUST NOT collect lead manager, start/end dates, or project description. Those Figma modal fields are out of scope for KAN-51.
- **FR-019**: This feature MUST NOT deliver the combined clients/projects assignment table, task create/edit, employee assignment, or per-project hour-report type. Those are sibling stories in Epic 4.

### Key Entities

- **Project**: A named piece of client work in the catalog. Has a name, a parent client, an active/inactive flag (default active), and an optional removed marker. Lives between Client and Task. Deactivating or removing it does not change its tasks. Its name still appears on old time reports after deactivation or removal.
- **Client**: The parent of a project. Create and client-change require an active, non-removed client. Clients themselves are managed in KAN-50; this feature only consumes them in the picker and shows the client name on each project row.
- **Projects catalog**: The admin Projects screen (table + search + client filter + create/edit/remove). Empty, loading, and modal states included.
- **Historical time report**: An already-stored time report that named a project. After that project is deactivated or removed, the stored name still renders; it is not blanked out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can open Projects and identify a project’s name, client, and status in under 30 seconds when at least one live project exists.
- **SC-002**: An admin can create a project under an active client in under 2 minutes, including picking the client from the active-only list.
- **SC-003**: 100% of create/edit attempts that omit name (or use only spaces) are rejected with a Hebrew VAL-22 error and do not save.
- **SC-004**: 100% of create attempts without an active live client, and 100% of client-change attempts to an inactive, removed, or unknown client, are rejected with a Hebrew VAL-23 error and do not save.
- **SC-005**: 100% of newly created projects in tests are active unless the admin later sets them inactive.
- **SC-006**: After a project is deactivated or removed, 100% of already-stored time reports in tests still show that project’s name, and 100% of new-entry pickers in tests omit it.
- **SC-007**: Deactivating or removing a project leaves its tasks unchanged (not closed, not removed) 100% of the time in tests.
- **SC-008**: An employee cannot manage projects; an unsigned-in visitor cannot either.
- **SC-009**: After a successful create, the admin remains on the same Projects page (same search, filters, sort) 100% of the time in tests; the new project is visible only when it belongs on that page.
- **SC-010**: During submit, the admin cannot produce two projects from one intended create (double-submit is blocked).
- **SC-011**: When create or edit fails because the service is unavailable, the form stays open with a Hebrew error 100% of the time in tests; typed values remain; the admin is not sent to sign-in.
- **SC-012**: A teammate can verify the shared contract, the catalog capability, and the Projects screen in a single delivery of this feature (not two sequential frontend/backend handoffs).
- **SC-013**: With more than 20 matching projects, the first page shows at most 20 rows 100% of the time in tests, and the admin cannot change page size on this screen.

## Assumptions

- This work tracks Jira [KAN-51](https://nadav40450.atlassian.net/browse/KAN-51) under Epic [KAN-44](https://nadav40450.atlassian.net/browse/KAN-44) (Entity Management). Sibling stories Clients CRUD (KAN-50), Tasks CRUD (KAN-52), Assignments (KAN-53), entity-chain e2e (KAN-54), and report-type per project (KAN-63) are out of scope as separate deliveries. Historical-rendering behavior for already-stored time reports **is in scope** here as the KAN-51 acceptance rule shared with clients.
- GENERAL_SPEC wins on contradictions: Project fields are name, parent client, and active flag (GENERAL_SPEC §4.3); admin-only Projects CRUD (§7.2); soft delete without physical destroy (§8.3); historical names still render on old time reports and new-entry pickers hide inactive/removed entities (§8.3); deactivating a client does not cascade — likewise deactivating or removing a project does not cascade to tasks; entity CRUD is not audit-logged in MVP (§8.4); Projects screen states are table, loading, empty, modal (§11.2); Hebrew RTL admin console.
- The product endpoints for this catalog are GENERAL_SPEC §12.4: list, get one, create, update, and remove, all admin-only. Success on create is 201 with the created project (identity, name, client identity and name, active flag). Validation failures for missing name are 400 with `details[].rule` VAL-22. Unusable client is 422 with VAL-23. Default list excludes removed rows; include-removed is an explicit list option. Page size 20, default sort by name ascending, search by name, filter by client — same list conventions as the Users and Clients catalogs.
- A shared list/create/update/remove contract (query and body fields, project row fields including client name, success/error envelopes, VAL ids) is **in scope for this feature**. Specify describes the behavior; `/speckit-plan` authors the contract artifact; implementation puts that contract in the shared contracts package and uses it from both the API and the admin console in the **same phase**.
- Authentication (sign-in, access token, admin role check) is delivered by the auth epic. The admin shell and Clients catalog (KAN-50) are prerequisites: create needs at least one active client in the picker. This feature does not re-implement login, the sidebar, or Clients CRUD. Expired-session recovery is to send the admin to the sign-in screen.
- The Figma file [Time report files](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/%E2%8F%B0-Time-report-files-%E2%8F%B0--1-?node-id=0-1) (`node-id=0-1`) is the employee mobile app. Admin portal frames live in the same file under [Management web portal](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/?node-id=1-3). Visuals follow that portal design language (Hebrew RTL, sidebar on the right, modal, empty state אין מידע קיים עד כה). In-scope create copy matches the [create-project modal](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw/?node-id=12-13657): title יצירת פרויקט, שם הפרויקט, שם הלקוח, submit צור פרויקט. Extra modal fields (lead manager, dates, description) are **looks in Figma only** and are out of scope because they are not in KAN-51 acceptance criteria and not in GENERAL_SPEC §4.3.
- Epic 4 and the portal spec describe a combined assignment table (ניהול לקוחות/פרויקטים). GENERAL_SPEC §11.2 and KAN-51 specify a dedicated `/admin/projects` screen. This feature delivers the dedicated Projects catalog. The combined table belongs to assignments (KAN-53).
- Lead manager per project was decided in Confluence (16 Aug) for a schema follow-up that did not land on the current Project record. It stays out of this delivery.
- Project names are not unique. Client names are unique among non-deleted clients (VAL-21) in KAN-50; that rule does not apply to projects.
- New-entry picker hiding is the product rule this feature must honor; the employee daily-report UI itself is a later epic. Tests may prove the rule against picker data and stored time-report display rather than a full employee reporting screen.
- Demo/test clients from the seed plus clients created in KAN-50 are sufficient to prove the active-only picker and VAL-23.
- Audit logging of project create/edit/remove is out of scope (Epic 4: entity CRUD is not audit-logged in MVP).
