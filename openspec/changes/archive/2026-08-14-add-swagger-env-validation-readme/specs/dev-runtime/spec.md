# dev-runtime Spec Delta

## MODIFIED Requirements

### Requirement: Services are reachable on documented host ports

Each service SHALL be reachable from the host browser on a fixed, documented port: API on 3000 (routes under the `/api/v1` prefix, health at `/api/v1/health`, Swagger UI at `/docs`), mobile frontend on 5173, admin frontend on 5174, Postgres on 5432. Frontend requests to the API from the browser SHALL succeed (no CORS failures).

#### Scenario: All endpoints respond

- **WHEN** the stack is up
- **THEN** `http://localhost:3000/api/v1/health` (API health), `http://localhost:3000/docs` (Swagger), `http://localhost:5173` (mobile), and `http://localhost:5174` (admin) each respond, and Postgres accepts connections on `localhost:5432`

#### Scenario: Browser can call the API

- **WHEN** either frontend, loaded from its own origin, makes a request to the API
- **THEN** the request is not blocked by CORS

### Requirement: One-command run is documented

The README SHALL document the compose workflow as the primary way to run the system locally: prerequisites, the copy-env step, the `docker compose up --build` command, the service URLs (including `/api/v1/health` and `/docs`), and how to reset the database volume. It SHALL also carry the remaining graded run-book sections — deployment URLs and how to run unit and e2e tests — populated where the underlying capability exists and explicitly marked as pending (with the blocking ticket) where it does not.

#### Scenario: README enables a new teammate

- **WHEN** a new teammate follows only the README's run section
- **THEN** they reach a running system without asking for help

#### Scenario: Unshipped sections are honest

- **WHEN** a reader looks up deployment URLs or e2e test instructions before those stories ship
- **THEN** the README shows the section with an explicit pending marker naming the blocking ticket, not an empty gap or an invented value
