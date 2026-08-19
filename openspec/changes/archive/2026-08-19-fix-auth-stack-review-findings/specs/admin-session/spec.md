# admin-session

## Purpose

Defines how the admin console acquires, holds, refreshes, and destroys its authenticated session: the httpOnly refresh cookie is the only durable credential, the access token is held in memory only, and every route in the console is gated on an active admin session.

## ADDED Requirements

### Requirement: Access token is never persisted to web storage

The admin client SHALL hold the access token in memory only. No JWT (access or refresh) is ever written to `localStorage`, `sessionStorage`, IndexedDB, or a non-httpOnly cookie. The only durable credential is the httpOnly refresh cookie issued by the server.

#### Scenario: Storage stays token-free after login

- **WHEN** an admin logs in successfully
- **THEN** the API calls succeed using the in-memory access token, and no key in `localStorage` or `sessionStorage` contains the token

#### Scenario: Script injection cannot read the token

- **WHEN** arbitrary script enumerates web storage after a login
- **THEN** it finds no access or refresh token material

### Requirement: Session bootstraps from the refresh cookie on load

On application load, the admin client SHALL attempt `POST /auth/refresh` (with credentials) before deciding the visitor is logged out. A valid refresh cookie yields a fresh access token and user summary without re-entering credentials; an absent, expired, or revoked cookie resolves to the logged-out state and the login screen.

#### Scenario: Remembered admin survives a browser restart

- **WHEN** an admin who logged in with "remember me" (30-day cookie) reopens the console the next day
- **THEN** the console loads their session via the refresh cookie and lands them on the portal without showing the login form

#### Scenario: Expired cookie degrades to login

- **WHEN** the refresh cookie is missing, expired, or its token version was revoked
- **THEN** the bootstrap resolves to logged-out and the visitor is shown `/login`, with no error banner

### Requirement: 401 responses trigger one refresh-and-retry, then logout

When an authenticated request returns 401, the admin client SHALL attempt one `POST /auth/refresh` and retry the original request with the new token. If the refresh itself fails or the retry returns 401 again, the client SHALL clear the session and route the user to `/login`. The interceptor never loops.

#### Scenario: Expired access token is transparent to the user

- **WHEN** a request fails 401 because the ~15-minute access token expired while the refresh cookie is still valid
- **THEN** the request is retried after a silent refresh and the user sees only the successful result

#### Scenario: Revoked session logs the user out

- **WHEN** a request fails 401 and the follow-up refresh also fails (revoked/expired cookie)
- **THEN** the in-memory session is cleared and the user is redirected to `/login` within the same interaction

### Requirement: Admin console is gated on an active admin session

Every console route except `/login` SHALL require an in-memory session whose user role is `admin`. A session with any other role is rejected: the session is discarded and the visitor lands on `/login`. An authenticated admin visiting `/login` is redirected to the portal.

#### Scenario: Employee credentials cannot enter the console

- **WHEN** a user with role `employee` authenticates successfully against the admin console
- **THEN** no console screen renders and they are returned to `/login` with their session discarded

#### Scenario: Unauthenticated deep link round-trips through login

- **WHEN** a logged-out visitor opens a protected console URL
- **THEN** they are sent to `/login`, and after a successful admin login they land on the URL they originally requested
