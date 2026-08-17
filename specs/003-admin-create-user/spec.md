# Feature Specification: Admin Create User

**Feature Branch**: `003-admin-create-user`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Jira KAN-46 (Epic KAN-43 — User Management). Create user from the admin console: POST users + create form/modal. Fields: full name, email, initial password, role (רגיל/אדמין). Email unique among non-deleted people. Initial password hashed, minimum 8 characters, never returned. Created person can sign in immediately. Implement frontend and backend in the same phase. Do not split into FE and BE. Confluence Epic 3 spec and Figma time-report file provided as context."

## Clarifications

### Session 2026-08-17

- Q: If creating a person fails because the service is unavailable (not missing fields, not a duplicate email, and not an expired sign-in), what should the admin see? → A: Form stays open with a Hebrew error; the admin can retry
- Q: After the admin successfully creates a person, what should the Users table show next? → A: Stay on the current page and only refresh that page
- Q: When the admin types an email with mixed capitalization (for example `Nadav@Org.com`), how should that address be stored? → A: Store lowercase after trimming spaces
- Q: When the new person signs in, may they type the email with any capitalization, or must it match the stored lowercase address? → A: Sign-in ignores email capitalization; mixed case still works

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a person from the Users screen (Priority: P1)

An authenticated admin opens Users, starts “create person,” and fills a Hebrew right-to-left form: full name, email, initial password, and role (employee / admin, shown as רגיל / אדמין). On success the form closes, the new person is active, and the current page of the directory is refreshed. The admin stays on that same page of the same search, filters, and sort. The new person is visible only if they belong on that page.

**Why this priority**: Without create, the directory from KAN-45 cannot grow. This is the next usable slice of Epic 3.

**Independent Test**: Sign in as an admin, open Users on page 1 with no filters that would hide the new people, create one employee and one admin with unique emails, and confirm both appear on the refreshed page with the chosen names, emails, roles, and active status.

**Acceptance Scenarios**:

1. **Given** an admin is signed in on Users, **When** they open the create form, **Then** they see required fields for full name, email, initial password, and role.
2. **Given** the admin is on a directory page that would include the new employee (same search, filters, and sort), **When** they submit a valid create with role employee, **Then** the form closes, they stay on that page, the page refreshes, and that person appears as an active employee.
3. **Given** the admin is on a directory page that would include the new admin, **When** they submit a valid create with role admin, **Then** they stay on that page, the page refreshes, and that person appears as an active admin.
4. **Given** a person was just created and is visible on the current page, **When** the admin views their row, **Then** they see full name, email, role, and active status — never the password.
5. **Given** an employee (non-admin) is signed in, **When** they try to open or submit create-person, **Then** they are denied.
6. **Given** nobody is signed in, **When** they try to create a person, **Then** they are denied.
7. **Given** create succeeds while the directory is filtered in a way that would hide the new person (for example filter “admins only” after creating an employee), **When** the form closes, **Then** the admin stays on the same page of that filtered list, the page refreshes, and the new person is absent until the admin changes filters — not an error.
8. **Given** the admin is on page 2 and the new person would belong on page 1 of the current search/filters/sort, **When** create succeeds, **Then** the admin stays on page 2, that page refreshes, and the new person is not in the visible rows (the admin is not jumped to page 1).
9. **Given** the admin types a mixed-capitalization email such as `Nadav@Org.com` and the new person is visible on the current page, **When** create succeeds, **Then** the directory shows the email in lowercase (`nadav@org.com`).

---

### User Story 2 - Catch invalid create input and duplicate email (Priority: P1)

The admin must not create a half-finished or colliding person. Missing full name, missing or invalid email, missing initial password, password shorter than 8 characters, and invalid role are rejected with field-level Hebrew errors tied to the published validation rules. An email already used by a non-deleted person is a conflict: the admin stays on the form and sees a Hebrew error that identifies the uniqueness rule.

**Why this priority**: Jira KAN-46 treats VAL-10–13 and unique-email conflict as required acceptance criteria. Silent or generic failures would create unusable accounts.

**Independent Test**: Submit empty fields, a 7-character password, a malformed email, and an email that already belongs to a live person; confirm each case shows the matching Hebrew field/conflict error and no new person is created.

**Acceptance Scenarios**:

