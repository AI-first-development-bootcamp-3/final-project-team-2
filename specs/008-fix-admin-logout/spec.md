# Feature Specification: Fix Admin Logout Relogin

**Feature Branch**: `008-fix-admin-logout`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Jira KAN-116 (Bug). When you log out from admin you instantly login inside again. Fix it."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin signs out and stays signed out (Priority: P1)

An administrator working in the admin console chooses Logout. They leave the authenticated console and land on the admin sign-in screen. They stay signed out. The console does not immediately treat them as signed in again, and they do not bounce back into an authenticated page without entering credentials.

**Why this priority**: This is the reported defect. A logout control that does not end the session is a security and trust failure; operators cannot switch accounts or leave a shared machine safely.

**Independent Test**: Sign in as an admin, open any authenticated console page, choose Logout, and confirm the sign-in screen remains visible with no automatic return to the console.

**Acceptance Scenarios**:

1. **Given** an admin is signed in to the admin console, **When** they choose Logout, **Then** they are taken to the admin sign-in screen.
2. **Given** the admin just chose Logout, **When** they wait on the sign-in screen without entering credentials, **Then** they remain on the sign-in screen and are not treated as signed in.
3. **Given** the admin just chose Logout, **When** they try to open a previously authenticated console page (Users, Clients, or another catalog), **Then** they see the sign-in screen instead of that page’s authenticated content.
4. **Given** the admin just chose Logout, **When** they reload the sign-in screen, **Then** they still see the sign-in screen and are not signed back in.

---

### User Story 2 - Signed-out admin can sign in again on purpose (Priority: P1)

After a successful logout, the same administrator can sign in again by entering valid credentials. Intentional sign-in still works; only automatic re-entry is forbidden.

**Why this priority**: Fixing logout must not strand admins. The console remains usable after the session is ended.

**Independent Test**: After User Story 1, enter the same valid admin email and password on the sign-in screen and confirm the authenticated console appears.

**Acceptance Scenarios**:

1. **Given** an admin has just signed out and is on the sign-in screen, **When** they submit valid credentials, **Then** they reach the authenticated console.
2. **Given** an admin has just signed out, **When** they submit invalid credentials, **Then** they remain signed out and see a sign-in failure (they are not silently admitted).

---

### User Story 3 - Explicit logout overrides a remembered session (Priority: P2)

An administrator who originally signed in with “remember me” (or an equivalent stay-signed-in choice) still ends that session when they choose Logout. Remembering a session must not bring them back in after an explicit logout.

**Why this priority**: The bug is most harmful if a long-lived remembered session immediately restores access after Logout. Shorter sessions that auto-restore are the same defect; remembered sessions are the highest-risk variant.

**Independent Test**: Sign in as an admin with remember-me enabled, choose Logout, and confirm the sign-in screen stays up and a later visit to an authenticated page still requires credentials.

**Acceptance Scenarios**:

1. **Given** an admin signed in with remember-me enabled, **When** they choose Logout, **Then** they land on the sign-in screen and stay signed out.
2. **Given** that logout, **When** they later open an authenticated console page in the same browser without signing in again, **Then** they see the sign-in screen, not authenticated content.

---

### Edge Cases

- Rapid double-click (or repeated activation) of Logout: the admin still ends on the sign-in screen and stays signed out; they are not signed back in.
- Logout while a console page is still loading data: the admin still ends on the sign-in screen; in-flight work does not restore a signed-in view.
- Browser back after logout: returning to a previous authenticated page does not show protected content; the admin is treated as signed out.
- Bookmark or typed address of an authenticated page after logout: the admin is sent to the sign-in screen.
- Already on the sign-in screen: choosing Logout (if the control is still reachable) does not sign the admin in.
- Shared or public computer: after Logout, a different person using the same browser does not inherit the previous admin’s session.
- Employee app sign-out: out of scope for this bug; this feature covers the admin console only.
- Forced logout from deactivation or password reset (existing product rules): unchanged; this feature only fixes explicit Logout from the console.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: When a signed-in admin chooses Logout in the admin console, the product MUST end that admin’s console session immediately.
- **FR-002**: After Logout, the product MUST show the admin sign-in screen and MUST NOT automatically admit the same admin without a new successful sign-in.
- **FR-003**: After Logout, any attempt to open an authenticated admin console page MUST show the sign-in screen instead of protected content.
- **FR-004**: After Logout, reloading the sign-in screen or returning via browser history MUST keep the admin signed out.
- **FR-005**: After Logout, the same admin MUST be able to sign in again by submitting valid credentials.
- **FR-006**: Explicit Logout MUST end the console session even if the admin originally signed in with remember-me (or an equivalent stay-signed-in choice).
- **FR-007**: After Logout, a later visitor using the same browser MUST NOT inherit the previous admin’s authenticated console session.

### Key Entities

- **Admin console session**: The signed-in state that lets an administrator see and use protected console pages.
- **Logout**: The operator’s explicit choice to end the current admin console session.
- **Admin sign-in screen**: The unauthenticated screen where an administrator must enter credentials to start a new session.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of tested logout attempts from a signed-in admin console, the operator reaches the sign-in screen and is not treated as signed in.
- **SC-002**: After Logout, 100% of tested waits of at least 10 seconds on the sign-in screen (no credentials entered) leave the operator signed out — no automatic return to the console.
- **SC-003**: After Logout, 100% of tested visits to previously authenticated console pages (including reload and browser-back) show the sign-in screen instead of protected content.
- **SC-004**: After Logout, 100% of tested sign-ins with valid credentials reach the authenticated console within 30 seconds.
- **SC-005**: After Logout from a remember-me sign-in, 100% of tested later visits to an authenticated console page in the same browser still require credentials.
- **SC-006**: A teammate can demonstrate the KAN-116 fix without guessing: Logout from the console ends the session and stays ended until the next successful sign-in.

## Assumptions

- This work tracks Jira [KAN-116](https://nadav40450.atlassian.net/browse/KAN-116). The ticket summary is the defect: “when you log out from admin you instantly login inside again.” There is no longer description; the expected outcome is inferred from existing admin-console logout rules and this bug report.
- Scope is the **admin console** only. Employee-app sign-out is unchanged unless the same defect is later reported there.
- Existing product intent (admin shell): the console already has a Logout control that must clear the session and send the operator to the admin sign-in screen. This feature does not add a new Logout control; it makes that existing action actually end the session.
- Existing product intent (authentication): an explicit logout ends the session so a later refresh cannot restore access without a new sign-in. Remember-me extends an _uninterrupted_ session; it does not override Logout.
- A new sign-in after Logout is a deliberate operator action with valid credentials, not an automatic restore of the previous session.
- Hebrew RTL admin console copy and the existing sidebar Logout placement stay as they are unless a label change is required to complete the flow.
- Demo administrators used in checks (for example the seeded admin) are sufficient to reproduce and prove the fix.
- Multi-device logout (ending sessions on a different computer) is already specified by authentication product rules and is not the reported bug; this feature’s proof is the same-browser console flow in KAN-116.
- Implementation details (tokens, cookies, client storage, routing guards) belong in `/speckit-plan`, not in this specification.
