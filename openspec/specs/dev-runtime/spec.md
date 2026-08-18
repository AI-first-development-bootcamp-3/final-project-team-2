# dev-runtime Specification

## Purpose

Defines the one-command containerized development runtime: what `docker compose up --build` must bring up, how the services are wired together, and the environment-file contract every service follows.

## Requirements

### Requirement: One command brings up the whole system

Running `docker compose up --build` from a fresh clone SHALL start all four services — PostgreSQL 16, the API, and both frontend dev servers — with no prerequisite steps other than Docker being installed and `.env` files created from their committed examples.

#### Scenario: Fresh clone cold start

- **WHEN** a teammate clones the repo, copies each `.env.example` to `.env`, and runs `docker compose up --build`
- **THEN** all four containers reach a running state without manual intervention

#### Scenario: Pulled changes are picked up

- **WHEN** a teammate pulls new commits and runs `docker compose up --build`
- **THEN** the images are rebuilt from the pulled source and the running system reflects the new code

### Requirement: PostgreSQL 16 with durable data

The compose stack SHALL run PostgreSQL 16 with its data directory on a named Docker volume, and SHALL expose a healthcheck so dependent services can wait for readiness.

#### Scenario: Data survives restarts

- **WHEN** the stack is stopped with `docker compose down` (without `-v`) and started again
- **THEN** previously written database data is still present

#### Scenario: API waits for a healthy database

- **WHEN** the stack starts from cold
- **THEN** the API container does not start its process until the Postgres healthcheck passes

### Requirement: Services are reachable on documented host ports

Each service SHALL be reachable from the host browser on a fixed, documented port: API on 3000 (routes under the `/api/v1` prefix, health at `/api/v1/health`, Swagger UI at `/docs`), mobile frontend on 5173, admin frontend on 5174, Postgres on 5432. Frontend requests to the API from the browser SHALL succeed (no CORS failures).

#### Scenario: All endpoints respond

- **WHEN** the stack is up
- **THEN** `http://localhost:3000/api/v1/health` (API health), `http://localhost:3000/docs` (Swagger), `http://localhost:5173` (mobile), and `http://localhost:5174` (admin) each respond, and Postgres accepts connections on `localhost:5432`

#### Scenario: Browser can call the API

- **WHEN** either frontend, loaded from its own origin, makes a request to the API
- **THEN** the request is not blocked by CORS

### Requirement: Environment configuration via committed examples

Every service that needs configuration SHALL have a committed `.env.example` listing all required variables with working local-dev defaults; real `.env` files SHALL be git-ignored. The API SHALL take its port and database connection string (`DATABASE_URL`) from the environment rather than hardcoded values.

#### Scenario: Examples are complete

- **WHEN** each `.env.example` is copied to `.env` unmodified
- **THEN** the stack starts and functions with those defaults

#### Scenario: Real env files never committed

- **WHEN** a `.env` file exists in any service directory or the repo root
- **THEN** `git status` does not show it as trackable

### Requirement: One-command run is documented

The README SHALL document the compose workflow as the primary way to run the system locally: prerequisites, the copy-env step, the `docker compose up --build` command, the service URLs (including `/api/v1/health` and `/docs`), and how to reset the database volume. It SHALL also carry the remaining graded run-book sections — deployment URLs and how to run unit and e2e tests — populated where the underlying capability exists and explicitly marked as pending (with the blocking ticket) where it does not.

#### Scenario: README enables a new teammate

- **WHEN** a new teammate follows only the README's run section
- **THEN** they reach a running system without asking for help

#### Scenario: Unshipped sections are honest

- **WHEN** a reader looks up deployment URLs or e2e test instructions before those stories ship
- **THEN** the README shows the section with an explicit pending marker naming the blocking ticket, not an empty gap or an invented value