1. **Given** the create form is open, **When** the admin submits with an empty full name (or a name that is only spaces), **Then** they see a Hebrew error for the required-name rule and no person is created.
2. **Given** the create form is open, **When** the admin submits without an initial password, **Then** they see a Hebrew error for the required-initial-password rule and no person is created.
3. **Given** the create form is open, **When** the admin submits an initial password of 7 characters, **Then** they see a Hebrew error that the password must be at least 8 characters and no person is created.
4. **Given** the create form is open, **When** the admin submits a password of exactly 8 characters (and the rest is valid), **Then** create succeeds.
5. **Given** the create form is open, **When** the admin submits a malformed email, **Then** they see a Hebrew invalid-email error and no person is created.
6. **Given** a non-deleted person already uses an email, **When** the admin submits create with that same email (ignoring letter case), **Then** they see a Hebrew uniqueness conflict that names the uniqueness rule, the form stays open, and no second person is created.
7. **Given** a deactivated/removed person used an email, **When** the admin creates a new person with that same email, **Then** create succeeds (uniqueness is among non-deleted people only).
8. **Given** the admin submits a role that is not employee or admin, **When** create is processed, **Then** they see a Hebrew invalid-role error and no person is created.

---

### User Story 3 - New person can sign in immediately (Priority: P1)

After create, the admin does not wait for a welcome email or a forced password change. The new employee can sign in to the employee app with that email and initial password. The new admin can sign in to the admin console with that email and initial password. Email letter case does not matter at sign-in. There is no first-login password change.

**Why this priority**: Epic 3 definition of done and KAN-46 both require that a created person can log in immediately with the initial password.

**Independent Test**: Create an employee and an admin through the Users form; sign in as each with the initial password on the matching product (employee app vs admin console) on the first try, including once with mixed-case email.

**Acceptance Scenarios**:

1. **Given** an admin just created an employee with an initial password, **When** that employee signs in to the employee app with the same email and password, **Then** they get in on the first try.
2. **Given** an admin just created an admin with an initial password, **When** that admin signs in to the admin console with the same email and password, **Then** they get in on the first try.
3. **Given** a person was created with mixed-capitalization email such as `Nadav@Org.com` (stored as `nadav@org.com`), **When** they sign in with `Nadav@Org.com` and the initial password, **Then** they get in on the first try.
4. **Given** a person was just created, **When** they sign in successfully, **Then** they are not forced to change the password.
5. **Given** a newly created employee, **When** they try to sign in to the admin console, **Then** they are denied (employees do not use the admin console).
6. **Given** a newly created admin, **When** they try to sign in to the employee app, **Then** they are denied (admins do not use the employee app).

---

### User Story 4 - Loading, field errors, and expired session (Priority: P1)

Create must not look broken while saving, when validation fails, when the service is unavailable, or when the admin’s session expires. Submit shows a saving state (the admin cannot double-submit). Failures are Hebrew and never silent. An expired session sends the admin to sign-in. Any other failure keeps the form open with a Hebrew error so the admin can retry.

**Why this priority**: Screen inventory for Users includes the create modal. Silent or duplicate submits would create duplicate people or leave the console untrustworthy.

**Independent Test**: Observe the form during a slow submit, a validation failure, a uniqueness conflict, a service-unavailable failure, and an expired session; confirm the five outcomes are distinct.

**Acceptance Scenarios**:

1. **Given** the admin has submitted a valid create, **When** the request is still in progress, **Then** they see a saving state and cannot send a second create for the same submit.
2. **Given** validation fails, **When** the response returns, **Then** the form stays open, field errors are in Hebrew, and the failure is not hidden.
3. **Given** uniqueness fails, **When** the response returns, **Then** the form stays open with a Hebrew conflict on email, not a generic blank failure.
4. **Given** the admin is on the create form with a previously valid session, **When** that session expires and they try to submit, **Then** they are sent to the admin sign-in screen (not left on a silent form, and not shown only a generic “failed to create” as the final state).
5. **Given** the admin submits a valid create and the service is unavailable (not a field error, not a duplicate email, not an expired session), **When** the failure is returned, **Then** the form stays open with a Hebrew error, what they typed is still there, they can retry, and they are not sent to sign-in.

---

### Edge Cases

