# env-validation Specification

## Purpose

Defines fail-fast environment validation at API boot: misconfiguration must stop the process at startup with an actionable error, never surface as a runtime failure at first request.

## Requirements

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

### Requirement: Auth secrets are required

The env schema SHALL require `JWT_SECRET` and `JWT_REFRESH_SECRET` as non-empty strings with no default; startup SHALL fail naming the missing variable. Secret values SHALL live only in deployment configuration (Vercel env vars / GitHub Actions secrets) and `.env` files excluded from git; `.env.example` SHALL list both with placeholder values.

#### Scenario: Missing JWT secret fails startup

- **WHEN** the API starts without `JWT_SECRET` or `JWT_REFRESH_SECRET`
- **THEN** the process exits non-zero and the error names the missing variable

#### Scenario: Secrets present boots normally

- **WHEN** both secrets are set to non-empty values
- **THEN** the API boots and signs/verifies tokens with them
