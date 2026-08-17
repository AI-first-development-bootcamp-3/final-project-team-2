# Feature Specification: Create User Then Login E2E

**Feature Branch**: `005-create-user-login-e2e`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Jira KAN-49 (Epic KAN-43 — User Management). Playwright e2e: admin creates a user who then logs in. Acceptance: (1) admin logs into the console → creates a user with an initial password → logs out → the new user logs into the employee app successfully; (2) deactivated user cannot log in; (3) runs in CI as part of the required e2e check. Confluence Epic 3 spec and Figma time-report file provided as context."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prove create-then-login (Priority: P1)

A teammate (or the required quality gate) walks the Epic 3 happy path as a real admin and a real new employee would: an admin signs into the admin console, opens Users, creates an employee with a unique email and an initial password, signs out of the console, then that new employee signs into the employee app with the same email and initial password and reaches the authenticated employee app — not the login welcome screen. There is no forced password change.

**Why this priority**: This is the Epic 3 definition of done and the first KAN-49 acceptance criterion. Unit tests on create or login alone do not prove the full chain.

**Independent Test**: Run the automated create-then-login journey against a fresh demo organization. Confirm the new employee leaves the Hebrew login screen and sees the authenticated employee app on the first try.

**Acceptance Scenarios**:

1. **Given** a known admin can sign in to the admin console, **When** they sign in and open Users, **Then** they see the Users directory (not the admin sign-in screen).
2. **Given** the admin is on Users, **When** they create a new employee with a unique email and an initial password of at least 8 characters, **Then** create succeeds and the new person is an active employee.
3. **Given** create just succeeded, **When** the admin signs out of the console, **Then** they are returned to the admin sign-in screen and are no longer treated as signed in.
4. **Given** that new employee and their initial password, **When** they sign into the employee app with that email and password, **Then** they leave the login welcome screen and reach the authenticated employee app on the first try.
5. **Given** the new employee just signed in successfully, **When** they land in the employee app, **Then** they are not forced to change the password.
6. **Given** the same journey, **When** the employee app is showing the login screen before sign-in, **Then** the Hebrew welcome heading matches the employee-app login (“ברוכים הבאים!”), consistent with the employee mobile design.

---

### User Story 2 - Prove a deactivated employee cannot sign in (Priority: P1)

A teammate (or the required quality gate) proves the other Epic 3 done criterion: after an admin deactivates an employee from Users, that person cannot sign into the employee app even with the correct password. They stay on (or return to) the login screen and see a Hebrew failure — they do not enter the authenticated employee app.

**Why this priority**: KAN-49’s second acceptance criterion and Epic 3 DoD (“deactivation proven by test”). A create-then-login journey that never deactivates would leave the epic’s logout/block behavior unproven in the required check.

**Independent Test**: In a separate automated journey, create (or pick) an active employee, deactivate them from Users, then attempt employee-app sign-in with their email and password; confirm they are refused.

**Acceptance Scenarios**:

1. **Given** an active employee who can sign into the employee app, **When** an admin deactivates that person from Users, **Then** that person is inactive / deactivated in the directory.
2. **Given** that deactivated employee and their existing password, **When** they try to sign into the employee app, **Then** they do not reach the authenticated employee app.
3. **Given** the same failed sign-in, **When** the employee app shows the result, **Then** they see a Hebrew error (not a silent blank screen and not a successful home screen).
4. **Given** the create-then-login journey (User Story 1) and this deactivated-cannot-sign-in journey, **When** both run in the same required check, **Then** either can fail independently without being skipped because the other was not run.

---

### User Story 3 - Required quality gate and safe reruns (Priority: P1)

The two journeys above run as part of the project’s required automated end-to-end check. A failure blocks merge. Reruns and parallel CI jobs do not collide on the same email. Existing smoke checks (employee app shell renders; service health) still run.

**Why this priority**: KAN-49’s third acceptance criterion is that this is not an optional local script — it is part of the required e2e check.

**Independent Test**: Trigger the required e2e check; confirm both new journeys and the existing smoke checks run; rerun and confirm a second create-then-login still succeeds with a new unique email.

**Acceptance Scenarios**:

