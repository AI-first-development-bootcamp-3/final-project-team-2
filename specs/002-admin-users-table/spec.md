# Feature Specification: Admin Users Table

**Feature Branch**: `002-admin-users-table`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Jira KAN-45 (Epic KAN-43 — User Management). Users table in the admin console: list users with full name, email, role, and status; search by name/email; filter by role and status; pagination; include deactivated users; loading and empty states. Implement frontend and backend in the same phase. Do not split into FE and BE. Confluence Epic 3 spec and Figma time-report file provided as context."

## Clarifications

### Session 2026-08-17

- Q: When an admin requests a Users page past the last page (for example page 99 when there are only two pages), what should they see? → A: Successful empty page (0 rows) with the real total still shown
- Q: If the admin types only spaces in search (no letters or numbers), should the directory treat that as “no search” or as “find nobody”? → A: Trim and treat as no search (same as an empty search box)
- Q: In this Users delivery, can the admin change how the table is sorted, or is it always full name A–Z? → A: Admin can change sort (for example by clicking column headers)
- Q: If the admin’s sign-in expires while the Users table is open, what should they see next? → A: Send the admin to the sign-in screen
- Q: Can the admin choose how many people appear per page on the Users screen, or is the page size always 20 there? → A: Users screen always shows 20 per page; sizes above 100 are rejected

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse the organization directory (Priority: P1)

An authenticated admin opens the Users screen in the admin console and sees a table of people in the organization. Each row shows full name, email, role (employee or admin), and status (active or inactive). The list is paginated at 20 people per page (the admin cannot change page size on this screen), sorted by full name A–Z until the admin changes sort (for example by clicking a column header), and excludes people who have been deactivated/removed, unless the admin asks to include them.

**Why this priority**: Without a directory, an admin cannot run the rest of the user-management epic (create, edit, deactivate). This is the first usable slice of Epic 3.

**Independent Test**: Sign in as an admin, open Users, and confirm the table shows existing people with the four columns, default page size, and no deactivated-removed people.

**Acceptance Scenarios**:

1. **Given** an admin is signed in and the organization has people, **When** they open the Users screen, **Then** they see a table with columns full name, email, role, and status.
2. **Given** more than 20 matching people exist, **When** the admin opens Users with no extra filters, **Then** the first page shows at most 20 rows, they can move to the next page, and they have no control to change how many rows appear per page.
3. **Given** a person has been deactivated/removed, **When** the admin opens Users with default settings, **Then** that person does not appear in the list.
4. **Given** an employee (non-admin) is signed in, **When** they try to open or request the Users directory, **Then** they are denied.
5. **Given** nobody is signed in, **When** they try to request the Users directory, **Then** they are denied.
6. **Given** matching people fill only 2 pages, **When** the admin requests page 99, **Then** they see a successful empty page (0 rows) and the real total is still shown (not an error, and not a silent jump to page 2).
7. **Given** the directory is showing the default full-name A–Z order, **When** the admin sorts by another visible column (for example email), **Then** the rows reorder by that column and they are returned to page 1 of the same search/filters.

---

### User Story 2 - Search and filter the directory (Priority: P1)

The admin needs to find a specific person. They can type part of a name or email, and optionally narrow the list by role and by active/inactive status. Changing search, filters, or sort starts again from the first page.

**Why this priority**: A directory without search/filter is unusable once the organization has more than a handful of people. Jira KAN-45 treats this as required acceptance criteria.

**Independent Test**: With mixed roles and statuses in the demo org, search by a unique email, filter by role, filter by inactive status, and confirm the table and total count match.

**Acceptance Scenarios**:

1. **Given** the directory contains a person with a unique email, **When** the admin searches for that email (or a distinctive part of it), **Then** that person is in the results and unrelated people are not.
2. **Given** the directory contains both employees and admins, **When** the admin filters to admins only, **Then** every visible row is an admin.
3. **Given** the directory contains active and inactive people, **When** the admin filters to inactive, **Then** every visible row is inactive.
4. **Given** the admin combines search text with role and status filters, **When** results load, **Then** every row matches all applied criteria (combined, not either/or).
5. **Given** the admin is on page 2, **When** they change search, a filter, or sort, **Then** they are returned to page 1 of the new result set.
6. **Given** the search text matches nobody, **When** results load, **Then** the admin sees an empty state, not an error.
7. **Given** people exist and no other filters hide them, **When** the admin searches with only spaces, **Then** the directory behaves as if the search box were empty (the unfiltered list for current filters), not an empty state or an error.

---

### User Story 3 - Include deactivated people (Priority: P2)

