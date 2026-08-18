# env-validation Delta Spec

## ADDED Requirements

### Requirement: Auth secrets are required

The env schema SHALL require `JWT_SECRET` and `JWT_REFRESH_SECRET` as non-empty strings with no default; startup SHALL fail naming the missing variable. Secret values SHALL live only in deployment configuration (Vercel env vars / GitHub Actions secrets) and `.env` files excluded from git; `.env.example` SHALL list both with placeholder values.

#### Scenario: Missing JWT secret fails startup

- **WHEN** the API starts without `JWT_SECRET` or `JWT_REFRESH_SECRET`
- **THEN** the process exits non-zero and the error names the missing variable

#### Scenario: Secrets present boots normally

- **WHEN** both secrets are set to non-empty values
- **THEN** the API boots and signs/verifies tokens with them