1. **Given** the required e2e check is configured, **When** a change is proposed for merge, **Then** the create-then-login journey and the deactivated-cannot-sign-in journey run as part of that check.
2. **Given** either new journey fails, **When** the check finishes, **Then** the check is reported as failed (merge is not treated as green).
3. **Given** the new journeys are added, **When** the required e2e check runs, **Then** the existing employee-app-shell and service-health smoke checks still run and still pass when those products are healthy.
4. **Given** the create-then-login journey runs twice in a row (or two overlapping runs), **When** each run creates a person, **Then** each run uses a unique email and neither fails because of a duplicate-email conflict from the other run.

---

### Edge Cases

- Email already used by a non-deleted person: the journey MUST generate a unique email per run so this does not fail a healthy product.
- Create form validation failure (missing name, short password, malformed email): the create-then-login journey uses valid input; those cases remain owned by KAN-46 and are not re-specified here.
- Newly created person is an admin rather than an employee: out of scope for this check — KAN-49 requires sign-in to the **employee app**, so the created person MUST be an employee.
- Admin remains signed in when the employee signs in: the journey still signs the admin out first, as specified in KAN-49, even though the two products are separate.
- Deactivated person who never signed in before deactivation: they still cannot complete employee-app sign-in.
- Deactivated person who signed in before deactivation: they cannot complete a new sign-in; leftover-session rejection on the next request is owned by KAN-48 and is not required as a third journey here.
- Employee signs in with mixed-capitalization email: allowed (KAN-46 already requires case-insensitive sign-in); this journey MAY type the email as created and does not need a separate mixed-case case.
- Empty demo organization (no admin): the check MUST have a known admin who can sign in (demo seed); otherwise create-then-login cannot start.
- Employee app still on the login welcome screen after a “successful” create: the journey MUST fail (that is the bug this check exists to catch).
- Restore after deactivate is not part of this check.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The required end-to-end check MUST include an automated create-then-login journey that walks, in order: admin signs into the admin console → admin creates an employee with an initial password from Users → admin signs out → that employee signs into the employee app with the same email and initial password and reaches the authenticated employee app.
- **FR-002**: The person created in that journey MUST be an employee (not an admin). The initial password MUST meet the published create rules (required, at least 8 characters). Create MUST NOT force a password change on first sign-in.
- **FR-003**: Successful employee sign-in MUST mean the person leaves the Hebrew login welcome screen and sees the authenticated employee app. Remaining on login after submitting a valid new account MUST fail the journey.
- **FR-004**: The required end-to-end check MUST include a second automated journey: after an admin deactivates an employee from Users, that person MUST NOT be able to sign into the employee app with their existing password. The employee app MUST show a Hebrew error and MUST NOT show the authenticated home.
- **FR-005**: The two journeys MUST be independently runnable inside the same required check (a failure in one MUST NOT skip the other).
- **FR-006**: Both journeys MUST run as part of the project’s required automated end-to-end check. A failure in either MUST fail that check.
- **FR-007**: Existing smoke checks (employee app shell for an unsigned-in visitor, and service health) MUST continue to run in that same required check.
- **FR-008**: Each create-then-login run MUST use a unique email so reruns and overlapping jobs do not fail on duplicate-email uniqueness.
- **FR-009**: The create step MUST happen on the admin console Users screen (the admin signs in and creates a person the way an operator would). It MUST NOT be replaced by a hidden create that the admin never performs in the console.
- **FR-010**: The employee sign-in step MUST happen on the employee app sign-in screen (Hebrew welcome consistent with the employee mobile login design). It MUST NOT be replaced by a hidden sign-in that never opens the employee app.
- **FR-011**: This feature MUST NOT implement or change create-user, edit-user, reset-password, deactivate/restore, or sign-in product behavior. It only proves those already-delivered behaviors as one required check. Failures MUST indicate a regression in those products, not a new product rule.
- **FR-012**: The journeys MUST have a known admin account that can sign into the console (the demo organization admin). If that admin is missing, the check MUST fail with a clear setup failure rather than hang on the admin sign-in screen.
- **FR-013**: The journeys MUST cover both products used in the chain: the admin console and the employee app. A check that only drives the employee app, or only drives the console, does not satisfy KAN-49.
- **FR-014**: Passwords used in the journeys MUST never be asserted as visible in the Users directory or in any returned person record (same secret rule as create).

### Key Entities