Sometimes the admin must inspect people who were deactivated/removed. They can turn on “include deactivated.” Those people appear in the table with inactive status. Turning the control off hides them again.

**Why this priority**: Needed for later deactivate/restore work and for GENERAL_SPEC soft-delete listing rules, but secondary to browsing the live directory.

**Independent Test**: Deactivate (or mark deleted) one person in test data, confirm they are hidden by default, then enable include-deactivated and confirm they appear as inactive.

**Acceptance Scenarios**:

1. **Given** at least one deactivated/removed person exists, **When** include-deactivated is off, **Then** they are absent from the list and from the total count.
2. **Given** the same person, **When** the admin turns include-deactivated on, **Then** they appear and their status is inactive.
3. **Given** include-deactivated is on and a status filter of “active” is applied, **When** results load, **Then** deactivated/removed people still do not appear (they are not active).

---

### User Story 4 - Loading, empty, and error feedback (Priority: P1)

The Users screen must not look broken while data is loading, when there are no rows, or when the request fails. The admin sees a loading state, an empty state, or a clear Hebrew error. Failures are never silent.

**Why this priority**: Screen inventory for Users requires loading and empty states. Silent failures would make the console untrustworthy.

**Independent Test**: Observe the screen during a slow load, with filters that match nobody, and with a failed request; confirm the three states are distinct.

**Acceptance Scenarios**:

1. **Given** the directory request is in progress, **When** the admin is on Users, **Then** they see a loading state rather than a blank or stale table presented as final.
2. **Given** the current search/filters match zero people, **When** the response returns, **Then** they see an empty state (not a loading spinner and not an error).
3. **Given** the directory request fails, **When** the error is returned, **Then** the admin sees a Hebrew error message and the failure is not hidden.
4. **Given** the admin is on Users with a previously valid session, **When** that session expires and they try to load or refresh the directory, **Then** they are sent to the admin sign-in screen (not left on a silent blank table, and not shown a “failed to load users” message as the final state).

---

### Edge Cases

- Requested page past the last page (for example page 99 of 2): successful empty page (0 rows) with the real total still shown; not an error and not clamped to the last page.
- Requested page size below 1 or above 100: rejected as invalid input. The Users screen always uses 20 per page and does not offer a page-size control.
- Inactive but not removed people appear in the default list; deactivated/removed people are hidden unless include-deactivated is on (see FR-005).
- Search text that is only whitespace: trim and treat as no search (same as an empty search box); not an empty-state match and not an error.
- Employee bookmarks or guesses the Users URL: access is denied (same as FR-010).
- Signed-in admin’s session expires while the table is open: send the admin to the sign-in screen; do not leave a silent blank table or treat expiry as a directory-load error.
- Missing optional display data: all required directory fields exist on User today; every row can show full name, email, role, and status.
- Password material and session-revocation internals are never shown in the table.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An authenticated admin MUST be able to open a Users directory in the admin console and see people as a table.
- **FR-002**: Each visible row MUST show full name, email, role (employee / admin), and status (active / inactive).
- **FR-003**: The directory MUST paginate with a page size of 20, a starting page of 1, and a maximum allowed page size of 100. The Users screen MUST always use 20 people per page and MUST NOT offer a control to change page size. A requested page size below 1 or above 100 MUST be rejected as invalid input.
- **FR-004**: The directory MUST report enough paging information for the admin to know the current page, page size, and total matching people. A request for a page past the last page MUST succeed with zero rows and MUST still report the real total (it MUST NOT be treated as an error and MUST NOT silently replace the request with the last valid page).
- **FR-005**: By default the directory MUST hide people who have been deactivated/removed (soft-deleted). Inactive people who have not been removed MUST still appear, unless the admin filters them out.
- **FR-006**: Admins MUST be able to search the directory by name and/or email using a case-insensitive partial match. Search text that is only whitespace MUST be trimmed and treated as no search (same as an empty search box); it MUST NOT be treated as a match-nobody query or as invalid input.
- **FR-007**: Admins MUST be able to filter the directory by role and by active/inactive status, including combining those filters with search.
- **FR-008**: Admins MUST be able to include deactivated/removed people via an explicit control; those rows MUST still show as inactive.
- **FR-009**: Changing search, filters, or sort MUST reset the view to the first page of the new result set.
- **FR-010**: Only admins MAY use the Users directory. Unauthenticated access MUST be rejected. Employees MUST be rejected. If the admin’s session expires while the Users screen is open, they MUST be sent to the sign-in screen rather than left on the directory with a load error as the final state.
- **FR-011**: The directory MUST never expose password secrets or session-revocation internals.
- **FR-012**: The Users screen MUST provide loading, empty, and error states as specified in the user stories. Errors shown to the admin MUST be in Hebrew.
- **FR-013**: The Users screen MUST be Hebrew and right-to-left, consistent with the admin console.
- **FR-014**: This feature MUST deliver the directory in one phase: the shared list contract, the backend list capability, and the admin console table together. It MUST NOT be split into a frontend-only or backend-only delivery.
- **FR-015**: This feature MUST NOT include create-user, edit-user, reset-password, or deactivate/restore actions (those are later stories in the same epic).
- **FR-016**: This feature MUST NOT add extra directory columns for HR attributes planned elsewhere (employee number, role title, worker/manager type, employment percent, org unit).
- **FR-017**: Admins MUST be able to change the directory sort (for example by clicking column headers). The four visible columns (full name, email, role, status) MUST be sortable. The default MUST be full name A–Z until the admin changes it.

