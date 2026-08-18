# env-validation Spec Delta

## Purpose

Defines fail-fast environment validation at API boot: misconfiguration must stop the process at startup with an actionable error, never surface as a runtime failure at first request.

## ADDED Requirements

### Requirement: Environment is validated before the application starts

The API SHALL validate its environment variables with a zod schema before the NestJS application is created. On validation failure the process SHALL exit non-zero with an error message naming each offending variable and what was wrong with it.

#### Scenario: Invalid value fails startup clearly

- **WHEN** the API starts with an invalid value (e.g. `PORT=abc`)
- **THEN** the process exits with a non-zero code and the error output names `PORT` and the expected format, and the Nest application never begins listening

#### Scenario: Valid environment boots normally

- **WHEN** all environment variables satisfy the schema
- **THEN** the API starts and serves requests using the parsed, typed values

### Requirement: Optional variables have working defaults

Variables the API can sensibly default (`PORT`, `CORS_ORIGINS`) SHALL be optional with the defaults documented in `.env.example`; variables without a safe default SHALL be required by the schema once code consumes them, and until then SHALL be shape-checked when present (`DATABASE_URL` must be a valid PostgreSQL connection string when set).

#### Scenario: Boot with no env at all

- **WHEN** the API starts with no environment variables set
- **THEN** it boots on port 3000 with the default CORS origins

#### Scenario: Malformed DATABASE_URL is rejected even while unused

- **WHEN** `DATABASE_URL` is set to a non-PostgreSQL-URL value
- **THEN** startup fails naming `DATABASE_URL`, even though no code consumes it yet
