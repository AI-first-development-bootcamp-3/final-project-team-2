# auth Delta Spec

## Purpose

Authenticates every user of the system with email + password and authorizes every API request by role: employees land in the mobile app, admins in the console, and requests without a valid identity are rejected.

## ADDED Requirements

### Requirement: User can log in with email and password

The API SHALL expose `POST /api/v1/auth/login` accepting email, password, and a remember-me flag, validated against the shared contract schemas (VAL-01 email required, VAL-02 valid email format, VAL-03 password required, VAL-04 password min 8 chars). On success it SHALL return an access token in the response body and set a refresh token as an `httpOnly`, `Secure`, `SameSite=Strict` cookie. On failure it SHALL return 401 with a generic error that does not reveal whether the email exists.

#### Scenario: Valid credentials

- **WHEN** a seeded active user posts their correct email and password
- **THEN** the response contains an access token and sets the refresh cookie, and the user's role is embedded in the token

#### Scenario: Wrong password

- **WHEN** a user posts a correct email with a wrong password
- **THEN** the response is 401 with a generic invalid-credentials error and no cookie is set

#### Scenario: Input failing validation is rejected before credential check

- **WHEN** the request body has a malformed email or a password shorter than 8 characters
- **THEN** the response is a validation error naming the offending field, per the contract schemas

### Requirement: Access tokens are short-lived and stateless

Access tokens SHALL be JWTs with approximately 15 minutes expiry, carrying exactly `{ userId, role }` as application payload, verifiable without a database lookup.

#### Scenario: Expired access token

- **WHEN** a request presents an access token past its expiry
- **THEN** the API responds 401 without consulting the database for token state

### Requirement: Refresh token rotates the access token and is revocable

`POST /api/v1/auth/refresh` SHALL issue a new access token when the refresh cookie is valid AND its version claim matches the current `token_version` on the User row. `POST /api/v1/auth/logout` SHALL increment `token_version` and clear the refresh cookie, immediately invalidating all previously issued refresh tokens; password reset and deactivation SHALL have the same revocation effect.

#### Scenario: Valid refresh

- **WHEN** a client with a valid refresh cookie calls refresh
- **THEN** it receives a new access token

#### Scenario: Refresh after logout

- **WHEN** a client calls refresh with a cookie issued before that user's logout
- **THEN** the response is 401 and no token is issued

#### Scenario: Missing or malformed cookie

- **WHEN** refresh is called without a refresh cookie or with a tampered one
- **THEN** the response is 401

### Requirement: Remember-me controls refresh token lifetime

The refresh token SHALL live 1 day when remember-me is unchecked and 30 days when checked. The duration SHALL be enforced server-side in both the cookie `Max-Age` and the token's own expiry claim, so a client-edited cookie cannot extend a session.

#### Scenario: Unchecked remember-me expires after 1 day

- **WHEN** a user logs in without remember-me and presents the refresh token after 1 day
- **THEN** refresh is rejected with 401 even if the cookie itself was preserved

#### Scenario: Checked remember-me survives up to 30 days

- **WHEN** a user logs in with remember-me and presents the refresh token within 30 days
- **THEN** refresh succeeds

### Requirement: Every API route is protected by default with role-based access

All API routes SHALL require a valid access token except login, refresh, and the health endpoint, which are explicitly public (health remains unauthenticated so CI, container healthchecks, and deploy smoke tests keep working; agreed 17 Aug 2026, recorded on KAN-41). Admin-console routes SHALL require the ADMIN role; employee-app routes SHALL accept EMPLOYEE and ADMIN (ADR-26: an admin keeps all regular-user abilities). Requests without a valid token SHALL get 401; authenticated requests with an insufficient role SHALL get 403.

#### Scenario: Health stays reachable without a token

- **WHEN** a request without a token hits the health endpoint
- **THEN** it is served normally

#### Scenario: No token on a protected route

- **WHEN** a request without a token hits any non-public route
- **THEN** the response is 401

#### Scenario: Employee token on an admin route

- **WHEN** a request with a valid EMPLOYEE token hits an admin-console route
- **THEN** the response is 403

#### Scenario: Admin token on an employee route

- **WHEN** a request with a valid ADMIN token hits an employee-app route
- **THEN** the request is served

### Requirement: Deactivated users are rejected on every request

The API SHALL check `is_active` on every authenticated request and on refresh; a deactivated user SHALL be rejected even while holding a not-yet-expired access token.

#### Scenario: Deactivation takes effect on next request

- **WHEN** a user is deactivated and then makes any authenticated request or a refresh attempt with previously valid tokens
- **THEN** the response is 401 and no new tokens are issued

### Requirement: Unauthenticated app users are redirected to login

The frontends SHALL redirect to the login screen with a friendly Hebrew message when a session is expired or invalid, and SHALL make protected routes unreachable when logged out.

#### Scenario: Expired session in the app

- **WHEN** an app user's tokens can no longer be refreshed and they navigate to a protected route
- **THEN** they land on the login screen with a Hebrew explanation instead of a broken page

### Requirement: Admin can log in from the management portal

The admin web portal SHALL present a login screen with email, password, and remember-me fields, validated client-side with the same shared contract schemas and Hebrew validation messages as the mobile app, submitting to the login endpoint. On success the admin lands on the portal home; on failure the generic Hebrew error is shown and the admin stays on the login screen.

#### Scenario: Admin logs in successfully

- **WHEN** a seeded admin submits correct credentials on the portal login screen
- **THEN** they land on the portal home with an authenticated session

#### Scenario: Admin login with wrong password

- **WHEN** an admin submits a wrong password
- **THEN** the generic Hebrew error is shown and the portal stays on the login screen

#### Scenario: Client-side validation reuses shared messages

- **WHEN** the admin submits a malformed email or a password under 8 characters
- **THEN** the field-level Hebrew message from the shared contract validation map is shown without calling the API

### Requirement: Login flow is verified end-to-end

The login flow SHALL be covered by a Playwright e2e spec that runs in CI as part of the required e2e check, using seeded credentials.

#### Scenario: Successful e2e login

- **WHEN** the e2e spec logs in a seeded employee with valid credentials
- **THEN** the browser lands on the daily-report home

#### Scenario: Failed e2e login

- **WHEN** the e2e spec submits a wrong password
- **THEN** a Hebrew error message is shown and the browser stays on the login screen