- **Create-then-login journey**: The ordered proof that a person created by an admin can immediately use the employee app with the initial password.
- **Deactivated-cannot-sign-in journey**: The ordered proof that a deactivated employee is refused at employee-app sign-in.
- **Demo admin**: The known administrator in the demo organization who can open Users and create or deactivate people.
- **Created employee**: The new active employee produced by the create-then-login journey, identified by a unique email and an initial password that is never shown again in the directory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of create-then-login runs against a healthy demo organization succeed: the new employee reaches the authenticated employee app on the first try with the initial password, in under 3 minutes from admin sign-in through employee sign-in.
- **SC-002**: 100% of deactivated-cannot-sign-in runs refuse employee-app sign-in for a deactivated employee with the correct password; they never reach the authenticated employee app.
- **SC-003**: A failing create-then-login or deactivated-cannot-sign-in journey fails the required automated end-to-end check 100% of the time in tests (the check is not reported as passed).
- **SC-004**: Two consecutive create-then-login runs on the same demo organization both succeed (unique emails; no duplicate-email false failure).
- **SC-005**: The existing unsigned-in employee-app-shell and service-health smoke checks still run in the same required check and still pass when those products are healthy.
- **SC-006**: A teammate can demonstrate Epic 3 done without manual clicking: create-then-login and deactivated-cannot-sign-in are visible in the required check output.
- **SC-007**: After create-then-login, the admin never sees the initial password again in the Users directory.

## Assumptions

- This work tracks Jira [KAN-49](https://nadav40450.atlassian.net/browse/KAN-49) under Epic [KAN-43](https://nadav40450.atlassian.net/browse/KAN-43). Product behavior is owned by sibling stories: KAN-39 (sign-in), KAN-45 (Users directory), KAN-46 (create user + immediate sign-in), KAN-47 (edit / reset password), KAN-48 (deactivate / restore / instant logout). This feature only adds the required end-to-end proof. Edit, reset-password, restore, and “create an admin who signs into the console” are out of scope.
- [Epic 3 Spec — User Management](https://nadav40450.atlassian.net/wiki/spaces/~7120202b4bf28995db4c44819befd33c3b0321/pages/5570607/Epic+3+Spec+-+User+Management) DoD: “Admin can create a user who can immediately log in (Playwright e2e KAN-49 covers exactly this chain)” and “Deactivation proven by test.” KAN-49’s user-facing proof of deactivation is **cannot sign into the employee app**. Instant logout of an already-open session (next request rejected) remains KAN-48.
- GENERAL_SPEC wins on contradictions: no force-change-on-first-login, password minimum 8 characters, unique email among non-deleted people, admin-only Users, Hebrew RTL employee app and admin console.
- The established automated e2e tool is Playwright (KAN-34). The required check is the existing CI `e2e` job (`pnpm --filter @abra/e2e test`). Implementation may extend that job so the admin console is started alongside the employee app and API, and so the demo organization is seeded (known admin `admin@abra.co`) before the journeys run. Those mechanics belong in `/speckit-plan`.
- Demo seed from KAN-32 is the known admin. Employee-app login success is leaving `/login` (Hebrew “ברוכים הבאים!”) for the authenticated employee home. Admin console Users is `/admin/users`; admin sign-in is `/admin/login`. Ports follow the documented local runtime (employee app 5173, admin console 5174, API 3000) unless overridden.
- Figma file [Time report files](https://www.figma.com/design/3CK80SB84FluVRrWCDlmaw) (`node-id=0-1`) is the employee mobile app only (login welcome “ברוכים הבאים!”, then time-report screens). Epic 3 §3 already notes there are no user-management or admin-console frames. This feature pixel-matches neither the admin Users screen nor a new login invention; employee sign-in success is the existing Hebrew employee-app login, then the authenticated app.
- The deactivated-cannot-sign-in journey deactivates via the Users screen (not a hidden operator flag) so the proof matches how an admin actually deactivates someone. It MAY create its own employee for that purpose so it does not depend on User Story 1 passing.
- Unique emails may use a timestamp or random suffix; they MUST still be valid email addresses.
- Audit logging of user CRUD is out of scope for MVP (Epic 3 §5).
- This feature does not add new Users columns or create-form fields for HR attributes (employee number, role title, worker/manager type, employment percent, org unit).
