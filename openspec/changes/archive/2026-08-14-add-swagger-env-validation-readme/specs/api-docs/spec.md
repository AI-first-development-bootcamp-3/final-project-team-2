# api-docs Spec Delta

## Purpose

Defines the API's interactive OpenAPI documentation: where Swagger is served, what it must document, and how it stays in sync with the actual endpoints.

## ADDED Requirements

### Requirement: Swagger UI is served at /docs

The API SHALL serve interactive Swagger UI at `/docs`, generated from the running application's NestJS decorators (not a hand-maintained file). The spec-mandated development path `/api/v1/docs` SHALL lead to the same documentation.

#### Scenario: Documentation is reachable

- **WHEN** the API is running and a browser opens `http://localhost:3000/docs`
- **THEN** Swagger UI renders the API documentation

#### Scenario: Spec path also works

- **WHEN** a browser opens `/api/v1/docs`
- **THEN** it lands on the same Swagger documentation

### Requirement: Every existing endpoint is documented

The generated documentation SHALL include every registered route with its method, path, and response shape — starting with `GET /api/v1/health` and growing automatically as endpoints are added.

#### Scenario: Health endpoint appears

- **WHEN** Swagger UI loads
- **THEN** it lists `GET /api/v1/health` with its 200 response schema, and invoking it from the UI returns `{"status":"ok"}`