- Email already used by a non-deleted person: uniqueness conflict; form stays open; no second person.
- Email previously used only by a deactivated/removed person: create is allowed.
- Email comparison ignores letter case (the same address with different capitalization is still a duplicate among non-deleted people).
- Mixed-capitalization email is trimmed of surrounding spaces and stored in lowercase; the directory shows the lowercase form.
- Sign-in ignores email letter case: typing `Nadav@Org.com` still matches stored `nadav@org.com`.
- Full name that is only spaces: treated as missing name, not a valid name.
- Email that is only spaces: treated as missing/invalid email, not a unique address.
- Initial password is not trimmed; leading or trailing spaces are part of the secret the new person must type to sign in.
- Password of 8 characters succeeds; 7 fails.
- Invalid or missing role is rejected; only employee and admin are accepted.
- Employee bookmarks or guesses create-person: access is denied.
- Signed-in admin’s session expires while the form is open: send the admin to the sign-in screen.
- Create fails because the service is unavailable (not validation, not duplicate email, not expiry): form stays open with a Hebrew error; typed values remain; admin can retry; not treated as sign-in expiry and not closed silently.
- Password material is never shown in the directory, in the success payload, or in later views of that person.
- Create does not force a password change on first sign-in.
- Extra HR attributes (employee number, role title, worker/manager type, employment percent, org unit) are not collected on this form.
- After a successful create the admin stays on the current directory page; only that page is refreshed. The new person is not shown if they belong on another page or if current search/filters hide them.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An authenticated admin MUST be able to open a create-person form from the Users screen in the admin console.
- **FR-002**: The form MUST collect full name, email, initial password, and role (employee / admin, labeled רגיל / אדמין in the console).
- **FR-003**: On successful create the new person MUST be active and MUST NOT be marked deactivated/removed. The create form MUST close. The Users directory MUST stay on the same page of the same search, filters, and sort, and MUST refresh that page only. The new person MUST appear in the visible rows only if they belong on that current page.
- **FR-004**: Full name MUST be required (VAL-10). A name that is only whitespace MUST be treated as missing.
- **FR-005**: Email MUST be required and a valid email address. Surrounding spaces MUST be trimmed, then the address MUST be stored in lowercase. Email MUST be unique among non-deleted people (VAL-11), compared without regard to letter case. A colliding email MUST be rejected as a conflict that includes the uniqueness rule id in the error details. An email used only by a deactivated/removed person MUST be allowed. The directory and the created-person record MUST show the lowercase stored address.
- **FR-006**: Role MUST be a valid employee or admin value (VAL-12).
- **FR-007**: Initial password MUST be required on create (VAL-13) and MUST be at least 8 characters. There are no extra complexity rules. The password MUST NOT be trimmed before it is stored.
- **FR-008**: The initial password MUST be stored only as a one-way secret. It MUST never be returned in any success or error payload, shown in the directory, or logged for operators.
- **FR-009**: After create, the person MUST be able to sign in immediately with that email and initial password on the matching product: employee → employee app, admin → admin console. Email letter case MUST NOT matter at sign-in (mixed capitalization MUST still succeed). Create MUST NOT force a password change on first sign-in.
- **FR-010**: Only admins MAY create people. Unauthenticated access MUST be rejected. Employees MUST be rejected. If the admin’s session expires while the create form is open, they MUST be sent to the sign-in screen.
- **FR-011**: The create form MUST be Hebrew and right-to-left, consistent with the admin console. Errors shown to the admin MUST be in Hebrew and MUST name the relevant validation rule for field and uniqueness failures.
- **FR-012**: While create is in progress the admin MUST see a saving state and MUST NOT be able to submit the same create twice.
- **FR-013**: This feature MUST deliver create in one phase: the shared create contract, the backend create capability, and the admin console form together. It MUST NOT be split into a frontend-only or backend-only delivery.
- **FR-014**: This feature MUST NOT include edit-person, reset-password, or deactivate/restore actions (those are later stories in the same epic).
- **FR-015**: This feature MUST NOT add create-form fields for HR attributes planned elsewhere (employee number, role title, worker/manager type, employment percent, org unit).
- **FR-016**: There MUST be no self-registration. Only an admin creates people.
- **FR-017**: If create fails for a reason other than field validation, duplicate email, or expired session (for example the service is unavailable), the form MUST stay open with a Hebrew error, MUST keep what the admin typed, and MUST allow retry. This MUST NOT send the admin to sign-in and MUST NOT close the form with no message.

### Key Entities