### Key Entities

- **User**: A person in the organization with a full name, email, role (employee or admin), active/inactive flag, and optional deactivated/removed marker. The directory lists Users; it does not create or change them.
- **User directory page**: A page of matching Users plus paging metadata (page, page size, total matches) for the current search and filters.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can open the Users directory and understand who is in the organization (name, email, role, status) without contacting another teammate.
- **SC-002**: For a unique email in the demo organization, search returns that person on the first try.
- **SC-003**: Role and status filters each reduce the visible set to only matching people; combined filters further reduce it (AND, not OR).
- **SC-004**: The Users screen always shows at most 20 people per page; the admin can reach the rest via paging and cannot change the page size; requesting fewer than 1 or more than 100 per page is rejected.
- **SC-005**: A deactivated/removed person is hidden in the default view and visible when include-deactivated is on, 100% of the time in tests.
- **SC-006**: An employee cannot use the Users directory; an unsigned-in visitor cannot either.
- **SC-007**: The admin never sees password secrets in the directory.
- **SC-008**: Loading appears before results; empty appears when there are zero matches; a failed load shows a Hebrew error rather than a silent blank screen. An expired session on the open Users screen sends the admin to sign-in.
- **SC-009**: A teammate can verify the list contract, the list capability, and the Users screen in a single delivery of this feature (not two sequential FE/BE handoffs).
- **SC-010**: From the default full-name A–Z view, an admin can reorder the directory by each of the four visible columns on the first try.

## Assumptions

- This work tracks Jira KAN-45 under Epic KAN-43. Sibling stories KAN-46 (create), KAN-47 (edit / reset password), KAN-48 (deactivate), and KAN-49 (create-then-login e2e) are out of scope.
- GENERAL_SPEC wins on contradictions: pagination (§6.7), list envelope (§6.4), error envelope (§6.5), soft-delete listing (§6.10 / §8.3), admin-only Users access (§7.2 / §11.2).
- The product endpoint for this directory is `GET /api/v1/users` (GENERAL_SPEC §12). Query capabilities: `page`, `limit`, `q` (name/email search), `role`, `isActive`, `includeDeleted`, `sort`, `order`. Default sort is full name ascending. The admin can change sort in the Users table (column headers); sortable fields are the four visible columns. The Users screen always requests page size 20; `limit` above 100 or below 1 is rejected.
- A shared list contract (request query, list-item fields, success/error envelopes) is **in scope for this feature** and is the KAN-69 “Create API contract” subtask. Specify describes the behavior; `/speckit-plan` authors the contract artifact; implementation puts that contract in the shared contracts package and uses it from both the API and the admin console in the **same phase**.
- Authentication (sign-in, access token, admin role check) is delivered by KAN-39. This feature requires those checks on the directory; it does not implement login itself. Expired-session recovery on Users is to send the admin to the sign-in screen.
- Figma file “Time report files” contains only the employee mobile app. Confluence Epic 3 §3 already notes there are no user-management frames. Visuals follow the admin console design language (Hebrew RTL, table, loading/empty) rather than pixel-matching that Figma file.
- Status in the table maps to the person’s active flag, not solely to the removed marker. Removed people are an extra set gated by include-deactivated.
- Extra User fields called out in Epic 3 (employee number, role title, worker/manager type, employment %, org unit) are not on the current User model and are out of scope for KAN-45’s four-column table.
- Demo seed data from KAN-32 is sufficient to populate the first directory view.
- Password hashes and token-version internals are never part of directory output.
- Create/edit modal listed on the Users screen inventory is owned by KAN-46/47, not this feature.
- Audit logging of user-directory reads is out of scope (Epic 3: user CRUD audit is out of scope for MVP).