- **User**: A person in the organization with a full name, a lowercase email, role (employee or admin), active/inactive flag, optional deactivated/removed marker, and a sign-in secret that is never displayed. This feature creates Users; it does not edit or deactivate them.
- **Create-person form**: The Users-screen form (modal) that collects full name, email, initial password, and role, shows Hebrew field/conflict errors, and submits a single create.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can create a new person from Users in under 2 minutes, including choosing role and setting the initial password.
- **SC-002**: 100% of people created with a unique valid email in tests can sign in on the first try with the initial password on the matching product (employee app or admin console), including when they type the email with mixed capitalization.
- **SC-003**: 100% of create attempts that omit full name, omit initial password, use a password shorter than 8 characters, or use a malformed email are rejected with a Hebrew field error and create no person.
- **SC-004**: Creating a second person with an email already used by a non-deleted person is blocked 100% of the time in tests, and the admin sees a Hebrew uniqueness error that names the uniqueness rule.
- **SC-005**: Creating a person with an email used only by a deactivated/removed person succeeds in tests.
- **SC-006**: An employee cannot create people; an unsigned-in visitor cannot either.
- **SC-007**: After create, the admin never sees the password again in the console or in any returned person record.
- **SC-008**: A newly created person is not forced to change password on first sign-in.
- **SC-009**: A teammate can verify the create contract, the create capability, and the Users create form in a single delivery of this feature (not two sequential FE/BE handoffs).
- **SC-010**: During submit, the admin cannot produce two people from one intended create (double-submit is blocked).
- **SC-011**: When create fails because the service is unavailable, the form stays open with a Hebrew error 100% of the time in tests; typed values remain; the admin is not sent to sign-in and the form does not close silently.
- **SC-012**: After a successful create, the admin remains on the same Users page (same search, filters, sort) 100% of the time in tests; the new person is visible only when they belong on that page.
- **SC-013**: A mixed-capitalization email typed on create is stored and shown in lowercase 100% of the time in tests.

## Assumptions

- This work tracks Jira KAN-46 under Epic KAN-43. Sibling stories KAN-45 (directory), KAN-47 (edit / reset password), KAN-48 (deactivate), and KAN-49 (Playwright create-then-login e2e) are out of scope as separate deliveries. Immediate sign-in with the initial password **is in scope** here (KAN-46 acceptance); the dedicated Playwright chain that walks create-then-login as epic DoD remains KAN-49.
- GENERAL_SPEC wins on contradictions: admin-only user create (§5.2 / §7.2), no force-change-on-first-login (§5.2 / ADR-16), password minimum 8 characters with no extra complexity (§5.3), hashed secrets never returned (§13.2), error envelope (§6.5), 409 for duplicate email (§6.6), 201 on create (§6.6), unique email among non-deleted people (§4.1 / VAL-11).
- The product endpoint for this create is `POST /api/v1/users` (GENERAL_SPEC §12.2). Success is 201 with the created person (same public fields as a directory row: identity, full name, email, role, status) and **no** password material. Validation failures are 400 with `details[].rule` set to VAL-10, VAL-12, VAL-13, VAL-02 (email format), or VAL-04 (password length). Duplicate email among non-deleted people is 409 with VAL-11 in `details`.
- A shared create contract (request body, created-person fields, success/error envelopes, VAL ids) is **in scope for this feature**. Specify describes the behavior; `/speckit-plan` authors the contract artifact; implementation puts that contract in the shared contracts package and uses it from both the API and the admin console in the **same phase**.
- Authentication (sign-in, access token, admin role check) is delivered by KAN-39. The Users directory is delivered by KAN-45. This feature requires those checks and opens the form from that Users screen; it does not re-implement login or the table. Expired-session recovery on create is to send the admin to the sign-in screen.
- Figma file [Time report files](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw) (`node-id=0-1`) is the employee mobile app only (login, time report, alerts). There are no user-management or admin-console frames. Confluence Epic 3 §3 already notes this. Visuals follow the admin console design language (Hebrew RTL, Users screen, modal form, loading/error) rather than pixel-matching that Figma file.
- Default selected role on the empty form is employee (רגיל); the admin can change it to admin (אדמין) before submit. Role remains required.
- Email uniqueness is case-insensitive. Emails are trimmed of surrounding whitespace, then stored in lowercase; uniqueness and directory display use that stored form. Sign-in also ignores email letter case (the typed address is matched to the stored lowercase form). Passwords are not trimmed. Immediate sign-in in this feature requires that matching; it does not add a new sign-in screen.
- Extra User fields called out in Epic 3 §2 (employee number, role title, worker/manager type, employment %, org unit) are not on the current User model and are out of scope for KAN-46’s four-field create form, matching KAN-45’s four-column table.
- The Users create/edit modal in the screen inventory is split across stories: this feature owns **create** only; edit is KAN-47.
- Audit logging of user create is out of scope (Epic 3: user CRUD audit is out of scope for MVP).
- There is no confirm-password field and no forgot-password flow on create.
- Demo/test data from KAN-32 plus people created in this feature are sufficient to prove uniqueness conflicts and immediate sign-in.
